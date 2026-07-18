import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, fireEvent, userEvent, resetDb, resetStores } from "../componentTestUtils";
import GroceryList from "../../lib/components/GroceryList.svelte";
import { meals } from "../../lib/stores/meals.svelte";
import { weeklyPlan } from "../../lib/stores/weeklyPlan.svelte";
import { groceryList, addGroceryItem } from "../../lib/stores/groceryList.svelte";
import { groceryPresets } from "../../lib/stores/groceryPresets.svelte";
import { groceryPresetRepo } from "../../lib/repos/groceryPresetRepo";
import { mealRepo } from "../../lib/repos/mealRepo";
import { db } from "../../lib/db";

describe("GroceryList", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("renders the empty state when there are no items", () => {
    render(GroceryList);
    expect(screen.getByText(/No meals planned yet/)).toBeInTheDocument();
  });

  it("preset pill buttons toggle aria-pressed and are disabled while the toggle is in flight", async () => {
    const preset = await groceryPresetRepo.create({
      name: "Pantry",
      items: [{ name: "Rice", quantity: "1 kg", category: "aisle" }],
    });
    groceryPresets.all = await groceryPresetRepo.getAll();

    render(GroceryList);
    const button = screen.getByRole("button", { name: "Pantry" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);
    await vi.waitFor(() => expect(button).toBeDisabled());
    await vi.waitFor(() => expect(button).not.toBeDisabled());

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(groceryPresets.activeForWeek.has(preset.id)).toBe(true);
  });

  it("'+' per category reveals an inline add form; submit adds the item", async () => {
    render(GroceryList);
    const user = userEvent.setup();

    const vegetablesHeader = screen.getByText("Vegetables").closest("div")!;
    await user.click(within(vegetablesHeader).getByRole("button", { name: "Add ingredient" }));

    await user.type(screen.getByPlaceholderText("Ingredient name"), "Carrot");
    await user.type(screen.getByPlaceholderText("Qty"), "2");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => expect(groceryList.itemsForWeek.map((i) => i.name)).toContain("Carrot"));
    expect(screen.getByText("Carrot")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Ingredient name")).not.toBeInTheDocument();
  });

  it("Escape resets the add form without adding an item", async () => {
    render(GroceryList);
    const user = userEvent.setup();

    const vegetablesHeader = screen.getByText("Vegetables").closest("div")!;
    await user.click(within(vegetablesHeader).getByRole("button", { name: "Add ingredient" }));
    const nameInput = screen.getByPlaceholderText("Ingredient name");
    await user.type(nameInput, "Discarded");
    await user.keyboard("{Escape}");

    expect(screen.queryByPlaceholderText("Ingredient name")).not.toBeInTheDocument();
    expect(groceryList.itemsForWeek).toEqual([]);
  });

  it("Cancel resets the add form without adding an item", async () => {
    render(GroceryList);
    const user = userEvent.setup();

    const vegetablesHeader = screen.getByText("Vegetables").closest("div")!;
    await user.click(within(vegetablesHeader).getByRole("button", { name: "Add ingredient" }));
    await user.type(screen.getByPlaceholderText("Ingredient name"), "Discarded");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByPlaceholderText("Ingredient name")).not.toBeInTheDocument();
    expect(groceryList.itemsForWeek).toEqual([]);
  });

  it("checkbox toggles checked, and checked items sort to the bottom with strikethrough styling", async () => {
    await addGroceryItem("vegetables", "Apple", "1");
    await addGroceryItem("vegetables", "Banana", "2");

    render(GroceryList);
    const appleCheckbox = within(screen.getByText("Apple").closest("li")!).getByRole("checkbox");
    const user = userEvent.setup();

    await user.click(appleCheckbox);

    await vi.waitFor(() => {
      expect(groceryList.itemsForWeek.find((i) => i.name === "Apple")?.checked).toBe(true);
    });
    const appleTextSpan = screen.getByText("Apple", { exact: false });
    expect(appleTextSpan).toHaveClass("line-through");

    const items = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    const appleIdx = items.findIndex((t) => t.includes("Apple"));
    const bananaIdx = items.findIndex((t) => t.includes("Banana"));
    expect(appleIdx).toBeGreaterThan(bananaIdx);
  });

  it("long-pressing a custom item enters inline edit; Enter saves the change", async () => {
    await addGroceryItem("vegetables", "Carrot", "1");
    render(GroceryList);

    const label = screen.getByText("Carrot").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const nameInput = await screen.findByDisplayValue("Carrot");
    const user = userEvent.setup();
    await user.clear(nameInput);
    await user.type(nameInput, "Baby Carrot{Enter}");

    await vi.waitFor(() => expect(groceryList.itemsForWeek.map((i) => i.name)).toContain("Baby Carrot"));
    expect(screen.getByText("Baby Carrot")).toBeInTheDocument();
  }, 10000);

  it("long-press edit: Escape cancels without saving", async () => {
    await addGroceryItem("vegetables", "Carrot", "1");
    render(GroceryList);

    const label = screen.getByText("Carrot").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const nameInput = await screen.findByDisplayValue("Carrot");
    const user = userEvent.setup();
    await user.clear(nameInput);
    await user.type(nameInput, "Discarded{Escape}");

    expect(screen.queryByDisplayValue("Discarded")).not.toBeInTheDocument();
    expect(screen.getByText("Carrot")).toBeInTheDocument();
    expect(groceryList.itemsForWeek.map((i) => i.name)).not.toContain("Discarded");
  }, 10000);

  it("long-press edit shows the source meal names for a plan-derived item with a DB row", async () => {
    const meal = await mealRepo.create({
      name: "Tacos",
      duration: "short",
      supperDays: [],
      url: "",
      ingredients: [{ name: "Beef", quantity: "1 lb", category: "meat" }],
      instructions: ["Cook"],
    });
    meals.all = await mealRepo.getAll();
    weeklyPlan.plans = {
      ...weeklyPlan.plans,
      [weeklyPlan.selectedWeek]: { monday: { supper: meal.id } },
    };
    // DB row matching the meal ingredient (as applyAdjustments would create)
    await addGroceryItem("meat", "Beef", "1 lb");

    render(GroceryList);

    const label = screen.getByText("Beef").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));

    await screen.findByDisplayValue("Beef");
    expect(screen.getByText("Tacos")).toBeInTheDocument();
  }, 10000);

  it("long-press edit shows no provenance line for a custom item", async () => {
    const meal = await mealRepo.create({
      name: "Tacos",
      duration: "short",
      supperDays: [],
      url: "",
      ingredients: [{ name: "Beef", quantity: "1 lb", category: "meat" }],
      instructions: ["Cook"],
    });
    meals.all = await mealRepo.getAll();
    weeklyPlan.plans = {
      ...weeklyPlan.plans,
      [weeklyPlan.selectedWeek]: { monday: { supper: meal.id } },
    };
    // Renamed item: no longer matches any planned meal ingredient → custom
    await addGroceryItem("meat", "Ground Beef", "1 lb");

    render(GroceryList);

    const label = screen.getByText("Ground Beef").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));

    await screen.findByDisplayValue("Ground Beef");
    expect(screen.queryByText("Tacos")).not.toBeInTheDocument();
  }, 10000);

  it("remove on a custom item calls removeGroceryItem", async () => {
    await addGroceryItem("vegetables", "Carrot", "1");
    render(GroceryList);
    const user = userEvent.setup();

    const li = screen.getByText("Carrot").closest("li")!;
    await user.click(within(li).getByRole("button", { name: "Remove from list" }));

    await vi.waitFor(() => expect(groceryList.itemsForWeek).toEqual([]));
    expect(screen.queryByText("Carrot")).not.toBeInTheDocument();
  });

  it("long-press opens the edit form for a plan-derived item with no DB row yet", async () => {
    const meal = await mealRepo.create({
      name: "Tacos",
      duration: "short",
      supperDays: [],
      url: "",
      ingredients: [{ name: "Beef", quantity: "1 lb", category: "meat" }],
      instructions: ["Cook"],
    });
    meals.all = await mealRepo.getAll();
    weeklyPlan.plans = {
      ...weeklyPlan.plans,
      [weeklyPlan.selectedWeek]: { monday: { supper: meal.id } },
    };

    render(GroceryList);

    const label = screen.getByText("Beef").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(await screen.findByDisplayValue("Beef")).toBeInTheDocument();
  }, 10000);

  it("'To verify' button commits pending edits and marks the item to-verify", async () => {
    await addGroceryItem("vegetables", "Carrot", "1");
    render(GroceryList);

    const label = screen.getByText("Carrot").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const nameInput = await screen.findByDisplayValue("Carrot");
    const user = userEvent.setup();
    await user.clear(nameInput);
    await user.type(nameInput, "Baby Carrot");
    await user.click(screen.getByRole("button", { name: "To verify" }));

    await vi.waitFor(() => {
      const item = groceryList.itemsForWeek.find((i) => i.name === "Baby Carrot");
      expect(item?.toVerify).toBe(true);
    });
    expect(screen.getByText("Baby Carrot")).toHaveClass("text-warn");
  }, 10000);

  it("'Remove To verify' clears the flag when re-opening the form on a to-verify item", async () => {
    await addGroceryItem("vegetables", "Carrot", "1");
    render(GroceryList);

    let label = screen.getByText("Carrot").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await screen.findByDisplayValue("Carrot");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "To verify" }));
    await vi.waitFor(() => {
      expect(groceryList.itemsForWeek.find((i) => i.name === "Carrot")?.toVerify).toBe(true);
    });

    label = screen.getByText("Carrot").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await screen.findByDisplayValue("Carrot");
    await user.click(screen.getByRole("button", { name: "Remove To verify" }));

    await vi.waitFor(() => {
      expect(groceryList.itemsForWeek.find((i) => i.name === "Carrot")?.toVerify).toBe(false);
    });
  }, 10000);

  it("tapping a to-verify item clears the flag without checking it", async () => {
    await addGroceryItem("vegetables", "Carrot", "1");
    render(GroceryList);

    const label = screen.getByText("Carrot").closest("label")!;
    fireEvent.pointerDown(label, { clientX: 0, clientY: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await screen.findByDisplayValue("Carrot");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "To verify" }));
    await vi.waitFor(() => {
      expect(groceryList.itemsForWeek.find((i) => i.name === "Carrot")?.toVerify).toBe(true);
    });

    const checkbox = within(screen.getByText("Carrot", { exact: false }).closest("li")!).getByRole("checkbox");
    await user.click(checkbox);

    await vi.waitFor(() => {
      const item = groceryList.itemsForWeek.find((i) => i.name === "Carrot");
      expect(item?.toVerify).toBe(false);
      expect(item?.checked).toBe(false);
    });
    expect(checkbox).not.toBeChecked();
  }, 10000);

  it("remove on a plan-derived item calls dismissIngredient instead of removeGroceryItem", async () => {
    const meal = await mealRepo.create({
      name: "Tacos",
      duration: "short",
      supperDays: [],
      url: "",
      ingredients: [{ name: "Beef", quantity: "1 lb", category: "meat" }],
      instructions: ["Cook"],
    });
    meals.all = await mealRepo.getAll();
    weeklyPlan.plans = {
      ...weeklyPlan.plans,
      [weeklyPlan.selectedWeek]: { monday: { supper: meal.id } },
    };

    render(GroceryList);
    const user = userEvent.setup();

    const li = screen.getByText("Beef").closest("li")!;
    await user.click(within(li).getByRole("button", { name: "Remove from list" }));

    await vi.waitFor(() => expect(weeklyPlan.dismissedIngredients).toContain("Beef"));
    expect(screen.queryByText("Beef")).not.toBeInTheDocument();

    await vi.waitFor(async () => {
      const row = await db.weeklyPlans.where("weekStart").equals(weeklyPlan.selectedWeek).first();
      expect(row?.dismissedNames).toContain("Beef");
    });
  });
});
