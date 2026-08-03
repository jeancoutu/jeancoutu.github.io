import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

describe("upsert_meal / delete_meal RPCs", () => {
  it("insert path (p_base_version = null) creates a meal with its ingredients", async () => {
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

    const refetched = await fake.from("meals").select("*").eq("id", mealId).maybeSingle();
    expect(refetched.data).toMatchObject({
      name: "Chicken Soup",
      meal_ingredients: [{ name: "Chicken", quantity: "1 lb", category: "meat" }],
    });
  });

  it("update path with matching version bumps version and replaces ingredients", async () => {
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
      p_ingredients: [{ name: "Chicken", quantity: "1 lb", category: "meat" }],
    });

    const { data, error } = await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: 1,
      p_name: "Beef Stew",
      p_duration: "long",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [{ name: "Beef", quantity: "2 lb", category: "meat" }],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: mealId, version: 2 });

    const refetched = await fake.from("meals").select("*").eq("id", mealId).maybeSingle();
    expect(refetched.data).toMatchObject({
      name: "Beef Stew",
      meal_ingredients: [{ name: "Beef", quantity: "2 lb", category: "meat" }],
    });
  });

  it("conflict path returns the current server row when base_version is stale", async () => {
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

    const { data, error } = await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: 99,
      p_name: "Stale Edit",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: mealId, version: 1 });

    const refetched = await fake.from("meals").select("*").eq("id", mealId).maybeSingle();
    expect((refetched.data as { name: string }).name).toBe("Chicken Soup");
  });

  it("delete_meal soft-deletes via deleted_at when the version matches", async () => {
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

    const { data, error } = await fake.rpc("delete_meal", { p_id: mealId, p_base_version: 1 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: mealId, version: 2 });

    const refetched = await fake.from("meals").select("*").eq("id", mealId).maybeSingle();
    expect((refetched.data as { deleted_at: string | null }).deleted_at).not.toBeNull();
  });

  it("delete_meal returns a version conflict when base_version is stale", async () => {
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

    const { data, error } = await fake.rpc("delete_meal", { p_id: mealId, p_base_version: 99 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: mealId, version: 1 });
  });

  it("delete_meal nulls day_plans slots referencing the meal, bumps the owning plan, and reports its new version", async () => {
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

    const planId = crypto.randomUUID();
    await fake.rpc("upsert_weekly_plan", {
      p_id: planId,
      p_base_version: null,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [{ day_key: "monday", note: null, supper_meal_id: mealId, diner_meal_id: null }],
      p_preset_ids: [],
    });

    const { data, error } = await fake.rpc("delete_meal", { p_id: mealId, p_base_version: 1 });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: "ok",
      id: mealId,
      affected_plans: [{ id: planId, version: 2 }],
    });

    const refetchedPlan = await fake
      .from("weekly_plans")
      .select("id, week_start, dismissed_ingredient_names, version, updated_at, deleted_at, day_plans(day_key, note, supper_meal_id, diner_meal_id), weekly_plan_grocery_presets(preset_id)")
      .eq("id", planId)
      .maybeSingle();
    const dayPlans = (refetchedPlan.data as { day_plans: { supper_meal_id: string | null }[] }).day_plans;
    expect(dayPlans).toEqual([{ day_key: "monday", note: null, supper_meal_id: null, diner_meal_id: null }]);
  });

  it("delete_meal reports no affected_plans when the meal isn't booked anywhere", async () => {
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

    const { data, error } = await fake.rpc("delete_meal", { p_id: mealId, p_base_version: 1 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: mealId, affected_plans: [] });
  });

  it("round-trips tags through insert, update, and refetch", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealId = crypto.randomUUID();
    const { error } = await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Spaghetti",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
      p_tags: ["pasta", "quick"],
    });
    expect(error).toBeNull();

    let refetched = await fake.from("meals").select("*").eq("id", mealId).maybeSingle();
    expect((refetched.data as { tags: string[] }).tags).toEqual(["pasta", "quick"]);

    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: 1,
      p_name: "Spaghetti",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
      p_tags: ["pasta"],
    });

    refetched = await fake.from("meals").select("*").eq("id", mealId).maybeSingle();
    expect((refetched.data as { tags: string[] }).tags).toEqual(["pasta"]);
  });

  it("an upsert call without p_tags (old cached client) leaves existing tags untouched", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Spaghetti",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
      p_tags: ["pasta"],
    });

    // Old-client simulation: the 8-arg signature, no p_tags key at all —
    // the parameter defaults to null and coalesce keeps the stored tags.
    const { data, error } = await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: 1,
      p_name: "Renamed by old client",
      p_duration: "long",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: mealId, version: 2 });

    const refetched = await fake.from("meals").select("*").eq("id", mealId).maybeSingle();
    expect(refetched.data).toMatchObject({ name: "Renamed by old client", tags: ["pasta"] });
  });

  it("an insert without p_tags defaults tags to an empty array", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const mealId = crypto.randomUUID();
    const { error } = await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Untagged",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });
    expect(error).toBeNull();

    const refetched = await fake.from("meals").select("*").eq("id", mealId).maybeSingle();
    expect((refetched.data as { tags: string[] }).tags).toEqual([]);
  });

  it("delete_meal is idempotent once the meal is already deleted", async () => {
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
    await fake.rpc("delete_meal", { p_id: mealId, p_base_version: 1 });

    // Second delete of an already-deleted row never matches `deleted_at is
    // null`, so it falls into the "not found" (from the update's point of
    // view) branch — but the row still exists, so this returns "ok" with
    // its current (unbumped) version rather than raising or conflicting.
    const { data, error } = await fake.rpc("delete_meal", { p_id: mealId, p_base_version: 2 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: mealId, version: 2 });
  });
});
