import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, userEvent, resetDb, resetStores } from "../componentTestUtils";
import IngredientListEditorHost from "./fixtures/IngredientListEditorHost.svelte";
import type { Ingredient } from "../../lib/types";

function makeIngredient(overrides: Partial<Ingredient> & { name: string }): Ingredient {
  return {
    quantity: "1",
    category: "aisle",
    section: null,
    ...overrides,
  };
}

function latestRows(onRowsChange: ReturnType<typeof vi.fn>): Ingredient[] {
  return onRowsChange.mock.calls.at(-1)![0] as Ingredient[];
}

async function addIngredientViaSearch(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByPlaceholderText("Search for an ingredient…"), name);
  await user.click(screen.getByRole("button", { name: `Create: ${name}` }));
  await user.click(screen.getByRole("button", { name: "Vegetables" }));
}

describe("IngredientListEditor", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("always shows an unsectioned group first, even with zero ingredients", () => {
    render(IngredientListEditorHost, { initialRows: [], onRowsChange: vi.fn() });

    expect(screen.getByRole("group", { name: "Unsectioned" })).toBeInTheDocument();
  });

  it("adds an ingredient to a specific section via that section's add control", async () => {
    const onRowsChange = vi.fn();
    render(IngredientListEditorHost, {
      initialRows: [makeIngredient({ name: "Tomato", section: "Sauce" })],
      onRowsChange,
    });
    const user = userEvent.setup();

    const sauceGroup = screen.getByRole("group", { name: "Sauce" });
    await user.click(within(sauceGroup).getByRole("button", { name: "+ Add ingredient" }));
    await addIngredientViaSearch(user, "Basil");

    await vi.waitFor(() => {
      expect(within(screen.getByRole("group", { name: "Sauce" })).getByText("Basil")).toBeInTheDocument();
    });
    const basil = latestRows(onRowsChange).find((r) => r.name === "Basil");
    expect(basil?.section).toBe("Sauce");
  });

  it("creates a new section via '+ Add section' followed by its first ingredient", async () => {
    const onRowsChange = vi.fn();
    render(IngredientListEditorHost, { initialRows: [], onRowsChange });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Add section" }));
    await user.type(screen.getByPlaceholderText("Section name"), "Toppings{enter}");
    await addIngredientViaSearch(user, "Cheese");

    await vi.waitFor(() => {
      expect(screen.getByRole("group", { name: "Toppings" })).toBeInTheDocument();
    });
    expect(within(screen.getByRole("group", { name: "Toppings" })).getByText("Cheese")).toBeInTheDocument();
    const cheese = latestRows(onRowsChange).find((r) => r.name === "Cheese");
    expect(cheese?.section).toBe("Toppings");
  });

  it("renaming a section updates every ingredient currently in that group", async () => {
    const onRowsChange = vi.fn();
    render(IngredientListEditorHost, {
      initialRows: [
        makeIngredient({ name: "Tomato", section: "Sauce" }),
        makeIngredient({ name: "Onion", section: "sauce" }),
      ],
      onRowsChange,
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sauce" }));
    const input = screen.getByDisplayValue("Sauce");
    await user.clear(input);
    await user.type(input, "Tomato Sauce{enter}");

    await vi.waitFor(() => {
      expect(screen.getByRole("group", { name: "Tomato Sauce" })).toBeInTheDocument();
    });
    const rows = latestRows(onRowsChange);
    expect(rows.find((r) => r.name === "Tomato")?.section).toBe("Tomato Sauce");
    expect(rows.find((r) => r.name === "Onion")?.section).toBe("Tomato Sauce");
  });

  it("deleting a section clears its ingredients' section and they fall back to the unsectioned group, which stays first", async () => {
    const onRowsChange = vi.fn();
    render(IngredientListEditorHost, {
      initialRows: [
        makeIngredient({ name: "Salt" }),
        makeIngredient({ name: "Tomato", section: "Sauce" }),
        makeIngredient({ name: "Onion", section: "Sauce" }),
      ],
      onRowsChange,
    });
    const user = userEvent.setup();

    const sauceGroup = screen.getByRole("group", { name: "Sauce" });
    await user.click(within(sauceGroup).getByLabelText("Remove section"));

    await vi.waitFor(() => {
      expect(screen.queryByRole("group", { name: "Sauce" })).not.toBeInTheDocument();
    });
    const fieldset = screen.getByRole("group", { name: "Ingredients" });
    const groups = within(fieldset).getAllByRole("group");
    expect(groups[0]).toHaveAccessibleName("Unsectioned");
    const unsectioned = within(groups[0]!);
    expect(unsectioned.getByText("Salt")).toBeInTheDocument();
    expect(unsectioned.getByText("Tomato")).toBeInTheDocument();
    expect(unsectioned.getByText("Onion")).toBeInTheDocument();

    const rows = latestRows(onRowsChange);
    expect(rows.find((r) => r.name === "Tomato")?.section).toBeNull();
    expect(rows.find((r) => r.name === "Onion")?.section).toBeNull();
  });

  describe("moving an ingredient via the move-to-section menu", () => {
    it("moves to an existing section", async () => {
      const onRowsChange = vi.fn();
      render(IngredientListEditorHost, {
        initialRows: [makeIngredient({ name: "Salt" }), makeIngredient({ name: "Tomato", section: "Sauce" })],
        onRowsChange,
      });
      const user = userEvent.setup();

      const unsectionedGroup = screen.getByRole("group", { name: "Unsectioned" });
      await user.click(within(unsectionedGroup).getByRole("button", { name: "Move to section" }));
      await user.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Sauce" }));

      await vi.waitFor(() => {
        expect(within(screen.getByRole("group", { name: "Sauce" })).getByText("Salt")).toBeInTheDocument();
      });
      expect(latestRows(onRowsChange).find((r) => r.name === "Salt")?.section).toBe("Sauce");
    });

    it("moves to Unsectioned", async () => {
      const onRowsChange = vi.fn();
      render(IngredientListEditorHost, {
        initialRows: [makeIngredient({ name: "Tomato", section: "Sauce" })],
        onRowsChange,
      });
      const user = userEvent.setup();

      const sauceGroup = screen.getByRole("group", { name: "Sauce" });
      await user.click(within(sauceGroup).getByRole("button", { name: "Move to section" }));
      await user.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Unsectioned" }));

      await vi.waitFor(() => {
        expect(screen.queryByRole("group", { name: "Sauce" })).not.toBeInTheDocument();
      });
      expect(latestRows(onRowsChange).find((r) => r.name === "Tomato")?.section).toBeNull();
    });

    it("moves to a brand-new section", async () => {
      const onRowsChange = vi.fn();
      render(IngredientListEditorHost, {
        initialRows: [makeIngredient({ name: "Salt" })],
        onRowsChange,
      });
      const user = userEvent.setup();

      const unsectionedGroup = screen.getByRole("group", { name: "Unsectioned" });
      await user.click(within(unsectionedGroup).getByRole("button", { name: "Move to section" }));
      await user.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "New section…" }));
      await user.type(screen.getByPlaceholderText("Section name"), "Seasoning{enter}");

      await vi.waitFor(() => {
        expect(screen.getByRole("group", { name: "Seasoning" })).toBeInTheDocument();
      });
      expect(within(screen.getByRole("group", { name: "Seasoning" })).getByText("Salt")).toBeInTheDocument();
      expect(latestRows(onRowsChange).find((r) => r.name === "Salt")?.section).toBe("Seasoning");
    });
  });
});
