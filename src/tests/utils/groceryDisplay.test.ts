import { describe, it, expect } from "vitest";
import { buildDisplayItems } from "../../lib/utils/groceryDisplay";
import type { GroceryItem } from "../../lib/utils/groceryList";
import type { GroceryDBItem } from "../../lib/api/groceryList";

function mealPlanItem(overrides: Partial<GroceryItem> & { name: string }): GroceryItem {
  return { category: "vegetables", quantities: [], ...overrides };
}

function dbItem(overrides: Partial<GroceryDBItem> & { id: string; name: string }): GroceryDBItem {
  return { category: "vegetables", quantity: "1", checked: false, ...overrides };
}

describe("buildDisplayItems", () => {
  it("enriches meal-plan items with DB checked state and dbId", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots", quantities: ["2"] })],
      [dbItem({ id: "1", name: "Carrots", checked: true })],
      new Set(),
    );
    expect(result).toEqual([
      { name: "Carrots", category: "vegetables", quantities: ["2"], dbId: "1", checked: true, isCustom: false },
    ]);
  });

  it("marks meal-plan items with no matching DB row as unchecked with no dbId", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots", quantities: ["2"] })],
      [],
      new Set(),
    );
    expect(result).toEqual([
      { name: "Carrots", category: "vegetables", quantities: ["2"], dbId: undefined, checked: false, isCustom: false },
    ]);
  });

  it("excludes dismissed meal-plan items", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots" })],
      [],
      new Set(["Carrots"]),
    );
    expect(result).toEqual([]);
  });

  it("includes DB items not derived from the meal plan as custom items", () => {
    const result = buildDisplayItems(
      [],
      [dbItem({ id: "2", name: "Chocolate", quantity: "1 bar" })],
      new Set(),
    );
    expect(result).toEqual([
      { dbId: "2", name: "Chocolate", category: "vegetables", quantities: ["1 bar"], checked: false, isCustom: true },
    ]);
  });

  it("does not duplicate a name that exists in both the meal plan and DB rows", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots", quantities: ["2"] })],
      [dbItem({ id: "1", name: "Carrots" })],
      new Set(),
    );
    expect(result).toHaveLength(1);
  });
});
