import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import type { FakeSupabase } from "../fixtures/fakeSupabase";

// Repro for: "manually selecting a meal in the planner, then navigating
// away / refreshing / switching weeks — the selected meal did not save."
// Runs the real repo -> Dexie -> sync engine -> PGlite RPC path.
vi.mock("../../lib/supabase", async () => {
  const { createFakeSupabase } = await import("../fixtures/fakeSupabase");
  const fake = await createFakeSupabase();
  return {
    supabase: {
      ...fake,
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  };
});

const { supabase } = await import("../../lib/supabase");
const fake = supabase as unknown as FakeSupabase;

const { db } = await import("../../lib/db");
const { sync } = await import("../../lib/sync/engine");
const { syncStatus } = await import("../../lib/sync/status.svelte");
const { onConflict } = await import("../../lib/sync/status.svelte");
const { weeklyPlanRepo } = await import("../../lib/repos/weeklyPlanRepo");
const { mealRepo } = await import("../../lib/repos/mealRepo");

const WEEK = "2026-07-11";

async function seedMealOnServer(): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await fake.rpc("upsert_meal", {
    p_id: id,
    p_base_version: null,
    p_name: "Tacos",
    p_duration: "short",
    p_url: "",
    p_supper_days: [],
    p_instructions: [],
    p_ingredients: [],
  });
  if (error) throw new Error(error.message);
  return id;
}

