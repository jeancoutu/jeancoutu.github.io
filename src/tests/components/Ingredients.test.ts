import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, userEvent, resetDb, resetStores } from "../componentTestUtils";
import IngredientCategoryManager from "../../lib/components/IngredientCategoryManager.svelte";
import { meals, recategorizeIngredientEverywhere } from "../../lib/stores/meals.svelte";
import { mealRepo } from "../../lib/repos/mealRepo";
import { syncStatus } from "../../lib/sync/status.svelte";
import type { Ingredient, Meal } from "../../lib/types";

// Stub the network orchestration — the component's contract is "call it with
// the row's name + chosen category and toast the result".
vi.mock("../../lib/stores/meals.svelte", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/stores/meals.svelte")>();
  return {
    ...actual,
    recategorizeIngredientEverywhere: vi
      .fn()
      .mockResolvedValue({ status: "ok", updated_meal_count: 2, updated_ingredient_count: 2 }),
  };
});

const mockRecategorize = vi.mocked(recategorizeIngredientEverywhere);

async function seedMeal(name: string, ingredients: Ingredient[]): Promise<Meal> {
  const meal = await mealRepo.create({
    name,
    duration: "short",
    supperDays: [],
    url: "",
    ingredients,
    instructions: [],
    needsPrepAhead: false,
  });
  meals.all = await mealRepo.getAll();
  return meal;
}

describe("IngredientCategoryManager", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
    mockRecategorize.mockClear();
    syncStatus.online = true;
  });

  afterEach(() => {
    syncStatus.online = true;
  });

  it("renders the empty state when no meal has ingredients", async () => {
    await seedMeal("Plain", []);
    render(IngredientCategoryManager);
    expect(
      screen.getByText("No ingredients yet. Add ingredients to your meals to manage their categories here."),
    ).toBeInTheDocument();
  });

  it("shows one row per distinct case-insensitive name with the meal names", async () => {
    await seedMeal("Salad", [
      { name: "Tomato", quantity: "2", category: "vegetables" },
      { name: "Lettuce", quantity: "1", category: "vegetables" },
    ]);
    await seedMeal("Salsa", [{ name: " tomato ", quantity: "1", category: "vegetables" }]);
    render(IngredientCategoryManager);

    // "Tomato" appears in two meals despite the case/whitespace difference.
    const tomatoRow = screen.getByRole("button", { name: /tomato/i });
    expect(within(tomatoRow).getByText("Salad, Salsa")).toBeInTheDocument();

    const lettuceRow = screen.getByRole("button", { name: /lettuce/i });
    expect(within(lettuceRow).getByText("Salad")).toBeInTheDocument();
  });

  it("lists the meal names in alphabetical (fr-locale) order", async () => {
    await seedMeal("Zucchini pasta", [{ name: "Oil", quantity: "1", category: "aisle" }]);
    await seedMeal("Apple crumble", [{ name: "Oil", quantity: "1", category: "aisle" }]);
    await seedMeal("Mango salad", [{ name: "Oil", quantity: "1", category: "aisle" }]);
    render(IngredientCategoryManager);

    const oilRow = screen.getByRole("button", { name: /oil/i });
    expect(
      within(oilRow).getByText("Apple crumble, Mango salad, Zucchini pasta"),
    ).toBeInTheDocument();
  });

  it("shows the mixed badge only when a name's meals disagree on a category", async () => {
    await seedMeal("A", [{ name: "Tomato", quantity: "1", category: "vegetables" }]);
    await seedMeal("B", [{ name: "Tomato", quantity: "1", category: "aisle" }]);
    await seedMeal("C", [{ name: "Basil", quantity: "1", category: "vegetables" }]);
    render(IngredientCategoryManager);

    const tomatoRow = screen.getByRole("button", { name: /tomato/i });
    expect(within(tomatoRow).getByText("mixed")).toBeInTheDocument();

    const basilRow = screen.getByRole("button", { name: /basil/i });
    expect(within(basilRow).queryByText("mixed")).not.toBeInTheDocument();
  });

  it("picking a category from the modal calls the orchestration with the name and category", async () => {
    await seedMeal("Salad", [{ name: "Tomato", quantity: "2", category: "aisle" }]);
    render(IngredientCategoryManager);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /tomato/i }));
    await user.click(screen.getByRole("button", { name: "Fridge" }));

    await vi.waitFor(() => {
      expect(mockRecategorize).toHaveBeenCalledWith("Tomato", "fridge");
    });
  });

  it("disables the category controls when offline", async () => {
    syncStatus.online = false;
    await seedMeal("Salad", [{ name: "Tomato", quantity: "2", category: "aisle" }]);
    render(IngredientCategoryManager);

    expect(screen.getByRole("button", { name: /tomato/i })).toBeDisabled();
    expect(screen.getByText("Connect to the internet to change categories")).toBeInTheDocument();
  });
});
