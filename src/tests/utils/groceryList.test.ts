import { describe, it, expect } from "vitest";
import {
  adjustQuantityString,
  buildGroceryList,
  computeGroceryAdjustments,
  formatGroceryQuantities,
  getPlannedMeals,
  presetItemsToAdjustments,
} from "../../lib/utils/groceryList";
import type { Meal, WeeklyPlan } from "../../lib/types";

function makeMeal(overrides: Partial<Meal> & { id: string }): Meal {
  return {
    name: overrides.id,
    duration: "short",
    supperDays: [],
    url: "",
    ingredients: [],
    instructions: [],
    ...overrides,
  };
}

describe("formatGroceryQuantities", () => {
  it("sums quantities with identical units", () => {
    expect(formatGroceryQuantities(["1 kg", "2 kg"])).toBe("3 kg");
  });

  it("merges units within edit distance 2", () => {
    expect(formatGroceryQuantities(["1 kg", "2 kgs"])).toBe("3 kgs");
  });

  it("keeps distinct units separate", () => {
    expect(formatGroceryQuantities(["1 kg", "2 tasses"])).toBe("1 kg, 2 tasses");
  });

  it("parses fractions", () => {
    expect(formatGroceryQuantities(["1/2 tasse", "1/2 tasse"])).toBe("1 tasse");
  });

  it("parses comma decimals the same as dot decimals", () => {
    expect(formatGroceryQuantities(["1,5 kg"])).toBe(formatGroceryQuantities(["1.5 kg"]));
  });

  it("passes through unparsable quantities unchanged", () => {
    expect(formatGroceryQuantities(["au goût"])).toBe("au goût");
  });

  it("returns an empty string for an empty list", () => {
    expect(formatGroceryQuantities([])).toBe("");
  });

  it("formats a leftover decimal as the nearest simple fraction", () => {
    expect(formatGroceryQuantities(["0.5"])).toBe("1/2");
  });
});

describe("adjustQuantityString", () => {
  it("adds to a base quantity", () => {
    expect(adjustQuantityString("1 kg", ["1 kg"], [])).toBe("2 kg");
  });

  it("subtracts from a base quantity", () => {
    expect(adjustQuantityString("2 kg", [], ["1 kg"])).toBe("1 kg");
  });

  it("returns null when the net result drops to zero", () => {
    expect(adjustQuantityString("1 kg", [], ["1 kg"])).toBeNull();
  });

  it("returns null when the net result goes negative", () => {
    expect(adjustQuantityString("1 kg", [], ["2 kg"])).toBeNull();
  });

  it("starts from null base and only adds", () => {
    expect(adjustQuantityString(null, ["1 kg"], [])).toBe("1 kg");
  });

  it("returns null for a null base with nothing to add", () => {
    expect(adjustQuantityString(null, [], [])).toBeNull();
  });

  it("keeps unparsable base text alongside numeric groups", () => {
    expect(adjustQuantityString("au goût", ["1 kg"], [])).toBe("1 kg, au goût");
  });
});

describe("buildGroceryList", () => {
  it("aggregates ingredient quantities across meals", () => {
    const meals: Meal[] = [
      makeMeal({
        id: "m1",
        ingredients: [{ name: "Tomate", category: "vegetables", quantity: "1" }],
      }),
      makeMeal({
        id: "m2",
        ingredients: [{ name: "Tomate", category: "vegetables", quantity: "2" }],
      }),
    ];
    const result = buildGroceryList(meals);
    expect(result).toEqual([
      { name: "Tomate", category: "vegetables", quantities: ["1", "2"] },
    ]);
  });

  it("sorts by category order then name", () => {
    const meals: Meal[] = [
      makeMeal({
        id: "m1",
        ingredients: [
          { name: "Poulet", category: "meat", quantity: "1" },
          { name: "Zeste citron", category: "vegetables", quantity: "1" },
          { name: "Ail", category: "vegetables", quantity: "1" },
        ],
      }),
    ];
    const result = buildGroceryList(meals);
    expect(result.map((i) => i.name)).toEqual(["Ail", "Zeste citron", "Poulet"]);
  });
});

describe("getPlannedMeals", () => {
  it("returns unique meals across the week in day order, skipping missing ids", () => {
    const meal1 = makeMeal({ id: "1" });
    const meal2 = makeMeal({ id: "2" });
    const meals = new Map([["1", meal1], ["2", meal2]]);
    const plan: WeeklyPlan = {
      monday: { diner: "1", supper: "2" },
      tuesday: { diner: "1" },
      wednesday: { diner: "missing" },
    };
    const result = getPlannedMeals(plan, (id) => meals.get(id));
    expect(result).toEqual([meal1, meal2]);
  });
});

