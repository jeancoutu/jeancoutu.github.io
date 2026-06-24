import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";

vi.mock("../../lib/api/plan", () => ({
  getWeeklyPlan: vi.fn().mockResolvedValue({}),
  setMealSlot: vi.fn().mockResolvedValue(undefined),
  clearPlan: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/api/meals", () => ({
  getMeals: vi.fn().mockResolvedValue([]),
  createMeal: vi.fn(),
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
}));

describe("weeklyPlan store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function importStore() {
    const { weeklyPlan, selectedWeek, allPlans } = await import("../../lib/stores/weeklyPlan");
    const { setMealSlot, clearPlan, getWeeklyPlan } = await import("../../lib/api/plan");
    return { weeklyPlan, selectedWeek, allPlans, setMealSlot, clearPlan, getWeeklyPlan };
  }

  it("starts with empty plan for current week", async () => {
    const { weeklyPlan } = await importStore();
    expect(get(weeklyPlan)).toEqual({});
  });

  it("setDay calls setMealSlot API and updates the plan", async () => {
    const { weeklyPlan, selectedWeek, setMealSlot } = await importStore();
    const week = get(selectedWeek);
    await weeklyPlan.setDay("monday", "supper", "meal-abc");
    expect(setMealSlot).toHaveBeenCalledWith(week, "monday", "supper", "meal-abc");
    expect(get(weeklyPlan).monday?.supper).toBe("meal-abc");
  });

  it("setDay removes the slot when mealId is undefined", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("monday", "supper", "meal-abc");
    await weeklyPlan.setDay("monday", "supper", undefined);
    expect(get(weeklyPlan).monday?.supper).toBeUndefined();
  });

  it("setDay removes the day entry when all slots cleared", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("monday", "supper", "meal-abc");
    await weeklyPlan.setDay("monday", "supper", undefined);
    expect(get(weeklyPlan).monday).toBeUndefined();
  });

  it("clearWeek calls clearPlan and empties the plan", async () => {
    const { weeklyPlan, clearPlan } = await importStore();
    await weeklyPlan.setDay("monday", "supper", "meal-1");
    await weeklyPlan.clearWeek();
    expect(clearPlan).toHaveBeenCalled();
    expect(get(weeklyPlan)).toEqual({});
  });

  it("importPlan sets the weekly plan and switches to the given week", async () => {
    const { weeklyPlan, selectedWeek } = await importStore();
    const plan = { monday: { supper: "meal-x" } };
    await weeklyPlan.importPlan(plan, "2025-W01");
    expect(get(selectedWeek)).toBe("2025-W01");
    expect(get(weeklyPlan).monday?.supper).toBe("meal-x");
  });

  it("importPlan calls setMealSlot for each day/slot in the plan", async () => {
    const { weeklyPlan, setMealSlot } = await importStore();
    vi.mocked(setMealSlot).mockClear();
    const plan = { monday: { supper: "meal-a" }, tuesday: { diner: "meal-b" } };
    await weeklyPlan.importPlan(plan, "2025-W02");
    const calls = vi.mocked(setMealSlot).mock.calls;
    expect(calls.some((c) => c[1] === "monday" && c[2] === "supper" && c[3] === "meal-a")).toBe(true);
    expect(calls.some((c) => c[1] === "tuesday" && c[2] === "diner" && c[3] === "meal-b")).toBe(true);
  });

  it("setSelectedWeek switches the active week and loads it if not cached", async () => {
    const { weeklyPlan, selectedWeek, getWeeklyPlan } = await importStore();
    vi.mocked(getWeeklyPlan).mockResolvedValue({ friday: { supper: "meal-z" } });
    await weeklyPlan.setSelectedWeek("2025-W10");
    expect(get(selectedWeek)).toBe("2025-W10");
    expect(getWeeklyPlan).toHaveBeenCalledWith("2025-W10");
  });

  it("setSelectedWeek does not reload if week is already cached", async () => {
    const { weeklyPlan, getWeeklyPlan } = await importStore();
    vi.mocked(getWeeklyPlan).mockClear();
    await weeklyPlan.setSelectedWeek("2025-W11");
    const callCount = vi.mocked(getWeeklyPlan).mock.calls.length;
    await weeklyPlan.setSelectedWeek("2025-W11");
    expect(vi.mocked(getWeeklyPlan).mock.calls.length).toBe(callCount);
  });

  it("getSnapshot returns a copy of the current plan", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("wednesday", "supper", "meal-snap");
    const snap = weeklyPlan.getSnapshot();
    expect(snap.wednesday?.supper).toBe("meal-snap");
  });

  it("getSelectedWeek returns the current week key", async () => {
    const { weeklyPlan, selectedWeek } = await importStore();
    const week = get(selectedWeek);
    expect(weeklyPlan.getSelectedWeek()).toBe(week);
  });

  it("getAllPlans returns the full plans map", async () => {
    const { weeklyPlan, selectedWeek } = await importStore();
    await weeklyPlan.setDay("thursday", "supper", "meal-all");
    const week = get(selectedWeek);
    const all = weeklyPlan.getAllPlans();
    expect(all[week]?.thursday?.supper).toBe("meal-all");
  });
});
