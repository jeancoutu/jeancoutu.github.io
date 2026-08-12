import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Meal } from "../../lib/types";

vi.mock("../../lib/repos/mealRepo", () => ({
  mealRepo: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((payload) =>
      Promise.resolve({ id: "custom-1", ...payload })
    ),
    update: vi.fn().mockImplementation((id, payload) =>
      Promise.resolve({ id, ...payload })
    ),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../lib/repos/weeklyPlanRepo", () => ({
  weeklyPlanRepo: {
    clearMealFromAllPlans: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../lib/stores/weeklyPlan.svelte", () => ({
  weeklyPlan: {
    getSelectedWeek: vi.fn().mockReturnValue("2025-01-04"),
    reloadWeek: vi.fn().mockResolvedValue(undefined),
    invalidateWeek: vi.fn(),
  },
}));

const makeMeal = (overrides: Partial<Meal> = {}): Meal => ({
  id: "test-meal",
  name: "Test Meal",
  duration: "short",
  supperDays: ["monday"],
  url: "",
  ingredients: [],
  instructions: [],
  tags: [],
  needsPrepAhead: false,
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

  it("getMealById finds a meal by id", async () => {
    const { meals, getMealById } = await importMeals();
    meals.all = [makeMeal({ id: "find-me" })];
    expect(getMealById("find-me")?.id).toBe("find-me");
  });

  it("getMealById returns undefined for unknown id", async () => {
    const { getMealById } = await importMeals();
    expect(getMealById("does-not-exist")).toBeUndefined();
  });

  it("addMeal calls the repo and adds to store", async () => {
    const { meals, addMeal } = await importMeals();
    const { mealRepo } = await import("../../lib/repos/mealRepo");
    meals.all = [];
    await addMeal({
      name: "New Dish",
      duration: "medium",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
      needsPrepAhead: false,
    });
    expect(mealRepo.create).toHaveBeenCalled();
    expect(meals.all.some((m) => m.id === "custom-1")).toBe(true);
  });

  it("deleteMealById calls the repo and removes from store", async () => {
    const { meals, deleteMealById } = await importMeals();
    const { mealRepo } = await import("../../lib/repos/mealRepo");
    meals.all = [makeMeal({ id: "to-delete" })];
    await deleteMealById("to-delete");
    expect(mealRepo.delete).toHaveBeenCalledWith("to-delete");
    expect(meals.all.some((m) => m.id === "to-delete")).toBe(false);
  });

  it("deleteMealById clears the meal from weekly plans and reloads the selected week if affected", async () => {
    const { deleteMealById } = await importMeals();
    const { weeklyPlanRepo } = await import("../../lib/repos/weeklyPlanRepo");
    const { weeklyPlan } = await import("../../lib/stores/weeklyPlan.svelte");
    vi.mocked(weeklyPlanRepo.clearMealFromAllPlans).mockResolvedValueOnce(["2025-01-04", "2025-01-11"]);
    vi.mocked(weeklyPlan.getSelectedWeek).mockReturnValueOnce("2025-01-04");

    await deleteMealById("to-delete");

    expect(weeklyPlanRepo.clearMealFromAllPlans).toHaveBeenCalledWith("to-delete");
    expect(weeklyPlan.reloadWeek).toHaveBeenCalled();
    expect(weeklyPlan.invalidateWeek).toHaveBeenCalledWith("2025-01-11");
    expect(weeklyPlan.invalidateWeek).not.toHaveBeenCalledWith("2025-01-04");
  });

  it("updateMealById calls the repo and updates meal in store", async () => {
    const { meals, updateMealById } = await importMeals();
    const { mealRepo } = await import("../../lib/repos/mealRepo");
    meals.all = [makeMeal({ id: "c-existing", name: "Old Name" })];
    await updateMealById("c-existing", {
      name: "New Name",
      duration: "short",
      supperDays: ["monday"],
      url: "",
      ingredients: [],
      instructions: [],
      needsPrepAhead: false,
    });
    expect(mealRepo.update).toHaveBeenCalledWith("c-existing", expect.objectContaining({ name: "New Name" }));
    expect(meals.all.find((m) => m.id === "c-existing")?.name).toBe("New Name");
  });
});
