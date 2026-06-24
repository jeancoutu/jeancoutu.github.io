import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";

// Reset module state between tests by re-importing fresh
describe("groceryList store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  async function importStores() {
    const { selectedWeek } = await import("../../lib/stores/weeklyPlan");
    const {
      groceryListState,
      toggleGroceryChecked,
      addGroceryItem,
      removeGroceryItem,
      restoreGroceryItem,
      restoreAllGroceryItems,
      importGroceryList,
      isGroceryChecked,
      isGroceryRemoved,
    } = await import("../../lib/stores/groceryList");
    return {
      selectedWeek,
      groceryListState,
      toggleGroceryChecked,
      addGroceryItem,
      removeGroceryItem,
      restoreGroceryItem,
      restoreAllGroceryItems,
      importGroceryList,
      isGroceryChecked,
      isGroceryRemoved,
    };
  }

  it("starts with empty state", async () => {
    const { groceryListState } = await importStores();
    const state = get(groceryListState);
    expect(state.checked).toEqual([]);
    expect(state.removed).toEqual([]);
    expect(state.added).toEqual([]);
  });

  it("toggleGroceryChecked adds an item to checked", async () => {
    const { groceryListState, toggleGroceryChecked } = await importStores();
    toggleGroceryChecked("Milk");
    expect(get(groceryListState).checked).toContain("Milk");
  });

  it("toggleGroceryChecked removes an already-checked item", async () => {
    const { groceryListState, toggleGroceryChecked } = await importStores();
    toggleGroceryChecked("Milk");
    toggleGroceryChecked("Milk");
    expect(get(groceryListState).checked).not.toContain("Milk");
  });

  it("addGroceryItem adds a new custom item", async () => {
    const { groceryListState, addGroceryItem } = await importStores();
    addGroceryItem("vegetables", "Spinach", "1 bag");
    const state = get(groceryListState);
    expect(state.added).toHaveLength(1);
    expect(state.added[0]).toMatchObject({ name: "Spinach", category: "vegetables", quantity: "1 bag" });
  });

  it("addGroceryItem merges quantity when item already exists", async () => {
    const { groceryListState, addGroceryItem } = await importStores();
    addGroceryItem("vegetables", "Spinach", "1 bag");
    addGroceryItem("vegetables", "Spinach", "2 bags");
    const state = get(groceryListState);
    expect(state.added).toHaveLength(1);
    expect(state.added[0].quantity).toBe("1 bag, 2 bags");
  });

  it("addGroceryItem ignores empty names", async () => {
    const { groceryListState, addGroceryItem } = await importStores();
    addGroceryItem("vegetables", "   ", "1");
    expect(get(groceryListState).added).toHaveLength(0);
  });

  it("addGroceryItem defaults quantity to '1' when blank", async () => {
    const { groceryListState, addGroceryItem } = await importStores();
    addGroceryItem("vegetables", "Carrots", "  ");
    expect(get(groceryListState).added[0].quantity).toBe("1");
  });

  it("removeGroceryItem adds name to removed and removes from checked", async () => {
    const { groceryListState, toggleGroceryChecked, removeGroceryItem } = await importStores();
    toggleGroceryChecked("Bread");
    removeGroceryItem("Bread");
    const state = get(groceryListState);
    expect(state.removed).toContain("Bread");
    expect(state.checked).not.toContain("Bread");
  });

  it("restoreGroceryItem removes name from removed list", async () => {
    const { groceryListState, removeGroceryItem, restoreGroceryItem } = await importStores();
    removeGroceryItem("Bread");
    restoreGroceryItem("Bread");
    expect(get(groceryListState).removed).not.toContain("Bread");
  });

  it("restoreAllGroceryItems clears all removed items", async () => {
    const { groceryListState, removeGroceryItem, restoreAllGroceryItems } = await importStores();
    removeGroceryItem("Bread");
    removeGroceryItem("Milk");
    restoreAllGroceryItems();
    expect(get(groceryListState).removed).toEqual([]);
  });

  it("isGroceryChecked returns true for checked items", async () => {
    const { groceryListState, toggleGroceryChecked, isGroceryChecked } = await importStores();
    toggleGroceryChecked("Eggs");
    expect(isGroceryChecked("Eggs", get(groceryListState))).toBe(true);
    expect(isGroceryChecked("Milk", get(groceryListState))).toBe(false);
  });

  it("isGroceryRemoved returns true for removed items", async () => {
    const { groceryListState, removeGroceryItem, isGroceryRemoved } = await importStores();
    removeGroceryItem("Eggs");
    expect(isGroceryRemoved("Eggs", get(groceryListState))).toBe(true);
    expect(isGroceryRemoved("Milk", get(groceryListState))).toBe(false);
  });

  it("importGroceryList replaces the week's grocery state", async () => {
    const { selectedWeek, groceryListState, importGroceryList } = await importStores();
    const weekKey = get(selectedWeek);
    importGroceryList(weekKey, {
      checked: ["Milk"],
      removed: ["Bread"],
      added: [{ name: "Spinach", category: "vegetables", quantity: "2" }],
    });
    const state = get(groceryListState);
    expect(state.checked).toContain("Milk");
    expect(state.removed).toContain("Bread");
    expect(state.added[0].name).toBe("Spinach");
  });

  it("importGroceryList sanitizes invalid added items", async () => {
    const { selectedWeek, groceryListState, importGroceryList } = await importStores();
    const weekKey = get(selectedWeek);
    importGroceryList(weekKey, {
      checked: [],
      removed: [],
      added: [
        { name: "  ", category: "vegetables", quantity: "1" },
        { name: "Valid", category: "invalid-cat" as never, quantity: "1" },
        { name: "Good", category: "meat", quantity: "2" },
      ],
    });
    const state = get(groceryListState);
    expect(state.added).toHaveLength(1);
    expect(state.added[0].name).toBe("Good");
  });

  it("addGroceryItem removes name from removed when re-adding", async () => {
    const { groceryListState, removeGroceryItem, addGroceryItem } = await importStores();
    removeGroceryItem("Spinach");
    addGroceryItem("vegetables", "Spinach", "1");
    expect(get(groceryListState).removed).not.toContain("Spinach");
  });

  it("state is persisted to localStorage", async () => {
    const { addGroceryItem } = await importStores();
    addGroceryItem("vegetables", "Carrot", "3");
    expect(localStorage.setItem).toHaveBeenCalled();
  });
});
