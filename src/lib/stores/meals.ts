import { derived, get, writable } from "svelte/store";
import type { DayKey, DurationTag, Meal } from "../types";
import { DAYS, INGREDIENT_CATEGORIES } from "../types";
import {
  createMeal,
  deleteMeal,
  getMeals,
  updateMeal,
} from "../api/meals";
import { session } from "./auth";

const VALID_DAYS = new Set<DayKey>(DAYS.map((day) => day.key));
const VALID_CATEGORIES = new Set(INGREDIENT_CATEGORIES);

export interface CustomMealIngredient {
  name: string;
  quantity: string;
}

export interface CustomMealInput {
  name: string;
  duration: DurationTag;
  supperDays: DayKey[];
  url: string;
  ingredients: CustomMealIngredient[];
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
        category: "aisle",
      };
    }),
    instructions: input.instructions.map((i) => i.trim()).filter(Boolean),
  };
}

export const allMeals = writable<Meal[]>([]);

let prevMealsUserId: string | null = null;
session.subscribe(async ($session) => {
  const userId = $session?.user?.id ?? null;
  if (userId === prevMealsUserId) return;
  prevMealsUserId = userId;
  if ($session) {
    allMeals.set(await getMeals());
  } else {
    allMeals.set([]);
  }
});

export const mealSearch = writable("");
export const durationFilter = writable<DurationTag | "all">("all");

export const filteredMeals = derived(
  [mealSearch, durationFilter, allMeals],
  ([$search, $duration, $allMeals]) => {
    const query = $search.trim().toLowerCase();
    return $allMeals.filter((meal) => {
      const matchesSearch = !query || meal.name.toLowerCase().includes(query);
      const matchesDuration =
        $duration === "all" || meal.duration === $duration;
      return matchesSearch && matchesDuration;
    });
  },
);

export function getMealById(id: string): Meal | undefined {
  return get(allMeals).find((m) => m.id === id);
}

export async function addMeal(input: CustomMealInput): Promise<Meal> {
  const meal = await createMeal(buildMealInput(input));
  allMeals.update((meals) => [...meals, meal]);
  return meal;
}

export async function updateMealById(
  id: string,
  input: CustomMealInput,
): Promise<Meal> {
  const meal = await updateMeal(id, buildMealInput(input));
  allMeals.update((meals) => meals.map((m) => (m.id === id ? meal : m)));
  return meal;
}

export async function deleteMealById(id: string): Promise<void> {
  await deleteMeal(id);
  allMeals.update((meals) => meals.filter((m) => m.id !== id));
}
