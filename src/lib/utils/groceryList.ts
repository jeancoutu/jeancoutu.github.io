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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function parseQuantity(q: string): { value: number; unit: string } | null {
  const match = q.trim().match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*(.*)$/);
  if (!match) return null;
  const numStr = match[1].replace(",", ".");
  let value: number;
  if (numStr.includes("/")) {
    const [num, den] = numStr.split("/");
    value = parseFloat(num) / parseFloat(den);
  } else {
    value = parseFloat(numStr);
  }
  if (isNaN(value)) return null;
  return { value, unit: match[2].trim() };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function formatNumber(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  const whole = Math.floor(rounded);
  const decimal = rounded - whole;

  if (decimal < 0.001) return String(whole);

  // Find the nearest simple fraction (denominator up to 16)
  let bestNum = 1, bestDen = 2, bestErr = Infinity;
  for (let den = 2; den <= 16; den++) {
    const num = Math.round(decimal * den);
    const err = Math.abs(decimal - num / den);
    if (err < bestErr) { bestErr = err; bestNum = num; bestDen = den; }
  }

  if (bestErr > 0.01) return String(rounded);

  const g = gcd(bestNum, bestDen);
  const fracStr = `${bestNum / g}/${bestDen / g}`;
  return whole > 0 ? `${whole} ${fracStr}` : fracStr;
}

export function formatGroceryQuantities(quantities: string[]): string {
  const groups: Array<{ total: number; unit: string }> = [];
  const unparsed: string[] = [];

  for (const q of quantities) {
    const p = parseQuantity(q);
    if (!p) {
      unparsed.push(q);
      continue;
    }
    let merged = false;
    for (const group of groups) {
      if (levenshtein(p.unit.toLowerCase(), group.unit.toLowerCase()) <= 2) {
        group.total += p.value;
        if (p.unit.length > group.unit.length) group.unit = p.unit;
        merged = true;
        break;
      }
    }
    if (!merged) groups.push({ total: p.value, unit: p.unit });
  }

  const results = groups.map(({ total, unit }) => {
    const num = formatNumber(total);
    return unit ? `${num} ${unit}` : num;
  });

  return [...results, ...unparsed].join(", ");
}