describe("planner meal selection persistence", () => {
  beforeEach(async () => {
    await Promise.all([
      db.meals.clear(),
      db.weeklyPlans.clear(),
      db.groceryItems.clear(),
      db.groceryPresets.clear(),
      db.syncQueue.clear(),
      db.meta.clear(),
    ]);
    syncStatus.online = true;
    await fake._testHelpers.signInAsNewUser();
  });

  it("A: fresh week — select a meal, sync, Dexie still has it", async () => {
    const mealId = await seedMealOnServer();
    await sync(); // initial pull so the meal exists locally

    const row = await weeklyPlanRepo.getOrCreate(WEEK);
    await weeklyPlanRepo.save(row, { plan: { monday: { supper: mealId } } });

    await sync();

    const after = await weeklyPlanRepo.getByWeek(WEEK);
    expect(after?.plan?.monday?.supper).toBe(mealId);
  });

  it("B: second edit after a completed sync survives", async () => {
    const mealId = await seedMealOnServer();
    await sync();

    let row = await weeklyPlanRepo.getOrCreate(WEEK);
    await weeklyPlanRepo.save(row, { plan: { monday: { supper: mealId } } });
    await sync();

    row = (await weeklyPlanRepo.getByWeek(WEEK))!;
    await weeklyPlanRepo.save(row, { plan: { ...row.plan, tuesday: { supper: mealId } } });
    await sync();

    const after = await weeklyPlanRepo.getByWeek(WEEK);
    expect(after?.plan?.monday?.supper).toBe(mealId);
    expect(after?.plan?.tuesday?.supper).toBe(mealId);
  });

  it("C: plan already exists on server but not in Dexie — edit survives", async () => {
    const mealId = await seedMealOnServer();
    // Another device already created this week's plan on the server.
    const serverPlanId = crypto.randomUUID();
    const { error } = await fake.rpc("upsert_weekly_plan", {
      p_id: serverPlanId,
      p_base_version: null,
      p_week_start: WEEK,
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });
    if (error) throw new Error(error.message);

    // Local Dexie has meals but NOT this week's plan (e.g. edit races the pull).
    const { db: db2 } = await import("../../lib/db");
    await db2.meals.put({
      id: mealId, name: "Tacos", duration: "short", url: "", supperDays: [],
      instructions: [], tags: [], ingredients: [], version: 1,
      updatedAt: new Date().toISOString(), deletedAt: null,
    });

    const row = await weeklyPlanRepo.getOrCreate(WEEK);
    await weeklyPlanRepo.save(row, { plan: { monday: { supper: mealId } } });

    await sync();

    // The collision drops the original op, but the edit must be re-applied
    // on top of the adopted canonical row and pushed on the next sync.
    const after = await weeklyPlanRepo.getByWeek(WEEK);
    expect(after?.id).toBe(serverPlanId);
    expect(after?.plan?.monday?.supper).toBe(mealId);

    await sync();
    expect(await db.syncQueue.count()).toBe(0);
    const serverRow = await fake
      .from("weekly_plans")
      .select("id, week_start, dismissed_ingredient_names, version, updated_at, deleted_at, day_plans(day_key, note, supper_meal_id, diner_meal_id), weekly_plan_grocery_presets(preset_id)")
      .eq("id", serverPlanId)
      .maybeSingle();
    const dayPlans = (serverRow.data as { day_plans: { day_key: string; supper_meal_id: string | null }[] }).day_plans;
    expect(dayPlans).toEqual([{ day_key: "monday", note: null, supper_meal_id: mealId, diner_meal_id: null }]);
  });

  it("E: legacy duplicate local rows for the same week — edit survives and rows converge", async () => {
    const mealId = await seedMealOnServer();
    // Canonical plan exists on the server.
    const serverPlanId = crypto.randomUUID();
    const { error } = await fake.rpc("upsert_weekly_plan", {
      p_id: serverPlanId,
      p_base_version: null,
      p_week_start: WEEK,
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });
    if (error) throw new Error(error.message);
    // A later edit on another device bumped the canonical row past the
    // stale duplicate's version.
    const { error: error2 } = await fake.rpc("upsert_weekly_plan", {
      p_id: serverPlanId,
      p_base_version: 1,
      p_week_start: WEEK,
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    });
    if (error2) throw new Error(error2.message);
    await sync(); // pulls meal + canonical plan into Dexie

    // Legacy state left behind by the old broken conflict path: a second,
    // never-synced local row for the same week that lost the id race but was
    // never deleted. Force it to sort before the canonical row so
    // getByWeek().first() picks it, as it would for the affected user.
    const canonical = (await db.weeklyPlans.get(serverPlanId))!;
    const staleId = "00000000-0000-0000-0000-000000000001";
    await db.weeklyPlans.put({
      id: staleId,
      weekStart: WEEK,
      plan: {},
      dismissedNames: [],
      presetIds: [],
      version: 1,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    });

    // The user's edit lands on the stale duplicate.
    const row = await weeklyPlanRepo.getOrCreate(WEEK);
    expect(row.id).toBe(staleId);
    await weeklyPlanRepo.save(row, { plan: { monday: { supper: mealId } } });

    await sync(); // push conflicts (wrong row) -> adopt canonical + re-apply
    await sync(); // push the re-applied edit

    const rows = (await db.weeklyPlans.toArray()).filter((r) => r.weekStart === WEEK && !r.deletedAt);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(serverPlanId);
    expect(rows[0]!.plan?.monday?.supper).toBe(mealId);
    expect(rows[0]!.version).toBe(canonical.version + 1);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it("D: edit made while a sync is in flight survives the next sync", async () => {
    const mealId = await seedMealOnServer();
    await sync();

    let row = await weeklyPlanRepo.getOrCreate(WEEK);
    await weeklyPlanRepo.save(row, { plan: { monday: { supper: mealId } } });
    await sync(); // plan now synced at some server version

    // First edit syncs; second edit lands while that sync runs (its op is
    // enqueued after flushQueue snapshotted, so it goes in the next flush).
    row = (await weeklyPlanRepo.getByWeek(WEEK))!;
    await weeklyPlanRepo.save(row, { plan: { ...row.plan, tuesday: { supper: mealId } } });
    const syncPromise = sync();
    // simulate the user picking another meal mid-flight, using the row state
    // as the UI would have it (version not yet bumped by the in-flight push)
    await weeklyPlanRepo.save(row, { plan: { ...row.plan, tuesday: { supper: mealId }, wednesday: { supper: mealId } } });
    await syncPromise;
    await sync();

    const after = await weeklyPlanRepo.getByWeek(WEEK);
    expect(after?.plan?.wednesday?.supper).toBe(mealId);
  });

  it("F: deleting a meal booked into a plan syncs without a spurious conflict toast", async () => {
    const mealId = await seedMealOnServer();
    await sync();

    const row = await weeklyPlanRepo.getOrCreate(WEEK);
    await weeklyPlanRepo.save(row, { plan: { monday: { supper: mealId } } });
    await sync(); // plan booking now synced

    // Mirrors stores/meals.svelte.ts's deleteMealById: the meal delete op
    // and the local plan-cleanup upsert are queued back to back, then both
    // flush in the same sync() pass — reproducing the race with the
    // server's own delete_meal cleanup.
    await mealRepo.delete(mealId);
    await weeklyPlanRepo.clearMealFromAllPlans(mealId);

    const conflicts: unknown[] = [];
    const unsubscribe = onConflict((event) => conflicts.push(event));
    try {
      await sync();
    } finally {
      unsubscribe();
    }

    expect(conflicts).toEqual([]);
    expect(await db.syncQueue.count()).toBe(0);

    const after = await weeklyPlanRepo.getByWeek(WEEK);
    expect(after?.plan?.monday).toBeUndefined();
  });
});
