import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, fireEvent, userEvent, resetDb, resetStores } from "../componentTestUtils";
import MealDetail from "../../routes/meal/[id]/MealDetail.svelte";
import { meals } from "../../lib/stores/meals.svelte";
import { mealRepo } from "../../lib/repos/mealRepo";
import { db } from "../../lib/db";
import { router } from "../../lib/utils/router.svelte";
import type { Meal } from "../../lib/types";

async function seedMeal(overrides: Partial<Omit<Meal, "id">> = {}): Promise<Meal> {
  const meal = await mealRepo.create({
    name: "Tacos",
    duration: "short",
    supperDays: ["monday"],
    url: "",
    ingredients: [{ name: "Beef", quantity: "1 lb", category: "meat" }],
    instructions: ["Cook the beef."],
    ...overrides,
  });
  meals.all = await mealRepo.getAll();
  return meal;
}

describe("MealDetail", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  // Order matters here: `hasNavigatedInApp()` is a module-level flag that only
  // ever flips false -> true, so the "no in-app history" case must run before
  // any test in this file triggers a `navigate()` call.
  it("Back navigates to /meals when there is no in-app navigation history", async () => {
    const meal = await seedMeal();
    render(MealDetail, { id: meal.id });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "← Back to Meals" }));

    expect(router.current).toEqual({ name: "meals" });
  });

  it("Back uses browser history when there is in-app navigation history", async () => {
    const meal = await seedMeal();
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(MealDetail, { id: meal.id });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "← Back to Meals" }));

    expect(backSpy).toHaveBeenCalled();
    backSpy.mockRestore();
  });

  it("renders the not-found state for an unknown id", () => {
    render(MealDetail, { id: "missing" });
    expect(screen.getByText("Meal not found.")).toBeInTheDocument();
  });

  it("renders the View recipe guide link only when meal.url is set", async () => {
    const withUrl = await seedMeal({ url: "https://example.com/tacos" });
    const { unmount } = render(MealDetail, { id: withUrl.id });
    expect(screen.getByRole("link", { name: /View recipe guide/ })).toBeInTheDocument();
    unmount();

    const withoutUrl = await seedMeal({ name: "Pasta", url: "" });
    render(MealDetail, { id: withoutUrl.id });
    expect(screen.queryByRole("link", { name: /View recipe guide/ })).not.toBeInTheDocument();
  });

  it("Edit opens the form pre-filled and saving persists changes", async () => {
    const meal = await seedMeal({ name: "Tacos" });
    render(MealDetail, { id: meal.id });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByLabelText("Meal name") as HTMLInputElement;
    expect(nameInput.value).toBe("Tacos");

    await user.clear(nameInput);
    await user.type(nameInput, "Beef Tacos");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(screen.getByRole("heading", { name: "Beef Tacos", level: 1 })).toBeInTheDocument());
    const saved = await db.meals.get(meal.id);
    expect(saved?.name).toBe("Beef Tacos");
  });

  it("Duplicate opens the form pre-filled with a generated name and saving creates a new meal without mutating the original", async () => {
    const meal = await seedMeal({ name: "Tacos" });
    render(MealDetail, { id: meal.id });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    const nameInput = screen.getByLabelText("Meal name") as HTMLInputElement;
    expect(nameInput.value).toBe("Tacos (copy)");

    await user.click(screen.getByRole("button", { name: "Create meal" }));

    await vi.waitFor(async () => {
      const all = await mealRepo.getAll();
      expect(all.map((m) => m.name).sort()).toEqual(["Tacos", "Tacos (copy)"]);
    });
    const original = await db.meals.get(meal.id);
    expect(original?.name).toBe("Tacos");
  });

  it("Cancel discards changes", async () => {
    const meal = await seedMeal({ name: "Tacos" });
    render(MealDetail, { id: meal.id });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Meal name"));
    await user.type(screen.getByLabelText("Meal name"), "Changed Name");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Meal name")).not.toBeInTheDocument();
    const saved = await db.meals.get(meal.id);
    expect(saved?.name).toBe("Tacos");
  });

  it("Save is disabled while saving", async () => {
    const meal = await seedMeal({ name: "Tacos" });
    render(MealDetail, { id: meal.id });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const saveButton = screen.getByRole("button", { name: "Save changes" });

    fireEvent.click(saveButton);
    await vi.waitFor(() => expect(saveButton).toBeDisabled());
    await vi.waitFor(() => expect(saveButton).not.toBeInTheDocument());
  });

  describe("validation", () => {
    it("blocks save with an empty name", async () => {
      const meal = await seedMeal();
      render(MealDetail, { id: meal.id });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.clear(screen.getByLabelText("Meal name"));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(screen.getByText("Please enter a meal name.")).toBeInTheDocument();
    });

    it("blocks save with a name longer than 50 characters", async () => {
      const meal = await seedMeal();
      render(MealDetail, { id: meal.id });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      const nameInput = screen.getByLabelText("Meal name") as HTMLInputElement;
      // bypass the native maxlength=50 attribute to exercise the JS validation
      await fireEvent.input(nameInput, { target: { value: "a".repeat(51) } });
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(screen.getByText("Meal name must be 50 characters or fewer.")).toBeInTheDocument();
    });

    it("blocks save with zero ingredients", async () => {
      const meal = await seedMeal();
      render(MealDetail, { id: meal.id });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.click(screen.getByRole("button", { name: "Remove" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(screen.getByText("Please add at least one ingredient.")).toBeInTheDocument();
    });

    it("blocks save with zero non-blank instruction lines", async () => {
      const meal = await seedMeal();
      render(MealDetail, { id: meal.id });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      const instructions = screen.getByLabelText("Instructions", { exact: false }) as HTMLTextAreaElement;
      await user.clear(instructions);
      await user.type(instructions, "   \n  ");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(screen.getByText("Please add at least one instruction.")).toBeInTheDocument();
    });
  });

  it("day checkboxes toggle supperDays", async () => {
    const meal = await seedMeal({ supperDays: ["monday"] });
    render(MealDetail, { id: meal.id });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const mondayCheckbox = screen.getByRole("checkbox", { name: "Monday" }) as HTMLInputElement;
    const fridayCheckbox = screen.getByRole("checkbox", { name: "Friday" }) as HTMLInputElement;
    expect(mondayCheckbox.checked).toBe(true);
    expect(fridayCheckbox.checked).toBe(false);

    await user.click(mondayCheckbox);
    await user.click(fridayCheckbox);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(async () => {
      const saved = await db.meals.get(meal.id);
      expect(saved?.supperDays.sort()).toEqual(["friday"]);
    });
  });

  describe("tags", () => {
    it("shows tag chips in view mode", async () => {
      const meal = await seedMeal({ tags: ["pasta", "quick"] });
      render(MealDetail, { id: meal.id });

      expect(screen.getByText("pasta")).toBeInTheDocument();
      expect(screen.getByText("quick")).toBeInTheDocument();
    });

    it("adding and removing tags in the editor persists on save", async () => {
      const meal = await seedMeal({ tags: ["pasta"] });
      render(MealDetail, { id: meal.id });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.click(screen.getByRole("button", { name: "Remove tag pasta" }));
      await user.type(screen.getByPlaceholderText("Add a tag…"), "quick{enter}");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(async () => {
        const saved = await db.meals.get(meal.id);
        expect(saved?.tags).toEqual(["quick"]);
      });
    });
  });

  describe("ingredient editor", () => {
    it("adds a new ingredient row via the ingredient search", async () => {
      const meal = await seedMeal();
      render(MealDetail, { id: meal.id });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.click(screen.getByRole("button", { name: "+ Add ingredient" }));
      await user.type(screen.getByPlaceholderText("Search for an ingredient…"), "Carrots");
      await user.click(screen.getByRole("button", { name: "Create: Carrots" }));
      await user.click(screen.getByRole("button", { name: "Vegetables" }));

      expect(screen.getByText("Carrots")).toBeInTheDocument();
    });

    it("removes an ingredient row", async () => {
      const meal = await seedMeal();
      render(MealDetail, { id: meal.id });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Beef")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Remove" }));

      expect(within(dialog).queryByText("Beef")).not.toBeInTheDocument();
    });

    it("edits an ingredient's quantity inline", async () => {
      const meal = await seedMeal();
      render(MealDetail, { id: meal.id });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit" }));
      const quantityInput = screen.getByDisplayValue("1 lb") as HTMLInputElement;
      await user.clear(quantityInput);
      await user.type(quantityInput, "2 lb");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(async () => {
        const saved = await db.meals.get(meal.id);
        expect(saved?.ingredients[0]?.quantity).toBe("2 lb");
      });
    });
  });
});
