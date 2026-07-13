import { db, enqueue, type LocalGroceryItem } from "../db";
import type { IngredientCategory } from "../types";
import { adjustQuantityString, type GroceryAdjustment } from "../utils/groceryList";

export type GroceryDBItem = LocalGroceryItem;

export class GroceryItemRepository {
  async getForPlan(weeklyPlanId: string): Promise<LocalGroceryItem[]> {
    return db.groceryItems
      .where("weeklyPlanId")
      .equals(weeklyPlanId)
      .and((i) => !i.deletedAt)
      .toArray();
  }

  // Leaf root (Decision 3/4): each grocery item syncs independently via the
  // merge-by-(weeklyPlanId, name, category) RPC, so two devices editing
  // different items never conflict.
  async upsert(
    weeklyPlanId: string,
    input: {
      id?: string | undefined;
      name: string;
      quantity: string;
      category: IngredientCategory;
      checked: boolean;
      toVerify?: boolean;
    },
  ): Promise<LocalGroceryItem> {
    const id = input.id ?? crypto.randomUUID();
    const existing = input.id ? await db.groceryItems.get(input.id) : undefined;
    const now = new Date().toISOString();
    const row: LocalGroceryItem = {
      id,
      weeklyPlanId,
      name: input.name,
      quantity: input.quantity,
      category: input.category,
      checked: input.checked,
      toVerify: input.toVerify ?? existing?.toVerify ?? false,
      version: existing?.version ?? 1,
      updatedAt: now,
      deletedAt: null,
    };
    await db.groceryItems.put(row);
    await enqueue("groceryItem", id, "upsert", existing?.version ?? null, row);
    return row;
  }

  async delete(id: string): Promise<void> {
    const existing = await db.groceryItems.get(id);
    if (!existing) return;
    const deletedAt = new Date().toISOString();
    const row = { ...existing, deletedAt, updatedAt: deletedAt };
    await db.groceryItems.put(row);
    await enqueue("groceryItem", id, "delete", existing.version, row);
  }

  // Hard delete: unlike delete(), this drops the row from Dexie entirely
  // instead of leaving a tombstone, since a cleared/replaced plan has no
  // use for per-item history. The delete op still carries the pre-delete
  // row as its payload so the server-side merge RPC has what it needs.
  async deleteAll(weeklyPlanId: string): Promise<void> {
    const existing = await this.getForPlan(weeklyPlanId);
    const deletedAt = new Date().toISOString();
    await Promise.all(
      existing.map(async (item) => {
        const row = { ...item, deletedAt, updatedAt: deletedAt };
        await enqueue("groceryItem", item.id, "delete", item.version, row);
        await db.groceryItems.delete(item.id);
      }),
    );
  }

  async replaceAll(
    weeklyPlanId: string,
    items: { name: string; quantity: string; category: IngredientCategory; checked: boolean; toVerify?: boolean }[],
  ): Promise<LocalGroceryItem[]> {
    await this.deleteAll(weeklyPlanId);
    return Promise.all(items.map((item) => this.upsert(weeklyPlanId, item)));
  }

  // Client-side port of the merge logic that used to run as a single
  // Supabase round trip: diff quantities per name and turn each into an
  // insert/update/delete against Dexie (each queued individually through
  // the merge-by-name RPC, per Decision 4).
  async applyAdjustments(
    weeklyPlanId: string,
    adjustments: GroceryAdjustment[],
    dismissedNames: string[] = [],
  ): Promise<LocalGroceryItem[]> {
    const existing = await this.getForPlan(weeklyPlanId);
    if (adjustments.length === 0) return existing;

    const byName = new Map(existing.map((item) => [item.name, item]));
    const dismissed = new Set(dismissedNames);

    for (const adj of adjustments) {
      if (dismissed.has(adj.name)) continue;
      const row = byName.get(adj.name);
      const newQty = adjustQuantityString(row?.quantity ?? null, adj.addQuantities, adj.removeQuantities);

      if (row) {
        if (newQty === null) {
          await this.delete(row.id);
          byName.delete(adj.name);
        } else {
          const updated = await this.upsert(weeklyPlanId, {
            id: row.id,
            name: row.name,
            quantity: newQty,
            category: row.category,
            checked: row.checked,
          });
          byName.set(adj.name, updated);
        }
      } else if (newQty !== null) {
        const created = await this.upsert(weeklyPlanId, {
          name: adj.name,
          quantity: newQty,
          category: adj.category,
          checked: false,
        });
        byName.set(adj.name, created);
      }
    }

    return [...byName.values()];
  }
}

export const groceryItemRepo = new GroceryItemRepository();
