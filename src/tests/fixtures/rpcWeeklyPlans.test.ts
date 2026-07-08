import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

async function makeMeal(fake: Awaited<ReturnType<typeof createFakeSupabase>>, name: string): Promise<string> {
  const id = crypto.randomUUID();
  await fake.rpc("upsert_meal", {
    p_id: id,
    p_base_version: null,
    p_name: name,
    p_duration: "short",
    p_url: "",
    p_supper_days: [],
    p_instructions: [],
    p_ingredients: [],
  });
  return id;
}

describe("upsert_weekly_plan / delete_weekly_plan RPCs", () => {
  it("get-or-create by (household_id, week_start): first call inserts under the pushed id", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const planId = crypto.randomUUID();
    const { data, error } = await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: planId, version: 1 });
  });

  it("version conflict when base_version is stale against an existing plan for that week", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const planId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });

    const { data, error } = await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: 99,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: planId, version: 1 });
  });

  it("a null base_version against an already-existing plan is treated as a conflict, not silently overwritten", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const planId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: ["Server dismissed"],
      p_day_plans: [],
      p_preset_ids: [],
    });

    // A second "device" independently believes it's creating this week's
    // plan for the first time (base_version null) under a different id.
    const otherPlanId = crypto.randomUUID();
    const { data, error } = await fake.rpc("upsert_weekly_plan", {
      p_id: otherPlanId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: ["Would clobber"],
      p_day_plans: [],
      p_preset_ids: [],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: planId, version: 1 });

    const refetched = await fake.from("weekly_plans").select("*").eq("id", planId).maybeSingle();
    expect((refetched.data as { dismissed_ingredient_names: string[] }).dismissed_ingredient_names).toEqual([
      "Server dismissed",
    ]);
  });

  it("id remap: reviving a soft-deleted plan for the week adopts the original id, not the pushed one", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const originalId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: originalId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });
    await fake.rpc("delete_weekly_plan", { p_id: originalId, p_base_version: 1 });

    // A device that never saw the delete offline-creates a fresh plan for
    // the same week under a brand-new id.
    const newId = crypto.randomUUID();
    const { data, error } = await fake.rpc("upsert_weekly_plan", {
      p_id: newId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: ["Revived"],
      p_day_plans: [],
      p_preset_ids: [],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: originalId });
    expect((data as { id: string }).id).not.toBe(newId);

    const refetched = await fake.from("weekly_plans").select("*").eq("id", originalId).maybeSingle();
    expect(refetched.data).toMatchObject({ dismissed_ingredient_names: ["Revived"], deleted_at: null });
  });

  it("day_plans and preset_ids are wholesale-replaced on each successful upsert", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealA = await makeMeal(fake, "Meal A");
    const mealB = await makeMeal(fake, "Meal B");
    const presetA = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", { p_id: presetA, p_base_version: null, p_name: "Preset A", p_items: [] });
    const presetB = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", { p_id: presetB, p_base_version: null, p_name: "Preset B", p_items: [] });

    const planId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [{ day_key: "monday", note: null, supper_meal_id: mealA, diner_meal_id: null }],
      p_preset_ids: [presetA],
    });

    const { data, error } = await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: 1,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [{ day_key: "tuesday", note: "swapped", supper_meal_id: mealB, diner_meal_id: null }],
      p_preset_ids: [presetB],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: planId, version: 2 });

    const refetched = (
      await fake.from("weekly_plans").select("*").eq("id", planId).maybeSingle()
    ).data as {
      day_plans: { day_key: string; supper_meal_id: string | null }[];
      weekly_plan_grocery_presets: { preset_id: string }[];
    };
    expect(refetched.day_plans).toEqual([{ day_key: "tuesday", note: "swapped", supper_meal_id: mealB, diner_meal_id: null }]);
    expect(refetched.weekly_plan_grocery_presets).toEqual([{ preset_id: presetB }]);
  });

  it("delete_weekly_plan soft-deletes when the version matches", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const planId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });

    const { data, error } = await fake.rpc("delete_weekly_plan", { p_id: planId, p_base_version: 1 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: planId, version: 2 });
  });

  it("delete_weekly_plan returns a version conflict when base_version is stale", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const planId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });

    const { data, error } = await fake.rpc("delete_weekly_plan", { p_id: planId, p_base_version: 99 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: planId, version: 1 });
  });
});
