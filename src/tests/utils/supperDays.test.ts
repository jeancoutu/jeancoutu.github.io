import { describe, it, expect } from "vitest";
import { mealsEligibleForSupper } from "../../lib/utils/supperDays";
import type { DayKey, Meal } from "../../lib/types";

function makeMeal(id: string, supperDays: Meal["supperDays"], tags: string[] = []): Meal {
  return {
    id,
    name: id,
    duration: "short",
    supperDays,
    url: "",
    ingredients: [],
    instructions: [],
    tags,
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

  describe("tag spacing", () => {
    const allDays: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    it("excludes a same-tag meal on the day right after a placed tag when alternatives exist", () => {
      const meals = [makeMeal("a", allDays, ["pasta"]), makeMeal("b", allDays)];
      const placedTags = new Map<DayKey, Set<string>>([["monday", new Set(["pasta"])]]);
      const result = mealsEligibleForSupper(meals, "tuesday", new Set(), new Set(), placedTags);
      expect(result.map((m) => m.id)).toEqual(["b"]);
    });

    it("excludes a same-tag meal two days after a placed tag (gap 1, still too close)", () => {
      const meals = [makeMeal("a", allDays, ["pasta"]), makeMeal("b", allDays)];
      const placedTags = new Map<DayKey, Set<string>>([["monday", new Set(["pasta"])]]);
      const result = mealsEligibleForSupper(meals, "wednesday", new Set(), new Set(), placedTags);
      expect(result.map((m) => m.id)).toEqual(["b"]);
    });

    it("allows a same-tag meal three days after a placed tag (gap 2, satisfies T1)", () => {
      const meals = [makeMeal("a", allDays, ["pasta"]), makeMeal("b", allDays)];
      const placedTags = new Map<DayKey, Set<string>>([["monday", new Set(["pasta"])]]);
      const result = mealsEligibleForSupper(meals, "thursday", new Set(), new Set(), placedTags);
      expect(result.map((m) => m.id).sort()).toEqual(["a", "b"]);
    });

    it("relaxes the tag gap to 1 (allows adjacent-but-one) when no alternative satisfies gap 2", () => {
      const meals = [makeMeal("a", allDays, ["pasta"])];
      const placedTags = new Map<DayKey, Set<string>>([["monday", new Set(["pasta"])]]);
      const result = mealsEligibleForSupper(meals, "wednesday", new Set(), new Set(), placedTags);
      expect(result.map((m) => m.id)).toEqual(["a"]);
    });

    it("drops the tag constraint entirely when even gap 1 has no candidate", () => {
      const meals = [makeMeal("a", allDays, ["pasta"])];
      const placedTags = new Map<DayKey, Set<string>>([["monday", new Set(["pasta"])]]);
      const result = mealsEligibleForSupper(meals, "tuesday", new Set(), new Set(), placedTags);
      expect(result.map((m) => m.id)).toEqual(["a"]);
    });

    it("untagged meals are never blocked by tag spacing", () => {
      const meals = [makeMeal("a", allDays)];
      const placedTags = new Map<DayKey, Set<string>>([["monday", new Set(["pasta"])]]);
      const result = mealsEligibleForSupper(meals, "tuesday", new Set(), new Set(), placedTags);
      expect(result.map((m) => m.id)).toEqual(["a"]);
    });

    it("does not conflict with itself when a tag is already placed on the same day", () => {
      const meals = [makeMeal("a", allDays, ["pasta"])];
      const placedTags = new Map<DayKey, Set<string>>([["monday", new Set(["pasta"])]]);
      const result = mealsEligibleForSupper(meals, "monday", new Set(), new Set(), placedTags);
      expect(result.map((m) => m.id)).toEqual(["a"]);
    });
  });
});
