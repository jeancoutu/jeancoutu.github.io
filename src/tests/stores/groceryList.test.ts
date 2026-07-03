import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GroceryDBItem } from "../../lib/stores/groceryList.svelte";

const mockFetchGroceryItems = vi.fn<(weekStart: string) => Promise<GroceryDBItem[]>>();
const mockUpsertGroceryItem = vi.fn<(weekStart: string, item: Omit<GroceryDBItem, "id">) => Promise<GroceryDBItem>>();
const mockUpdateGroceryItem = vi.fn<(id: string, changes: Partial<Omit<GroceryDBItem, "id">>) => Promise<void>>();
const mockDeleteGroceryItem = vi.fn<(id: string) => Promise<void>>();

vi.mock("../../lib/api/groceryList", () => ({
  fetchGroceryItems: (weekStart: string) => mockFetchGroceryItems(weekStart),
  upsertGroceryItem: (weekStart: string, item: Omit<GroceryDBItem, "id">) => mockUpsertGroceryItem(weekStart, item),
  updateGroceryItem: (id: string, changes: Partial<Omit<GroceryDBItem, "id">>) => mockUpdateGroceryItem(id, changes),
  deleteGroceryItem: (id: string) => mockDeleteGroceryItem(id),
}));

describe("groceryList store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetchGroceryItems.mockResolvedValue([]);
    mockUpsertGroceryItem.mockImplementation(async (_week: string, item: Omit<GroceryDBItem, "id">) => ({
      id: `id-${item.name}`,
      ...item,
    }));
    mockUpdateGroceryItem.mockResolvedValue(undefined);
    mockDeleteGroceryItem.mockResolvedValue(undefined);
  });

  async function importStore() {
    const { weeklyPlan } = await import("../../lib/stores/weeklyPlan.svelte");
    const {
      groceryList,
      toggleGroceryItemChecked,
      addGroceryItem,
      removeGroceryItem,
      editGroceryItem,
    } = await import("../../lib/stores/groceryList.svelte");
    return { weeklyPlan, groceryList, toggleGroceryItemChecked, addGroceryItem, removeGroceryItem, editGroceryItem };
  }

  it("starts with empty item list", async () => {
    const { groceryList } = await importStore();
    expect(groceryList.itemsForWeek).toEqual([]);
  });

  it("addGroceryItem inserts via API and updates store", async () => {
    const { groceryList, addGroceryItem } = await importStore();
    addGroceryItem("vegetables", "Spinach", "1 bag");
    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    const item = groceryList.itemsForWeek[0]!;
    expect(item.name).toBe("Spinach");
    expect(item.category).toBe("vegetables");
    expect(item.quantity).toBe("1 bag");
    expect(item.checked).toBe(false);
    expect(mockUpsertGroceryItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: "Spinach", category: "vegetables", quantity: "1 bag", checked: false }),
    );
  });

  it("addGroceryItem ignores empty names", async () => {
    const { groceryList, addGroceryItem } = await importStore();
    addGroceryItem("vegetables", "   ", "1");
    await new Promise((r) => setTimeout(r, 10));
    expect(groceryList.itemsForWeek).toHaveLength(0);
    expect(mockUpsertGroceryItem).not.toHaveBeenCalled();
  });

  it("addGroceryItem defaults quantity to '1' when blank", async () => {
    const { groceryList, addGroceryItem } = await importStore();
    addGroceryItem("vegetables", "Carrots", "  ");
    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    expect(groceryList.itemsForWeek[0]!.quantity).toBe("1");
  });

  it("toggleGroceryItemChecked upserts via API and updates store", async () => {
    const { groceryList, toggleGroceryItemChecked } = await importStore();
    mockUpsertGroceryItem.mockResolvedValueOnce({
      id: "id-Milk",
      name: "Milk",
      quantity: "1 L",
      category: "fridge",
      checked: true,
    });
    toggleGroceryItemChecked("Milk", "1 L", "fridge", true);
    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    expect(groceryList.itemsForWeek[0]!.checked).toBe(true);
    expect(mockUpsertGroceryItem).toHaveBeenCalledWith(
      expect.any(String),
      { name: "Milk", quantity: "1 L", category: "fridge", checked: true },
    );
  });

  it("removeGroceryItem deletes via API and removes from store", async () => {
    const { groceryList, addGroceryItem, removeGroceryItem } = await importStore();
    addGroceryItem("vegetables", "Spinach", "1 bag");
    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    const id = groceryList.itemsForWeek[0]!.id;
    removeGroceryItem(id);
    expect(groceryList.itemsForWeek).toHaveLength(0);
    expect(mockDeleteGroceryItem).toHaveBeenCalledWith(id);
  });

  it("editGroceryItem updates via API and updates store", async () => {
    const { groceryList, addGroceryItem, editGroceryItem } = await importStore();
    addGroceryItem("vegetables", "Spinach", "1 bag");
    await vi.waitFor(() => expect(groceryList.itemsForWeek).toHaveLength(1));
    const id = groceryList.itemsForWeek[0]!.id;
    editGroceryItem(id, "Baby Spinach", "vegetables", "2 bags");
    const updated = groceryList.itemsForWeek[0]!;
    expect(updated.name).toBe("Baby Spinach");
    expect(updated.quantity).toBe("2 bags");
    expect(mockUpdateGroceryItem).toHaveBeenCalledWith(
      id,
      { name: "Baby Spinach", category: "vegetables", quantity: "2 bags" },
    );
  });

  it("state is not persisted to localStorage", async () => {
    const { addGroceryItem } = await importStore();
    addGroceryItem("vegetables", "Carrot", "3");
    await new Promise((r) => setTimeout(r, 10));
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
