import { db, enqueue, type LocalMeal } from "../db";
import type { Meal } from "../types";

function toMeal(row: LocalMeal): Meal {
  return {
    id: row.id,
    name: row.name,
    duration: row.duration,
    url: row.url,
    supperDays: row.supperDays,
    instructions: row.instructions,
    ingredients: row.ingredients,
    tags: row.tags ?? [],
    needsPrepAhead: row.needsPrepAhead ?? false,
  };
}

/** Trim + lowercase, drop empties, dedupe preserving first occurrence. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

/** `tags` is optional on input — omitted means "no tags"; normalized on save. */
export type MealInput = Omit<Meal, "id" | "tags"> & { tags?: string[] };

export class MealRepository {
  async getAll(): Promise<Meal[]> {
    const rows = await db.meals.filter((m) => !m.deletedAt).toArray();
    return rows.map(toMeal);
  }

  async create(input: MealInput): Promise<Meal> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: LocalMeal = {
      ...input,
      tags: normalizeTags(input.tags ?? []),
      id,
      version: 1,
      updatedAt: now,
      deletedAt: null,
    };
    await db.meals.put(row);
    await enqueue("meal", id, "upsert", null, row);
    return toMeal(row);
  }

  async update(id: string, input: Partial<MealInput>): Promise<Meal> {
    const existing = await db.meals.get(id);
    if (!existing) throw new Error(`Meal ${id} not found locally`);
    const updated: LocalMeal = { ...existing, ...input, updatedAt: new Date().toISOString() };
    updated.tags = normalizeTags(updated.tags ?? []);
    await db.meals.put(updated);
    await enqueue("meal", id, "upsert", existing.version, updated);
    return toMeal(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await db.meals.get(id);
    if (!existing) return;
    const deletedAt = new Date().toISOString();
    const row = { ...existing, deletedAt, updatedAt: deletedAt };
    await db.meals.put(row);
    await enqueue("meal", id, "delete", existing.version, row);
  }
}

export const mealRepo = new MealRepository();
