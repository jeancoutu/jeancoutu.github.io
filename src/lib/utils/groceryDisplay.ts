import type { GroceryDBItem } from "../api/groceryList";
import type { IngredientCategory } from "../types";
import type { GroceryItem } from "./groceryList";

export interface DisplayItem {
  dbId: string | undefined;
  name: string;
  category: IngredientCategory;
  quantities: string[];
  checked: boolean;
  isCustom: boolean;
}

// Merges meal-plan-derived items with DB rows (custom items + checked state),
// excluding dismissed ingredients.
export function buildDisplayItems(
  mealPlanItems: GroceryItem[],
  dbItems: GroceryDBItem[],
  dismissed: Set<string>,
): DisplayItem[] {
  const dbByName = new Map(dbItems.map((i) => [i.name, i]));
  const mealPlanNames = new Set(mealPlanItems.map((i) => i.name));

  const mealPlanDisplayItems: DisplayItem[] = mealPlanItems
    .filter((item) => !dismissed.has(item.name))
    .map((item) => {
      const dbItem = dbByName.get(item.name);
      return {
        name: item.name,
        category: item.category,
        quantities: item.quantities,
        dbId: dbItem?.id,
        checked: dbItem?.checked ?? false,
        isCustom: false,
      };
    });

  const customDisplayItems: DisplayItem[] = dbItems
    .filter((i) => !mealPlanNames.has(i.name))
    .map((i) => ({
      dbId: i.id,
      name: i.name,
      category: i.category,
      quantities: [i.quantity],
      checked: i.checked,
      isCustom: true,
    }));

  return [...mealPlanDisplayItems, ...customDisplayItems];
}
