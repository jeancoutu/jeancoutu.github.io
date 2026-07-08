import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

describe("fakeSupabase (PGlite) harness smoke test", () => {
  it("runs the real schema.sql and executes a real RPC as a scoped household user", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealId = crypto.randomUUID();
    const { data, error } = await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Chicken Soup",
      p_duration: "short",
      p_url: "",
      p_supper_days: ["monday"],
      p_instructions: ["Simmer"],
      p_ingredients: [{ name: "Chicken", quantity: "1 lb", category: "meat" }],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: mealId, version: 1 });
  });

  it("scopes rows by household via get_my_household_id()/RLS", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Household A Meal",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });

    await fake._testHelpers.signInAsNewUser();
    const { data } = await fake.rpc("pull_changes", { p_since: null });

    expect((data as { meals: unknown[] }).meals).toEqual([]);
  });
});
