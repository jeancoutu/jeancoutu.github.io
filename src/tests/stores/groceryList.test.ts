import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetByWeek = vi.fn();
const mockGetOrCreate = vi.fn();

vi.mock("../../lib/repos/weeklyPlanRepo", () => ({
  weeklyPlanRepo: {
    getByWeek: (...args: unknown[]) => mockGetByWeek(...args),
    getOrCreate: (...args: unknown[]) => mockGetOrCreate(...args),
    save: vi.fn(),
    setPlan: vi.fn(),
    getMealIds: vi.fn().mockResolvedValue(new Set()),
    clearPlan: vi.fn(),
    dismissIngredient: vi.fn(),
    undismissIngredient: vi.fn(),
  },
}));

const mockGetForPlan = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../lib/repos/groceryItemRepo", () => ({
  groceryItemRepo: {
    getForPlan: (...args: unknown[]) => mockGetForPlan(...args),
    upsert: (...args: unknown[]) => mockUpsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    deleteAll: vi.fn(),
    replaceAll: vi.fn(),
    applyAdjustments: vi.fn(),
  },
}));

vi.mock("../../lib/repos/mealRepo", () => ({
  mealRepo: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const PLAN_ROW = { id: "plan-1", weekStart: "mock-week", plan: {}, dismissedNames: [], presetIds: [] };

describe("groceryList store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetByWeek.mockResolvedValue(undefined);
    mockGetOrCreate.mockResolvedValue(PLAN_ROW);
    mockGetForPlan.mockResolvedValue([]);
    mockUpsert.mockImplementation(async (planId: string, item: { id?: string; name: string; quantity: string; category: string; checked: boolean; toVerify?: boolean }) => ({
      id: item.id ?? `id-${item.name}`,
      weeklyPlanId: planId,
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      checked: item.checked,
      toVerify: item.toVerify ?? false,
    }));
    mockDelete.mockResolvedValue(undefined);
  });

  async function importStore() {
    const { weeklyPlan } = await import("../../lib/stores/weeklyPlan.svelte");
    const {
      groceryList,
      toggleGroceryItemChecked,
      toggleGroceryItemToVerify,
      addGroceryItem,
      removeGroceryItem,
      editGroceryItem,
    } = await import("../../lib/stores/groceryList.svelte");
    return {
      weeklyPlan,
      groceryList,
      toggleGroceryItemChecked,
      toggleGroceryItemToVerify,
      addGroceryItem,
      removeGroceryItem,
      editGroceryItem,
    };
  }

  it("starts with empty item list", async () => {
    const { groceryList } = await importStore();
    expect(groceryList.itemsForWeek).toEqual([]);
  });

  it("addGroceryItem upserts via the repo and updates store", async () => {
    const { groceryList, addGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "Spinach", "1 bag");
    expect(groceryList.itemsForWeek).toHaveLength(1);
    const item = groceryList.itemsForWeek[0]!;
    expect(item.name).toBe("Spinach");
    expect(item.category).toBe("vegetables");
    expect(item.quantity).toBe("1 bag");
    expect(item.checked).toBe(false);
    expect(mockUpsert).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({ name: "Spinach", category: "vegetables", quantity: "1 bag", checked: false }),
    );
  });

  it("addGroceryItem ignores empty names", async () => {
    const { groceryList, addGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "   ", "1");
    expect(groceryList.itemsForWeek).toHaveLength(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("addGroceryItem defaults quantity to '1' when blank", async () => {
    const { groceryList, addGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "Carrots", "  ");
    expect(groceryList.itemsForWeek[0]!.quantity).toBe("1");
  });

  it("toggleGroceryItemChecked upserts via the repo and updates store", async () => {
    const { groceryList, toggleGroceryItemChecked } = await importStore();
    toggleGroceryItemChecked("Milk", "1 L", "fridge", true);
    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    expect(groceryList.itemsForWeek[0]!.checked).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      "plan-1",
      { id: undefined, name: "Milk", quantity: "1 L", category: "fridge", checked: true, toVerify: false },
    );
  });

  it("removeGroceryItem deletes via the repo and removes from store", async () => {
    const { groceryList, addGroceryItem, removeGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "Spinach", "1 bag");
    const id = groceryList.itemsForWeek[0]!.id;
    removeGroceryItem(id);
    expect(groceryList.itemsForWeek).toHaveLength(0);
    expect(mockDelete).toHaveBeenCalledWith(id);
  });

  it("editGroceryItem updates via the repo and updates store", async () => {
    const { groceryList, addGroceryItem, editGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "Spinach", "1 bag");
    const id = groceryList.itemsForWeek[0]!.id;
    editGroceryItem(id, "Baby Spinach", "vegetables", "2 bags");
    await vi.waitFor(() => expect(groceryList.itemsForWeek[0]!.name).toBe("Baby Spinach"));
    expect(groceryList.itemsForWeek[0]!.quantity).toBe("2 bags");
    expect(mockUpsert).toHaveBeenCalledWith(
      "plan-1",
      { id, name: "Baby Spinach", category: "vegetables", quantity: "2 bags", checked: false, toVerify: false },
    );
  });

  it("editGroceryItem lazily creates a DB row when no id is given yet", async () => {
    const { groceryList, editGroceryItem } = await importStore();
    editGroceryItem(undefined, "Kale", "vegetables", "1 bunch");
    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    expect(groceryList.itemsForWeek[0]!.name).toBe("Kale");
    expect(mockUpsert).toHaveBeenCalledWith(
      "plan-1",
      { id: undefined, name: "Kale", category: "vegetables", quantity: "1 bunch", checked: false, toVerify: false },
    );
  });

  it("editGroceryItem sets toVerify when passed true, committing pending edits in the same call", async () => {
    const { groceryList, addGroceryItem, editGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "Spinach", "1 bag");
    const id = groceryList.itemsForWeek[0]!.id;
    editGroceryItem(id, "Spinach", "vegetables", "2 bags", true);
    await vi.waitFor(() => expect(groceryList.itemsForWeek[0]!.quantity).toBe("2 bags"));
    expect(groceryList.itemsForWeek[0]!.toVerify).toBe(true);
  });

  it("toggleGroceryItemToVerify upserts via the repo and updates store", async () => {
    const { groceryList, addGroceryItem, toggleGroceryItemToVerify } = await importStore();
    await addGroceryItem("vegetables", "Spinach", "1 bag");
    toggleGroceryItemToVerify("Spinach", "1 bag", "vegetables", true);
    await vi.waitFor(() => expect(groceryList.itemsForWeek[0]!.toVerify).toBe(true));
  });

  it("toggleGroceryItemToVerify lazily creates a row for a meal-plan item with no DB row yet", async () => {
    const { groceryList, toggleGroceryItemToVerify } = await importStore();
    toggleGroceryItemToVerify("Kale", "1 bunch", "vegetables", true);
    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    expect(groceryList.itemsForWeek[0]!.toVerify).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      "plan-1",
      { id: undefined, name: "Kale", quantity: "1 bunch", category: "vegetables", checked: false, toVerify: true },
    );
  });

  it("toggleGroceryItemChecked clears toVerify when checking an item", async () => {
    const { groceryList, addGroceryItem, toggleGroceryItemToVerify, toggleGroceryItemChecked } = await importStore();
    await addGroceryItem("vegetables", "Spinach", "1 bag");
    toggleGroceryItemToVerify("Spinach", "1 bag", "vegetables", true);
    await vi.waitFor(() => expect(groceryList.itemsForWeek[0]!.toVerify).toBe(true));

    toggleGroceryItemChecked("Spinach", "1 bag", "vegetables", true);
    await vi.waitFor(() => expect(groceryList.itemsForWeek[0]!.checked).toBe(true));
    expect(groceryList.itemsForWeek[0]!.toVerify).toBe(false);
  });

  it("addGroceryItem merges into an existing item with the same name instead of duplicating it", async () => {
    const { groceryList, addGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "Carrots", "1");
    await addGroceryItem("vegetables", "Carrots", "2");
    expect(groceryList.itemsForWeek).toHaveLength(1);
    expect(groceryList.itemsForWeek[0]!.quantity).toBe("3");
    expect(mockUpsert).toHaveBeenLastCalledWith(
      "plan-1",
      expect.objectContaining({ name: "Carrots", quantity: "3" }),
    );
  });

  it("editGroceryItem merges into a colliding item and deletes the renamed row", async () => {
    const { groceryList, addGroceryItem, editGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "Carrots", "1");
    await addGroceryItem("vegetables", "Spinach", "1 bag");
    expect(groceryList.itemsForWeek).toHaveLength(2);

    const spinachId = groceryList.itemsForWeek.find((i) => i.name === "Spinach")!.id;
    editGroceryItem(spinachId, "Carrots", "vegetables", "2");

    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    expect(groceryList.itemsForWeek[0]!.name).toBe("Carrots");
    expect(groceryList.itemsForWeek[0]!.quantity).toBe("3");
    expect(mockDelete).toHaveBeenCalledWith(spinachId);
  });

  it("state is not persisted to localStorage", async () => {
    const { addGroceryItem } = await importStore();
    await addGroceryItem("vegetables", "Carrot", "3");
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
