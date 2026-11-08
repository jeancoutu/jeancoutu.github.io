import type { IngredientCategory } from "../types";
import { weeklyPlan } from "./weeklyPlan.svelte";
import { auth, onUserChange } from "./auth.svelte";
import { onSynced } from "../sync/status.svelte";
import { weeklyPlanRepo } from "../repos/weeklyPlanRepo";
import { groceryItemRepo, type GroceryDBItem } from "../repos/groceryItemRepo";
import { groceryPresetRepo } from "../repos/groceryPresetRepo";
import { adjustQuantityString } from "../utils/groceryList";

export type { GroceryDBItem };

type WeekItems = Record<string, GroceryDBItem[]>;

class GroceryListStore {
  itemsByWeek = $state<WeekItems>({});
  itemsForWeek = $derived(this.itemsByWeek[weeklyPlan.selectedWeek] ?? []);
  costcoEnabledByWeek = $state<Record<string, boolean>>({});
  costcoEnabled = $derived(this.costcoEnabledByWeek[weeklyPlan.selectedWeek] ?? false);
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
    groceryList.costcoEnabledByWeek = {
      ...groceryList.costcoEnabledByWeek,
      [weekKey]: row?.costcoEnabled ?? false,
    };
  } catch (err) {
    console.error("Failed to load grocery items:", err);
  }
}

onUserChange(async ($session) => {
  if ($session) {
    await loadWeek(weeklyPlan.selectedWeek);
  } else {
    groceryList.itemsByWeek = {};
    groceryList.costcoEnabledByWeek = {};
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
    (i) => !i.isCostco && i.name === name && i.category === category,
  );

  (async () => {
    const plan = await weeklyPlanRepo.getOrCreate(weekKey);
    return groceryItemRepo.upsert(plan.id, {
      id: existing?.id,
      name,
      quantity,
      category,
      checked,
      toVerify: checked ? false : (existing?.toVerify ?? false),
    });
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
    (i) => !i.isCostco && i.name === trimmedName,
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

export function toggleGroceryItemToVerify(
  name: string,
  quantity: string,
  category: IngredientCategory,
  toVerify: boolean,
): void {
  const weekKey = weeklyPlan.selectedWeek;
  const existing = (groceryList.itemsByWeek[weekKey] ?? []).find(
    (i) => !i.isCostco && i.name === name && i.category === category,
  );

  (async () => {
    const plan = await weeklyPlanRepo.getOrCreate(weekKey);
    return groceryItemRepo.upsert(plan.id, {
      id: existing?.id,
      name,
      quantity,
      category,
      checked: existing?.checked ?? false,
      toVerify,
    });
  })()
    .then((item) => upsertInStore(weekKey, item))
    .catch(console.error);
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
  id: string | undefined,
  name: string,
  category: IngredientCategory,
  quantity: string,
  toVerify = false,
): void {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const trimmedQty = quantity.trim() || "1";
  const weekKey = weeklyPlan.selectedWeek;
  const items = groceryList.itemsByWeek[weekKey] ?? [];
  const current = id ? items.find((i) => i.id === id) : undefined;

  // Renaming onto an existing item's name+category would collide with its unique
  // constraint; merge into that item instead of creating a duplicate.
  const collision = items.find(
    (i) => !i.isCostco && i.id !== id && i.name === trimmedName && i.category === category,
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
        toVerify: toVerify || collision.toVerify,
      });
      if (id) await groceryItemRepo.delete(id);
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
      checked: current?.checked ?? false,
      toVerify,
    });
    groceryList.itemsByWeek = {
      ...groceryList.itemsByWeek,
      [weekKey]: id ? items.map((i) => (i.id === id ? updated : i)) : [...items, updated],
    };
  })().catch(console.error);
}

// ============================================================
// Costco section: an optional per-week flat list of manual items, seeded from
// the household's "Costco recurring" list when switched on. Rows are normal
// groceryItems flagged isCostco, kept apart from the category groups and from
// meal-name matching (see buildCostcoItems).
// ============================================================

function costcoItems(weekKey: string): GroceryDBItem[] {
  return (groceryList.itemsByWeek[weekKey] ?? []).filter((i) => i.isCostco);
}

let costcoToggleInFlight = false;

