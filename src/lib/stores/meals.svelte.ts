import type { DayKey, DurationTag, Ingredient, Meal } from "../types";
import { DAYS, INGREDIENT_CATEGORIES } from "../types";
import { mealRepo } from "../repos/mealRepo";
import { onUserChange } from "./auth.svelte";
import { onSynced } from "../sync/status.svelte";

const VALID_DAYS = new Set<DayKey>(DAYS.map((day) => day.key));
const VALID_CATEGORIES = new Set(INGREDIENT_CATEGORIES);

export interface CustomMealInput {
  name: string;
  duration: DurationTag;
  supperDays: DayKey[];
  url: string;
  ingredients: Ingredient[];
  instructions: string[];
  /** Optional until the editor is wired up (meal-tags step 2); normalized in mealRepo. */
  tags?: string[];
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
    tags: input.tags ?? [],
  };
}

class MealsStore {
  all = $state<Meal[]>([]);
  search = $state("");
  durationFilter = $state<DurationTag | "all">("all");
  tagFilter = $state<string | null>(null);

  allTags = $derived.by(() => {
    const tags = new Set<string>();
    for (const meal of this.all) {
      for (const tag of meal.tags) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  });

  filtered = $derived.by(() => {
    const query = this.search.trim().toLowerCase();
    return this.all
      .filter((meal) => {
        const matchesSearch = !query || meal.name.toLowerCase().includes(query);
        const matchesDuration =
          this.durationFilter === "all" || meal.duration === this.durationFilter;
        const matchesTag = !this.tagFilter || meal.tags.includes(this.tagFilter);
        return matchesSearch && matchesDuration && matchesTag;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export const meals = new MealsStore();

async function refreshMeals(): Promise<void> {
  meals.all = await mealRepo.getAll();
}

// Reads always come from IndexedDB, not the network, so this works offline
// with a cached session. A logout/switch wipes IndexedDB (see src/lib/db),
// which the next pull/refresh will reflect as an empty list.
onUserChange(async ($session) => {
  meals.all = $session ? await mealRepo.getAll() : [];
});

// Cross-device / realtime changes land in Dexie via the sync engine, not
// through these store functions, so re-read after every successful sync.
onSynced(() => {
  void refreshMeals();
});

export function getMealById(id: string): Meal | undefined {
  return meals.all.find((m) => m.id === id);
}

export async function addMeal(input: CustomMealInput): Promise<Meal> {
  const meal = await mealRepo.create(buildMealInput(input));
  meals.all = [...meals.all, meal];
  return meal;
}

export async function updateMealById(
  id: string,
  input: CustomMealInput,
): Promise<Meal> {
  const meal = await mealRepo.update(id, buildMealInput(input));
  meals.all = meals.all.map((m) => (m.id === id ? meal : m));
  return meal;
}

export async function deleteMealById(id: string): Promise<void> {
  await mealRepo.delete(id);
  meals.all = meals.all.filter((m) => m.id !== id);
}
