import type { IngredientCategory } from "../types";
import { weeklyPlan } from "./weeklyPlan.svelte";
import { auth, onUserChange } from "./auth.svelte";
import { onSynced } from "../sync/status.svelte";
import { weeklyPlanRepo } from "../repos/weeklyPlanRepo";
import { groceryItemRepo, type GroceryDBItem } from "../repos/groceryItemRepo";
import { adjustQuantityString } from "../utils/groceryList";

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
    const row = await weeklyPlanRepo.getByWeek(weekKey);
    const items = row ? await groceryItemRepo.getForPlan(row.id) : [];
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

// Cross-device / realtime changes land in Dexie via the sync engine, not
// through these store functions, so re-read after every successful sync.
onSynced(() => {
  void loadWeek(weeklyPlan.selectedWeek);
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

function upsertInStore(weekKey: string, item: GroceryDBItem): void {
  const items = groceryList.itemsByWeek[weekKey] ?? [];
  const idx = items.findIndex((i) => i.id === item.id);
  groceryList.itemsByWeek = {
    ...groceryList.itemsByWeek,
    [weekKey]: idx >= 0 ? items.map((i, j) => (j === idx ? item : i)) : [...items, item],
  };
}

export function toggleGroceryItemChecked(
  name: string,
  quantity: string,
  category: IngredientCategory,
  checked: boolean,
): void {
  const weekKey = weeklyPlan.selectedWeek;
  const existing = (groceryList.itemsByWeek[weekKey] ?? []).find(
    (i) => i.name === name && i.category === category,
  );

  (async () => {
    const plan = await weeklyPlanRepo.getOrCreate(weekKey);
    return groceryItemRepo.upsert(plan.id, { id: existing?.id, name, quantity, category, checked });
  })()
    .then((item) => upsertInStore(weekKey, item))
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

  const existing = (groceryList.itemsByWeek[weekKey] ?? []).find(
    (i) => i.name === trimmedName,
  );
  const trimmedQuantity = quantity.trim() || "1";
  const mergedQuantity = existing
    ? (adjustQuantityString(existing.quantity, [trimmedQuantity], []) ?? trimmedQuantity)
    : trimmedQuantity;

  try {
    const plan = await weeklyPlanRepo.getOrCreate(weekKey);
    const item = await groceryItemRepo.upsert(plan.id, {
      id: existing?.id,
      name: trimmedName,
      quantity: mergedQuantity,
      category,
      checked: existing?.checked ?? false,
    });
    upsertInStore(weekKey, item);
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
  groceryItemRepo.delete(id).catch(console.error);
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
  const items = groceryList.itemsByWeek[weekKey] ?? [];
  const current = items.find((i) => i.id === id);
  if (!current) return;

  // Renaming onto an existing item's name+category would collide with its unique
  // constraint; merge into that item instead of creating a duplicate.
  const collision = items.find(
    (i) => i.id !== id && i.name === trimmedName && i.category === category,
  );

  (async () => {
    const plan = await weeklyPlanRepo.getOrCreate(weekKey);

    if (collision) {
      const mergedQuantity =
        adjustQuantityString(collision.quantity, [trimmedQty], []) ?? trimmedQty;
      const merged = await groceryItemRepo.upsert(plan.id, {
        id: collision.id,
        name: collision.name,
        category: collision.category,
        quantity: mergedQuantity,
        checked: collision.checked,
      });
      await groceryItemRepo.delete(id);
      groceryList.itemsByWeek = {
        ...groceryList.itemsByWeek,
        [weekKey]: items.filter((i) => i.id !== id).map((i) => (i.id === merged.id ? merged : i)),
      };
      return;
    }

    const updated = await groceryItemRepo.upsert(plan.id, {
      id,
      name: trimmedName,
      category,
      quantity: trimmedQty,
      checked: current.checked,
    });
    groceryList.itemsByWeek = {
      ...groceryList.itemsByWeek,
      [weekKey]: items.map((i) => (i.id === id ? updated : i)),
    };
  })().catch(console.error);
}
