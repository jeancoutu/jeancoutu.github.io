import type { GroceryPreset } from "../types";
import { auth, onUserChange } from "./auth.svelte";
import { weeklyPlan } from "./weeklyPlan.svelte";
import { setGroceryItemsForWeek } from "./groceryList.svelte";
import {
  activatePreset,
  createGroceryPreset,
  deactivatePreset,
  deleteGroceryPreset,
  getActivePresetIds,
  getGroceryPresets,
  updateGroceryPreset,
} from "../api/groceryPresets";

export interface GroceryPresetInput {
  name: string;
  items: GroceryPreset["items"];
}

function buildPresetInput(input: GroceryPresetInput): Omit<GroceryPreset, "id"> {
  return {
    name: input.name.trim(),
    items: input.items.map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity.trim() || "1",
      category: item.category,
    })),
  };
}

class GroceryPresetsStore {
  all = $state<GroceryPreset[]>([]);
  activeIdsByWeek = $state<Record<string, string[]>>({});
  activeForWeek = $derived(
    new Set(this.activeIdsByWeek[weeklyPlan.selectedWeek] ?? []),
  );
}

export const groceryPresets = new GroceryPresetsStore();

async function loadActiveIds(weekKey: string): Promise<void> {
  try {
    const ids = await getActivePresetIds(weekKey);
    groceryPresets.activeIdsByWeek = { ...groceryPresets.activeIdsByWeek, [weekKey]: ids };
  } catch (err) {
    console.error("Failed to load active grocery presets:", err);
  }
}

onUserChange(async ($session) => {
  if ($session) {
    groceryPresets.all = await getGroceryPresets();
    await loadActiveIds(weeklyPlan.selectedWeek);
  } else {
    groceryPresets.all = [];
    groceryPresets.activeIdsByWeek = {};
  }
});

$effect.root(() => {
  $effect(() => {
    const weekKey = weeklyPlan.selectedWeek;
    if (!auth.session) return;
    if (groceryPresets.activeIdsByWeek[weekKey] === undefined) {
      void loadActiveIds(weekKey);
    }
  });
});

export function getPresetById(id: string): GroceryPreset | undefined {
  return groceryPresets.all.find((p) => p.id === id);
}

export async function addPreset(input: GroceryPresetInput): Promise<GroceryPreset> {
  const preset = await createGroceryPreset(buildPresetInput(input));
  groceryPresets.all = [...groceryPresets.all, preset];
  return preset;
}

export async function updatePresetById(
  id: string,
  input: GroceryPresetInput,
): Promise<GroceryPreset> {
  const preset = await updateGroceryPreset(id, buildPresetInput(input));
  groceryPresets.all = groceryPresets.all.map((p) => (p.id === id ? preset : p));
  return preset;
}

export async function deletePresetById(id: string): Promise<void> {
  await deleteGroceryPreset(id);
  groceryPresets.all = groceryPresets.all.filter((p) => p.id !== id);
  // The DB cascades join rows away; mirror that in local per-week active state.
  groceryPresets.activeIdsByWeek = Object.fromEntries(
    Object.entries(groceryPresets.activeIdsByWeek).map(([week, ids]) => [
      week,
      ids.filter((presetId) => presetId !== id),
    ]),
  );
}

export async function togglePresetForWeek(presetId: string): Promise<void> {
  const preset = getPresetById(presetId);
  if (!preset) return;

  const weekKey = weeklyPlan.selectedWeek;
  const activeIds = groceryPresets.activeIdsByWeek[weekKey] ?? [];
  const isActive = activeIds.includes(presetId);

  const items = isActive
    ? await deactivatePreset(weekKey, presetId, preset.items)
    : await activatePreset(weekKey, presetId, preset.items);

  groceryPresets.activeIdsByWeek = {
    ...groceryPresets.activeIdsByWeek,
    [weekKey]: isActive
      ? activeIds.filter((id) => id !== presetId)
      : [...activeIds, presetId],
  };

  if (items) setGroceryItemsForWeek(weekKey, items);
}
