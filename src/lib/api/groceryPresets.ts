import { supabase } from "../supabase";
import type { GroceryPreset, GroceryPresetItem } from "../types";
import { getOrCreateWeeklyPlanId } from "./plan";
import { applyGroceryAdjustments, type GroceryDBItem } from "./groceryList";
import { presetItemsToAdjustments } from "../utils/groceryList";

type PresetRow = {
  id: string;
  name: string;
  grocery_preset_items: { name: string; quantity: string; category: string }[];
};

function rowToPreset(row: PresetRow): GroceryPreset {
  return {
    id: row.id,
    name: row.name,
    items: (row.grocery_preset_items ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      category: item.category as GroceryPresetItem["category"],
    })),
  };
}

export async function getGroceryPresets(): Promise<GroceryPreset[]> {
  const { data, error } = await supabase
    .from("grocery_presets")
    .select("id, name, grocery_preset_items(name, quantity, category)")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data.map(rowToPreset);
}

export async function createGroceryPreset(
  input: Omit<GroceryPreset, "id">,
): Promise<GroceryPreset> {
  const { data: preset, error: presetError } = await supabase
    .from("grocery_presets")
    .insert({ name: input.name })
    .select("id")
    .single();

  if (presetError) throw presetError;

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from("grocery_preset_items").insert(
      input.items.map((item) => ({
        preset_id: preset.id,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
      })),
    );
    if (itemsError) throw itemsError;
  }

  return { ...input, id: preset.id };
}

export async function updateGroceryPreset(
  id: string,
  input: Omit<GroceryPreset, "id">,
): Promise<GroceryPreset> {
  const { error: presetError } = await supabase
    .from("grocery_presets")
    .update({ name: input.name })
    .eq("id", id);

  if (presetError) throw presetError;

  const { error: deleteError } = await supabase
    .from("grocery_preset_items")
    .delete()
    .eq("preset_id", id);
  if (deleteError) throw deleteError;

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from("grocery_preset_items").insert(
      input.items.map((item) => ({
        preset_id: id,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
      })),
    );
    if (itemsError) throw itemsError;
  }

  return { ...input, id };
}

export async function deleteGroceryPreset(id: string): Promise<void> {
  const { error } = await supabase.from("grocery_presets").delete().eq("id", id);
  if (error) throw error;
}

export async function getActivePresetIds(weekStart: string): Promise<string[]> {
  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planError) throw planError;
  if (!plan) return [];

  const { data, error } = await supabase
    .from("weekly_plan_grocery_presets")
    .select("preset_id")
    .eq("weekly_plan_id", plan.id);

  if (error) throw error;
  return (data ?? []).map((row) => row.preset_id);
}

export async function activatePreset(
  weekStart: string,
  presetId: string,
  presetItems: GroceryPresetItem[],
): Promise<GroceryDBItem[] | null> {
  const weeklyPlanId = await getOrCreateWeeklyPlanId(weekStart);

  const { error } = await supabase
    .from("weekly_plan_grocery_presets")
    .insert({ weekly_plan_id: weeklyPlanId, preset_id: presetId });
  if (error) throw error;

  return applyGroceryAdjustments(
    weekStart,
    presetItemsToAdjustments(presetItems, "add"),
    weeklyPlanId,
  );
}

export async function deactivatePreset(
  weekStart: string,
  presetId: string,
  presetItems: GroceryPresetItem[],
): Promise<GroceryDBItem[] | null> {
  const weeklyPlanId = await getOrCreateWeeklyPlanId(weekStart);

  const { error } = await supabase
    .from("weekly_plan_grocery_presets")
    .delete()
    .eq("weekly_plan_id", weeklyPlanId)
    .eq("preset_id", presetId);
  if (error) throw error;

  return applyGroceryAdjustments(
    weekStart,
    presetItemsToAdjustments(presetItems, "remove"),
    weeklyPlanId,
  );
}
