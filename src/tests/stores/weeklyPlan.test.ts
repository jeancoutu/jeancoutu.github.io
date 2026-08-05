import { describe, it, expect, beforeEach, vi } from "vitest";

function planRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    weekStart: "mock-week",
    plan: {},
    dismissedNames: [],
    presetIds: [],
    version: 1,
    updatedAt: "now",
    deletedAt: null,
    ...overrides,
  };
}

const mockGetByWeek = vi.fn();
const mockGetOrCreate = vi.fn();
const mockSave = vi.fn();
const mockSetPlan = vi.fn();
const mockGetMealIds = vi.fn();
const mockClearPlan = vi.fn();
const mockDismissIngredient = vi.fn();
const mockUndismissIngredient = vi.fn();

vi.mock("../../lib/repos/weeklyPlanRepo", () => ({
  weeklyPlanRepo: {
    getByWeek: (...args: unknown[]) => mockGetByWeek(...args),
    getOrCreate: (...args: unknown[]) => mockGetOrCreate(...args),
    save: (...args: unknown[]) => mockSave(...args),
    setPlan: (...args: unknown[]) => mockSetPlan(...args),
    getMealIds: (...args: unknown[]) => mockGetMealIds(...args),
    clearPlan: (...args: unknown[]) => mockClearPlan(...args),
    dismissIngredient: (...args: unknown[]) => mockDismissIngredient(...args),
    undismissIngredient: (...args: unknown[]) => mockUndismissIngredient(...args),
  },
}));

const mockApplyAdjustments = vi.fn();
const mockDeleteAll = vi.fn();
const mockReplaceAll = vi.fn();
const mockDeleteItem = vi.fn();

vi.mock("../../lib/repos/groceryItemRepo", () => ({
  groceryItemRepo: {
    applyAdjustments: (...args: unknown[]) => mockApplyAdjustments(...args),
    deleteAll: (...args: unknown[]) => mockDeleteAll(...args),
    replaceAll: (...args: unknown[]) => mockReplaceAll(...args),
    delete: (...args: unknown[]) => mockDeleteItem(...args),
  },
}));