export async function enableCostco(): Promise<void> {
  if (costcoToggleInFlight) return;
  costcoToggleInFlight = true;
  const weekKey = weeklyPlan.selectedWeek;
  try {
    const plan = await weeklyPlanRepo.setCostcoEnabled(weekKey, true);
    // Seed once, at enable time; later edits to the recurring list don't
    // touch weeks that are already enabled.
    const recurring = await groceryPresetRepo.findCostcoList();
    const present = new Set(
      (await groceryItemRepo.getForPlan(plan.id)).filter((i) => i.isCostco).map((i) => i.name),
    );
    for (const item of recurring?.items ?? []) {
      if (present.has(item.name)) continue;
      present.add(item.name);
      await groceryItemRepo.upsert(plan.id, {
        name: item.name,
        quantity: item.quantity || "1",
        category: item.category,
        checked: false,
        isCostco: true,
      });
    }
  } catch (err) {
    console.error("Failed to enable Costco section:", err);
  } finally {
    costcoToggleInFlight = false;
  }
  await loadWeek(weekKey);
}

export async function disableCostco(): Promise<void> {
  if (costcoToggleInFlight) return;
  costcoToggleInFlight = true;
  const weekKey = weeklyPlan.selectedWeek;
  try {
    const plan = await weeklyPlanRepo.setCostcoEnabled(weekKey, false);
    await groceryItemRepo.deleteCostcoItems(plan.id);
  } catch (err) {
    console.error("Failed to disable Costco section:", err);
  } finally {
    costcoToggleInFlight = false;
  }
  await loadWeek(weekKey);
}

export async function addCostcoItem(name: string, quantity = "1"): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const weekKey = weeklyPlan.selectedWeek;
  const trimmedQuantity = quantity.trim() || "1";
  const existing = costcoItems(weekKey).find((i) => i.name === trimmedName);
  const mergedQuantity = existing
    ? (adjustQuantityString(existing.quantity, [trimmedQuantity], []) ?? trimmedQuantity)
    : trimmedQuantity;

  try {
    const plan = await weeklyPlanRepo.getOrCreate(weekKey);
    const item = await groceryItemRepo.upsert(plan.id, {
      id: existing?.id,
      name: trimmedName,
      quantity: mergedQuantity,
      category: existing?.category ?? "aisle",
      checked: existing?.checked ?? false,
      isCostco: true,
    });
    upsertInStore(weekKey, item);
  } catch (err) {
    console.error(err);
  }
}

export function toggleCostcoItemChecked(id: string, checked: boolean): void {
  const weekKey = weeklyPlan.selectedWeek;
  const existing = costcoItems(weekKey).find((i) => i.id === id);
  if (!existing) return;
  groceryItemRepo
    .upsert(existing.weeklyPlanId, {
      id,
      name: existing.name,
      quantity: existing.quantity,
      category: existing.category,
      checked,
      isCostco: true,
    })
    .then((item) => upsertInStore(weekKey, item))
    .catch(console.error);
}

export function editCostcoItem(id: string, name: string, quantity: string): void {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const trimmedQty = quantity.trim() || "1";
  const weekKey = weeklyPlan.selectedWeek;
  const items = costcoItems(weekKey);
  const current = items.find((i) => i.id === id);
  if (!current) return;

  // Renaming onto another Costco item's name would hit the unique key; merge
  // into that item instead.
  const collision = items.find((i) => i.id !== id && i.name === trimmedName);

  (async () => {
    if (collision) {
      const merged = await groceryItemRepo.upsert(collision.weeklyPlanId, {
        id: collision.id,
        name: collision.name,
        category: collision.category,
        quantity: adjustQuantityString(collision.quantity, [trimmedQty], []) ?? trimmedQty,
        checked: collision.checked,
        isCostco: true,
      });
      await groceryItemRepo.delete(id);
      groceryList.itemsByWeek = {
        ...groceryList.itemsByWeek,
        [weekKey]: (groceryList.itemsByWeek[weekKey] ?? [])
          .filter((i) => i.id !== id)
          .map((i) => (i.id === merged.id ? merged : i)),
      };
      return;
    }
    const updated = await groceryItemRepo.upsert(current.weeklyPlanId, {
      id,
      name: trimmedName,
      category: current.category,
      quantity: trimmedQty,
      checked: current.checked,
      isCostco: true,
    });
    upsertInStore(weekKey, updated);
  })().catch(console.error);
}

export const removeCostcoItem = removeGroceryItem;
