import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../lib/db";
import { mealIdeaRepo } from "../../lib/repos/mealIdeaRepo";

describe("mealIdeaRepo", () => {
  beforeEach(async () => {
    await db.mealIdeas.clear();
    await db.syncQueue.clear();
  });

  it("create writes a row, queues an insert op, and returns the idea", async () => {
    const idea = await mealIdeaRepo.create("Try shakshuka");

    expect(idea.text).toBe("Try shakshuka");
    const stored = await db.mealIdeas.get(idea.id);
    expect(stored?.version).toBe(1);
    expect(stored?.deletedAt).toBeNull();
    expect(stored?.createdAt).toBe(idea.createdAt);

    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      entity: "mealIdea",
      entityId: idea.id,
      op: "upsert",
      baseVersion: null,
    });
  });

  it("getAll excludes soft-deleted ideas and returns newest first", async () => {
    const first = await mealIdeaRepo.create("First");
    // createdAt is second-resolution enough to collide; force distinct order.
    await db.mealIdeas.update(first.id, { createdAt: "2026-01-01T00:00:00.000Z" });
    const second = await mealIdeaRepo.create("Second");
    await db.mealIdeas.update(second.id, { createdAt: "2026-02-01T00:00:00.000Z" });
    const third = await mealIdeaRepo.create("Third");
    await db.mealIdeas.update(third.id, { createdAt: "2026-03-01T00:00:00.000Z" });

    await mealIdeaRepo.delete(second.id);

    const all = await mealIdeaRepo.getAll();
    expect(all.map((i) => i.text)).toEqual(["Third", "First"]);
  });

  it("update changes the text, bumps updatedAt, and queues an upsert with the prior version", async () => {
    const idea = await mealIdeaRepo.create("Draft");
    const before = await db.mealIdeas.get(idea.id);
    await db.syncQueue.clear();

    const updated = await mealIdeaRepo.update(idea.id, "Draft v2");

    expect(updated.text).toBe("Draft v2");
    const stored = await db.mealIdeas.get(idea.id);
    expect(stored?.text).toBe("Draft v2");
    expect(stored?.createdAt).toBe(before?.createdAt);
    expect(stored?.updatedAt).not.toBe(before?.updatedAt);

    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({
      entity: "mealIdea",
      entityId: idea.id,
      op: "upsert",
      baseVersion: 1,
    });
    expect((queued[0]!.payload as { text: string }).text).toBe("Draft v2");
  });

  it("delete soft-deletes locally and queues a delete op", async () => {
    const idea = await mealIdeaRepo.create("Ephemeral");
    await db.syncQueue.clear();

    await mealIdeaRepo.delete(idea.id);

    const stored = await db.mealIdeas.get(idea.id);
    expect(stored?.deletedAt).not.toBeNull();
    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({
      entity: "mealIdea",
      entityId: idea.id,
      op: "delete",
      baseVersion: 1,
    });
  });

  it("update throws when the idea is missing locally", async () => {
    await expect(mealIdeaRepo.update("nope", "x")).rejects.toThrow();
  });
});
