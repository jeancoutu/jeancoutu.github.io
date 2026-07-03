import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Meal } from "../../lib/types";

vi.mock("../../lib/api/meals", () => ({
  getMeals: vi.fn().mockResolvedValue([]),
  createMeal: vi.fn().mockImplementation((payload) =>
    Promise.resolve({ id: "custom-1", ...payload })
  ),
  updateMeal: vi.fn().mockImplementation((id, payload) =>
    Promise.resolve({ id, ...payload })
  ),
  deleteMeal: vi.fn().mockResolvedValue(undefined),
}));

const makeMeal = (overrides: Partial<Meal> = {}): Meal => ({
  id: "test-meal",
  name: "Test Meal",
  duration: "short",
  supperDays: ["monday"],
  url: "",
  ingredients: [],
  instructions: [],
  ...overrides,
});

describe("meals store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function importMeals() {
    const mod = await import("../../lib/stores/meals.svelte");
    return mod;
  }

  it("allMeals starts empty (no session)", async () => {
    const { meals } = await importMeals();
    expect(meals.all.length).toBe(0);
  });

  it("filteredMeals returns all meals when search is empty", async () => {
    const { meals } = await importMeals();
    meals.all = [makeMeal({ id: "c1" }), makeMeal({ id: "c2" })];
    meals.search = "";
    expect(meals.filtered.length).toBe(meals.all.length);
  });

  it("filteredMeals filters by name search (case-insensitive)", async () => {
    const { meals } = await importMeals();
    meals.all = [
      makeMeal({ id: "c1", name: "Chicken Soup" }),
      makeMeal({ id: "c2", name: "Beef Stew" }),
    ];
    meals.search = "chicken";
    const results = meals.filtered;
    expect(results.some((m) => m.name === "Chicken Soup")).toBe(true);
    expect(results.some((m) => m.name === "Beef Stew")).toBe(false);
  });

  it("filteredMeals filters by duration", async () => {
    const { meals } = await importMeals();
    meals.all = [
      makeMeal({ id: "c1", name: "Quick Dish", duration: "short" }),
      makeMeal({ id: "c2", name: "Slow Roast", duration: "long" }),
    ];
    meals.search = "";
    meals.durationFilter = "short";
    const results = meals.filtered;
    expect(results.every((m) => m.duration === "short")).toBe(true);
  });

  it("filteredMeals returns all durations when filter is 'all'", async () => {
    const { meals } = await importMeals();
    meals.all = [
      makeMeal({ id: "c1", name: "Short Dish", duration: "short" }),
      makeMeal({ id: "c2", name: "Long Dish", duration: "long" }),
    ];
    meals.search = "";
    meals.durationFilter = "all";
    expect(meals.filtered.length).toBe(meals.all.length);
  });

  it("getMealById finds a meal by id", async () => {
    const { meals, getMealById } = await importMeals();
    meals.all = [makeMeal({ id: "find-me" })];
    expect(getMealById("find-me")?.id).toBe("find-me");
  });

  it("getMealById returns undefined for unknown id", async () => {
    const { getMealById } = await importMeals();
    expect(getMealById("does-not-exist")).toBeUndefined();
  });

  it("addMeal calls API and adds to store", async () => {
    const { meals, addMeal } = await importMeals();
    const { createMeal } = await import("../../lib/api/meals");
    meals.all = [];
    await addMeal({
      name: "New Dish",
      duration: "medium",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
    });
    expect(createMeal).toHaveBeenCalled();
    expect(meals.all.some((m) => m.id === "custom-1")).toBe(true);
  });

  it("deleteMealById calls API and removes from store", async () => {
    const { meals, deleteMealById } = await importMeals();
    const { deleteMeal } = await import("../../lib/api/meals");
    meals.all = [makeMeal({ id: "to-delete" })];
    await deleteMealById("to-delete");
    expect(deleteMeal).toHaveBeenCalledWith("to-delete");
    expect(meals.all.some((m) => m.id === "to-delete")).toBe(false);
  });

  it("updateMealById calls API and updates meal in store", async () => {
    const { meals, updateMealById } = await importMeals();
    const { updateMeal } = await import("../../lib/api/meals");
    meals.all = [makeMeal({ id: "c-existing", name: "Old Name" })];
    await updateMealById("c-existing", {
      name: "New Name",
      duration: "short",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
    });
    expect(updateMeal).toHaveBeenCalledWith("c-existing", expect.objectContaining({ name: "New Name" }));
    expect(meals.all.find((m) => m.id === "c-existing")?.name).toBe("New Name");
  });
});
