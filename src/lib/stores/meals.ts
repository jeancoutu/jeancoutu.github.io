import { derived, get, writable } from "svelte/store";
import { meals as defaultMeals } from "../../data/meals";
import { getIngredientCategory } from "../../data/ingredientCategories";
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

const builtInMealIds = new Set(defaultMeals.map((meal) => meal.id));

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
        category: getIngredientCategory(name) ?? "aisle",
      };
    }),
    instructions: input.instructions.map((i) => i.trim()).filter(Boolean),
  };
}

export const customMeals = writable<Meal[]>([]);

session.subscribe(async ($session) => {
  if ($session) {
    customMeals.set(await getMeals());
  } else {
    customMeals.set([]);
  }
});

export const mealSearch = writable("");
export const durationFilter = writable<DurationTag | "all">("all");

export const allMeals = derived([customMeals], ([$customMeals]) => {
  const customById = new Map($customMeals.map((meal) => [meal.id, meal]));
  return [
    ...defaultMeals.map((meal) => customById.get(meal.id) ?? meal),
    ...$customMeals.filter((meal) => !builtInMealIds.has(meal.id)),
  ];
});

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

export function isCustomMeal(id: string): boolean {
  return get(customMeals).some((meal) => meal.id === id);
}

export function getCustomMealById(id: string): Meal | undefined {
  return get(customMeals).find((meal) => meal.id === id);
}

export function getMealById(id: string): Meal | undefined {
  return getCustomMealById(id) ?? defaultMeals.find((m) => m.id === id);
}

export async function addCustomMeal(input: CustomMealInput): Promise<Meal> {
  const meal = await createMeal(buildMealInput(input));
  customMeals.update((meals) => [...meals, meal]);
  return meal;
}

export async function updateCustomMeal(
  id: string,
  input: CustomMealInput,
): Promise<Meal> {
  const payload = buildMealInput(input);

  if (!isCustomMeal(id)) {
    // Editing a built-in meal: create a new custom copy instead
    return addCustomMeal(input);
  }

  const meal = await updateMeal(id, payload);
  customMeals.update((meals) => meals.map((m) => (m.id === id ? meal : m)));
  return meal;
}

export async function deleteCustomMeal(id: string): Promise<void> {
  await deleteMeal(id);
  customMeals.update((meals) => meals.filter((m) => m.id !== id));
}
