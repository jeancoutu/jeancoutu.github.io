import type { Ingredient } from "../types";

export interface IngredientSectionBlock {
  section: string | null;
  ingredients: Ingredient[];
}

// Groups by first-appearance order, case-insensitive; ingredients with no
// section land in one trailing unlabeled block.
export function groupIngredientsBySection(ingredients: Ingredient[]): IngredientSectionBlock[] {
  const blocks = new Map<string, IngredientSectionBlock>();
  const unlabeled: Ingredient[] = [];

  for (const ingredient of ingredients) {
    const trimmed = ingredient.section?.trim();
    if (!trimmed) {
      unlabeled.push(ingredient);
      continue;
    }
    const key = trimmed.toLowerCase();
    const existing = blocks.get(key);
    if (existing) {
      existing.ingredients.push(ingredient);
    } else {
      blocks.set(key, { section: trimmed, ingredients: [ingredient] });
    }
  }

  const result = [...blocks.values()];
  if (unlabeled.length > 0) {
    result.push({ section: null, ingredients: unlabeled });
  }
  return result;
}
