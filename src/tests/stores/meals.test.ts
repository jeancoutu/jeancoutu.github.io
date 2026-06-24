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

  it("allMeals includes built-in meals", async () => {
    const { allMeals } = await importMeals();
    expect(get(allMeals).length).toBeGreaterThan(0);
  });

  it("allMeals starts with no custom meals added", async () => {
    const { customMeals, allMeals } = await importMeals();
    const builtInCount = get(allMeals).length;
    customMeals.set([]);
    expect(get(allMeals).length).toBe(builtInCount);
  });

  it("allMeals includes custom meals appended after built-ins", async () => {
    const { customMeals, allMeals } = await importMeals();
    const builtInCount = get(allMeals).length;
    const custom = makeMeal({ id: "brand-new-custom", name: "My Custom Dish" });
    customMeals.set([custom]);
    expect(get(allMeals).length).toBe(builtInCount + 1);
    expect(get(allMeals).at(-1)?.id).toBe("brand-new-custom");
  });

  it("allMeals overrides built-in meal when custom has same id", async () => {
    const { customMeals, allMeals } = await importMeals();
    const builtIns = get(allMeals);
    const firstBuiltIn = builtIns[0];
    const override = { ...firstBuiltIn, name: "Overridden Name" };
    customMeals.set([override]);
    const merged = get(allMeals);
    expect(merged.length).toBe(builtIns.length);
    const found = merged.find((m) => m.id === firstBuiltIn.id);
    expect(found?.name).toBe("Overridden Name");
  });

  it("filteredMeals returns all meals when search is empty", async () => {
    const { allMeals, filteredMeals, mealSearch } = await importMeals();
    mealSearch.set("");
    expect(get(filteredMeals).length).toBe(get(allMeals).length);
  });

  it("filteredMeals filters by name search (case-insensitive)", async () => {
    const { customMeals, filteredMeals, mealSearch } = await importMeals();
    customMeals.set([
      makeMeal({ id: "c1", name: "Chicken Soup" }),
      makeMeal({ id: "c2", name: "Beef Stew" }),
    ]);
    mealSearch.set("chicken");
    const results = get(filteredMeals);
    expect(results.some((m) => m.name === "Chicken Soup")).toBe(true);
    expect(results.some((m) => m.name === "Beef Stew")).toBe(false);
  });

  it("filteredMeals filters by duration", async () => {
    const { customMeals, filteredMeals, mealSearch, durationFilter } = await importMeals();
    customMeals.set([
      makeMeal({ id: "c1", name: "Quick Dish", duration: "short" }),
      makeMeal({ id: "c2", name: "Slow Roast", duration: "long" }),
    ]);
    mealSearch.set("");
    durationFilter.set("short");
    const results = get(filteredMeals);
    expect(results.every((m) => m.duration === "short")).toBe(true);
  });

  it("filteredMeals returns all durations when filter is 'all'", async () => {
    const { customMeals, filteredMeals, mealSearch, durationFilter, allMeals } = await importMeals();
    customMeals.set([
      makeMeal({ id: "c1", name: "Short Dish", duration: "short" }),
      makeMeal({ id: "c2", name: "Long Dish", duration: "long" }),
    ]);
    mealSearch.set("");
    durationFilter.set("all");
    expect(get(filteredMeals).length).toBe(get(allMeals).length);
  });

  it("isCustomMeal returns false for built-in meals", async () => {
    const { allMeals, isCustomMeal } = await importMeals();
    const builtInId = get(allMeals)[0].id;
    expect(isCustomMeal(builtInId)).toBe(false);
  });

  it("isCustomMeal returns true for custom meals", async () => {
    const { customMeals, isCustomMeal } = await importMeals();
    customMeals.set([makeMeal({ id: "my-custom" })]);
    expect(isCustomMeal("my-custom")).toBe(true);
  });

  it("getMealById finds built-in meals", async () => {
    const { allMeals, getMealById } = await importMeals();
    const id = get(allMeals)[0].id;
    expect(getMealById(id)?.id).toBe(id);
  });

  it("getMealById returns undefined for unknown id", async () => {
    const { getMealById } = await importMeals();
    expect(getMealById("does-not-exist")).toBeUndefined();
  });

  it("addCustomMeal calls API and adds to store", async () => {
    const { customMeals, addCustomMeal } = await importMeals();
    const { createMeal } = await import("../../lib/api/meals");
    customMeals.set([]);
    await addCustomMeal({
      name: "New Dish",
      duration: "medium",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
    });
    expect(createMeal).toHaveBeenCalled();
    expect(get(customMeals).some((m) => m.id === "custom-1")).toBe(true);
  });

  it("deleteCustomMeal calls API and removes from store", async () => {
    const { customMeals, deleteCustomMeal } = await importMeals();
    const { deleteMeal } = await import("../../lib/api/meals");
    customMeals.set([makeMeal({ id: "to-delete" })]);
    await deleteCustomMeal("to-delete");
    expect(deleteMeal).toHaveBeenCalledWith("to-delete");
    expect(get(customMeals).some((m) => m.id === "to-delete")).toBe(false);
  });

  it("updateCustomMeal updates existing custom meal in store", async () => {
    const { customMeals, updateCustomMeal } = await importMeals();
    const { updateMeal } = await import("../../lib/api/meals");
    customMeals.set([makeMeal({ id: "c-existing", name: "Old Name" })]);
    await updateCustomMeal("c-existing", {
      name: "New Name",
      duration: "short",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
    });
    expect(updateMeal).toHaveBeenCalledWith("c-existing", expect.objectContaining({ name: "New Name" }));
    expect(get(customMeals).find((m) => m.id === "c-existing")?.name).toBe("New Name");
  });

  it("updateCustomMeal creates a copy when editing a built-in meal", async () => {
    const { allMeals, updateCustomMeal } = await importMeals();
    const { createMeal } = await import("../../lib/api/meals");
    vi.mocked(createMeal).mockClear();
    const builtInId = get(allMeals)[0].id;
    await updateCustomMeal(builtInId, {
      name: "My Override",
      duration: "short",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
    });
    expect(createMeal).toHaveBeenCalled();
  });
});
