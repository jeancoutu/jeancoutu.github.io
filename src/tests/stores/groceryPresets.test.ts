import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GroceryPreset } from "../../lib/types";

const mockGetByWeek = vi.fn();
const mockSetPresetActive = vi.fn();

vi.mock("../../lib/repos/weeklyPlanRepo", () => ({
  weeklyPlanRepo: {
    getByWeek: (...args: unknown[]) => mockGetByWeek(...args),
    setPresetActive: (...args: unknown[]) => mockSetPresetActive(...args),
    getOrCreate: vi.fn(),
    save: vi.fn(),
    setPlan: vi.fn(),
    getMealIds: vi.fn().mockResolvedValue(new Set()),
    clearPlan: vi.fn(),
    dismissIngredient: vi.fn(),
    undismissIngredient: vi.fn(),
  },
}));

const mockApplyAdjustments = vi.fn();

vi.mock("../../lib/repos/groceryItemRepo", () => ({
  groceryItemRepo: {
    applyAdjustments: (...args: unknown[]) => mockApplyAdjustments(...args),
    getForPlan: vi.fn().mockResolvedValue([]),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    replaceAll: vi.fn(),
  },
}));

vi.mock("../../lib/repos/groceryPresetRepo", () => ({
  groceryPresetRepo: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((payload) =>
      Promise.resolve({ id: "p-new", ...payload }),
    ),
    update: vi.fn().mockImplementation((id, payload) =>
      Promise.resolve({ id, ...payload }),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../lib/repos/mealRepo", () => ({
  mealRepo: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("groceryPresets store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetByWeek.mockResolvedValue(undefined);
    mockSetPresetActive.mockImplementation(async (weekStart: string, presetId: string, active: boolean) => ({
      id: "plan-1",
      weekStart,
      plan: {},
      dismissedNames: [],
      presetIds: active ? [presetId] : [],
    }));
    mockApplyAdjustments.mockResolvedValue([]);
  });

  async function importStore() {
    const { weeklyPlan } = await import("../../lib/stores/weeklyPlan.svelte");
    const { groceryPresetRepo } = await import("../../lib/repos/groceryPresetRepo");
    const {
      groceryPresets,
      addPreset,
      updatePresetById,
      deletePresetById,
      getPresetById,
      togglePresetForWeek,
    } = await import("../../lib/stores/groceryPresets.svelte");
    return {
      weeklyPlan,
      groceryPresets,
      addPreset,
      updatePresetById,
      deletePresetById,
      getPresetById,
      togglePresetForWeek,
      groceryPresetRepo,
    };
  }

  it("starts with no presets and no active ids", async () => {
    const { groceryPresets } = await importStore();
    expect(groceryPresets.all).toEqual([]);
    expect(groceryPresets.activeForWeek.size).toBe(0);
  });

  it("addPreset creates via the repo and adds it to the store", async () => {
    const { groceryPresets, addPreset, groceryPresetRepo } = await importStore();
    const preset: GroceryPreset = await addPreset({ name: "  Pantry  ", items: [] });
    expect(preset.name).toBe("Pantry");
    expect(groceryPresets.all).toHaveLength(1);
    expect(groceryPresetRepo.create).toHaveBeenCalledWith({ name: "Pantry", items: [] });
  });

  it("addPreset trims item fields and defaults blank quantities to '1'", async () => {
    const { addPreset, groceryPresetRepo } = await importStore();
    await addPreset({
      name: "Pantry",
      items: [{ name: " Riz ", quantity: "  ", category: "aisle" }],
    });
    expect(groceryPresetRepo.create).toHaveBeenCalledWith({
      name: "Pantry",
      items: [{ name: "Riz", quantity: "1", category: "aisle" }],
    });
  });

  it("updatePresetById updates via the repo and replaces the stored preset", async () => {
    const { groceryPresets, addPreset, updatePresetById } = await importStore();
    const preset = await addPreset({ name: "Pantry", items: [] });
    await updatePresetById(preset.id, {
      name: "Pantry v2",
      items: [{ name: "Riz", quantity: "1 kg", category: "aisle" }],
    });
    expect(groceryPresets.all[0]!.name).toBe("Pantry v2");
    expect(groceryPresets.all[0]!.items).toHaveLength(1);
  });

  it("deletePresetById removes the preset and its active-week entries", async () => {
    const { groceryPresets, addPreset, deletePresetById, togglePresetForWeek, groceryPresetRepo } =
      await importStore();
    const preset = await addPreset({ name: "Pantry", items: [] });
    await togglePresetForWeek(preset.id);
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(true);

    await deletePresetById(preset.id);
    expect(groceryPresets.all).toHaveLength(0);
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(false);
    expect(groceryPresetRepo.delete).toHaveBeenCalledWith(preset.id);
  });

  it("getPresetById finds a preset", async () => {
    const { addPreset, getPresetById } = await importStore();
    const preset = await addPreset({ name: "Pantry", items: [] });
    expect(getPresetById(preset.id)?.name).toBe("Pantry");
    expect(getPresetById("nope")).toBeUndefined();
  });

  it("togglePresetForWeek activates an inactive preset with its items", async () => {
    const { weeklyPlan, addPreset, togglePresetForWeek, groceryPresets } = await importStore();
    const preset = await addPreset({
      name: "Pantry",
      items: [{ name: "Riz", quantity: "1 kg", category: "aisle" }],
    });

    await togglePresetForWeek(preset.id);

    expect(mockSetPresetActive).toHaveBeenCalledWith(weeklyPlan.selectedWeek, preset.id, true);
    expect(mockApplyAdjustments).toHaveBeenCalledWith(
      "plan-1",
      [{ name: "Riz", category: "aisle", addQuantities: ["1 kg"], removeQuantities: [] }],
    );
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(true);
  });

  it("togglePresetForWeek deactivates an active preset", async () => {
    const { weeklyPlan, addPreset, togglePresetForWeek, groceryPresets } = await importStore();
    const preset = await addPreset({ name: "Pantry", items: [] });

    await togglePresetForWeek(preset.id);
    await togglePresetForWeek(preset.id);

    expect(mockSetPresetActive).toHaveBeenLastCalledWith(weeklyPlan.selectedWeek, preset.id, false);
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(false);
  });

  it("togglePresetForWeek does nothing for an unknown preset", async () => {
    const { togglePresetForWeek } = await importStore();
    await togglePresetForWeek("nope");
    expect(mockSetPresetActive).not.toHaveBeenCalled();
  });

  it("togglePresetForWeek updates the grocery list with returned items", async () => {
    const { weeklyPlan, addPreset, togglePresetForWeek } = await importStore();
    const { groceryList } = await import("../../lib/stores/groceryList.svelte");
    const preset = await addPreset({
      name: "Pantry",
      items: [{ name: "Riz", quantity: "1 kg", category: "aisle" }],
    });
    mockApplyAdjustments.mockResolvedValue([
      { id: "g1", name: "Riz", quantity: "1 kg", category: "aisle", checked: false },
    ]);

    await togglePresetForWeek(preset.id);

    expect(groceryList.itemsByWeek[weeklyPlan.selectedWeek]).toEqual([
      { id: "g1", name: "Riz", quantity: "1 kg", category: "aisle", checked: false },
    ]);
  });
});
