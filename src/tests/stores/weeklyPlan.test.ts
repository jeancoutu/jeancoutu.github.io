import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/api/plan", () => ({
  getWeeklyPlan: vi.fn().mockResolvedValue({ plan: {}, dismissedNames: [] }),
  setMealSlot: vi.fn().mockResolvedValue("mock-weekly-plan-id"),
  setDayNote: vi.fn().mockResolvedValue(undefined),
  clearWeekData: vi.fn().mockResolvedValue(undefined),
  bulkSetWeekPlan: vi.fn().mockResolvedValue(undefined),
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
    const { weeklyPlan } = await import("../../lib/stores/weeklyPlan.svelte");
    const { setMealSlot, setDayNote, clearWeekData, getWeeklyPlan, bulkSetWeekPlan } = await import("../../lib/api/plan");
    return { weeklyPlan, setMealSlot, setDayNote, clearWeekData, getWeeklyPlan, bulkSetWeekPlan };
  }

  it("starts with empty plan for current week", async () => {
    const { weeklyPlan } = await importStore();
    expect(weeklyPlan.current).toEqual({});
  });

  it("setDay calls setMealSlot API and updates the plan", async () => {
    const { weeklyPlan, setMealSlot } = await importStore();
    const week = weeklyPlan.selectedWeek;
    await weeklyPlan.setDay("monday", "supper", "meal-abc");
    expect(setMealSlot).toHaveBeenCalledWith(week, "monday", "supper", "meal-abc");
    expect(weeklyPlan.current.monday?.supper).toBe("meal-abc");
  });

  it("setDay removes the slot when mealId is undefined", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("monday", "supper", "meal-abc");
    await weeklyPlan.setDay("monday", "supper", undefined);
    expect(weeklyPlan.current.monday?.supper).toBeUndefined();
  });

  it("setDay removes the day entry when all slots cleared", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("monday", "supper", "meal-abc");
    await weeklyPlan.setDay("monday", "supper", undefined);
    expect(weeklyPlan.current.monday).toBeUndefined();
  });

  it("clearWeek calls clearWeekData and empties the plan", async () => {
    const { weeklyPlan, clearWeekData } = await importStore();
    await weeklyPlan.setDay("monday", "supper", "meal-1");
    await weeklyPlan.clearWeek();
    expect(clearWeekData).toHaveBeenCalled();
    expect(weeklyPlan.current).toEqual({});
  });

  it("importPlan sets the weekly plan and switches to the given week", async () => {
    const { weeklyPlan } = await importStore();
    const plan = { monday: { supper: "meal-x" } };
    await weeklyPlan.importPlan(plan, "2025-W01");
    expect(weeklyPlan.selectedWeek).toBe("2025-W01");
    expect(weeklyPlan.current.monday?.supper).toBe("meal-x");
  });

  it("importPlan calls bulkSetWeekPlan with the given plan", async () => {
    const { weeklyPlan, bulkSetWeekPlan } = await importStore();
    const plan = { monday: { supper: "meal-a" }, tuesday: { diner: "meal-b" } };
    await weeklyPlan.importPlan(plan, "2025-W02");
    expect(bulkSetWeekPlan).toHaveBeenCalledWith("2025-W02", plan);
  });

  it("setSelectedWeek switches the active week and loads it if not cached", async () => {
    const { weeklyPlan, getWeeklyPlan } = await importStore();
    vi.mocked(getWeeklyPlan).mockResolvedValue({ plan: { friday: { supper: "meal-z" } }, dismissedNames: [] });
    await weeklyPlan.setSelectedWeek("2025-W10");
    expect(weeklyPlan.selectedWeek).toBe("2025-W10");
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
    const { weeklyPlan } = await importStore();
    const week = weeklyPlan.selectedWeek;
    expect(weeklyPlan.getSelectedWeek()).toBe(week);
  });

  it("getAllPlans returns the full plans map", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("thursday", "supper", "meal-all");
    const week = weeklyPlan.selectedWeek;
    const all = weeklyPlan.getAllPlans();
    expect(all[week]?.thursday?.supper).toBe("meal-all");
  });

  it("setDayNote calls the API and updates the plan", async () => {
    const { weeklyPlan, setDayNote } = await importStore();
    const week = weeklyPlan.selectedWeek;
    await weeklyPlan.setDayNote("monday", "Leftovers night");
    expect(setDayNote).toHaveBeenCalledWith(week, "monday", "Leftovers night");
    expect(weeklyPlan.current.monday?.note).toBe("Leftovers night");
  });

  it("setDayNote creates a day entry even when no meals are assigned", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDayNote("tuesday", "Order pizza");
    expect(weeklyPlan.current.tuesday).toEqual({ note: "Order pizza" });
  });

  it("setDayNote(null) clears the note but keeps the day entry when meals are assigned", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("wednesday", "supper", "meal-abc");
    await weeklyPlan.setDayNote("wednesday", "Note to remove");
    await weeklyPlan.setDayNote("wednesday", null);
    expect(weeklyPlan.current.wednesday?.note).toBeUndefined();
    expect(weeklyPlan.current.wednesday?.supper).toBe("meal-abc");
  });

  it("setDayNote(null) removes the day entry when there are no meals", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDayNote("thursday", "Temporary note");
    await weeklyPlan.setDayNote("thursday", null);
    expect(weeklyPlan.current.thursday).toBeUndefined();
  });

  it("clearing the last meal slot preserves an existing note", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDayNote("friday", "Keep this note");
    await weeklyPlan.setDay("friday", "supper", "meal-x");
    await weeklyPlan.setDay("friday", "supper", undefined);
    expect(weeklyPlan.current.friday?.supper).toBeUndefined();
    expect(weeklyPlan.current.friday?.note).toBe("Keep this note");
  });
});
