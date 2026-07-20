import { describe, it, expect } from "vitest";
import { groupIngredientsBySection } from "../../lib/utils/ingredientSections";
import type { Ingredient } from "../../lib/types";

function makeIngredient(overrides: Partial<Ingredient> & { name: string }): Ingredient {
  return {
    quantity: "1",
    category: "aisle",
    ...overrides,
  };
}

describe("groupIngredientsBySection", () => {
  it("puts all ingredients in one unlabeled block when none have a section", () => {
    const ingredients = [makeIngredient({ name: "Tomato" }), makeIngredient({ name: "Onion" })];

    const blocks = groupIngredientsBySection(ingredients);

    expect(blocks).toEqual([{ section: null, ingredients }]);
  });

  it("orders blocks by first appearance", () => {
    const tacoTomato = makeIngredient({ name: "Tomato", section: "Tacos" });
    const sauceTomato = makeIngredient({ name: "Tomato", section: "Sauce" });
    const sauceOnion = makeIngredient({ name: "Onion", section: "Sauce" });

    const blocks = groupIngredientsBySection([tacoTomato, sauceTomato, sauceOnion]);

    expect(blocks.map((b) => b.section)).toEqual(["Tacos", "Sauce"]);
    expect(blocks[1]!.ingredients).toEqual([sauceTomato, sauceOnion]);
  });

  it("groups sections case-insensitively, keeping the first-seen casing", () => {
    const sauce = makeIngredient({ name: "Tomato", section: "Sauce" });
    const sauceLower = makeIngredient({ name: "Onion", section: "sauce" });

    const blocks = groupIngredientsBySection([sauce, sauceLower]);

    expect(blocks).toEqual([{ section: "Sauce", ingredients: [sauce, sauceLower] }]);
  });

  it("trims whitespace-only sections and treats them as unlabeled", () => {
    const blank = makeIngredient({ name: "Salt", section: "   " });

    const blocks = groupIngredientsBySection([blank]);

    expect(blocks).toEqual([{ section: null, ingredients: [blank] }]);
  });

  it("puts the unlabeled block last, after all named sections", () => {
    const noSection = makeIngredient({ name: "Salt" });
    const sectioned = makeIngredient({ name: "Tomato", section: "Sauce" });

    const blocks = groupIngredientsBySection([noSection, sectioned]);

    expect(blocks.map((b) => b.section)).toEqual(["Sauce", null]);
  });

  it("puts the unlabeled block first when unsectionedFirst is set", () => {
    const noSection = makeIngredient({ name: "Salt" });
    const sectioned = makeIngredient({ name: "Tomato", section: "Sauce" });

    const blocks = groupIngredientsBySection([noSection, sectioned], { unsectionedFirst: true });

    expect(blocks.map((b) => b.section)).toEqual([null, "Sauce"]);
  });

  it("omits the unlabeled block entirely when there are no unsectioned ingredients, regardless of unsectionedFirst", () => {
    const sectioned = makeIngredient({ name: "Tomato", section: "Sauce" });

    const blocks = groupIngredientsBySection([sectioned], { unsectionedFirst: true });

    expect(blocks.map((b) => b.section)).toEqual(["Sauce"]);
  });
});
