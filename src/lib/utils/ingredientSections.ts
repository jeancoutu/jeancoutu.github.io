import type { Ingredient } from "../types";

export interface IngredientSectionBlock {
  section: string | null;
  ingredients: Ingredient[];
}

export interface GroupIngredientsOptions {
  /** Places the unlabeled block first instead of last (used by the editor). */
  unsectionedFirst?: boolean;
}

// Groups by first-appearance order, case-insensitive; ingredients with no
// section land in one unlabeled block, trailing by default.
export function groupIngredientsBySection(
  ingredients: Ingredient[],
  options: GroupIngredientsOptions = {},
): IngredientSectionBlock[] {
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
  if (unlabeled.length === 0) {
    return result;
  }
  const unlabeledBlock: IngredientSectionBlock = { section: null, ingredients: unlabeled };
  return options.unsectionedFirst ? [unlabeledBlock, ...result] : [...result, unlabeledBlock];
}
