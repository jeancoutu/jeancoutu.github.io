import { db, enqueue, type LocalMealIdea } from "../db";
import type { MealIdea } from "../types";

function toIdea(row: LocalMealIdea): MealIdea {
  return { id: row.id, text: row.text, createdAt: row.createdAt };
}

export class MealIdeaRepository {
  async getAll(): Promise<MealIdea[]> {
    const rows = await db.mealIdeas.filter((i) => !i.deletedAt).toArray();
    // createdAt is ISO, so lexical compare == chronological; newest first.
    return rows.map(toIdea).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(text: string): Promise<MealIdea> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: LocalMealIdea = { id, text, createdAt: now, version: 1, updatedAt: now, deletedAt: null };
    await db.mealIdeas.put(row);
    await enqueue("mealIdea", id, "upsert", null, row);
    return toIdea(row);
  }

  async update(id: string, text: string): Promise<MealIdea> {
    const existing = await db.mealIdeas.get(id);
    if (!existing) throw new Error(`Meal idea ${id} not found locally`);
    const updated: LocalMealIdea = { ...existing, text, updatedAt: new Date().toISOString() };
    await db.mealIdeas.put(updated);
    await enqueue("mealIdea", id, "upsert", existing.version, updated);
    return toIdea(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await db.mealIdeas.get(id);
    if (!existing) return;
    const now = new Date().toISOString();
    const row = { ...existing, deletedAt: now, updatedAt: now };
    await db.mealIdeas.put(row);
    await enqueue("mealIdea", id, "delete", existing.version, row);
  }
}

export const mealIdeaRepo = new MealIdeaRepository();
