import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

type PulledMeal = {
  id: string;
  version: number;
  ingredients: { name: string; category: string }[];
};

async function seedMeal(
  fake: Awaited<ReturnType<typeof createFakeSupabase>>,
  name: string,
  ingredients: { name: string; quantity: string; category: string }[],
): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await fake.rpc("upsert_meal", {
    p_id: id,
    p_base_version: null,
    p_name: name,
    p_duration: "short",
    p_url: "",
    p_supper_days: [],
    p_instructions: [],
    p_ingredients: ingredients,
  });
  expect(error).toBeNull();
  return id;
}

async function pullMeals(fake: Awaited<ReturnType<typeof createFakeSupabase>>): Promise<PulledMeal[]> {
  const { data } = await fake.rpc("pull_changes", { p_since: null });
  return (data as { meals: PulledMeal[] }).meals;
}

describe("recategorize_ingredient RPC", () => {
  it("rewrites the category for every case/whitespace variant of the name and bumps only affected meals", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const a = await seedMeal(fake, "Salade", [
      { name: "Tomate", quantity: "2", category: "aisle" },
      { name: "Laitue", quantity: "1", category: "vegetables" },
    ]);
    const b = await seedMeal(fake, "Sauce", [{ name: " tomate ", quantity: "3", category: "fridge" }]);
    const c = await seedMeal(fake, "Salsa", [{ name: "TOMATE", quantity: "1", category: "aisle" }]);
    const untouched = await seedMeal(fake, "Pain", [{ name: "Farine", quantity: "1", category: "aisle" }]);

    const { data, error } = await fake.rpc("recategorize_ingredient", {
      p_name: "tomate",
      p_category: "vegetables",
    });

    expect(error).toBeNull();
    expect(data).toEqual({ status: "ok", updated_meal_count: 3, updated_ingredient_count: 3 });

    const meals = await pullMeals(fake);
    const byId = new Map(meals.map((m) => [m.id, m]));

    for (const id of [a, b, c]) {
      const meal = byId.get(id)!;
      expect(meal.version).toBe(2);
      for (const ing of meal.ingredients) {
        if (ing.name.trim().toLowerCase() === "tomate") expect(ing.category).toBe("vegetables");
      }
    }
    // Non-matching ingredient on an affected meal is left alone.
    expect(byId.get(a)!.ingredients.find((i) => i.name === "Laitue")!.category).toBe("vegetables");
    // A meal that never used the name isn't bumped.
    expect(byId.get(untouched)!.version).toBe(1);
    expect(byId.get(untouched)!.ingredients[0]!.category).toBe("aisle");
  });

  it("returns zero counts and bumps nothing when every use already has the target category", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const id = await seedMeal(fake, "Salade", [{ name: "Tomate", quantity: "2", category: "vegetables" }]);

    const { data, error } = await fake.rpc("recategorize_ingredient", {
      p_name: "Tomate",
      p_category: "vegetables",
    });

    expect(error).toBeNull();
    expect(data).toEqual({ status: "ok", updated_meal_count: 0, updated_ingredient_count: 0 });

    const meals = await pullMeals(fake);
    expect(meals.find((m) => m.id === id)!.version).toBe(1);
  });

  it("returns zero counts when the name is no longer used anywhere", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    await seedMeal(fake, "Salade", [{ name: "Laitue", quantity: "1", category: "vegetables" }]);

    const { data, error } = await fake.rpc("recategorize_ingredient", {
      p_name: "Tomate",
      p_category: "vegetables",
    });

    expect(error).toBeNull();
    expect(data).toEqual({ status: "ok", updated_meal_count: 0, updated_ingredient_count: 0 });
  });

  it("is scoped to the caller's household — a matching name in another household is untouched", async () => {
    const fake = await createFakeSupabase();
    const { userId: userA } = await fake._testHelpers.signInAsNewUser();
    const mealA = await seedMeal(fake, "Salade A", [{ name: "Tomate", quantity: "1", category: "aisle" }]);

    const { userId: userB } = await fake._testHelpers.signInAsNewUser();
    const mealB = await seedMeal(fake, "Salade B", [{ name: "Tomate", quantity: "1", category: "aisle" }]);
    const bVersionBefore = (await pullMeals(fake)).find((m) => m.id === mealB)!.version;

    await fake._testHelpers.signInAs(userA);
    const { data } = await fake.rpc("recategorize_ingredient", { p_name: "Tomate", p_category: "vegetables" });
    expect(data).toEqual({ status: "ok", updated_meal_count: 1, updated_ingredient_count: 1 });
    expect((await pullMeals(fake)).find((m) => m.id === mealA)!.ingredients[0]!.category).toBe("vegetables");

    await fake._testHelpers.signInAs(userB);
    const bMeal = (await pullMeals(fake)).find((m) => m.id === mealB)!;
    expect(bMeal.ingredients[0]!.category).toBe("aisle");
    expect(bMeal.version).toBe(bVersionBefore);
  });
});
