import {
  INGREDIENT_CATEGORY_ORDER,
} from "../../data/ingredientCategories";
import type { CustomGroceryItem } from "../stores/groceryList";
import type { IngredientCategory, Meal, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { getMealById } from "../stores/meals";

export interface GroceryItem {
  name: string;
  category: IngredientCategory;
  quantities: string[];
}

export function getPlannedMeals(plan: WeeklyPlan): Meal[] {
  const slots: MealSlot[] = ["diner", "supper"];
  const seen = new Set<string>();
  const unique: Meal[] = [];

  for (const { key } of DAYS) {
    for (const slot of slots) {
      const id = plan[key]?.[slot];
      if (!id || seen.has(id)) continue;
      const meal = getMealById(id);
      if (!meal) continue;
      seen.add(id);
      unique.push(meal);
    }
  }

  return unique;
}

function addToGroceryMap(
  map: Map<string, GroceryItem>,
  name: string,
  category: IngredientCategory,
  quantity: string,
): void {
  const existing = map.get(name);
  if (existing) {
    existing.quantities.push(quantity);
  } else {
    map.set(name, { name, category, quantities: [quantity] });
  }
}

export function buildGroceryList(
  meals: Meal[],
  added: CustomGroceryItem[] = [],
): GroceryItem[] {
  const map = new Map<string, GroceryItem>();

  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      addToGroceryMap(
        map,
        ingredient.name,
        ingredient.category,
        ingredient.quantity,
      );
    }
  }

  for (const item of added) {
    addToGroceryMap(map, item.name, item.category, item.quantity);
  }

  return [...map.values()].sort((a, b) => {
    const orderDiff =
      INGREDIENT_CATEGORY_ORDER.indexOf(a.category) -
      INGREDIENT_CATEGORY_ORDER.indexOf(b.category);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "fr");
  });
}

export function groupGroceryByCategory(
  items: GroceryItem[],
): { category: IngredientCategory; items: GroceryItem[] }[] {
  const groups = new Map<IngredientCategory, GroceryItem[]>(
    INGREDIENT_CATEGORY_ORDER.map((category) => [category, []]),
  );

  for (const item of items) {
    groups.get(item.category)!.push(item);
  }

  return INGREDIENT_CATEGORY_ORDER.map((category) => ({
    category,
    items: groups.get(category)!,
  }));
}

export function formatGroceryQuantities(quantities: string[]): string {
  return quantities.join(", ");
}
