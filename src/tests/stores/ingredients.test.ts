import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import type { IngredientDefinition } from "../../lib/types";

vi.mock("../../lib/api/ingredients", () => ({
  getIngredientDefinitions: vi.fn().mockResolvedValue([]),
  upsertIngredientDefinition: vi.fn().mockResolvedValue(undefined),
  deleteIngredientDefinition: vi.fn().mockResolvedValue(undefined),
}));

const makeDef = (name: string, category: IngredientDefinition["category"] = "aisle"): IngredientDefinition => ({
  name,
  category,
});

describe("ingredients store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function importIngredients() {
    return import("../../lib/stores/ingredients");
  }

  it("starts with empty ingredient definitions", async () => {
    const { ingredientDefinitions } = await importIngredients();
    expect(get(ingredientDefinitions)).toEqual([]);
  });

  it("upsertIngredientDefinition adds a new definition", async () => {
    const { ingredientDefinitions, upsertIngredientDefinition } = await importIngredients();
    await upsertIngredientDefinition(makeDef("Olive Oil", "aisle"));
    expect(get(ingredientDefinitions).some((d) => d.name === "Olive Oil")).toBe(true);
  });

  it("upsertIngredientDefinition replaces existing definition with same name (case-insensitive)", async () => {
    const { ingredientDefinitions, upsertIngredientDefinition } = await importIngredients();
    await upsertIngredientDefinition(makeDef("Butter", "fridge"));
    await upsertIngredientDefinition({ name: "butter", category: "aisle" });
    const defs = get(ingredientDefinitions);
    const matches = defs.filter((d) => d.name.toLowerCase() === "butter");
    expect(matches).toHaveLength(1);
    expect(matches[0].category).toBe("aisle");
  });

  it("removeIngredientDefinition removes by name (case-insensitive)", async () => {
    const { ingredientDefinitions, upsertIngredientDefinition, removeIngredientDefinition } = await importIngredients();
    await upsertIngredientDefinition(makeDef("Sugar", "aisle"));
    await removeIngredientDefinition("SUGAR");
    expect(get(ingredientDefinitions).some((d) => d.name.toLowerCase() === "sugar")).toBe(false);
  });

  it("resolveIngredientCategory returns category for known ingredient", async () => {
    const { upsertIngredientDefinition, resolveIngredientCategory } = await importIngredients();
    await upsertIngredientDefinition(makeDef("Garlic", "vegetables"));
    expect(resolveIngredientCategory("garlic")).toBe("vegetables");
  });

  it("resolveIngredientCategory returns undefined for unknown ingredient", async () => {
    const { resolveIngredientCategory } = await importIngredients();
    expect(resolveIngredientCategory("xyzzy-unknown")).toBeUndefined();
  });

  it("upsertIngredientDefinition calls the API", async () => {
    const { upsertIngredientDefinition } = await importIngredients();
    const { upsertIngredientDefinition: apiUpsert } = await import("../../lib/api/ingredients");
    await upsertIngredientDefinition(makeDef("Salt", "aisle"));
    expect(apiUpsert).toHaveBeenCalledWith(makeDef("Salt", "aisle"));
  });

  it("removeIngredientDefinition calls the API", async () => {
    const { upsertIngredientDefinition, removeIngredientDefinition } = await importIngredients();
    const { deleteIngredientDefinition: apiDelete } = await import("../../lib/api/ingredients");
    await upsertIngredientDefinition(makeDef("Pepper", "aisle"));
    await removeIngredientDefinition("Pepper");
    expect(apiDelete).toHaveBeenCalledWith("Pepper");
  });
});
