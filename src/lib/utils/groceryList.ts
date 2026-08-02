import {
  INGREDIENT_CATEGORY_ORDER,
} from "../../data/ingredientCategories";
import type { IngredientCategory, Meal, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";

export interface GroceryItem {
  name: string;
  category: IngredientCategory;
  quantities: string[];
  mealNames: string[];
}

export function getPlannedMeals(
  plan: WeeklyPlan,
  getMeal: (id: string) => Meal | undefined,
): Meal[] {
  const slots: MealSlot[] = ["diner", "supper"];
  const seen = new Set<string>();
  const unique: Meal[] = [];

  for (const { key } of DAYS) {
    for (const slot of slots) {
      const id = plan[key]?.[slot];
      if (!id || seen.has(id)) continue;
      const meal = getMeal(id);
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
  mealName: string,
): void {
  const existing = map.get(name);
  if (existing) {
    existing.quantities.push(quantity);
    if (!existing.mealNames.includes(mealName)) {
      existing.mealNames.push(mealName);
    }
  } else {
    map.set(name, { name, category, quantities: [quantity], mealNames: [mealName] });
  }
}

export function buildGroceryList(meals: Meal[]): GroceryItem[] {
  const map = new Map<string, GroceryItem>();

  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      addToGroceryMap(
        map,
        ingredient.name,
        ingredient.category,
        ingredient.quantity,
        meal.name,
      );
    }
  }

  return [...map.values()].sort((a, b) => {
    const orderDiff =
      INGREDIENT_CATEGORY_ORDER.indexOf(a.category) -
      INGREDIENT_CATEGORY_ORDER.indexOf(b.category);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "fr");
  });
}

export function groupGroceryByCategory<T extends GroceryItem>(
  items: T[],
): { category: IngredientCategory; items: T[] }[] {
  const groups = new Map<IngredientCategory, T[]>(
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

export interface GroceryAdjustment {
  name: string;
  category: IngredientCategory;
  addQuantities: string[];
  removeQuantities: string[];
}

export function computeGroceryAdjustments(
  oldPlan: WeeklyPlan,
  newPlan: WeeklyPlan,
  getMeal: (id: string) => Meal | undefined,
): GroceryAdjustment[] {
  const oldItems = buildGroceryList(getPlannedMeals(oldPlan, getMeal));
  const newItems = buildGroceryList(getPlannedMeals(newPlan, getMeal));

  const oldMap = new Map(oldItems.map((i) => [i.name, i]));
  const newMap = new Map(newItems.map((i) => [i.name, i]));
  const allNames = new Set([...oldMap.keys(), ...newMap.keys()]);

  const adjustments: GroceryAdjustment[] = [];
  for (const name of allNames) {
    const oldItem = oldMap.get(name);
    const newItem = newMap.get(name);
    const oldQty = oldItem?.quantities ?? [];
    const newQty = newItem?.quantities ?? [];
    if (formatGroceryQuantities(oldQty) === formatGroceryQuantities(newQty)) continue;
    adjustments.push({
      name,
      category: newItem?.category ?? oldItem!.category,
      addQuantities: newQty,
      removeQuantities: oldQty,
    });
  }
  return adjustments;
}

// Converts a grocery preset's items into adjustments that either merge them
// into ("add") or subtract them from ("remove") a week's grocery items.
// Items sharing a name are grouped so each name yields a single adjustment.
export function presetItemsToAdjustments(
  items: { name: string; quantity: string; category: IngredientCategory }[],
  direction: "add" | "remove",
): GroceryAdjustment[] {
  const byName = new Map<string, GroceryAdjustment>();
  for (const item of items) {
    let adj = byName.get(item.name);
    if (!adj) {
      adj = {
        name: item.name,
        category: item.category,
        addQuantities: [],
        removeQuantities: [],
      };
      byName.set(item.name, adj);
    }
    (direction === "add" ? adj.addQuantities : adj.removeQuantities).push(item.quantity);
  }
  return [...byName.values()];
}

// Adjusts a formatted quantity string by adding and subtracting individual quantity strings.
// Returns null if the net result drops to zero or below.
export function adjustQuantityString(
  base: string | null,
  add: string[],
  remove: string[],
): string | null {
  const groups: Array<{ total: number; unit: string }> = [];
  const unparsed: string[] = [];

  if (base) {
    for (const part of base.split(/,\s*/)) {
      const p = parseQuantity(part.trim());
      if (!p) pushUnparsed(unparsed, part);
      else groups.push({ total: p.value, unit: p.unit });
    }
  }

  for (const q of add) {
    const p = parseQuantity(q);
    if (!p) { pushUnparsed(unparsed, q); continue; }
    let merged = false;
    for (const g of groups) {
      if (levenshtein(p.unit.toLowerCase(), g.unit.toLowerCase()) <= 2) {
        g.total += p.value;
        if (p.unit.length > g.unit.length) g.unit = p.unit;
        merged = true;
        break;
      }
    }
    if (!merged) groups.push({ total: p.value, unit: p.unit });
  }

  for (const q of remove) {
    const p = parseQuantity(q);
    if (!p) continue;
    for (const g of groups) {
      if (levenshtein(p.unit.toLowerCase(), g.unit.toLowerCase()) <= 2) {
        g.total -= p.value;
        break;
      }
    }
  }

  const validGroups = groups.filter((g) => g.total > 0.001);
  if (validGroups.length === 0 && unparsed.length === 0) return null;

  const results = validGroups.map(({ total, unit }) => {
    const num = formatNumber(total);
    return unit ? `${num} ${unit}` : num;
  });
  return [...results, ...unparsed].join(", ");
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

function parseQuantity(q: string): { value: number; unit: string } | null {
  const match = q
    .trim()
    .match(/^(\d+\s+\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*(.*)$/);
  if (!match) return null;
  const numStr = match[1]!.replace(",", ".");
  let value: number;
  const mixed = numStr.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    value = parseFloat(mixed[1]!) + parseFloat(mixed[2]!) / parseFloat(mixed[3]!);
  } else if (numStr.includes("/")) {
    const [num, den] = numStr.split("/");
    value = parseFloat(num!) / parseFloat(den!);
  } else {
    value = parseFloat(numStr);
  }
  if (isNaN(value)) return null;
  return { value, unit: match[2]!.trim() };
}

// Adds a non-numeric quantity string (e.g. "Au goût") to the unparsed list,
// deduplicating case/whitespace-insensitively so repeats across meals collapse to one.
function pushUnparsed(unparsed: string[], q: string): void {
  const trimmed = q.trim();
  const normalized = trimmed.toLowerCase();
  if (!unparsed.some((u) => u.toLowerCase() === normalized)) {
    unparsed.push(trimmed);
  }
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

  // Split on ", " (separator) but not a bare "," (French decimal, e.g. "1,5 kg"),
  // since a quantity here may already be a comma-joined result of a prior format pass.
  const parts = quantities.flatMap((q) => q.split(/,\s+/));

  for (const q of parts) {
    const p = parseQuantity(q);
    if (!p) {
      pushUnparsed(unparsed, q);
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
