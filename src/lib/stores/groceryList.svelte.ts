import type { IngredientCategory } from "../types";
import { weeklyPlan } from "./weeklyPlan.svelte";
import { auth, onUserChange } from "./auth.svelte";
import {
  fetchGroceryItems,
  upsertGroceryItem,
  updateGroceryItem,
  deleteGroceryItem,
  type GroceryDBItem,
} from "../api/groceryList";

export type { GroceryDBItem };

type WeekItems = Record<string, GroceryDBItem[]>;

class GroceryListStore {
  itemsByWeek = $state<WeekItems>({});
  itemsForWeek = $derived(this.itemsByWeek[weeklyPlan.selectedWeek] ?? []);
}

export const groceryList = new GroceryListStore();

export async function reloadGroceryItemsForWeek(weekKey: string): Promise<void> {
  await loadWeek(weekKey);
}

export function setGroceryItemsForWeek(weekKey: string, items: GroceryDBItem[]): void {
  groceryList.itemsByWeek = { ...groceryList.itemsByWeek, [weekKey]: items };
}

export function clearGroceryItemsForWeek(weekKey: string): void {
  groceryList.itemsByWeek = { ...groceryList.itemsByWeek, [weekKey]: [] };
}

async function loadWeek(weekKey: string): Promise<void> {
  try {
    const items = await fetchGroceryItems(weekKey);
    groceryList.itemsByWeek = { ...groceryList.itemsByWeek, [weekKey]: items };
  } catch (err) {
    console.error("Failed to load grocery items:", err);
  }
}

onUserChange(async ($session) => {
  if ($session) {
    await loadWeek(weeklyPlan.selectedWeek);
  } else {
    groceryList.itemsByWeek = {};
  }
});

$effect.root(() => {
  $effect(() => {
    const weekKey = weeklyPlan.selectedWeek;
    if (!auth.session) return;
    if (groceryList.itemsByWeek[weekKey] === undefined) {
      void loadWeek(weekKey);
    }
  });
});

export function toggleGroceryItemChecked(
  name: string,
  quantity: string,
  category: IngredientCategory,
  checked: boolean,
): void {
  const weekKey = weeklyPlan.selectedWeek;
  upsertGroceryItem(weekKey, { name, quantity, category, checked })
    .then((item) => {
      const items = groceryList.itemsByWeek[weekKey] ?? [];
      const idx = items.findIndex((i) => i.id === item.id);
      groceryList.itemsByWeek = {
        ...groceryList.itemsByWeek,
        [weekKey]: idx >= 0 ? items.map((i, j) => (j === idx ? item : i)) : [...items, item],
      };
    })
    .catch(console.error);
}

export async function addGroceryItem(
  category: IngredientCategory,
  name: string,
  quantity = "1",
): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const weekKey = weeklyPlan.selectedWeek;

  if (weeklyPlan.dismissedIngredients.includes(trimmedName)) {
    await weeklyPlan.undismissIngredient(trimmedName);
  }

  try {
    const item = await upsertGroceryItem(weekKey, {
      name: trimmedName,
      quantity: quantity.trim() || "1",
      category,
      checked: false,
    });
    const items = groceryList.itemsByWeek[weekKey] ?? [];
    const idx = items.findIndex((i) => i.id === item.id);
    groceryList.itemsByWeek = {
      ...groceryList.itemsByWeek,
      [weekKey]: idx >= 0 ? items.map((i, j) => (j === idx ? item : i)) : [...items, item],
    };
  } catch (err) {
    console.error(err);
  }
}

export function removeGroceryItem(id: string): void {
  const weekKey = weeklyPlan.selectedWeek;
  groceryList.itemsByWeek = {
    ...groceryList.itemsByWeek,
    [weekKey]: (groceryList.itemsByWeek[weekKey] ?? []).filter((i) => i.id !== id),
  };
  deleteGroceryItem(id).catch(console.error);
}

export function editGroceryItem(
  id: string,
  name: string,
  category: IngredientCategory,
  quantity: string,
): void {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const trimmedQty = quantity.trim() || "1";
  const weekKey = weeklyPlan.selectedWeek;
  groceryList.itemsByWeek = {
    ...groceryList.itemsByWeek,
    [weekKey]: (groceryList.itemsByWeek[weekKey] ?? []).map((i) =>
      i.id === id ? { ...i, name: trimmedName, category, quantity: trimmedQty } : i,
    ),
  };
  updateGroceryItem(id, { name: trimmedName, category, quantity: trimmedQty }).catch(console.error);
}
