import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GroceryPreset } from "../../lib/types";

const mockGetGroceryPresets = vi.fn<() => Promise<GroceryPreset[]>>();
const mockCreateGroceryPreset = vi.fn<(input: Omit<GroceryPreset, "id">) => Promise<GroceryPreset>>();
const mockUpdateGroceryPreset = vi.fn<(id: string, input: Omit<GroceryPreset, "id">) => Promise<GroceryPreset>>();
const mockDeleteGroceryPreset = vi.fn<(id: string) => Promise<void>>();
const mockGetActivePresetIds = vi.fn<(weekStart: string) => Promise<string[]>>();
const mockActivatePreset = vi.fn();
const mockDeactivatePreset = vi.fn();

vi.mock("../../lib/api/groceryPresets", () => ({
  getGroceryPresets: () => mockGetGroceryPresets(),
  createGroceryPreset: (input: Omit<GroceryPreset, "id">) => mockCreateGroceryPreset(input),
  updateGroceryPreset: (id: string, input: Omit<GroceryPreset, "id">) => mockUpdateGroceryPreset(id, input),
  deleteGroceryPreset: (id: string) => mockDeleteGroceryPreset(id),
  getActivePresetIds: (weekStart: string) => mockGetActivePresetIds(weekStart),
  activatePreset: (...args: unknown[]) => mockActivatePreset(...args),
  deactivatePreset: (...args: unknown[]) => mockDeactivatePreset(...args),
}));

describe("groceryPresets store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetGroceryPresets.mockResolvedValue([]);
    mockCreateGroceryPreset.mockImplementation(async (input) => ({ id: "p-new", ...input }));
    mockUpdateGroceryPreset.mockImplementation(async (id, input) => ({ id, ...input }));
    mockDeleteGroceryPreset.mockResolvedValue(undefined);
    mockGetActivePresetIds.mockResolvedValue([]);
    mockActivatePreset.mockResolvedValue(null);
    mockDeactivatePreset.mockResolvedValue(null);
  });

  async function importStore() {
    const { weeklyPlan } = await import("../../lib/stores/weeklyPlan.svelte");
    const {
      groceryPresets,
      addPreset,
      updatePresetById,
      deletePresetById,
      getPresetById,
      togglePresetForWeek,
    } = await import("../../lib/stores/groceryPresets.svelte");
    return { weeklyPlan, groceryPresets, addPreset, updatePresetById, deletePresetById, getPresetById, togglePresetForWeek };
  }

  it("starts with no presets and no active ids", async () => {
    const { groceryPresets } = await importStore();
    expect(groceryPresets.all).toEqual([]);
    expect(groceryPresets.activeForWeek.size).toBe(0);
  });

  it("addPreset creates via API and adds it to the store", async () => {
    const { groceryPresets, addPreset } = await importStore();
    const preset = await addPreset({ name: "  Pantry  ", items: [] });
    expect(preset.name).toBe("Pantry");
    expect(groceryPresets.all).toHaveLength(1);
    expect(mockCreateGroceryPreset).toHaveBeenCalledWith({ name: "Pantry", items: [] });
  });

  it("addPreset trims item fields and defaults blank quantities to '1'", async () => {
    const { addPreset } = await importStore();
    await addPreset({
      name: "Pantry",
      items: [{ name: " Riz ", quantity: "  ", category: "aisle" }],
    });
    expect(mockCreateGroceryPreset).toHaveBeenCalledWith({
      name: "Pantry",
      items: [{ name: "Riz", quantity: "1", category: "aisle" }],
    });
  });

  it("updatePresetById updates via API and replaces the stored preset", async () => {
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
    const { groceryPresets, addPreset, deletePresetById, togglePresetForWeek } = await importStore();
    const preset = await addPreset({ name: "Pantry", items: [] });
    await togglePresetForWeek(preset.id);
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(true);

    await deletePresetById(preset.id);
    expect(groceryPresets.all).toHaveLength(0);
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(false);
    expect(mockDeleteGroceryPreset).toHaveBeenCalledWith(preset.id);
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

    expect(mockActivatePreset).toHaveBeenCalledWith(
      weeklyPlan.selectedWeek,
      preset.id,
      [{ name: "Riz", quantity: "1 kg", category: "aisle" }],
    );
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(true);
  });

  it("togglePresetForWeek deactivates an active preset", async () => {
    const { weeklyPlan, addPreset, togglePresetForWeek, groceryPresets } = await importStore();
    const preset = await addPreset({ name: "Pantry", items: [] });

    await togglePresetForWeek(preset.id);
    await togglePresetForWeek(preset.id);

    expect(mockDeactivatePreset).toHaveBeenCalledWith(weeklyPlan.selectedWeek, preset.id, []);
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(false);
  });

  it("togglePresetForWeek does nothing for an unknown preset", async () => {
    const { togglePresetForWeek } = await importStore();
    await togglePresetForWeek("nope");
    expect(mockActivatePreset).not.toHaveBeenCalled();
    expect(mockDeactivatePreset).not.toHaveBeenCalled();
  });

  it("togglePresetForWeek updates the grocery list with returned items", async () => {
    const { weeklyPlan, addPreset, togglePresetForWeek } = await importStore();
    const { groceryList } = await import("../../lib/stores/groceryList.svelte");
    const preset = await addPreset({
      name: "Pantry",
      items: [{ name: "Riz", quantity: "1 kg", category: "aisle" }],
    });
    mockActivatePreset.mockResolvedValue([
      { id: "g1", name: "Riz", quantity: "1 kg", category: "aisle", checked: false },
    ]);

    await togglePresetForWeek(preset.id);

    expect(groceryList.itemsByWeek[weeklyPlan.selectedWeek]).toEqual([
      { id: "g1", name: "Riz", quantity: "1 kg", category: "aisle", checked: false },
    ]);
  });
});
