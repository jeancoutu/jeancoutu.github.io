import { describe, it, expect } from "vitest";
import { buildCostcoItems, buildDisplayItems } from "../../lib/utils/groceryDisplay";
import type { GroceryDBItem } from "../../lib/repos/groceryItemRepo";

function dbItem(overrides: Partial<GroceryDBItem> & { id: string; name: string }): GroceryDBItem {
  return {
    weeklyPlanId: "plan-1",
    category: "aisle",
    quantity: "1",
    checked: false,
    toVerify: false,
    isCostco: false,
    version: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("Costco rows in the display builders", () => {
  it("buildDisplayItems ignores Costco rows: no custom item and no merge with a same-named meal item", () => {
    const result = buildDisplayItems(
      [{ name: "Rice", category: "aisle", quantities: ["1 cup"], mealNames: ["Curry"] }],
      [
        dbItem({ id: "c1", name: "Rice", quantity: "10 kg", checked: true, isCostco: true }),
        dbItem({ id: "c2", name: "Paper towels", isCostco: true }),
      ],
      new Set(),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Rice", quantities: ["1 cup"], checked: false, dbId: undefined });
  });

  it("buildCostcoItems returns only Costco rows, unchecked first", () => {
    const result = buildCostcoItems([
      dbItem({ id: "a", name: "Normal" }),
      dbItem({ id: "b", name: "Done", checked: true, isCostco: true }),
      dbItem({ id: "c", name: "Todo", isCostco: true }),
    ]);

    expect(result.map((i) => i.name)).toEqual(["Todo", "Done"]);
  });
});
