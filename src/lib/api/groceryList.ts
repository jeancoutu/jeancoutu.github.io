import { supabase } from "../supabase";
import type { IngredientCategory } from "../types";
import { getOrCreateWeeklyPlanId } from "./plan";
import { adjustQuantityString, type GroceryAdjustment } from "../utils/groceryList";

export interface GroceryDBItem {
  id: string;
  name: string;
  quantity: string;
  category: IngredientCategory;
  checked: boolean;
}

export async function fetchGroceryItems(weekStart: string): Promise<GroceryDBItem[]> {
  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planError) throw planError;
  if (!plan) return [];

  const { data, error } = await supabase
    .from("grocery_items")
    .select("id, name, quantity, category, checked")
    .eq("weekly_plan_id", (plan as { id: string }).id);

  if (error) throw error;
  return (data ?? []) as GroceryDBItem[];
}

export async function upsertGroceryItem(
  weekStart: string,
  item: Omit<GroceryDBItem, "id">,
): Promise<GroceryDBItem> {
  const weeklyPlanId = await getOrCreateWeeklyPlanId(weekStart);

  const { data, error } = await supabase
    .from("grocery_items")
    .upsert(
      { weekly_plan_id: weeklyPlanId, ...item },
      { onConflict: "weekly_plan_id,name,quantity,category" },
    )
    .select("id, name, quantity, category, checked")
    .single();

  if (error) throw error;
  return data as GroceryDBItem;
}

export async function updateGroceryItem(
  id: string,
  changes: Partial<Omit<GroceryDBItem, "id">>,
): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteGroceryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function deleteAllGroceryItems(weekStart: string): Promise<void> {
  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planError) throw planError;
  if (!plan) return;

  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("weekly_plan_id", (plan as { id: string }).id);

  if (error) throw error;
}

export async function applyGroceryAdjustments(
  weekStart: string,
  adjustments: GroceryAdjustment[],
  existingWeeklyPlanId?: string,
  dismissedNames?: string[],
): Promise<GroceryDBItem[] | null> {
  if (adjustments.length === 0) return null;

  const weeklyPlanId = existingWeeklyPlanId ?? await getOrCreateWeeklyPlanId(weekStart);

  const { data: currentItems, error: fetchError } = await supabase
    .from("grocery_items")
    .select("id, name, quantity, category, checked")
    .eq("weekly_plan_id", weeklyPlanId);

  if (fetchError) throw fetchError;

  const existing = (currentItems ?? []) as GroceryDBItem[];
  const dbByName = new Map(existing.map((i) => [i.name, i]));

  const toDelete: string[] = [];
  const toUpdate: Array<{ id: string; quantity: string }> = [];
  const toInsert: Array<{
    weekly_plan_id: string;
    name: string;
    quantity: string;
    category: IngredientCategory;
    checked: boolean;
  }> = [];

  const dismissed = dismissedNames ? new Set(dismissedNames) : null;
  for (const adj of adjustments) {
    if (dismissed?.has(adj.name)) continue;
    const row = dbByName.get(adj.name);
    const newQty = adjustQuantityString(
      row?.quantity ?? null,
      adj.addQuantities,
      adj.removeQuantities,
    );

    if (row) {
      if (newQty === null) {
        toDelete.push(row.id);
      } else {
        toUpdate.push({ id: row.id, quantity: newQty });
      }
    } else if (newQty !== null) {
      toInsert.push({
        weekly_plan_id: weeklyPlanId,
        name: adj.name,
        quantity: newQty,
        category: adj.category,
        checked: false,
      });
    }
  }

  const [, insertedItems] = await Promise.all([
    Promise.all([
      toDelete.length > 0
        ? supabase
            .from("grocery_items")
            .delete()
            .in("id", toDelete)
            .then(({ error }) => { if (error) throw error; })
        : Promise.resolve(),
      ...toUpdate.map(({ id, quantity }) =>
        supabase
          .from("grocery_items")
          .update({ quantity })
          .eq("id", id)
          .then(({ error }) => { if (error) throw error; }),
      ),
    ]),
    toInsert.length > 0
      ? supabase
          .from("grocery_items")
          .insert(toInsert)
          .select("id, name, quantity, category, checked")
          .then(({ data, error }) => { if (error) throw error; return (data ?? []) as GroceryDBItem[]; })
      : Promise.resolve([] as GroceryDBItem[]),
  ]);

  const deletedIds = new Set(toDelete);
  const updatedQty = new Map(toUpdate.map(({ id, quantity }) => [id, quantity]));

  return [
    ...existing
      .filter((i) => !deletedIds.has(i.id))
      .map((i) => updatedQty.has(i.id) ? { ...i, quantity: updatedQty.get(i.id)! } : i),
    ...insertedItems,
  ];
}

export async function bulkReplaceGroceryItems(
  weekStart: string,
  items: Omit<GroceryDBItem, "id">[],
): Promise<void> {
  const weeklyPlanId = await getOrCreateWeeklyPlanId(weekStart);

  const { error: deleteError } = await supabase
    .from("grocery_items")
    .delete()
    .eq("weekly_plan_id", weeklyPlanId);

  if (deleteError) throw deleteError;
  if (items.length === 0) return;

  const { error: insertError } = await supabase
    .from("grocery_items")
    .insert(items.map((item) => ({ weekly_plan_id: weeklyPlanId, ...item })));

  if (insertError) throw insertError;
}
