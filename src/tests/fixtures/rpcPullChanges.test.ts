import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

describe("pull_changes RPC", () => {
  it("a null p_since performs a full pull across all synced tables", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Chicken Soup",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });

    const presetId = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", { p_id: presetId, p_base_version: null, p_name: "Staples", p_items: [] });

    const planId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });

    const itemId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: itemId,
      p_name: "Carrots",
      p_category: "vegetables",
      p_quantity: "2",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    const { data, error } = await fake.rpc("pull_changes", { p_since: null });

    expect(error).toBeNull();
    const result = data as {
      watermark: string;
      meals: { id: string }[];
      grocery_presets: { id: string }[];
      weekly_plans: { id: string }[];
      grocery_items: { id: string }[];
    };
    expect(result.meals.map((m) => m.id)).toEqual([mealId]);
    expect(result.grocery_presets.map((p) => p.id)).toEqual([presetId]);
    expect(result.weekly_plans.map((p) => p.id)).toEqual([planId]);
    expect(result.grocery_items.map((i) => i.id)).toEqual([itemId]);
    expect(result.watermark).toBeTruthy();
  });

  it("only returns rows updated after p_since", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const firstMealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: firstMealId,
      p_base_version: null,
      p_name: "First",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });

    const firstPull = (await fake.rpc("pull_changes", { p_since: null })).data as { watermark: string };

    const secondMealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: secondMealId,
      p_base_version: null,
      p_name: "Second",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });

    const { data } = await fake.rpc("pull_changes", { p_since: firstPull.watermark });
    const result = data as { meals: { id: string }[] };

    expect(result.meals.map((m) => m.id)).toEqual([secondMealId]);
  });

  it("includes tombstoned (soft-deleted) rows rather than filtering them out", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Chicken Soup",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });

    const beforeDelete = (await fake.rpc("pull_changes", { p_since: null })).data as { watermark: string };

    await fake.rpc("delete_meal", { p_id: mealId, p_base_version: 1 });

    const { data } = await fake.rpc("pull_changes", { p_since: beforeDelete.watermark });
    const result = data as { meals: { id: string; deleted_at: string | null }[] };

    expect(result.meals).toHaveLength(1);
    expect(result.meals[0]!.id).toBe(mealId);
    expect(result.meals[0]!.deleted_at).not.toBeNull();
  });

  it("nests ingredients/day_plans/preset_ids/items exactly as engine.ts expects", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Chicken Soup",
      p_duration: "short",
      p_url: "",
      p_supper_days: ["monday"],
      p_instructions: ["Simmer"],
      p_ingredients: [{ name: "Chicken", quantity: "1 lb", category: "meat" }],
      p_needs_prep_ahead: true,
    });

    const presetId = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", {
      p_id: presetId,
      p_base_version: null,
      p_name: "Staples",
      p_items: [{ name: "Milk", quantity: "1L", category: "fridge" }],
    });

    const planId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [{ day_key: "monday", note: "note", supper_meal_id: mealId, diner_meal_id: null }],
      p_preset_ids: [presetId],
    });

    const { data } = await fake.rpc("pull_changes", { p_since: null });
    const result = data as {
      meals: { ingredients: { name: string; quantity: string; category: string }[]; needs_prep_ahead: boolean }[];
      grocery_presets: { items: { name: string; quantity: string; category: string }[] }[];
      weekly_plans: {
        day_plans: { day_key: string; note: string | null; supper_meal_id: string | null; diner_meal_id: string | null }[];
        preset_ids: string[];
      }[];
    };

    expect(result.meals[0]!.ingredients).toEqual([
      { name: "Chicken", quantity: "1 lb", category: "meat", section: null },
    ]);
    expect(result.meals[0]!.needs_prep_ahead).toBe(true);
    expect(result.grocery_presets[0]!.items).toEqual([{ name: "Milk", quantity: "1L", category: "fridge" }]);
    expect(result.weekly_plans[0]!.day_plans).toEqual([
      { day_key: "monday", note: "note", supper_meal_id: mealId, diner_meal_id: null },
    ]);
    expect(result.weekly_plans[0]!.preset_ids).toEqual([presetId]);
  });
});
