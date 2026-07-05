import { describe, it, expect } from "vitest";
import { mealsEligibleForSupper } from "../../lib/utils/supperDays";
import type { Meal } from "../../lib/types";

function makeMeal(id: string, supperDays: Meal["supperDays"]): Meal {
  return {
    id,
    name: id,
    duration: "short",
    supperDays,
    url: "",
    ingredients: [],
    instructions: [],
  };
}

describe("mealsEligibleForSupper", () => {
  it("excludes a meal used last week when other eligible meals exist", () => {
    const meals = [makeMeal("a", ["monday"]), makeMeal("b", ["monday"])];
    const previousWeekIds = new Set(["a"]);
    const result = mealsEligibleForSupper(meals, "monday", new Set(), previousWeekIds);
    expect(result.map((m) => m.id)).toEqual(["b"]);
  });

  it("falls back to the previous week's meal when it's the only day-eligible option", () => {
    const meals = [makeMeal("a", ["monday"]), makeMeal("b", ["tuesday"])];
    const previousWeekIds = new Set(["a"]);
    const result = mealsEligibleForSupper(meals, "monday", new Set(), previousWeekIds);
    expect(result.map((m) => m.id)).toEqual(["a"]);
  });

  it("behaves as before when previousWeekIds is empty", () => {
    const meals = [makeMeal("a", ["monday"]), makeMeal("b", ["monday"])];
    const result = mealsEligibleForSupper(meals, "monday", new Set());
    expect(result.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });
});
