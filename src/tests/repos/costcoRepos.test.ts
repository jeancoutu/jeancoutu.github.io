import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../lib/db";
import { groceryItemRepo } from "../../lib/repos/groceryItemRepo";
import { groceryPresetRepo } from "../../lib/repos/groceryPresetRepo";
import { weeklyPlanRepo } from "../../lib/repos/weeklyPlanRepo";

describe("costco: groceryItemRepo", () => {
  beforeEach(async () => {
    await db.groceryItems.clear();
    await db.syncQueue.clear();
  });

  it("upsert stores isCostco, and an existing row never changes section", async () => {
    const item = await groceryItemRepo.upsert("p", { name: "Towels", quantity: "1", category: "aisle", checked: false, isCostco: true });
    expect(item.isCostco).toBe(true);

    const again = await groceryItemRepo.upsert("p", { id: item.id, name: "Towels", quantity: "2", category: "aisle", checked: false });
    expect(again.isCostco).toBe(true);
  });

  it("deleteCostcoItems tombstones and queues only Costco rows", async () => {
    const regular = await groceryItemRepo.upsert("p", { name: "Milk", quantity: "1", category: "fridge", checked: false });
    const costco = await groceryItemRepo.upsert("p", { name: "Milk", quantity: "1", category: "fridge", checked: false, isCostco: true });
    await db.syncQueue.clear();

    await groceryItemRepo.deleteCostcoItems("p");

    expect((await groceryItemRepo.getForPlan("p")).map((i) => i.id)).toEqual([regular.id]);
    expect((await db.groceryItems.get(costco.id))?.deletedAt).toBeTruthy();
    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ entityId: costco.id, op: "delete" });
  });

  it("deleteAll (clear week / auto-fill) and applyAdjustments leave Costco rows alone", async () => {
    const costco = await groceryItemRepo.upsert("p", { name: "Rice", quantity: "10 kg", category: "aisle", checked: false, isCostco: true });

    await groceryItemRepo.applyAdjustments("p", [{ name: "Rice", category: "aisle", addQuantities: ["1"], removeQuantities: [] }]);
    const rows = await groceryItemRepo.getForPlan("p");
    expect(rows.find((r) => r.id === costco.id)?.quantity).toBe("10 kg");
    expect(rows.filter((r) => r.name === "Rice")).toHaveLength(2);

    await groceryItemRepo.deleteAll("p");
    expect((await groceryItemRepo.getForPlan("p")).map((r) => r.id)).toEqual([costco.id]);
  });

  it("getForPlan defaults isCostco to false for rows written before the field existed", async () => {
    await db.groceryItems.put({
      id: "old", weeklyPlanId: "p", name: "X", quantity: "1", category: "aisle", checked: false, toVerify: false,
      version: 1, updatedAt: "", deletedAt: null,
    } as never);
    expect((await groceryItemRepo.getForPlan("p"))[0]?.isCostco).toBe(false);
  });
});

describe("costco: groceryPresetRepo", () => {
  beforeEach(async () => {
    await db.groceryPresets.clear();
    await db.syncQueue.clear();
  });

  it("getCostcoList creates once, even under concurrent calls, and is hidden from getAll", async () => {
    const [a, b] = await Promise.all([groceryPresetRepo.getCostcoList(), groceryPresetRepo.getCostcoList()]);

    expect(a.id).toBe(b.id);
    expect(await db.groceryPresets.count()).toBe(1);
    expect(await db.syncQueue.count()).toBe(1);
    expect((await db.groceryPresets.get(a.id))?.isCostco).toBe(true);
    expect(await groceryPresetRepo.getAll()).toEqual([]);
    expect((await groceryPresetRepo.findCostcoList())?.id).toBe(a.id);
  });

  it("findCostcoList never creates", async () => {
    expect(await groceryPresetRepo.findCostcoList()).toBeUndefined();
    expect(await db.groceryPresets.count()).toBe(0);
  });

  it("update keeps the Costco flag", async () => {
    const list = await groceryPresetRepo.getCostcoList();
    await groceryPresetRepo.update(list.id, { name: list.name, items: [{ name: "Eggs", quantity: "1", category: "fridge" }] });
    expect((await db.groceryPresets.get(list.id))?.isCostco).toBe(true);
  });
});

describe("costco: weeklyPlanRepo", () => {
  beforeEach(async () => {
    await db.weeklyPlans.clear();
    await db.syncQueue.clear();
  });

  it("defaults off, setCostcoEnabled persists and queues, and is a no-op when unchanged", async () => {
    const row = await weeklyPlanRepo.getOrCreate("2026-01-03");
    expect(row.costcoEnabled).toBe(false);
    await db.syncQueue.clear();

    await weeklyPlanRepo.setCostcoEnabled("2026-01-03", false);
    expect(await db.syncQueue.count()).toBe(0);

    await weeklyPlanRepo.setCostcoEnabled("2026-01-03", true);
    expect((await weeklyPlanRepo.getByWeek("2026-01-03"))?.costcoEnabled).toBe(true);
    expect(await db.syncQueue.count()).toBe(1);
  });
});