vi.mock("../../lib/repos/mealRepo", () => ({
  mealRepo: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("weeklyPlan store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetByWeek.mockResolvedValue(undefined);
    mockGetOrCreate.mockImplementation(async (weekStart: string) => planRow({ weekStart }));
    mockSave.mockImplementation(async (row: ReturnType<typeof planRow>, patch: Record<string, unknown>) => ({
      ...row,
      ...patch,
    }));
    mockSetPlan.mockImplementation(async (weekStart: string, plan: unknown) => planRow({ weekStart, plan }));
    mockGetMealIds.mockResolvedValue(new Set());
    mockClearPlan.mockResolvedValue(planRow());
    mockDismissIngredient.mockResolvedValue(planRow());
    mockUndismissIngredient.mockResolvedValue(planRow());
    mockApplyAdjustments.mockResolvedValue(null);
    mockDeleteAll.mockResolvedValue(undefined);
    mockReplaceAll.mockResolvedValue([]);
    mockDeleteItem.mockResolvedValue(undefined);
  });

  async function importStore() {
    const { weeklyPlan } = await import("../../lib/stores/weeklyPlan.svelte");
    const { meals } = await import("../../lib/stores/meals.svelte");
    return { weeklyPlan, meals };
  }

  it("starts with empty plan for current week", async () => {
    const { weeklyPlan } = await importStore();
    expect(weeklyPlan.current).toEqual({});
  });

  it("setDay creates/updates the weekly plan row and updates the plan", async () => {
    const { weeklyPlan } = await importStore();
    const week = weeklyPlan.selectedWeek;
    await weeklyPlan.setDay("monday", "supper", "meal-abc");
    expect(mockGetOrCreate).toHaveBeenCalledWith(week);
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

  it("setDay rejects (rather than resolving silently) when the underlying save fails", async () => {
    const { weeklyPlan } = await importStore();
    mockSave.mockRejectedValueOnce(new Error("DataCloneError"));
    await expect(weeklyPlan.setDay("monday", "supper", "meal-abc")).rejects.toThrow("DataCloneError");
  });

  it("swapSlots rejects (rather than resolving silently) when the underlying save fails", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("monday", "supper", "meal-a");
    await weeklyPlan.setDay("tuesday", "diner", "meal-b");
    mockSave.mockRejectedValueOnce(new Error("DataCloneError"));
    await expect(
      weeklyPlan.swapSlots({ day: "monday", slot: "supper" }, { day: "tuesday", slot: "diner" }),
    ).rejects.toThrow("DataCloneError");
  });

  it("clearWeek clears the plan row and grocery items", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDay("monday", "supper", "meal-1");
    mockClearPlan.mockResolvedValue(planRow({ id: "plan-1" }));
    await weeklyPlan.clearWeek();
    expect(mockClearPlan).toHaveBeenCalled();
    expect(mockDeleteAll).toHaveBeenCalledWith("plan-1");
    expect(weeklyPlan.current).toEqual({});
  });

  it("importPlan sets the weekly plan and switches to the given week", async () => {
    const { weeklyPlan } = await importStore();
    const plan = { monday: { supper: "meal-x" } };
    await weeklyPlan.importPlan(plan, "2025-W01");
    expect(weeklyPlan.selectedWeek).toBe("2025-W01");
    expect(weeklyPlan.current.monday?.supper).toBe("meal-x");
  });

  it("importPlan calls setPlan with the given plan", async () => {
    const { weeklyPlan } = await importStore();
    const plan = { monday: { supper: "meal-a" }, tuesday: { diner: "meal-b" } };
    await weeklyPlan.importPlan(plan, "2025-W02");
    expect(mockSetPlan).toHaveBeenCalledWith("2025-W02", plan);
  });

  it("setSelectedWeek switches the active week and loads it if not cached", async () => {
    const { weeklyPlan } = await importStore();
    mockGetByWeek.mockResolvedValue(planRow({ plan: { friday: { supper: "meal-z" } } }));
    await weeklyPlan.setSelectedWeek("2025-W10");
    expect(weeklyPlan.selectedWeek).toBe("2025-W10");
    expect(mockGetByWeek).toHaveBeenCalledWith("2025-W10");
  });

  it("setSelectedWeek does not reload if week is already cached", async () => {
    const { weeklyPlan } = await importStore();
    mockGetByWeek.mockClear();
    await weeklyPlan.setSelectedWeek("2025-W11");
    const callCount = mockGetByWeek.mock.calls.length;
    await weeklyPlan.setSelectedWeek("2025-W11");
    expect(mockGetByWeek.mock.calls.length).toBe(callCount);
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

  it("setDayNote updates the plan", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.setDayNote("monday", "Leftovers night");
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

  describe("swapSlots", () => {
    function makeMeal(id: string, ingredients: { name: string; quantity: string; category: string }[] = []) {
      return {
        id,
        name: id,
        duration: "short" as const,
        supperDays: [],
        url: "",
        ingredients: ingredients as any,
        instructions: [],
        tags: [],
      };
    }

    it("swaps two filled slots (both directions)", async () => {
      const { weeklyPlan } = await importStore();
      await weeklyPlan.setDay("monday", "supper", "meal-a");
      await weeklyPlan.setDay("tuesday", "diner", "meal-b");

      await weeklyPlan.swapSlots({ day: "monday", slot: "supper" }, { day: "tuesday", slot: "diner" });

      expect(weeklyPlan.current.monday?.supper).toBe("meal-b");
      expect(weeklyPlan.current.tuesday?.diner).toBe("meal-a");
    });

    it("moving a filled slot onto an empty slot leaves source empty and target filled", async () => {
      const { weeklyPlan } = await importStore();
      await weeklyPlan.setDay("monday", "supper", "meal-a");

      await weeklyPlan.swapSlots({ day: "monday", slot: "supper" }, { day: "wednesday", slot: "diner" });

      expect(weeklyPlan.current.monday?.supper).toBeUndefined();
      expect(weeklyPlan.current.wednesday?.diner).toBe("meal-a");
    });

    it("swaps across two different days", async () => {
      const { weeklyPlan } = await importStore();
      await weeklyPlan.setDay("monday", "supper", "meal-a");
      await weeklyPlan.setDay("friday", "supper", "meal-b");

      await weeklyPlan.swapSlots({ day: "monday", slot: "supper" }, { day: "friday", slot: "supper" });

      expect(weeklyPlan.current.monday?.supper).toBe("meal-b");
      expect(weeklyPlan.current.friday?.supper).toBe("meal-a");
    });

    it("swaps supper and diner on the same day", async () => {
      const { weeklyPlan } = await importStore();
      await weeklyPlan.setDay("monday", "supper", "meal-a");
      await weeklyPlan.setDay("monday", "diner", "meal-b");

      await weeklyPlan.swapSlots({ day: "monday", slot: "supper" }, { day: "monday", slot: "diner" });

      expect(weeklyPlan.current.monday?.supper).toBe("meal-b");
      expect(weeklyPlan.current.monday?.diner).toBe("meal-a");
    });

    it("is a no-op when swapping a slot with itself", async () => {
      const { weeklyPlan } = await importStore();
      await weeklyPlan.setDay("monday", "supper", "meal-a");
      mockSave.mockClear();

      const result = await weeklyPlan.swapSlots({ day: "monday", slot: "supper" }, { day: "monday", slot: "supper" });

      expect(result).toBeNull();
      expect(mockSave).not.toHaveBeenCalled();
      expect(weeklyPlan.current.monday?.supper).toBe("meal-a");
    });

    it("recomputes the grocery list once for the combined change, without duplicating shared ingredients", async () => {
      const { weeklyPlan, meals } = await importStore();
      meals.all = [
        makeMeal("meal-a", [{ name: "Garlic", quantity: "2 cloves", category: "vegetables" }]),
        makeMeal("meal-b", [{ name: "Onion", quantity: "1", category: "vegetables" }]),
      ];
      await weeklyPlan.setDay("monday", "supper", "meal-a");
      await weeklyPlan.setDay("tuesday", "diner", "meal-b");
      mockApplyAdjustments.mockClear();

      await weeklyPlan.swapSlots({ day: "monday", slot: "supper" }, { day: "tuesday", slot: "diner" });

      // Both meals remain planned after the swap (just relocated), so the
      // net grocery diff is empty: neither ingredient's quantity changed.
      expect(mockApplyAdjustments).not.toHaveBeenCalled();
    });

    it("recomputes the grocery list correctly when swapping into an empty slot", async () => {
      const { weeklyPlan, meals } = await importStore();
      meals.all = [makeMeal("meal-a", [{ name: "Garlic", quantity: "2 cloves", category: "vegetables" }])];
      await weeklyPlan.setDay("monday", "supper", "meal-a");
      mockApplyAdjustments.mockClear();

      await weeklyPlan.swapSlots({ day: "monday", slot: "supper" }, { day: "wednesday", slot: "diner" });

      expect(mockApplyAdjustments).not.toHaveBeenCalled();
    });
  });

  it("dismissIngredient marks the name dismissed and deletes the grocery item", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.dismissIngredient("Garlic", "item-1");
    expect(weeklyPlan.dismissedIngredients).toContain("Garlic");
    expect(mockDismissIngredient).toHaveBeenCalledWith(weeklyPlan.selectedWeek, "Garlic");
    expect(mockDeleteItem).toHaveBeenCalledWith("item-1");
  });

  it("undismissIngredient removes the name from the dismissed list", async () => {
    const { weeklyPlan } = await importStore();
    await weeklyPlan.dismissIngredient("Garlic");
    await weeklyPlan.undismissIngredient("Garlic");
    expect(weeklyPlan.dismissedIngredients).not.toContain("Garlic");
  });

  describe("autoFillWeek", () => {
    function makeMeal(id: string, supperDays: string[], tags: string[] = []) {
      return {
        id,
        name: id,
        duration: "short" as const,
        supperDays: supperDays as any,
        url: "",
        ingredients: [],
        instructions: [],
        tags,
      };
    }

    it("avoids a meal used last week when other eligible meals exist", async () => {
      const { weeklyPlan, meals } = await importStore();
      const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      meals.all = [
        makeMeal("a", allDays),
        makeMeal("b", allDays),
        makeMeal("c", allDays),
        makeMeal("d", allDays),
        makeMeal("e", allDays),
        makeMeal("f", allDays),
        makeMeal("g", allDays),
        makeMeal("h", allDays),
      ];
      mockGetMealIds.mockResolvedValue(new Set(["a"]));

      await weeklyPlan.autoFillWeek();

      const usedMealIds = Object.values(weeklyPlan.current)
        .map((entry) => entry?.supper)
        .filter(Boolean);
      expect(usedMealIds).not.toContain("a");
    });

    it("falls back to a previous-week meal when it's the only eligible option", async () => {
      const { weeklyPlan, meals } = await importStore();
      meals.all = [makeMeal("a", ["monday"])];
      mockGetMealIds.mockResolvedValue(new Set(["a"]));

      await weeklyPlan.autoFillWeek();

      expect(weeklyPlan.current.monday?.supper).toBe("a");
    });

    it("behaves as before when there is no previous week's plan", async () => {
      const { weeklyPlan, meals } = await importStore();
      meals.all = [makeMeal("a", ["monday"])];
      mockGetMealIds.mockResolvedValue(new Set());

      await weeklyPlan.autoFillWeek();

      expect(weeklyPlan.current.monday?.supper).toBe("a");
    });

    it("keeps a same-tag supper off the following two days when untagged alternatives exist", async () => {
      const { weeklyPlan, meals } = await importStore();
      const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      meals.all = [
        makeMeal("pasta1", allDays, ["pasta"]),
        makeMeal("pasta2", allDays, ["pasta"]),
        makeMeal("other1", allDays),
        makeMeal("other2", allDays),
        makeMeal("other3", allDays),
        makeMeal("other4", allDays),
      ];
      mockGetMealIds.mockResolvedValue(new Set());
      await weeklyPlan.setDay("monday", "supper", "pasta1");

      await weeklyPlan.autoFillWeek();

      expect(weeklyPlan.current.tuesday?.supper).not.toBe("pasta2");
      expect(weeklyPlan.current.wednesday?.supper).not.toBe("pasta2");
    });

    it("allows a same-tag supper once a manual placement is >= 2 gap away", async () => {
      const { weeklyPlan, meals } = await importStore();
      const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      meals.all = [makeMeal("pasta1", allDays, ["pasta"]), makeMeal("pasta2", ["thursday"], ["pasta"])];
      mockGetMealIds.mockResolvedValue(new Set());
      await weeklyPlan.setDay("monday", "supper", "pasta1");

      await weeklyPlan.autoFillWeek();

      expect(weeklyPlan.current.thursday?.supper).toBe("pasta2");
    });
  });
});
