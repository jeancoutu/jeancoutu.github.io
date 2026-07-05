import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GroceryAdjustment } from "../../lib/utils/groceryList";

// Chainable Supabase query-builder mock. Each call to supabase.from() returns
// a builder whose terminal result is looked up from `responses` by table+method.
type MockResponse = { data?: unknown; error?: unknown };

const responses = new Map<string, MockResponse>();
const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

function makeBuilder(table: string) {
  let method = "";
  const record = (name: string, args: unknown[]) => {
    if (["select", "insert", "update", "delete", "upsert"].includes(name)) {
      method = method || name;
      calls.push({ table, method: name, args });
    }
  };
  const result = () => responses.get(`${table}.${method}`) ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const name of ["select", "insert", "update", "delete", "eq", "order", "maybeSingle", "single"]) {
    builder[name] = (...args: unknown[]) => {
      record(name, args);
      return builder;
    };
  }
  builder.then = (resolve: (value: MockResponse) => unknown) => resolve(result());
  return builder;
}

vi.mock("../../lib/supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

const mockGetOrCreateWeeklyPlanId = vi.fn<(weekStart: string) => Promise<string>>();
vi.mock("../../lib/api/plan", () => ({
  getOrCreateWeeklyPlanId: (weekStart: string) => mockGetOrCreateWeeklyPlanId(weekStart),
}));

const mockApplyGroceryAdjustments = vi.fn();
vi.mock("../../lib/api/groceryList", () => ({
  applyGroceryAdjustments: (...args: unknown[]) => mockApplyGroceryAdjustments(...args),
}));

import {
  activatePreset,
  createGroceryPreset,
  deactivatePreset,
  deleteGroceryPreset,
  getActivePresetIds,
  getGroceryPresets,
  updateGroceryPreset,
} from "../../lib/api/groceryPresets";

describe("groceryPresets API", () => {
  beforeEach(() => {
    responses.clear();
    calls.length = 0;
    vi.clearAllMocks();
    mockGetOrCreateWeeklyPlanId.mockResolvedValue("wp-1");
    mockApplyGroceryAdjustments.mockResolvedValue(null);
  });

  it("getGroceryPresets maps joined rows to presets", async () => {
    responses.set("grocery_presets.select", {
      data: [
        {
          id: "p1",
          name: "Pantry",
          grocery_preset_items: [{ name: "Riz", quantity: "1 kg", category: "aisle" }],
        },
      ],
      error: null,
    });

    const presets = await getGroceryPresets();

    expect(presets).toEqual([
      { id: "p1", name: "Pantry", items: [{ name: "Riz", quantity: "1 kg", category: "aisle" }] },
    ]);
  });

  it("createGroceryPreset inserts the preset then its items", async () => {
    responses.set("grocery_presets.insert", { data: { id: "p9" }, error: null });

    const preset = await createGroceryPreset({
      name: "BBQ",
      items: [{ name: "Saucisses", quantity: "12", category: "meat" }],
    });

    expect(preset.id).toBe("p9");
    const itemInsert = calls.find((c) => c.table === "grocery_preset_items" && c.method === "insert");
    expect(itemInsert?.args[0]).toEqual([
      { preset_id: "p9", name: "Saucisses", quantity: "12", category: "meat" },
    ]);
  });

  it("createGroceryPreset skips item insert when there are no items", async () => {
    responses.set("grocery_presets.insert", { data: { id: "p9" }, error: null });

    await createGroceryPreset({ name: "Empty", items: [] });

    expect(calls.some((c) => c.table === "grocery_preset_items")).toBe(false);
  });

  it("updateGroceryPreset replaces items via delete + insert", async () => {
    await updateGroceryPreset("p1", {
      name: "Pantry v2",
      items: [{ name: "Farine", quantity: "1 kg", category: "aisle" }],
    });

    const methods = calls
      .filter((c) => c.table === "grocery_preset_items")
      .map((c) => c.method);
    expect(methods).toEqual(["delete", "insert"]);
    expect(calls.find((c) => c.table === "grocery_presets" && c.method === "update")?.args[0]).toEqual({
      name: "Pantry v2",
    });
  });

  it("deleteGroceryPreset deletes by id", async () => {
    await deleteGroceryPreset("p1");
    expect(calls).toEqual([{ table: "grocery_presets", method: "delete", args: [] }]);
  });

  it("getActivePresetIds returns [] when the week has no plan", async () => {
    responses.set("weekly_plans.select", { data: null, error: null });
    expect(await getActivePresetIds("2026-W27")).toEqual([]);
  });

  it("getActivePresetIds reads join rows for the week's plan", async () => {
    responses.set("weekly_plans.select", { data: { id: "wp-1" }, error: null });
    responses.set("weekly_plan_grocery_presets.select", {
      data: [{ preset_id: "p1" }, { preset_id: "p2" }],
      error: null,
    });

    expect(await getActivePresetIds("2026-W27")).toEqual(["p1", "p2"]);
  });

  it("activatePreset inserts the join row and merges items additively", async () => {
    const items = [{ name: "Riz", quantity: "1 kg", category: "aisle" as const }];

    await activatePreset("2026-W27", "p1", items);

    expect(mockGetOrCreateWeeklyPlanId).toHaveBeenCalledWith("2026-W27");
    const joinInsert = calls.find(
      (c) => c.table === "weekly_plan_grocery_presets" && c.method === "insert",
    );
    expect(joinInsert?.args[0]).toEqual({ weekly_plan_id: "wp-1", preset_id: "p1" });

    const adjustments = mockApplyGroceryAdjustments.mock.calls[0]![1] as GroceryAdjustment[];
    expect(adjustments).toEqual([
      { name: "Riz", category: "aisle", addQuantities: ["1 kg"], removeQuantities: [] },
    ]);
    expect(mockApplyGroceryAdjustments).toHaveBeenCalledWith("2026-W27", adjustments, "wp-1");
  });

  it("deactivatePreset deletes the join row and subtracts items", async () => {
    const items = [{ name: "Riz", quantity: "1 kg", category: "aisle" as const }];

    await deactivatePreset("2026-W27", "p1", items);

    const joinDelete = calls.find(
      (c) => c.table === "weekly_plan_grocery_presets" && c.method === "delete",
    );
    expect(joinDelete).toBeDefined();

    const adjustments = mockApplyGroceryAdjustments.mock.calls[0]![1] as GroceryAdjustment[];
    expect(adjustments).toEqual([
      { name: "Riz", category: "aisle", addQuantities: [], removeQuantities: ["1 kg"] },
    ]);
  });

  it("propagates API errors", async () => {
    responses.set("grocery_presets.select", { data: null, error: new Error("boom") });
    await expect(getGroceryPresets()).rejects.toThrow("boom");
  });
});
