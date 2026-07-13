import { describe, it, expect } from "vitest";
import { buildDisplayItems } from "../../lib/utils/groceryDisplay";
import type { GroceryItem } from "../../lib/utils/groceryList";
import type { GroceryDBItem } from "../../lib/repos/groceryItemRepo";

function mealPlanItem(overrides: Partial<GroceryItem> & { name: string }): GroceryItem {
  return { category: "vegetables", quantities: [], mealNames: [], ...overrides };
}

function dbItem(overrides: Partial<GroceryDBItem> & { id: string; name: string }): GroceryDBItem {
  return {
    weeklyPlanId: "plan-1",
    category: "vegetables",
    quantity: "1",
    checked: false,
    toVerify: false,
    version: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("buildDisplayItems", () => {
  it("enriches meal-plan items with DB checked state and dbId", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots", quantities: ["2"] })],
      [dbItem({ id: "1", name: "Carrots", checked: true })],
      new Set(),
    );
    expect(result).toEqual([
      { name: "Carrots", category: "vegetables", quantities: ["1"], dbId: "1", checked: true, toVerify: false, isCustom: false, mealNames: [] },
    ]);
  });

  it("marks meal-plan items with no matching DB row as unchecked with no dbId", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots", quantities: ["2"] })],
      [],
      new Set(),
    );
    expect(result).toEqual([
      { name: "Carrots", category: "vegetables", quantities: ["2"], dbId: undefined, checked: false, toVerify: false, isCustom: false, mealNames: [] },
    ]);
  });

  it("carries toVerify through for meal-plan items with a matching DB row", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots", quantities: ["2"] })],
      [dbItem({ id: "1", name: "Carrots", toVerify: true })],
      new Set(),
    );
    expect(result[0]!.toVerify).toBe(true);
  });

  it("ORs toVerify across merged DB rows sharing a name", () => {
    const result = buildDisplayItems(
      [],
      [
        dbItem({ id: "1", name: "Chocolate", toVerify: false }),
        dbItem({ id: "2", name: "Chocolate", toVerify: true }),
      ],
      new Set(),
    );
    expect(result[0]!.toVerify).toBe(true);
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
      { dbId: "2", name: "Chocolate", category: "vegetables", quantities: ["1 bar"], checked: false, toVerify: false, isCustom: true, mealNames: [] },
    ]);
  });

  it("merges leftover DB rows that share a name into a single display item", () => {
    const result = buildDisplayItems(
      [],
      [
        dbItem({ id: "1", name: "1", quantity: "1", checked: false }),
        dbItem({ id: "2", name: "1", quantity: "2", checked: true }),
      ],
      new Set(),
    );
    expect(result).toEqual([
      { dbId: "1", name: "1", category: "vegetables", quantities: ["1", "2"], checked: true, toVerify: false, isCustom: true, mealNames: [] },
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

  it("carries meal names through to meal-plan display items", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots", quantities: ["2"], mealNames: ["Tacos", "Ragoût"] })],
      [],
      new Set(),
    );
    expect(result[0]!.mealNames).toEqual(["Tacos", "Ragoût"]);
  });

  it("gives custom items an empty mealNames list", () => {
    const result = buildDisplayItems(
      [],
      [dbItem({ id: "2", name: "Chocolate" })],
      new Set(),
    );
    expect(result[0]!.mealNames).toEqual([]);
  });

  it("keeps meal names on a quantity-edited DB row that still matches a meal ingredient", () => {
    const result = buildDisplayItems(
      [mealPlanItem({ name: "Carrots", quantities: ["2"], mealNames: ["Tacos"] })],
      [dbItem({ id: "1", name: "Carrots", quantity: "5" })],
      new Set(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.quantities).toEqual(["5"]);
    expect(result[0]!.mealNames).toEqual(["Tacos"]);
  });
});
