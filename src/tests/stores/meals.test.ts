import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
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
    const mod = await import("../../lib/stores/meals");
    return mod;
  }

  it("allMeals starts empty (no session)", async () => {
    const { allMeals } = await importMeals();
    expect(get(allMeals).length).toBe(0);
  });

  it("filteredMeals returns all meals when search is empty", async () => {
    const { allMeals, filteredMeals, mealSearch } = await importMeals();
    allMeals.set([makeMeal({ id: "c1" }), makeMeal({ id: "c2" })]);
    mealSearch.set("");
    expect(get(filteredMeals).length).toBe(get(allMeals).length);
  });

  it("filteredMeals filters by name search (case-insensitive)", async () => {
    const { allMeals, filteredMeals, mealSearch } = await importMeals();
    allMeals.set([
      makeMeal({ id: "c1", name: "Chicken Soup" }),
      makeMeal({ id: "c2", name: "Beef Stew" }),
    ]);
    mealSearch.set("chicken");
    const results = get(filteredMeals);
    expect(results.some((m) => m.name === "Chicken Soup")).toBe(true);
    expect(results.some((m) => m.name === "Beef Stew")).toBe(false);
  });

  it("filteredMeals filters by duration", async () => {
    const { allMeals, filteredMeals, mealSearch, durationFilter } = await importMeals();
    allMeals.set([
      makeMeal({ id: "c1", name: "Quick Dish", duration: "short" }),
      makeMeal({ id: "c2", name: "Slow Roast", duration: "long" }),
    ]);
    mealSearch.set("");
    durationFilter.set("short");
    const results = get(filteredMeals);
    expect(results.every((m) => m.duration === "short")).toBe(true);
  });

  it("filteredMeals returns all durations when filter is 'all'", async () => {
    const { allMeals, filteredMeals, mealSearch, durationFilter } = await importMeals();
    allMeals.set([
      makeMeal({ id: "c1", name: "Short Dish", duration: "short" }),
      makeMeal({ id: "c2", name: "Long Dish", duration: "long" }),
    ]);
    mealSearch.set("");
    durationFilter.set("all");
    expect(get(filteredMeals).length).toBe(get(allMeals).length);
  });

  it("getMealById finds a meal by id", async () => {
    const { allMeals, getMealById } = await importMeals();
    allMeals.set([makeMeal({ id: "find-me" })]);
    expect(getMealById("find-me")?.id).toBe("find-me");
  });

  it("getMealById returns undefined for unknown id", async () => {
    const { getMealById } = await importMeals();
    expect(getMealById("does-not-exist")).toBeUndefined();
  });

  it("addMeal calls API and adds to store", async () => {
    const { allMeals, addMeal } = await importMeals();
    const { createMeal } = await import("../../lib/api/meals");
    allMeals.set([]);
    await addMeal({
      name: "New Dish",
      duration: "medium",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
    });
    expect(createMeal).toHaveBeenCalled();
    expect(get(allMeals).some((m) => m.id === "custom-1")).toBe(true);
  });

  it("deleteMealById calls API and removes from store", async () => {
    const { allMeals, deleteMealById } = await importMeals();
    const { deleteMeal } = await import("../../lib/api/meals");
    allMeals.set([makeMeal({ id: "to-delete" })]);
    await deleteMealById("to-delete");
    expect(deleteMeal).toHaveBeenCalledWith("to-delete");
    expect(get(allMeals).some((m) => m.id === "to-delete")).toBe(false);
  });

  it("updateMealById calls API and updates meal in store", async () => {
    const { allMeals, updateMealById } = await importMeals();
    const { updateMeal } = await import("../../lib/api/meals");
    allMeals.set([makeMeal({ id: "c-existing", name: "Old Name" })]);
    await updateMealById("c-existing", {
      name: "New Name",
      duration: "short",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
    });
    expect(updateMeal).toHaveBeenCalledWith("c-existing", expect.objectContaining({ name: "New Name" }));
    expect(get(allMeals).find((m) => m.id === "c-existing")?.name).toBe("New Name");
  });
});
