import { supabase } from "../supabase";
import type { IngredientCategory, IngredientDefinition } from "../types";

export async function getIngredientDefinitions(): Promise<IngredientDefinition[]> {
  const { data, error } = await supabase
    .from("ingredient_definitions")
    .select("name, category");

  if (error) throw error;
  return (data as { name: string; category: string }[]).map((row) => ({
    name: row.name,
    category: row.category as IngredientCategory,
  }));
}

export async function upsertIngredientDefinition(def: IngredientDefinition): Promise<void> {
  const { error } = await supabase
    .from("ingredient_definitions")
    .upsert({ name: def.name, category: def.category }, { onConflict: "name" });

  if (error) throw error;
}

export async function deleteIngredientDefinition(name: string): Promise<void> {
  const { error } = await supabase
    .from("ingredient_definitions")
    .delete()
    .eq("name", name);

  if (error) throw error;
}
