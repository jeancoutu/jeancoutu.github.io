import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../lib/db";
import { mealRepo } from "../../lib/repos/mealRepo";

const input = {
  name: "Chicken Soup",
  duration: "short" as const,
  supperDays: ["monday" as const],
  url: "",
  ingredients: [],
  instructions: [],
  needsPrepAhead: false,
};

describe("mealRepo", () => {
  beforeEach(async () => {
    await db.meals.clear();
    await db.syncQueue.clear();
  });

  it("create writes to Dexie, queues an insert, and returns the meal", async () => {
    const meal = await mealRepo.create(input);

    expect(meal.name).toBe("Chicken Soup");
    const stored = await db.meals.get(meal.id);
    expect(stored?.version).toBe(1);
    expect(stored?.deletedAt).toBeNull();

    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ entity: "meal", entityId: meal.id, op: "upsert", baseVersion: null });
  });

  it("getAll excludes soft-deleted meals", async () => {
    const meal = await mealRepo.create(input);
    await mealRepo.create({ ...input, name: "Beef Stew" });
    await mealRepo.delete(meal.id);

    const all = await mealRepo.getAll();
    expect(all.map((m) => m.name)).toEqual(["Beef Stew"]);
  });

  it("update queues an upsert carrying the pre-update version as baseVersion", async () => {
    const meal = await mealRepo.create(input);
    await db.syncQueue.clear();

    await mealRepo.update(meal.id, { ...input, name: "Updated Soup" });

    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({ entity: "meal", entityId: meal.id, op: "upsert", baseVersion: 1 });
    expect((queued[0]!.payload as { name: string }).name).toBe("Updated Soup");
  });

  it("normalizes tags on create (trim, lowercase, drop empties, dedupe) and includes them in the sync payload", async () => {
    const meal = await mealRepo.create({ ...input, tags: ["  Pasta ", "QUICK", "pasta", "  ", ""] });

    expect(meal.tags).toEqual(["pasta", "quick"]);
    const stored = await db.meals.get(meal.id);
    expect(stored?.tags).toEqual(["pasta", "quick"]);

    const queued = await db.syncQueue.toArray();
    expect((queued[0]!.payload as { tags: string[] }).tags).toEqual(["pasta", "quick"]);
  });

  it("normalizes tags on update and defaults missing tags to [] on read", async () => {
    const meal = await mealRepo.create(input);
    // Simulate a row written before the tags field existed.
    await db.meals.update(meal.id, { tags: undefined } as unknown as Partial<import("../../lib/db").LocalMeal>);

    const all = await mealRepo.getAll();
    expect(all.find((m) => m.id === meal.id)?.tags).toEqual([]);

    const updated = await mealRepo.update(meal.id, { tags: ["Soup ", "soup"] });
    expect(updated.tags).toEqual(["soup"]);
    expect((await db.meals.get(meal.id))?.tags).toEqual(["soup"]);
  });

  it("delete soft-deletes locally and queues a delete op", async () => {
    const meal = await mealRepo.create(input);
    await db.syncQueue.clear();

    await mealRepo.delete(meal.id);

    const stored = await db.meals.get(meal.id);
    expect(stored?.deletedAt).not.toBeNull();
    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({ entity: "meal", entityId: meal.id, op: "delete", baseVersion: 1 });
  });
});
