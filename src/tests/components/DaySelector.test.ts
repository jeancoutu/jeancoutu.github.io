import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, userEvent, resetDb, resetStores } from "../componentTestUtils";
import DaySelector from "../../lib/components/DaySelector.svelte";
import { meals } from "../../lib/stores/meals.svelte";
import { weeklyPlan } from "../../lib/stores/weeklyPlan.svelte";
import { groceryList } from "../../lib/stores/groceryList.svelte";
import { onToast } from "../../lib/stores/toast.svelte";
import { router } from "../../lib/utils/router.svelte";
import { mealRepo } from "../../lib/repos/mealRepo";
import { db } from "../../lib/db";
import type { Meal } from "../../lib/types";

async function seedMeal(overrides: Partial<Omit<Meal, "id">> = {}): Promise<Meal> {
  const meal = await mealRepo.create({
    name: "Tacos",
    duration: "short",
    supperDays: [],
    url: "",
    ingredients: [{ name: "Beef", quantity: "1 lb", category: "meat" }],
    instructions: ["Cook the beef."],
    ...overrides,
  });
  meals.all = await mealRepo.getAll();
  return meal;
}

describe("DaySelector", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("selecting a meal in a slot saves to day_plans, selects it, and generates the grocery list", async () => {
    const meal = await seedMeal();
    render(DaySelector, { day: "monday" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Supper/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: meal.name }));

    await vi.waitFor(() => expect(weeklyPlan.current.monday?.supper).toBe(meal.id));
    expect(screen.getByRole("button", { name: new RegExp(`Supper.*${meal.name}`, "s") })).toBeInTheDocument();

    await vi.waitFor(async () => {
      const savedRow = await db.weeklyPlans.where("weekStart").equals(weeklyPlan.selectedWeek).first();
      expect(savedRow?.plan.monday?.supper).toBe(meal.id);
    });

    await vi.waitFor(() => {
      expect(groceryList.itemsForWeek.map((i) => i.name)).toContain("Beef");
    });
  });

  it("shows a toast and keeps the picker open when saving the selected meal fails", async () => {
    const meal = await seedMeal();
    render(DaySelector, { day: "monday" });
    const user = userEvent.setup();

    const setDaySpy = vi.spyOn(weeklyPlan, "setDay").mockRejectedValueOnce(new Error("DataCloneError"));
    const messages: string[] = [];
    const offToast = onToast((event) => messages.push(event.message));

    await user.click(screen.getByRole("button", { name: /Supper/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: meal.name }));

    await vi.waitFor(() => expect(messages).toContain("Failed to save. Please try again."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(weeklyPlan.current.monday?.supper).toBeUndefined();

    offToast();
    setDaySpy.mockRestore();
  });

  it("removing a meal via the picker's 'Remove meal' row clears that day's slot", async () => {
    const meal = await seedMeal();
    render(DaySelector, { day: "tuesday" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Supper/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: meal.name }));
    await vi.waitFor(() => expect(weeklyPlan.current.tuesday?.supper).toBe(meal.id));

    await user.click(screen.getByRole("button", { name: new RegExp(`Supper.*${meal.name}`, "s") }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove meal" }));

    await vi.waitFor(() => expect(weeklyPlan.current.tuesday?.supper).toBeUndefined());
  });

  it("the view-recipe button is only rendered when the slot has a meal, and navigates to /meal/:id", async () => {
    const meal = await seedMeal();
    render(DaySelector, { day: "wednesday" });
    expect(screen.queryByRole("button", { name: "View Recipe" })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Supper/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: meal.name }));

    const viewButton = await screen.findByRole("button", { name: "View Recipe" });
    await user.click(viewButton);

    expect(router.current).toEqual({ name: "meal", id: meal.id });
  });

  describe("day note", () => {
    it("Save persists the trimmed note and closes the modal", async () => {
      render(DaySelector, { day: "thursday" });
      const user = userEvent.setup();

      await user.click(screen.getByLabelText("Add note"));
      const textarea = screen.getByPlaceholderText("Add a note for this day…");
      await user.type(textarea, "  Leftovers night  ");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await vi.waitFor(() => expect(weeklyPlan.current.thursday?.note).toBe("Leftovers night"));
      const noteText = screen.getByText("Leftovers night");
      expect(noteText.tagName).toBe("P");
      expect(noteText).toHaveClass("italic");
    });

    it("Save persists null when the note is blank", async () => {
      render(DaySelector, { day: "friday" });
      const user = userEvent.setup();

      await user.click(screen.getByLabelText("Add note"));
      await user.type(screen.getByPlaceholderText("Add a note for this day…"), "   ");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await vi.waitFor(() => expect(weeklyPlan.current.friday?.note).toBeUndefined());
    });

    it("Clear is only shown when a note exists, and clears it", async () => {
      render(DaySelector, { day: "saturday" });
      const user = userEvent.setup();

      await user.click(screen.getByLabelText("Add note"));
      expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
      await user.type(screen.getByPlaceholderText("Add a note for this day…"), "Pizza night");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await vi.waitFor(() => expect(weeklyPlan.current.saturday?.note).toBe("Pizza night"));
      await user.click(await screen.findByLabelText("Edit note"));
      await user.click(screen.getByRole("button", { name: "Clear" }));

      await vi.waitFor(() => expect(weeklyPlan.current.saturday?.note).toBeUndefined());
      expect(screen.queryByText("Pizza night")).not.toBeInTheDocument();
    });

    it("Cancel discards changes", async () => {
      render(DaySelector, { day: "sunday" });
      const user = userEvent.setup();

      await user.click(screen.getByLabelText("Add note"));
      await user.type(screen.getByPlaceholderText("Add a note for this day…"), "Discard me");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(weeklyPlan.current.sunday?.note).toBeUndefined();
      expect(screen.queryByText("Discard me")).not.toBeInTheDocument();
    });
  });
});
