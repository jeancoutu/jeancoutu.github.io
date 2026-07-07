import Dexie, { type Table } from "dexie";
import type {
  DayKey,
  DurationTag,
  Ingredient,
  IngredientCategory,
  WeeklyPlan,
} from "../types";
import { onUserChange } from "../stores/auth.svelte";

// ============================================================
// Row shapes: aggregate roots as stored locally, sync metadata
// (version/updatedAt/deletedAt) mirrors the server columns from
// the 0a migration. Child rows (ingredients, day plans, preset
// items, preset toggles) are embedded — they have no sync
// metadata of their own and are replaced wholesale by their
// aggregate's RPC / pull_changes entry.
// ============================================================

export interface SyncMeta {
  version: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalMeal extends SyncMeta {
  id: string;
  name: string;
  duration: DurationTag;
  url: string;
  supperDays: DayKey[];
  instructions: string[];
  ingredients: Ingredient[];
}

export interface LocalGroceryPreset extends SyncMeta {
  id: string;
  name: string;
  items: Ingredient[];
}

export interface LocalWeeklyPlan extends SyncMeta {
  id: string;
  weekStart: string;
  plan: WeeklyPlan;
  dismissedNames: string[];
  presetIds: string[];
}

export interface LocalGroceryItem extends SyncMeta {
  id: string;
  weeklyPlanId: string;
  name: string;
  quantity: string;
  category: IngredientCategory;
  checked: boolean;
}

export type SyncEntity = "meal" | "groceryPreset" | "weeklyPlan" | "groceryItem";
export type SyncOp = "upsert" | "delete";

export interface SyncQueueItem {
  seq?: number;
  opId: string;
  entity: SyncEntity;
  entityId: string;
  op: SyncOp;
  baseVersion: number | null;
  payload: unknown;
  createdAt: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class MealPlannerDB extends Dexie {
  meals!: Table<LocalMeal, string>;
  groceryPresets!: Table<LocalGroceryPreset, string>;
  weeklyPlans!: Table<LocalWeeklyPlan, string>;
  groceryItems!: Table<LocalGroceryItem, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("mealplanner");
    this.version(1).stores({
      meals: "id, deletedAt",
      groceryPresets: "id, deletedAt",
      weeklyPlans: "id, weekStart, deletedAt",
      groceryItems: "id, weeklyPlanId, deletedAt",
      syncQueue: "++seq, opId, [entity+entityId]",
      meta: "key",
    });
  }
}

export const db = new MealPlannerDB();

const ALL_TABLES = [
  db.meals,
  db.groceryPresets,
  db.weeklyPlans,
  db.groceryItems,
  db.syncQueue,
  db.meta,
] as const;

export async function persistStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // best-effort only; eviction risk is acceptable if unsupported/denied
  }
}

export async function wipeLocalDb(): Promise<void> {
  await db.transaction("rw", ALL_TABLES, async () => {
    await Promise.all(ALL_TABLES.map((table) => table.clear()));
  });
}

const CURSOR_KEY = "lastSyncAt";

export async function getCursor(): Promise<string | null> {
  const row = await db.meta.get(CURSOR_KEY);
  return (row?.value as string | undefined) ?? null;
}

export async function setCursor(value: string): Promise<void> {
  await db.meta.put({ key: CURSOR_KEY, value });
}

export async function enqueue(
  entity: SyncEntity,
  entityId: string,
  op: SyncOp,
  baseVersion: number | null,
  payload: unknown,
): Promise<void> {
  await db.syncQueue.add({
    opId: crypto.randomUUID(),
    entity,
    entityId,
    op,
    baseVersion,
    payload,
    createdAt: new Date().toISOString(),
  });
}

// Logout / account switch wipes everything: cached data for a
// different household must never leak, and a fresh full pull
// (cursor = null) is cheap for our data volume.
let currentUserId: string | null = null;

onUserChange(async (session) => {
  const nextUserId = session?.user?.id ?? null;
  if (currentUserId !== null && nextUserId !== currentUserId) {
    const pending = await db.syncQueue.count();
    if (pending > 0) {
      console.warn(
        `[sync] discarding ${pending} unsynced change(s) on account switch/logout`,
      );
    }
    await wipeLocalDb();
  }
  currentUserId = nextUserId;
  if (nextUserId) await persistStorage();
});
