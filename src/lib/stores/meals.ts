import { derived, get, writable } from "svelte/store";
import { meals as defaultMeals } from "../../data/meals";
import { getIngredientCategory } from "../../data/ingredientCategories";
import type {
  DayKey,
  DurationTag,
  Ingredient,
  IngredientCategory,
  Meal,
} from "../types";
import { DAYS, INGREDIENT_CATEGORIES } from "../types";

const STORAGE_KEY = "meals";
const VALID_DURATIONS = new Set<DurationTag>(["short", "medium", "long"]);
const VALID_DAYS = new Set<DayKey>(DAYS.map((day) => day.key));
const VALID_CATEGORIES = new Set(INGREDIENT_CATEGORIES);

interface StoredMealInput {
  id?: unknown;
  name?: unknown;
  duration?: unknown;
  supperDays?: unknown;
  url?: unknown;
  ingredients?: unknown;
  instructions?: unknown;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeDuration(value: unknown): DurationTag | undefined {
  return typeof value === "string" && VALID_DURATIONS.has(value as DurationTag)
    ? (value as DurationTag)
    : undefined;
}

function normalizeDays(value: unknown): DayKey[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((day): day is DayKey =>
          typeof day === "string" && VALID_DAYS.has(day as DayKey),
        )
        .map((day) => day as DayKey),
    ),
  ];
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIngredient(value: unknown): Ingredient | null {
  if (!isRecord(value)) return null;

  const name = normalizeString(value.name);
  if (!name) return null;

  const quantity = normalizeString(value.quantity) || "1";
  const category =
    typeof value.category === "string" &&
    VALID_CATEGORIES.has(value.category as IngredientCategory)
      ? (value.category as IngredientCategory)
      : getIngredientCategory(name) ?? "aisle";

  return { name, quantity, category };
}

function normalizeMeal(value: unknown): Meal | null {
  if (!isRecord(value)) return null;

  const input = value as StoredMealInput;
  const id = normalizeString(input.id);
  const name = normalizeString(input.name);
  const duration = normalizeDuration(input.duration);

  if (!id || !name || !duration) return null;

  return {
    id,
    name,
    duration,
    supperDays: normalizeDays(input.supperDays),
    url: normalizeString(input.url),
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients
          .map(normalizeIngredient)
          .filter((item): item is Ingredient => !!item)
      : [],
    instructions: Array.isArray(input.instructions)
      ? input.instructions.map(normalizeString).filter(Boolean)
      : [],
  };
}

function loadStoredMeals(): Meal[] {
  if (typeof localStorage === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeMeal).filter((meal): meal is Meal => !!meal);
  } catch {
    return [];
  }
}

function saveStoredMeals(meals: Meal[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
}

function mergeMeals(customMeals: Meal[]): Meal[] {
  const builtInIds = new Set(defaultMeals.map((meal) => meal.id));
  return [
    ...defaultMeals,
    ...customMeals.filter((meal) => !builtInIds.has(meal.id)),
  ];
}

export const customMeals = writable<Meal[]>(loadStoredMeals());

customMeals.subscribe((meals) => saveStoredMeals(meals));

export const mealSearch = writable("");
export const durationFilter = writable<DurationTag | "all">("all");

export const allMeals = derived([customMeals], ([$customMeals]) => {
  return mergeMeals($customMeals);
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

export function addCustomMeal(input: CustomMealInput): Meal {
  const meal: Meal = {
    id:
      input.name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "custom-meal",
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
    instructions: input.instructions
      .map((instruction) => instruction.trim())
      .filter(Boolean),
  };

  const existingIds = new Set(get(allMeals).map((storedMeal) => storedMeal.id));
  if (existingIds.has(meal.id)) {
    meal.id = `${meal.id}-${Date.now().toString(36)}`;
  }

  customMeals.update((meals) => [...meals, meal]);
  return meal;
}

export function getMealById(id: string) {
  return get(allMeals).find((m) => m.id === id);
}
