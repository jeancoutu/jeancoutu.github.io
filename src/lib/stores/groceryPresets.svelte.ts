import type { GroceryPreset } from "../types";
import { auth, onUserChange } from "./auth.svelte";
import { weeklyPlan } from "./weeklyPlan.svelte";
import { setGroceryItemsForWeek } from "./groceryList.svelte";
import { groceryPresetRepo } from "../repos/groceryPresetRepo";
import { weeklyPlanRepo } from "../repos/weeklyPlanRepo";
import { groceryItemRepo } from "../repos/groceryItemRepo";
import { onSynced } from "../sync/status.svelte";
import { presetItemsToAdjustments } from "../utils/groceryList";

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

async function refreshPresets(): Promise<void> {
  groceryPresets.all = await groceryPresetRepo.getAll();
}

async function loadActiveIds(weekKey: string): Promise<void> {
  try {
    const row = await weeklyPlanRepo.getByWeek(weekKey);
    groceryPresets.activeIdsByWeek = { ...groceryPresets.activeIdsByWeek, [weekKey]: row?.presetIds ?? [] };
  } catch (err) {
    console.error("Failed to load active grocery presets:", err);
  }
}

// Reads always come from IndexedDB, not the network, so this works offline
// with a cached session. A logout/switch wipes IndexedDB (see src/lib/db),
// which the next pull/refresh will reflect as an empty list.
onUserChange(async ($session) => {
  if ($session) {
    await refreshPresets();
    await loadActiveIds(weeklyPlan.selectedWeek);
  } else {
    groceryPresets.all = [];
    groceryPresets.activeIdsByWeek = {};
  }
});

// Cross-device / realtime changes land in Dexie via the sync engine, not
// through these store functions, so re-read after every successful sync.
onSynced(() => {
  void refreshPresets();
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
  const preset = await groceryPresetRepo.create(buildPresetInput(input));
  groceryPresets.all = [...groceryPresets.all, preset];
  return preset;
}

export async function updatePresetById(
  id: string,
  input: GroceryPresetInput,
): Promise<GroceryPreset> {
  const preset = await groceryPresetRepo.update(id, buildPresetInput(input));
  groceryPresets.all = groceryPresets.all.map((p) => (p.id === id ? preset : p));
  return preset;
}

export async function deletePresetById(id: string): Promise<void> {
  await groceryPresetRepo.delete(id);
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
  const nextActive = !isActive;

  const planRow = await weeklyPlanRepo.setPresetActive(weekKey, presetId, nextActive);
  const items = await groceryItemRepo.applyAdjustments(
    planRow.id,
    presetItemsToAdjustments(preset.items, nextActive ? "add" : "remove"),
  );

  groceryPresets.activeIdsByWeek = { ...groceryPresets.activeIdsByWeek, [weekKey]: planRow.presetIds };

  setGroceryItemsForWeek(weekKey, items);
}
