import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, resetStores } from "../componentTestUtils";
import { db } from "../../lib/db";
import { weeklyPlan } from "../../lib/stores/weeklyPlan.svelte";
import {
  addCostcoItem,
  addGroceryItem,
  disableCostco,
  editCostcoItem,
  enableCostco,
  groceryList,
  removeCostcoItem,
  reloadGroceryItemsForWeek,
  toggleCostcoItemChecked,
} from "../../lib/stores/groceryList.svelte";
import { groceryPresetRepo } from "../../lib/repos/groceryPresetRepo";
import { weeklyPlanRepo } from "../../lib/repos/weeklyPlanRepo";

const costcoNames = () =>
  groceryList.itemsForWeek.filter((i) => i.isCostco).map((i) => i.name).sort();

describe("costco store", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("is off by default", () => {
    expect(groceryList.costcoEnabled).toBe(false);
  });

  it("enableCostco sets the flag and seeds from the recurring list", async () => {
    const list = await groceryPresetRepo.getCostcoList();
    await groceryPresetRepo.update(list.id, {
      name: list.name,
      items: [
        { name: "Paper towels", quantity: "1", category: "aisle" },
        { name: "Eggs", quantity: "24", category: "fridge" },
      ],
    });

    await enableCostco();

    expect(groceryList.costcoEnabled).toBe(true);
    expect(costcoNames()).toEqual(["Eggs", "Paper towels"]);
    expect((await weeklyPlanRepo.getByWeek(weeklyPlan.selectedWeek))?.costcoEnabled).toBe(true);
  });

  it("enableCostco with no recurring list just enables an empty section", async () => {
    await enableCostco();
    expect(groceryList.costcoEnabled).toBe(true);
    expect(costcoNames()).toEqual([]);
    expect(await db.groceryPresets.count()).toBe(0);
  });

  it("disableCostco clears the flag and deletes only Costco items; re-enabling re-seeds", async () => {
    const list = await groceryPresetRepo.getCostcoList();
    await groceryPresetRepo.update(list.id, {
      name: list.name,
      items: [{ name: "Eggs", quantity: "24", category: "fridge" }],
    });
    await addGroceryItem("fridge", "Milk", "1");
    await enableCostco();
    await addCostcoItem("Towels", "2");

    await disableCostco();

    expect(groceryList.costcoEnabled).toBe(false);
    expect(costcoNames()).toEqual([]);
    expect(groceryList.itemsForWeek.map((i) => i.name)).toEqual(["Milk"]);

    await enableCostco();
    expect(costcoNames()).toEqual(["Eggs"]);
  });

  it("addCostcoItem merges quantities for a repeated name and leaves a same-named regular item alone", async () => {
    await addGroceryItem("fridge", "Eggs", "6");
    await enableCostco();
    await addCostcoItem("Eggs", "12");
    await addCostcoItem("Eggs", "12");

    const eggs = groceryList.itemsForWeek.filter((i) => i.name === "Eggs");
    expect(eggs).toHaveLength(2);
    expect(eggs.find((i) => !i.isCostco)?.quantity).toBe("6");
    expect(eggs.find((i) => i.isCostco)?.quantity).toBe("24");
  });

  it("addGroceryItem for a name that also exists in Costco creates a separate regular row", async () => {
    await enableCostco();
    await addCostcoItem("Rice", "10 kg");
    await addGroceryItem("aisle", "Rice", "1");

    const rice = groceryList.itemsForWeek.filter((i) => i.name === "Rice");
    expect(rice.map((i) => i.isCostco).sort()).toEqual([false, true]);
  });

  it("toggle, edit and remove work on Costco items and persist", async () => {
    await enableCostco();
    await addCostcoItem("Towels", "1");
    const id = groceryList.itemsForWeek.find((i) => i.isCostco)!.id;

    toggleCostcoItemChecked(id, true);
    await vi.waitFor(() =>
      expect(groceryList.itemsForWeek.find((i) => i.id === id)?.checked).toBe(true),
    );

    editCostcoItem(id, "Big towels", "3");
    await vi.waitFor(() =>
      expect(groceryList.itemsForWeek.find((i) => i.id === id)).toMatchObject({
        name: "Big towels",
        quantity: "3",
        checked: true,
        isCostco: true,
      }),
    );

    removeCostcoItem(id);
    await vi.waitFor(async () => expect((await db.groceryItems.get(id))?.deletedAt).toBeTruthy());
    expect(costcoNames()).toEqual([]);
  });

  it("editCostcoItem renaming onto another Costco item merges into it", async () => {
    await enableCostco();
    await addCostcoItem("A", "1");
    await addCostcoItem("B", "2");
    const a = groceryList.itemsForWeek.find((i) => i.name === "A")!;

    editCostcoItem(a.id, "B", "3");

    await vi.waitFor(() => expect(costcoNames()).toEqual(["B"]));
    expect(groceryList.itemsForWeek.find((i) => i.name === "B")?.quantity).toBe("5");
  });

  it("the flag is per week and reloads from Dexie", async () => {
    await enableCostco();
    const week = weeklyPlan.selectedWeek;
    groceryList.costcoEnabledByWeek = {};
    await reloadGroceryItemsForWeek(week);
    expect(groceryList.costcoEnabled).toBe(true);

    weeklyPlan.selectedWeek = "2099-01-03";
    expect(groceryList.costcoEnabled).toBe(false);
  });
});
