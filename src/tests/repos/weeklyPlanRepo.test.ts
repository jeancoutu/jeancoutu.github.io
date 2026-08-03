import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../lib/db";
import { weeklyPlanRepo } from "../../lib/repos/weeklyPlanRepo";

describe("weeklyPlanRepo", () => {
  beforeEach(async () => {
    await db.weeklyPlans.clear();
    await db.syncQueue.clear();
  });

  it("getOrCreate writes a new row to Dexie and queues an insert", async () => {
    const row = await weeklyPlanRepo.getOrCreate("2025-01-04");

    expect(row.weekStart).toBe("2025-01-04");
    expect(row.plan).toEqual({});
    expect(row.dismissedNames).toEqual([]);
    expect(row.presetIds).toEqual([]);

    const stored = await db.weeklyPlans.get(row.id);
    expect(stored?.version).toBe(1);

    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ entity: "weeklyPlan", entityId: row.id, op: "upsert", baseVersion: null });
  });

  it("getOrCreate returns the existing row instead of creating a duplicate", async () => {
    const first = await weeklyPlanRepo.getOrCreate("2025-01-04");
    const second = await weeklyPlanRepo.getOrCreate("2025-01-04");

    expect(second.id).toBe(first.id);
    expect(await db.weeklyPlans.count()).toBe(1);
  });

  it("concurrent getOrCreate calls for the same week never create two rows", async () => {
    // Mirrors auto-fill's optimistic write racing a manual edit fired
    // right after: both call getOrCreate for the same week before either
    // Dexie write has landed.
    const [a, b] = await Promise.all([
      weeklyPlanRepo.getOrCreate("2025-01-04"),
      weeklyPlanRepo.getOrCreate("2025-01-04"),
    ]);

    expect(a.id).toBe(b.id);
    expect(await db.weeklyPlans.count()).toBe(1);
    expect(await db.syncQueue.count()).toBe(1);
  });

  it("save queues an upsert carrying the pre-save version as baseVersion", async () => {
    const row = await weeklyPlanRepo.getOrCreate("2025-01-04");
    await db.syncQueue.clear();

    await weeklyPlanRepo.save(row, { plan: { monday: { supper: "meal-1" } } });

    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({ entity: "weeklyPlan", entityId: row.id, op: "upsert", baseVersion: 1 });
  });

  it("getByWeek returns undefined for a soft-deleted plan", async () => {
    const row = await weeklyPlanRepo.getOrCreate("2025-01-04");
    await db.weeklyPlans.put({ ...row, deletedAt: new Date().toISOString() });

    expect(await weeklyPlanRepo.getByWeek("2025-01-04")).toBeUndefined();
  });

  it("getMealIds collects unique supper and diner meal ids from the plan", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", {
      monday: { supper: "a", diner: "b" },
      tuesday: { supper: "a" },
    });

    const ids = await weeklyPlanRepo.getMealIds("2025-01-04");
    expect(ids).toEqual(new Set(["a", "b"]));
  });

  it("getMealIds returns an empty set when the week has no plan", async () => {
    expect(await weeklyPlanRepo.getMealIds("2099-01-01")).toEqual(new Set());
  });

  it("clearPlan resets the plan to empty without touching dismissed names", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", { monday: { supper: "a" } });
    await weeklyPlanRepo.dismissIngredient("2025-01-04", "Garlic");

    const cleared = await weeklyPlanRepo.clearPlan("2025-01-04");

    expect(cleared?.plan).toEqual({});
    expect(cleared?.dismissedNames).toEqual(["Garlic"]);
  });

  it("clearPlan is a no-op when no row exists for the week", async () => {
    expect(await weeklyPlanRepo.clearPlan("2099-01-01")).toBeUndefined();
  });

  it("dismissIngredient adds a name once and undismissIngredient removes it", async () => {
    await weeklyPlanRepo.dismissIngredient("2025-01-04", "Garlic");
    const row = await weeklyPlanRepo.dismissIngredient("2025-01-04", "Garlic");
    expect(row.dismissedNames).toEqual(["Garlic"]);

    const undone = await weeklyPlanRepo.undismissIngredient("2025-01-04", "Garlic");
    expect(undone.dismissedNames).toEqual([]);
  });

  it("clearMealFromAllPlans clears the meal from supper only, keeping the day entry if diner remains", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", {
      monday: { supper: "meal-1", diner: "meal-2" },
    });

    const affected = await weeklyPlanRepo.clearMealFromAllPlans("meal-1");

    expect(affected).toEqual(["2025-01-04"]);
    const row = await weeklyPlanRepo.getByWeek("2025-01-04");
    expect(row?.plan.monday).toEqual({ diner: "meal-2" });
  });

  it("clearMealFromAllPlans clears the meal from diner only", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", {
      monday: { supper: "meal-2", diner: "meal-1" },
    });

    await weeklyPlanRepo.clearMealFromAllPlans("meal-1");

    const row = await weeklyPlanRepo.getByWeek("2025-01-04");
    expect(row?.plan.monday).toEqual({ supper: "meal-2" });
  });

  it("clearMealFromAllPlans clears both slots in the same day and drops the day entry", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", {
      monday: { supper: "meal-1", diner: "meal-1" },
    });

    await weeklyPlanRepo.clearMealFromAllPlans("meal-1");

    const row = await weeklyPlanRepo.getByWeek("2025-01-04");
    expect(row?.plan.monday).toBeUndefined();
  });

  it("clearMealFromAllPlans keeps the day entry when a note remains after clearing", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", {
      monday: { supper: "meal-1", note: "remember the sides" },
    });

    await weeklyPlanRepo.clearMealFromAllPlans("meal-1");

    const row = await weeklyPlanRepo.getByWeek("2025-01-04");
    expect(row?.plan.monday).toEqual({ note: "remember the sides" });
  });

  it("clearMealFromAllPlans clears the meal across multiple weeks and returns all affected weeks", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", { monday: { supper: "meal-1" } });
    await weeklyPlanRepo.setPlan("2025-01-11", { tuesday: { diner: "meal-1" } });
    await weeklyPlanRepo.setPlan("2025-01-18", { wednesday: { supper: "meal-2" } });

    const affected = await weeklyPlanRepo.clearMealFromAllPlans("meal-1");

    expect(new Set(affected)).toEqual(new Set(["2025-01-04", "2025-01-11"]));
    expect((await weeklyPlanRepo.getByWeek("2025-01-18"))?.plan.wednesday).toEqual({ supper: "meal-2" });
  });

  it("clearMealFromAllPlans is a no-op for a falsy id, even against days missing a supper/diner slot", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", {
      monday: { diner: "meal-2" },
      tuesday: { note: "just a note" },
    });

    const affected = await weeklyPlanRepo.clearMealFromAllPlans(undefined as unknown as string);

    expect(affected).toEqual([]);
    const row = await weeklyPlanRepo.getByWeek("2025-01-04");
    expect(row?.plan.monday).toEqual({ diner: "meal-2" });
    expect(row?.plan.tuesday).toEqual({ note: "just a note" });
  });

  it("clearMealFromAllPlans is a no-op when the meal isn't referenced anywhere", async () => {
    await weeklyPlanRepo.setPlan("2025-01-04", { monday: { supper: "meal-2" } });

    const affected = await weeklyPlanRepo.clearMealFromAllPlans("meal-1");

    expect(affected).toEqual([]);
  });

  it("setPresetActive adds and removes a preset id idempotently", async () => {
    const activated = await weeklyPlanRepo.setPresetActive("2025-01-04", "preset-1", true);
    expect(activated.presetIds).toEqual(["preset-1"]);

    const stillActive = await weeklyPlanRepo.setPresetActive("2025-01-04", "preset-1", true);
    expect(stillActive.presetIds).toEqual(["preset-1"]);

    const deactivated = await weeklyPlanRepo.setPresetActive("2025-01-04", "preset-1", false);
    expect(deactivated.presetIds).toEqual([]);
  });
});
