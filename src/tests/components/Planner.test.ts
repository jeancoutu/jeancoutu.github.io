import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, userEvent, resetDb, resetStores } from "../componentTestUtils";
import Planner from "../../routes/planner/Planner.svelte";
import { meals } from "../../lib/stores/meals.svelte";
import { weeklyPlan } from "../../lib/stores/weeklyPlan.svelte";
import { groceryList } from "../../lib/stores/groceryList.svelte";
import { mealRepo } from "../../lib/repos/mealRepo";
import { weeklyPlanRepo } from "../../lib/repos/weeklyPlanRepo";
import { db } from "../../lib/db";
import { addWeeks, getWeekSaturday, toWeekKey } from "../../lib/utils/weekDates";
import type { DayKey, Meal } from "../../lib/types";

const ALL_DAYS: DayKey[] = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

async function seedMeal(name: string, supperDays: DayKey[] = ALL_DAYS): Promise<Meal> {
  const meal = await mealRepo.create({
    name,
    duration: "short",
    supperDays,
    url: "",
    ingredients: [{ name: `${name} ingredient`, quantity: "1", category: "meat" }],
    instructions: ["Cook it."],
  });
  meals.all = await mealRepo.getAll();
  return meal;
}

function daySection(dayLabel: string): HTMLElement {
  return screen.getByText(dayLabel).closest("section") as HTMLElement;
}

async function pickMealForSlot(
  user: ReturnType<typeof userEvent.setup>,
  dayLabel: string,
  slotLabel: string,
  mealName: string,
): Promise<void> {
  const section = daySection(dayLabel);
  await user.click(within(section).getByRole("button", { name: new RegExp(slotLabel, "i") }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: mealName }));
}

describe("Planner", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("week-label button opens the week picker; selecting a week updates the selection and closes the modal", async () => {
    const otherWeekKey = toWeekKey(addWeeks(getWeekSaturday(), -2));
    weeklyPlan.plans = { ...weeklyPlan.plans, [otherWeekKey]: { monday: { supper: "meal-x" } } };

    render(Planner);
    const user = userEvent.setup();

    const weekPillButton = screen.getAllByText("this week").find((el) => !el.closest("dialog"))!.closest("button")!;
    await user.click(weekPillButton);
    expect(screen.getByText("Select week")).toBeInTheDocument();

    // The week with a stored plan shows a "Has plan" tag.
    const hasPlanTags = screen.getAllByText("Has plan");
    expect(hasPlanTags.length).toBeGreaterThan(0);
    const weekButton = hasPlanTags[0]!.closest("button")!;

    await user.click(weekButton);

    expect(weeklyPlan.selectedWeek).toBe(otherWeekKey);
    const dialog = document.querySelector("dialog")!;
    expect(dialog.open).toBe(false);
  });

  it("the current week shows a 'this week' badge in the planner header", async () => {
    render(Planner);
    expect(screen.getAllByText("this week").length).toBeGreaterThan(0);
  });

  it("Auto-fill only fills empty supper slots, cascades supper to the next day's diner, and clears Saturday's diner", async () => {
    await seedMeal("Chicken");
    await seedMeal("Beef");
    await seedMeal("Fish");

    render(Planner);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Auto Fill Week" }));

    await vi.waitFor(() => {
      for (const day of ALL_DAYS) {
        expect(weeklyPlan.current[day]?.supper).toBeTruthy();
      }
    });

    expect(weeklyPlan.current.saturday?.diner).toBeUndefined();

    for (const day of ALL_DAYS) {
      if (day === "saturday") continue;
      const idx = ALL_DAYS.indexOf(day);
      const prevDay = ALL_DAYS[idx - 1];
      if (!prevDay) continue;
      const prevSupper = weeklyPlan.current[prevDay]?.supper;
      if (prevSupper) {
        expect(weeklyPlan.current[day]?.diner).toBe(prevSupper);
      }
    }
  });

  it("Auto-fill does not overwrite an already-filled supper slot", async () => {
    await seedMeal("Chicken");
    const chosen = await seedMeal("Beef");
    await weeklyPlanRepo.setPlan(weeklyPlan.selectedWeek, { monday: { supper: chosen.id } });
    weeklyPlan.plans = { ...weeklyPlan.plans, [weeklyPlan.selectedWeek]: { monday: { supper: chosen.id } } };

    render(Planner);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Auto Fill Week" }));

    await vi.waitFor(() => {
      expect(weeklyPlan.current.saturday?.supper).toBeTruthy();
    });
    expect(weeklyPlan.current.monday?.supper).toBe(chosen.id);
  });

  it("Clear empties all days' assigned meals and the grocery list for the week", async () => {
    const meal = await seedMeal("Chicken");
    render(Planner);
    const user = userEvent.setup();

    await pickMealForSlot(user, "Monday", "Supper", meal.name);
    await vi.waitFor(() => expect(weeklyPlan.current.monday?.supper).toBe(meal.id));
    await vi.waitFor(() => expect(groceryList.itemsForWeek.length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: "Clear Week" }));
    await user.click(screen.getByRole("button", { name: "Clear week" }));

    await vi.waitFor(() => expect(weeklyPlan.current).toEqual({}));
    expect(groceryList.itemsForWeek).toEqual([]);
    expect(within(daySection("Monday")).queryByText(meal.name)).not.toBeInTheDocument();
  });

  it("Clear Week shows a confirmation dialog and does nothing until confirmed", async () => {
    const meal = await seedMeal("Chicken");
    render(Planner);
    const user = userEvent.setup();

    await pickMealForSlot(user, "Monday", "Supper", meal.name);
    await vi.waitFor(() => expect(weeklyPlan.current.monday?.supper).toBe(meal.id));

    await user.click(screen.getByRole("button", { name: "Clear Week" }));
    expect(screen.getByText(/removed all meals and notes|remove all meals and notes/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(weeklyPlan.current.monday?.supper).toBe(meal.id);
  });

  // Regression test for a bug where selecting a meal for a second day (after
  // a first day was already saved) silently failed: `weeklyPlan.plans` is a
  // deep-reactive $state proxy tree, so once a save round-trips through it,
  // the untouched day's entry becomes a Proxy. Merging onto that without
  // snapshotting first nests a Proxy inside the object handed to Dexie, and
  // IDBObjectStore.put throws DataCloneError, dropping the write.
  it("selecting meals for two different days both persist to Dexie", async () => {
    const chicken = await seedMeal("Chicken");
    const beef = await seedMeal("Beef");
    render(Planner);
    const user = userEvent.setup();

    await pickMealForSlot(user, "Monday", "Supper", chicken.name);
    await vi.waitFor(() => expect(weeklyPlan.current.monday?.supper).toBe(chicken.id));

    await pickMealForSlot(user, "Tuesday", "Supper", beef.name);
    await vi.waitFor(() => expect(weeklyPlan.current.tuesday?.supper).toBe(beef.id));

    // Both selections must still show as selected (a dropped save resets
    // the slot back to empty on the next render) and both must have
    // actually landed in Dexie, not just in-memory state.
    expect(within(daySection("Monday")).getByText(chicken.name)).toBeInTheDocument();
    expect(within(daySection("Tuesday")).getByText(beef.name)).toBeInTheDocument();
    await vi.waitFor(async () => {
      const savedRow = await db.weeklyPlans.where("weekStart").equals(weeklyPlan.selectedWeek).first();
      expect(savedRow?.plan.monday?.supper).toBe(chicken.id);
      expect(savedRow?.plan.tuesday?.supper).toBe(beef.id);
    });
  });

});
