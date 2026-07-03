import type { DayKey, DurationTag, Ingredient, Meal } from "../types";
import { DAYS, INGREDIENT_CATEGORIES } from "../types";
import {
  createMeal,
  deleteMeal,
  getMeals,
  updateMeal,
} from "../api/meals";
import { onUserChange } from "./auth.svelte";

const VALID_DAYS = new Set<DayKey>(DAYS.map((day) => day.key));
const VALID_CATEGORIES = new Set(INGREDIENT_CATEGORIES);

export interface CustomMealInput {
  name: string;
  duration: DurationTag;
  supperDays: DayKey[];
  url: string;
  ingredients: Ingredient[];
  instructions: string[];
}

function normalizeDays(value: DayKey[]): DayKey[] {
  return [...new Set(value.filter((day) => VALID_DAYS.has(day)))];
}

function buildMealInput(input: CustomMealInput): Omit<Meal, "id"> {
  return {
    name: input.name.trim(),
    duration: input.duration,
    supperDays: normalizeDays(input.supperDays),
    url: input.url.trim(),
    ingredients: input.ingredients.map((ingredient) => {
      const name = ingredient.name.trim();
      return {
        name,
        quantity: ingredient.quantity.trim() || "1",
        category: ingredient.category,
      };
    }),
    instructions: input.instructions.map((i) => i.trim()).filter(Boolean),
  };
}

class MealsStore {
  all = $state<Meal[]>([]);
  search = $state("");
  durationFilter = $state<DurationTag | "all">("all");

  filtered = $derived.by(() => {
    const query = this.search.trim().toLowerCase();
    return this.all
      .filter((meal) => {
        const matchesSearch = !query || meal.name.toLowerCase().includes(query);
        const matchesDuration =
          this.durationFilter === "all" || meal.duration === this.durationFilter;
        return matchesSearch && matchesDuration;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export const meals = new MealsStore();

onUserChange(async ($session) => {
  meals.all = $session ? await getMeals() : [];
});

export function getMealById(id: string): Meal | undefined {
  return meals.all.find((m) => m.id === id);
}

export async function addMeal(input: CustomMealInput): Promise<Meal> {
  const meal = await createMeal(buildMealInput(input));
  meals.all = [...meals.all, meal];
  return meal;
}

export async function updateMealById(
  id: string,
  input: CustomMealInput,
): Promise<Meal> {
  const meal = await updateMeal(id, buildMealInput(input));
  meals.all = meals.all.map((m) => (m.id === id ? meal : m));
  return meal;
}

export async function deleteMealById(id: string): Promise<void> {
  await deleteMeal(id);
  meals.all = meals.all.filter((m) => m.id !== id);
}
