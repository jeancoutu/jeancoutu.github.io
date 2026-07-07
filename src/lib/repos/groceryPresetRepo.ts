import { db, enqueue, type LocalGroceryPreset } from "../db";
import type { GroceryPreset } from "../types";

function toPreset(row: LocalGroceryPreset): GroceryPreset {
  return { id: row.id, name: row.name, items: row.items };
}

export class GroceryPresetRepository {
  async getAll(): Promise<GroceryPreset[]> {
    const rows = await db.groceryPresets.filter((p) => !p.deletedAt).toArray();
    return rows.map(toPreset);
  }

  async create(input: Omit<GroceryPreset, "id">): Promise<GroceryPreset> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: LocalGroceryPreset = { ...input, id, version: 1, updatedAt: now, deletedAt: null };
    await db.groceryPresets.put(row);
    await enqueue("groceryPreset", id, "upsert", null, row);
    return toPreset(row);
  }

  async update(id: string, input: Omit<GroceryPreset, "id">): Promise<GroceryPreset> {
    const existing = await db.groceryPresets.get(id);
    if (!existing) throw new Error(`Grocery preset ${id} not found locally`);
    const updated: LocalGroceryPreset = { ...existing, ...input, updatedAt: new Date().toISOString() };
    await db.groceryPresets.put(updated);
    await enqueue("groceryPreset", id, "upsert", existing.version, updated);
    return toPreset(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await db.groceryPresets.get(id);
    if (!existing) return;
    const deletedAt = new Date().toISOString();
    const row = { ...existing, deletedAt, updatedAt: deletedAt };
    await db.groceryPresets.put(row);
    await enqueue("groceryPreset", id, "delete", existing.version, row);
  }
}

export const groceryPresetRepo = new GroceryPresetRepository();
