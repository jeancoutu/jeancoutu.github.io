import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, userEvent, resetDb, resetStores } from "../componentTestUtils";
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

  it("duration filter narrows the list", async () => {
    await seedMeal({ name: "Tacos", duration: "short" });
    await seedMeal({ name: "Roast", duration: "long" });
    render(Meals);
    const user = userEvent.setup();

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: "long" } });

    expect(screen.queryByText("Tacos")).not.toBeInTheDocument();
    expect(screen.getByText("Roast")).toBeInTheDocument();
  });

  it("shows the empty state when the filtered list is empty", async () => {
    await seedMeal({ name: "Tacos" });
    render(Meals);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Search meals by name…"), "nonexistent");

    expect(screen.getByText("No meals match your search.")).toBeInTheDocument();
  });

  it("clicking View recipe navigates to /meal/:id", async () => {
    const meal = await seedMeal({ name: "Tacos" });
    render(Meals);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "View Recipe" }));

    expect(router.current).toEqual({ name: "meal", id: meal.id });
  });
});
