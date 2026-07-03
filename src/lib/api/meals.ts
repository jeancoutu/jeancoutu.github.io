import { supabase } from "../supabase";
import type { Database } from "../database.types";
import type { Meal } from "../types";

type MealRow = {
  id: string;
  name: string;
  duration: string;
  url: string | null;
  supper_days: string[] | null;
  instructions: string[] | null;
  meal_ingredients: { name: string; quantity: string; category: string }[];
};

function rowToMeal(row: MealRow): Meal {
  return {
    id: row.id,
    name: row.name,
    duration: row.duration as Meal["duration"],
    supperDays: (row.supper_days ?? []) as Meal["supperDays"],
    url: row.url ?? "",
    instructions: row.instructions ?? [],
    ingredients: (row.meal_ingredients ?? []).map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      category: ing.category as Meal["ingredients"][number]["category"],
    })),
  };
}

export async function getMeals(): Promise<Meal[]> {
  const { data, error } = await supabase
    .from("meals")
    .select(
      "id, name, duration, url, supper_days, instructions, meal_ingredients(name, quantity, category)",
    );

  if (error) throw error;
  return data.map(rowToMeal);
}

export async function createMeal(input: Omit<Meal, "id">): Promise<Meal> {
  const { data: meal, error: mealError } = await supabase
    .from("meals")
    .insert({
      name: input.name,
      duration: input.duration,
      url: input.url,
      supper_days: input.supperDays,
      instructions: input.instructions,
    })
    .select("id")
    .single();

  if (mealError) throw mealError;

  if (input.ingredients.length > 0) {
    const { error: ingError } = await supabase.from("meal_ingredients").insert(
      input.ingredients.map((ing) => ({
        meal_id: meal.id,
        name: ing.name,
        quantity: ing.quantity,
        category: ing.category,
      })),
    );
    if (ingError) throw ingError;
  }

  return { ...input, id: meal.id };
}

export async function updateMeal(id: string, input: Partial<Meal>): Promise<Meal> {
  const fields: Database["public"]["Tables"]["meals"]["Update"] = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.duration !== undefined) fields.duration = input.duration;
  if (input.url !== undefined) fields.url = input.url;
  if (input.supperDays !== undefined) fields.supper_days = input.supperDays;
  if (input.instructions !== undefined) fields.instructions = input.instructions;

  const { data: meal, error: mealError } = await supabase
    .from("meals")
    .update(fields)
    .eq("id", id)
    .select("id, name, duration, url, supper_days, instructions")
    .single();

  if (mealError) throw mealError;

  if (input.ingredients !== undefined) {
    const { error: deleteError } = await supabase
      .from("meal_ingredients")
      .delete()
      .eq("meal_id", id);
    if (deleteError) throw deleteError;

    if (input.ingredients.length > 0) {
      const { error: ingError } = await supabase
        .from("meal_ingredients")
        .insert(
          input.ingredients.map((ing) => ({
            meal_id: id,
            name: ing.name,
            quantity: ing.quantity,
            category: ing.category,
          })),
        );
      if (ingError) throw ingError;
    }
  }

  return rowToMeal({
    id: meal.id,
    name: meal.name,
    duration: meal.duration,
    url: meal.url,
    supper_days: meal.supper_days,
    instructions: meal.instructions,
    meal_ingredients: input.ingredients?.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      category: ing.category,
    })) ?? [],
  });
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) throw error;
}
