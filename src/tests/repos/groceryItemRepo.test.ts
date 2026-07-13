import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../lib/db";
import { groceryItemRepo } from "../../lib/repos/groceryItemRepo";

const PLAN_ID = "plan-1";

describe("groceryItemRepo", () => {
  beforeEach(async () => {
    await db.groceryItems.clear();
    await db.syncQueue.clear();
  });

  it("upsert with no id creates a new item, writes to Dexie, and queues an insert", async () => {
    const item = await groceryItemRepo.upsert(PLAN_ID, {
      name: "Carrots",
      quantity: "2",
      category: "vegetables",
      checked: false,
    });

    expect(item.weeklyPlanId).toBe(PLAN_ID);
    const stored = await db.groceryItems.get(item.id);
    expect(stored?.version).toBe(1);

    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({ entity: "groceryItem", entityId: item.id, op: "upsert", baseVersion: null });
  });

  it("upsert with an existing id carries the pre-update version as baseVersion", async () => {
    const item = await groceryItemRepo.upsert(PLAN_ID, {
      name: "Carrots",
      quantity: "2",
      category: "vegetables",
      checked: false,
    });
    await db.syncQueue.clear();

    await groceryItemRepo.upsert(PLAN_ID, { id: item.id, name: "Carrots", quantity: "3", category: "vegetables", checked: true });

    const queued = await db.syncQueue.toArray();
    expect(queued[0]).toMatchObject({ entity: "groceryItem", entityId: item.id, op: "upsert", baseVersion: 1 });
  });

  it("getForPlan excludes soft-deleted items and items from other plans", async () => {
    const a = await groceryItemRepo.upsert(PLAN_ID, { name: "Carrots", quantity: "1", category: "vegetables", checked: false });
    await groceryItemRepo.upsert(PLAN_ID, { name: "Milk", quantity: "1", category: "fridge", checked: false });
    await groceryItemRepo.upsert("other-plan", { name: "Bread", quantity: "1", category: "bakery", checked: false });
    await groceryItemRepo.delete(a.id);

    const items = await groceryItemRepo.getForPlan(PLAN_ID);
    expect(items.map((i) => i.name)).toEqual(["Milk"]);
  });

  it("deleteAll hard-deletes every item for a plan and queues a delete op each", async () => {
    const a = await groceryItemRepo.upsert(PLAN_ID, { name: "Carrots", quantity: "1", category: "vegetables", checked: false });
    const b = await groceryItemRepo.upsert(PLAN_ID, { name: "Milk", quantity: "1", category: "fridge", checked: false });
    await db.syncQueue.clear();

    await groceryItemRepo.deleteAll(PLAN_ID);

    expect(await groceryItemRepo.getForPlan(PLAN_ID)).toEqual([]);
    expect(await db.groceryItems.get(a.id)).toBeUndefined();
    expect(await db.groceryItems.get(b.id)).toBeUndefined();

    const queued = await db.syncQueue.toArray();
    expect(queued.map((q) => q.entityId).sort()).toEqual([a.id, b.id].sort());
    expect(queued.every((q) => q.op === "delete")).toBe(true);
  });

  it("replaceAll wipes existing items and inserts the new set", async () => {
    await groceryItemRepo.upsert(PLAN_ID, { name: "Carrots", quantity: "1", category: "vegetables", checked: false });

    const replaced = await groceryItemRepo.replaceAll(PLAN_ID, [
      { name: "Bread", quantity: "1", category: "bakery", checked: false },
    ]);

    expect(replaced.map((i) => i.name)).toEqual(["Bread"]);
    const items = await groceryItemRepo.getForPlan(PLAN_ID);
    expect(items.map((i) => i.name)).toEqual(["Bread"]);
  });

  it("upsert persists toVerify and defaults it to false when omitted", async () => {
    const item = await groceryItemRepo.upsert(PLAN_ID, {
      name: "Carrots",
      quantity: "2",
      category: "vegetables",
      checked: false,
    });
    expect(item.toVerify).toBe(false);

    const verified = await groceryItemRepo.upsert(PLAN_ID, {
      id: item.id,
      name: "Carrots",
      quantity: "2",
      category: "vegetables",
      checked: false,
      toVerify: true,
    });
    expect(verified.toVerify).toBe(true);
    expect((await db.groceryItems.get(item.id))?.toVerify).toBe(true);
  });

  describe("applyAdjustments", () => {
    it("preserves an existing item's toVerify flag across a quantity-only update", async () => {
      const item = await groceryItemRepo.upsert(PLAN_ID, {
        name: "Carrots",
        quantity: "1",
        category: "vegetables",
        checked: false,
        toVerify: true,
      });

      const items = await groceryItemRepo.applyAdjustments(PLAN_ID, [
        { name: "Carrots", category: "vegetables", addQuantities: ["2"], removeQuantities: [] },
      ]);

      const updated = items.find((i) => i.id === item.id);
      expect(updated?.quantity).toBe("3");
      expect(updated?.toVerify).toBe(true);
    });

    it("inserts a new item when the adjustment only adds quantity", async () => {
      const items = await groceryItemRepo.applyAdjustments(PLAN_ID, [
        { name: "Carrots", category: "vegetables", addQuantities: ["2"], removeQuantities: [] },
      ]);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ name: "Carrots", quantity: "2" });
    });

    it("merges into an existing item's quantity", async () => {
      await groceryItemRepo.upsert(PLAN_ID, { name: "Carrots", quantity: "1", category: "vegetables", checked: false });

      const items = await groceryItemRepo.applyAdjustments(PLAN_ID, [
        { name: "Carrots", category: "vegetables", addQuantities: ["2"], removeQuantities: [] },
      ]);

      expect(items.find((i) => i.name === "Carrots")?.quantity).toBe("3");
    });

    it("deletes an item once its net quantity drops to zero", async () => {
      await groceryItemRepo.upsert(PLAN_ID, { name: "Carrots", quantity: "2", category: "vegetables", checked: false });

      const items = await groceryItemRepo.applyAdjustments(PLAN_ID, [
        { name: "Carrots", category: "vegetables", addQuantities: [], removeQuantities: ["2"] },
      ]);

      expect(items.find((i) => i.name === "Carrots")).toBeUndefined();
      expect(await groceryItemRepo.getForPlan(PLAN_ID)).toEqual([]);
    });

    it("skips names present in dismissedNames", async () => {
      const items = await groceryItemRepo.applyAdjustments(
        PLAN_ID,
        [{ name: "Carrots", category: "vegetables", addQuantities: ["2"], removeQuantities: [] }],
        ["Carrots"],
      );

      expect(items).toEqual([]);
    });

    it("returns the existing items unchanged when there are no adjustments", async () => {
      await groceryItemRepo.upsert(PLAN_ID, { name: "Carrots", quantity: "1", category: "vegetables", checked: false });

      const items = await groceryItemRepo.applyAdjustments(PLAN_ID, []);
      expect(items).toHaveLength(1);
    });
  });
});
