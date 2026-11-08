import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, enqueue, type LocalGroceryPreset, type LocalWeeklyPlan } from "../../lib/db";

vi.mock("../../lib/sync/rpc", async () => {
  const actual = await vi.importActual<typeof import("../../lib/sync/rpc")>("../../lib/sync/rpc");
  return {
    ...actual,
    pushOp: vi.fn(),
    pushGroceryItems: vi.fn(),
    pullChanges: vi.fn(),
    refetchGroceryPreset: vi.fn(),
    refetchWeeklyPlan: vi.fn(),
  };
});

vi.mock("../../lib/stores/household.svelte", () => ({
  refreshHousehold: vi.fn().mockResolvedValue(undefined),
}));

const rpc = await import("../../lib/sync/rpc");
const { sync } = await import("../../lib/sync/engine");
const { syncStatus } = await import("../../lib/sync/status.svelte");

const pushOp = vi.mocked(rpc.pushOp);
const pullChanges = vi.mocked(rpc.pullChanges);
const refetchGroceryPreset = vi.mocked(rpc.refetchGroceryPreset);
const refetchWeeklyPlan = vi.mocked(rpc.refetchWeeklyPlan);

const emptyPull = {
  watermark: "2026-01-01T00:00:00.000Z",
  meals: [],
  weekly_plans: [],
  grocery_presets: [],
  grocery_items: [],
  meal_ideas: [],
};
const T = "2026-01-01T00:00:00.000Z";

describe("costco sync", () => {
  beforeEach(async () => {
    await Promise.all([
      db.groceryPresets.clear(),
      db.weeklyPlans.clear(),
      db.groceryItems.clear(),
      db.syncQueue.clear(),
      db.meta.clear(),
    ]);
    vi.clearAllMocks();
    syncStatus.online = true;
    pullChanges.mockResolvedValue(emptyPull);
  });

  it("a pulled week, preset and item carry the Costco fields into Dexie", async () => {
    pullChanges.mockResolvedValueOnce({
      ...emptyPull,
      weekly_plans: [
        { id: "w", week_start: "2026-01-03", dismissed_ingredient_names: [], day_plans: [], preset_ids: [], costco_enabled: true, version: 1, updated_at: T, deleted_at: null },
      ],
      grocery_presets: [{ id: "p", name: "Costco", items: [], is_costco: true, version: 1, updated_at: T, deleted_at: null }],
      grocery_items: [
        { id: "i", weekly_plan_id: "w", name: "Towels", quantity: "1", category: "aisle", checked: false, to_verify: false, is_costco: true, version: 1, updated_at: T, deleted_at: null },
      ],
    });

    await sync();

    expect((await db.weeklyPlans.get("w"))?.costcoEnabled).toBe(true);
    expect((await db.groceryPresets.get("p"))?.isCostco).toBe(true);
    expect((await db.groceryItems.get("i"))?.isCostco).toBe(true);
  });

  it("a pull from a server without the columns defaults to false", async () => {
    pullChanges.mockResolvedValueOnce({
      ...emptyPull,
      weekly_plans: [{ id: "w", week_start: "2026-01-03", dismissed_ingredient_names: [], day_plans: [], preset_ids: [], version: 1, updated_at: T, deleted_at: null }],
    });
    await sync();
    expect((await db.weeklyPlans.get("w"))?.costcoEnabled).toBe(false);
  });

  it("week-collision merge ORs costcoEnabled so an enabled section is never switched off", async () => {
    const local: LocalWeeklyPlan = {
      id: "local-w", weekStart: "2026-01-03", plan: {}, dismissedNames: [], presetIds: [], costcoEnabled: true,
      version: 1, updatedAt: T, deletedAt: null,
    };
    await db.weeklyPlans.put(local);
    await enqueue("weeklyPlan", "local-w", "upsert", null, local);

    // Server's canonical row for the week has Costco off.
    pushOp.mockResolvedValueOnce({ status: "conflict", id: "canon-w", version: 4 });
    refetchWeeklyPlan.mockResolvedValueOnce({
      id: "canon-w", week_start: "2026-01-03", dismissed_ingredient_names: [], day_plans: [], preset_ids: [], costco_enabled: false,
      version: 4, updated_at: T, deleted_at: null,
    });

    await sync();

    expect((await db.weeklyPlans.get("canon-w"))?.costcoEnabled).toBe(true);
    expect(await db.weeklyPlans.get("local-w")).toBeUndefined();
    const requeued = await db.syncQueue.toArray();
    expect(requeued.some((q) => q.entity === "weeklyPlan" && q.entityId === "canon-w")).toBe(true);
  });

  it("Costco-list collision adopts the canonical preset, drops the stale local one and keeps our items", async () => {
    const local: LocalGroceryPreset = {
      id: "local-p", name: "Costco", isCostco: true,
      items: [{ name: "Eggs", quantity: "24", category: "fridge" }, { name: "Towels", quantity: "1", category: "aisle" }],
      version: 1, updatedAt: T, deletedAt: null,
    };
    await db.groceryPresets.put(local);
    await enqueue("groceryPreset", "local-p", "upsert", null, local);

    pushOp.mockResolvedValueOnce({ status: "conflict", id: "canon-p", version: 3 });
    refetchGroceryPreset.mockResolvedValueOnce({
      id: "canon-p", name: "Costco", is_costco: true, items: [{ name: "Eggs", quantity: "12", category: "fridge" }],
      version: 3, updated_at: T, deleted_at: null,
    });

    await sync();

    expect(await db.groceryPresets.get("local-p")).toBeUndefined();
    const canon = await db.groceryPresets.get("canon-p");
    expect(canon?.isCostco).toBe(true);
    expect(canon?.items.map((i) => i.name).sort()).toEqual(["Eggs", "Towels"]);
    expect(canon?.items.find((i) => i.name === "Eggs")?.quantity).toBe("12");
    expect((await db.syncQueue.toArray()).some((q) => q.entity === "groceryPreset" && q.entityId === "canon-p")).toBe(true);
  });
});
