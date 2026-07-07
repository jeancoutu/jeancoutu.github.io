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
  };
}

export class MealRepository {
  async getAll(): Promise<Meal[]> {
    const rows = await db.meals.filter((m) => !m.deletedAt).toArray();
    return rows.map(toMeal);
  }

  async create(input: Omit<Meal, "id">): Promise<Meal> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: LocalMeal = { ...input, id, version: 1, updatedAt: now, deletedAt: null };
    await db.meals.put(row);
    await enqueue("meal", id, "upsert", null, row);
    return toMeal(row);
  }

  async update(id: string, input: Partial<Omit<Meal, "id">>): Promise<Meal> {
    const existing = await db.meals.get(id);
    if (!existing) throw new Error(`Meal ${id} not found locally`);
    const updated: LocalMeal = { ...existing, ...input, updatedAt: new Date().toISOString() };
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
