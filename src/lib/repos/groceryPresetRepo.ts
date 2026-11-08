import { db, enqueue, type LocalGroceryPreset } from "../db";
import type { GroceryPreset } from "../types";

function toPreset(row: LocalGroceryPreset): GroceryPreset {
  return { id: row.id, name: row.name, items: row.items };
}

export class GroceryPresetRepository {
  // The Costco recurring list is not a regular preset: it never appears as a
  // chip or in the presets list, so it is excluded here.
  async getAll(): Promise<GroceryPreset[]> {
    const rows = await db.groceryPresets.filter((p) => !p.deletedAt && !p.isCostco).toArray();
    return rows.map(toPreset);
  }

  // Read-only lookup (never creates), for UI that just wants to know if the
  // household has a Costco list yet.
  async findCostcoList(): Promise<GroceryPreset | undefined> {
    const row = await db.groceryPresets.filter((p) => !p.deletedAt && !!p.isCostco).first();
    return row ? toPreset(row) : undefined;
  }

  // At most one live Costco list per household (server-enforced), created
  // lazily. The read-then-create must be atomic so concurrent callers don't
  // each create a row.
  async getCostcoList(): Promise<GroceryPreset> {
    return db.transaction("rw", db.groceryPresets, db.syncQueue, async () => {
      const existing = await db.groceryPresets.filter((p) => !p.deletedAt && !!p.isCostco).first();
      if (existing) return toPreset(existing);

      const id = crypto.randomUUID();
      const row: LocalGroceryPreset = {
        id,
        name: "Costco",
        items: [],
        isCostco: true,
        version: 1,
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      await db.groceryPresets.put(row);
      await enqueue("groceryPreset", id, "upsert", null, row);
      return toPreset(row);
    });
  }

  async create(input: Omit<GroceryPreset, "id">): Promise<GroceryPreset> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: LocalGroceryPreset = { ...input, id, isCostco: false, version: 1, updatedAt: now, deletedAt: null };
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
