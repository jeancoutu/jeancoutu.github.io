import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../lib/db";
import { groceryPresetRepo } from "../../lib/repos/groceryPresetRepo";

const input = {
  name: "Pantry",
  items: [{ name: "Riz", quantity: "1 kg", category: "aisle" as const }],
};

describe("groceryPresetRepo", () => {
  beforeEach(async () => {
    await db.groceryPresets.clear();
    await db.syncQueue.clear();
  });

  it("create writes to Dexie, queues an insert, and returns the preset", async () => {
    const preset = await groceryPresetRepo.create(input);

    expect(preset.name).toBe("Pantry");
    const stored = await db.groceryPresets.get(preset.id);
    expect(stored?.version).toBe(1);
    expect(stored?.deletedAt).toBeNull();

    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      entity: "groceryPreset",
      entityId: preset.id,
      op: "upsert",
      baseVersion: null,
    });
  });

  it("getAll excludes soft-deleted presets", async () => {
    const preset = await groceryPresetRepo.create(input);
    await groceryPresetRepo.create({ ...input, name: "Freezer" });
    await groceryPresetRepo.delete(preset.id);

    const all = await groceryPresetRepo.getAll();
    expect(all.map((p) => p.name)).toEqual(["Freezer"]);
  });

  it("update queues an upsert carrying the pre-update version as baseVersion", async () => {
    const preset = await groceryPresetRepo.create(input);
    await db.syncQueue.clear();

    await groceryPresetRepo.update(preset.id, { ...input, name: "Pantry v2" });

    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({
      entity: "groceryPreset",
      entityId: preset.id,
      op: "upsert",
      baseVersion: 1,
    });
    expect((queued[0]!.payload as { name: string }).name).toBe("Pantry v2");
  });

  it("delete soft-deletes locally and queues a delete op", async () => {
    const preset = await groceryPresetRepo.create(input);
    await db.syncQueue.clear();

    await groceryPresetRepo.delete(preset.id);

    const stored = await db.groceryPresets.get(preset.id);
    expect(stored?.deletedAt).not.toBeNull();
    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({
      entity: "groceryPreset",
      entityId: preset.id,
      op: "delete",
      baseVersion: 1,
    });
  });
});
