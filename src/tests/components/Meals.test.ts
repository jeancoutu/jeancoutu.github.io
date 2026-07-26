import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, userEvent, resetDb, resetStores } from "../componentTestUtils";
import Meals from "../../routes/meals/Meals.svelte";
import { meals } from "../../lib/stores/meals.svelte";
import { router } from "../../lib/utils/router.svelte";
import { mealRepo } from "../../lib/repos/mealRepo";
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

describe("Meals", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("renders the empty state when there are no meals", () => {
    render(Meals);
    expect(screen.getByText("No meals match your search.")).toBeInTheDocument();
  });

  it("Create opens MealFormModal in create mode", async () => {
    render(Meals);
    const user = userEvent.setup();

    expect(screen.queryByRole("heading", { name: "Create a meal" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create meal" }));

    expect(screen.getByRole("heading", { name: "Create a meal" })).toBeInTheDocument();
  });

  it("search input filters the list by name", async () => {
    await seedMeal({ name: "Tacos" });
    await seedMeal({ name: "Pasta" });
    render(Meals);
    const user = userEvent.setup();

    expect(screen.getByText("Tacos")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search meals by name…"), "tac");

    expect(screen.getByText("Tacos")).toBeInTheDocument();
    expect(screen.queryByText("Pasta")).not.toBeInTheDocument();
  });

  it("shows the empty state when the filtered list is empty", async () => {
    await seedMeal({ name: "Tacos" });
    render(Meals);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Search meals by name…"), "nonexistent");

    expect(screen.getByText("No meals match your search.")).toBeInTheDocument();
  });

  it("clicking a meal row navigates to /meal/:id", async () => {
    const meal = await seedMeal({ name: "Tacos" });
    render(Meals);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Tacos/ }));

    expect(router.current).toEqual({ name: "meal", id: meal.id });
  });

  it("shows a tag pill row sorted alphabetically", async () => {
    await seedMeal({ name: "Tacos", tags: ["mexican", "quick"] });
    await seedMeal({ name: "Pasta", tags: ["italian"] });
    render(Meals);

    const pills = screen.getAllByRole("button", { pressed: false });
    const pillLabels = pills.map((p) => p.textContent?.trim());

    expect(pillLabels).toEqual(["italian", "mexican", "quick"]);
  });

  it("tapping a tag pill filters the list, tapping again clears it", async () => {
    await seedMeal({ name: "Tacos", tags: ["mexican"] });
    await seedMeal({ name: "Pasta", tags: ["italian"] });
    render(Meals);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "mexican" }));

    expect(screen.getByText("Tacos")).toBeInTheDocument();
    expect(screen.queryByText("Pasta")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mexican" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "mexican" }));

    expect(screen.getByText("Tacos")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
  });

  it("tapping another tag pill switches the filter", async () => {
    await seedMeal({ name: "Tacos", tags: ["mexican"] });
    await seedMeal({ name: "Pasta", tags: ["italian"] });
    render(Meals);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "mexican" }));
    await user.click(screen.getByRole("button", { name: "italian" }));

    expect(screen.queryByText("Tacos")).not.toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
  });

  it("tag filter composes with name search", async () => {
    await seedMeal({ name: "Tacos", tags: ["mexican"] });
    await seedMeal({ name: "Taco soup", tags: ["mexican"] });
    render(Meals);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "mexican" }));
    await user.type(screen.getByPlaceholderText("Search meals by name…"), "tac");

    expect(screen.getByText("Tacos")).toBeInTheDocument();
    expect(screen.getByText("Taco soup")).toBeInTheDocument();
  });

  it("displays muted tag chips on meal cards", async () => {
    await seedMeal({ name: "Tacos", tags: ["mexican", "quick"] });
    render(Meals);

    expect(screen.getAllByText("mexican").length).toBeGreaterThan(0);
    expect(screen.getAllByText("quick").length).toBeGreaterThan(0);
  });
});
