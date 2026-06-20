import { get, writable } from "svelte/store";
import type { IngredientDefinition } from "../types";
import {
  deleteIngredientDefinition as apiDelete,
  getIngredientDefinitions,
  upsertIngredientDefinition as apiUpsert,
} from "../api/ingredients";
import { session } from "./auth";

export const ingredientDefinitions = writable<IngredientDefinition[]>([]);

session.subscribe(async ($session) => {
  if ($session) {
    ingredientDefinitions.set(await getIngredientDefinitions());
  } else {
    ingredientDefinitions.set([]);
  }
});

export async function upsertIngredientDefinition(def: IngredientDefinition): Promise<void> {
  await apiUpsert(def);
  ingredientDefinitions.update((defs) => {
    const filtered = defs.filter(
      (d) => d.name.toLowerCase() !== def.name.toLowerCase(),
    );
    return [...filtered, def];
  });
}

export async function removeIngredientDefinition(name: string): Promise<void> {
  await apiDelete(name);
  ingredientDefinitions.update((defs) =>
    defs.filter((d) => d.name.toLowerCase() !== name.toLowerCase()),
  );
}

export function resolveIngredientCategory(name: string) {
  return get(ingredientDefinitions).find(
    (d) => d.name.toLowerCase() === name.toLowerCase(),
  )?.category;
}
