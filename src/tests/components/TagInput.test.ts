import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, userEvent, resetDb, resetStores } from "../componentTestUtils";
import TagInput from "../../lib/components/TagInput.svelte";
import { meals } from "../../lib/stores/meals.svelte";
import type { Meal } from "../../lib/types";

function makeMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: crypto.randomUUID(),
    name: "Tacos",
    duration: "short",
    supperDays: [],
    url: "",
    ingredients: [],
    instructions: [],
    tags: [],
    ...overrides,
  };
}

describe("TagInput", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("suggests existing tags from other meals, excluding already-added ones", async () => {
    meals.all = [makeMeal({ tags: ["pasta", "quick"] }), makeMeal({ tags: ["pasta-bake"] })];
    render(TagInput, { tags: ["quick"], onAdd: vi.fn(), onRemove: vi.fn() });
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Add a tag…"), "pasta");

    expect(screen.getByRole("button", { name: "pasta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pasta-bake" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "quick" })).not.toBeInTheDocument();
  });

  it("offers to create a new tag when the query doesn't match an existing one", async () => {
    meals.all = [];
    render(TagInput, { tags: [], onAdd: vi.fn(), onRemove: vi.fn() });
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Add a tag…"), "spicy");

    expect(screen.getByRole("button", { name: "Create: spicy" })).toBeInTheDocument();
  });

  it("calls onAdd with the trimmed/lowercased tag on Enter and clears the input", async () => {
    meals.all = [];
    const onAdd = vi.fn();
    render(TagInput, { tags: [], onAdd, onRemove: vi.fn() });
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText("Add a tag…") as HTMLInputElement;
    await user.type(input, "  Spicy  {enter}");

    expect(onAdd).toHaveBeenCalledWith("Spicy");
    expect(input.value).toBe("");
  });

  it("selecting a suggestion calls onAdd and clears the input", async () => {
    meals.all = [makeMeal({ tags: ["pasta"] })];
    const onAdd = vi.fn();
    render(TagInput, { tags: [], onAdd, onRemove: vi.fn() });
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText("Add a tag…") as HTMLInputElement;
    await user.type(input, "pasta");
    await user.click(screen.getByRole("button", { name: "pasta" }));

    expect(onAdd).toHaveBeenCalledWith("pasta");
    expect(input.value).toBe("");
  });

  it("renders added tags as chips and removing one calls onRemove", async () => {
    const onRemove = vi.fn();
    render(TagInput, { tags: ["pasta", "quick"], onAdd: vi.fn(), onRemove });
    const user = userEvent.setup();

    expect(screen.getByText("pasta")).toBeInTheDocument();
    expect(screen.getByText("quick")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove tag pasta" }));

    expect(onRemove).toHaveBeenCalledWith("pasta");
  });
});
