import type { GroceryDBItem } from "../repos/groceryItemRepo";
import type { IngredientCategory } from "../types";
import type { GroceryItem } from "./groceryList";

export interface DisplayItem {
  dbId: string | undefined;
  name: string;
  category: IngredientCategory;
  quantities: string[];
  checked: boolean;
  isCustom: boolean;
  mealNames: string[];
}

// Merges meal-plan-derived items with DB rows (custom items + checked state),
// excluding dismissed ingredients.
// Merges DB rows that share a name (e.g. leftover duplicates from before the
// weekly_plan_id+name+category unique constraint), combining quantities.
interface MergedDbItem {
  id: string;
  category: IngredientCategory;
  quantities: string[];
  checked: boolean;
}

function mergeDbItemsByName(dbItems: GroceryDBItem[]): Map<string, MergedDbItem> {
  const merged = new Map<string, MergedDbItem>();
  for (const item of dbItems) {
    const existing = merged.get(item.name);
    if (existing) {
      existing.quantities.push(item.quantity);
      existing.checked = existing.checked || item.checked;
    } else {
      merged.set(item.name, {
        id: item.id,
        category: item.category,
        quantities: [item.quantity],
        checked: item.checked,
      });
    }
  }
  return merged;
}

export function buildDisplayItems(
  mealPlanItems: GroceryItem[],
  dbItems: GroceryDBItem[],
  dismissed: Set<string>,
): DisplayItem[] {
  const dbByName = mergeDbItemsByName(dbItems);
  const mealPlanNames = new Set(mealPlanItems.map((i) => i.name));

  const mealPlanDisplayItems: DisplayItem[] = mealPlanItems
    .filter((item) => !dismissed.has(item.name))
    .map((item) => {
      const dbItem = dbByName.get(item.name);
      return {
        name: item.name,
        category: item.category,
        quantities: dbItem ? dbItem.quantities : item.quantities,
        dbId: dbItem?.id,
        checked: dbItem?.checked ?? false,
        isCustom: false,
        mealNames: item.mealNames,
      };
    });

  const customDisplayItems: DisplayItem[] = [...dbByName.entries()]
    .filter(([name]) => !mealPlanNames.has(name))
    .map(([name, item]) => ({
      dbId: item.id,
      name,
      category: item.category,
      quantities: item.quantities,
      checked: item.checked,
      isCustom: true,
      mealNames: [],
    }));

  return [...mealPlanDisplayItems, ...customDisplayItems];
}