describe("computeGroceryAdjustments", () => {
  it("reports an addition when a meal is newly planned", () => {
    const meal = makeMeal({
      id: "1",
      ingredients: [{ name: "Tomate", category: "vegetables", quantity: "1 kg" }],
    });
    const getMeal = (id: string) => (id === "1" ? meal : undefined);
    const oldPlan: WeeklyPlan = {};
    const newPlan: WeeklyPlan = { monday: { diner: "1" } };

    const result = computeGroceryAdjustments(oldPlan, newPlan, getMeal);
    expect(result).toEqual([
      { name: "Tomate", category: "vegetables", addQuantities: ["1 kg"], removeQuantities: [] },
    ]);
  });

  it("reports a removal when a meal is unplanned", () => {
    const meal = makeMeal({
      id: "1",
      ingredients: [{ name: "Tomate", category: "vegetables", quantity: "1 kg" }],
    });
    const getMeal = (id: string) => (id === "1" ? meal : undefined);
    const oldPlan: WeeklyPlan = { monday: { diner: "1" } };
    const newPlan: WeeklyPlan = {};

    const result = computeGroceryAdjustments(oldPlan, newPlan, getMeal);
    expect(result).toEqual([
      { name: "Tomate", category: "vegetables", addQuantities: [], removeQuantities: ["1 kg"] },
    ]);
  });

  it("produces no adjustment when the formatted quantity is unchanged", () => {
    const mealA = makeMeal({
      id: "a",
      ingredients: [{ name: "Tomate", category: "vegetables", quantity: "1 kg" }],
    });
    const mealB = makeMeal({
      id: "b",
      ingredients: [{ name: "Tomate", category: "vegetables", quantity: "1 kg" }],
    });
    const getMeal = (id: string) => ({ a: mealA, b: mealB })[id];
    const oldPlan: WeeklyPlan = { monday: { diner: "a" } };
    const newPlan: WeeklyPlan = { monday: { diner: "b" } };

    expect(computeGroceryAdjustments(oldPlan, newPlan, getMeal)).toEqual([]);
  });
});

describe("presetItemsToAdjustments", () => {
  it("maps items to additive adjustments", () => {
    expect(
      presetItemsToAdjustments(
        [{ name: "Riz", category: "aisle", quantity: "1 kg" }],
        "add",
      ),
    ).toEqual([
      { name: "Riz", category: "aisle", addQuantities: ["1 kg"], removeQuantities: [] },
    ]);
  });

  it("maps items to subtractive adjustments", () => {
    expect(
      presetItemsToAdjustments(
        [{ name: "Riz", category: "aisle", quantity: "1 kg" }],
        "remove",
      ),
    ).toEqual([
      { name: "Riz", category: "aisle", addQuantities: [], removeQuantities: ["1 kg"] },
    ]);
  });

  it("groups items sharing a name into one adjustment", () => {
    expect(
      presetItemsToAdjustments(
        [
          { name: "Riz", category: "aisle", quantity: "1 kg" },
          { name: "Riz", category: "aisle", quantity: "500 g" },
          { name: "Lait", category: "fridge", quantity: "1 L" },
        ],
        "add",
      ),
    ).toEqual([
      { name: "Riz", category: "aisle", addQuantities: ["1 kg", "500 g"], removeQuantities: [] },
      { name: "Lait", category: "fridge", addQuantities: ["1 L"], removeQuantities: [] },
    ]);
  });

  it("activation then deactivation nets back to the original quantity", () => {
    const preset = [{ name: "Riz", category: "aisle" as const, quantity: "1 kg" }];
    const [addAdj] = presetItemsToAdjustments(preset, "add");
    const afterAdd = adjustQuantityString("2 kg", addAdj!.addQuantities, addAdj!.removeQuantities);
    expect(afterAdd).toBe("3 kg");

    const [removeAdj] = presetItemsToAdjustments(preset, "remove");
    const afterRemove = adjustQuantityString(afterAdd, removeAdj!.addQuantities, removeAdj!.removeQuantities);
    expect(afterRemove).toBe("2 kg");
  });

  it("deactivation drops an item that nets to zero", () => {
    const preset = [{ name: "Riz", category: "aisle" as const, quantity: "1 kg" }];
    const [removeAdj] = presetItemsToAdjustments(preset, "remove");
    expect(adjustQuantityString("1 kg", removeAdj!.addQuantities, removeAdj!.removeQuantities)).toBeNull();
  });
});
