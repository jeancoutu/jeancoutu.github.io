import { derived, get, writable } from "svelte/store";
import type { IngredientCategory } from "../types";
import { selectedWeek, dismissedIngredientsForWeek, weeklyPlan } from "./weeklyPlan";
import { session } from "./auth";
import {
  fetchGroceryItems,
  upsertGroceryItem,
  updateGroceryItem,
  deleteGroceryItem,
  type GroceryDBItem,
} from "../api/groceryList";

export type { GroceryDBItem };

type WeekItems = Record<string, GroceryDBItem[]>;

const weekItems = writable<WeekItems>({});

export async function reloadGroceryItemsForWeek(weekKey: string): Promise<void> {
  await loadWeek(weekKey);
}

export function setGroceryItemsForWeek(weekKey: string, items: GroceryDBItem[]): void {
  weekItems.update((all) => ({ ...all, [weekKey]: items }));
}

export function clearGroceryItemsForWeek(weekKey: string): void {
  weekItems.update((all) => ({ ...all, [weekKey]: [] }));
}

async function loadWeek(weekKey: string): Promise<void> {
  try {
    const items = await fetchGroceryItems(weekKey);
    weekItems.update((all) => ({ ...all, [weekKey]: items }));
  } catch (err) {
    console.error("Failed to load grocery items:", err);
  }
}

let prevGroceryUserId: string | null = null;
session.subscribe(async ($session) => {
  const userId = $session?.user?.id ?? null;
  if (userId === prevGroceryUserId) return;
  prevGroceryUserId = userId;
  if ($session) {
    await loadWeek(get(selectedWeek));
  } else {
    weekItems.set({});
  }
});

selectedWeek.subscribe(async (weekKey) => {
  if (!get(session)) return;
  if (get(weekItems)[weekKey] === undefined) {
    await loadWeek(weekKey);
  }
});

export const groceryItemsForWeek = derived(
  [selectedWeek, weekItems],
  ([weekKey, all]) => all[weekKey] ?? [],
);

export function toggleGroceryItemChecked(
  name: string,
  quantity: string,
  category: IngredientCategory,
  checked: boolean,
): void {
  const weekKey = get(selectedWeek);
  upsertGroceryItem(weekKey, { name, quantity, category, checked })
    .then((item) => {
      weekItems.update((all) => {
        const items = all[weekKey] ?? [];
        const idx = items.findIndex((i) => i.id === item.id);
        return {
          ...all,
          [weekKey]: idx >= 0 ? items.map((i, j) => (j === idx ? item : i)) : [...items, item],
        };
      });
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
  const weekKey = get(selectedWeek);

  if (get(dismissedIngredientsForWeek).includes(trimmedName)) {
    await weeklyPlan.undismissIngredient(trimmedName);
  }

  try {
    const item = await upsertGroceryItem(weekKey, {
      name: trimmedName,
      quantity: quantity.trim() || "1",
      category,
      checked: false,
    });
    weekItems.update((all) => {
      const items = all[weekKey] ?? [];
      const idx = items.findIndex((i) => i.id === item.id);
      return {
        ...all,
        [weekKey]: idx >= 0 ? items.map((i, j) => (j === idx ? item : i)) : [...items, item],
      };
    });
  } catch (err) {
    console.error(err);
  }
}

export function removeGroceryItem(id: string): void {
  const weekKey = get(selectedWeek);
  weekItems.update((all) => ({
    ...all,
    [weekKey]: (all[weekKey] ?? []).filter((i) => i.id !== id),
  }));
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
  const weekKey = get(selectedWeek);
  weekItems.update((all) => ({
    ...all,
    [weekKey]: (all[weekKey] ?? []).map((i) =>
      i.id === id ? { ...i, name: trimmedName, category, quantity: trimmedQty } : i,
    ),
  }));
  updateGroceryItem(id, { name: trimmedName, category, quantity: trimmedQty }).catch(console.error);
}
