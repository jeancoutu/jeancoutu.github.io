import {
  db,
  enqueue,
  getCursor,
  setCursor,
  type LocalGroceryItem,
  type LocalGroceryPreset,
  type LocalMeal,
  type LocalWeeklyPlan,
  type SyncEntity,
  type SyncOp,
  type SyncQueueItem,
} from "../db";
import {
  pullChanges,
  pushGroceryItems,
  pushOp,
  refetchGroceryItem,
  refetchGroceryPreset,
  refetchMeal,
  refetchWeeklyPlan,
  rowsToDayPlans,
  type PulledGroceryItem,
  type PulledGroceryPreset,
  type PulledMeal,
  type PulledWeeklyPlan,
} from "./rpc";
import { emitConflict, emitSynced, syncStatus } from "./status.svelte";

const LOCK_NAME = "mealplanner-sync";
const MIN_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const DEBOUNCE_MS = 800;

let backoffMs = MIN_BACKOFF_MS;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================================
// Queue coalescing (per entity+entityId, in FIFO seq order):
//  - insert(baseVersion=null) followed eventually by a delete → the
//    server never saw it, so drop the whole group, no network call.
//  - anything followed by a delete → collapse to one delete.
//  - otherwise → collapse to one upsert with the latest payload.
// ============================================================

export interface CoalescedOp {
  entity: SyncEntity;
  entityId: string;
  op: SyncOp;
  baseVersion: number | null;
  payload: unknown;
  seqs: number[];
}

export function coalesce(items: SyncQueueItem[]): CoalescedOp[] {
  const order: string[] = [];
  const groups = new Map<string, SyncQueueItem[]>();
  for (const item of items) {
    const key = `${item.entity}:${item.entityId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  const result: CoalescedOp[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const seqs = group.map((g) => g.seq!);
    const neverSynced = first.op === "upsert" && first.baseVersion === null;

    if (last.op === "delete" && neverSynced) continue;

    result.push({
      entity: first.entity,
      entityId: first.entityId,
      op: last.op,
      baseVersion: first.baseVersion,
      payload: last.payload,
      seqs,
    });
  }
  return result;
}

// ============================================================
// Applying server rows to Dexie (from pull_changes or a
// post-conflict single-entity refetch). Tombstoned rows are kept
// (repos/UI filter on deletedAt) so future pulls stay consistent.
// ============================================================

function applyMeal(row: PulledMeal): Promise<unknown> {
  const local: LocalMeal = {
    id: row.id,
    name: row.name,
    duration: row.duration as LocalMeal["duration"],
    url: row.url ?? "",
    supperDays: (row.supper_days ?? []) as LocalMeal["supperDays"],
    instructions: row.instructions ?? [],
    ingredients: (row.ingredients ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      category: i.category as LocalMeal["ingredients"][number]["category"],
    })),
    version: row.version,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
  return db.meals.put(local);
}

function applyGroceryPreset(row: PulledGroceryPreset): Promise<unknown> {
  const local: LocalGroceryPreset = {
    id: row.id,
    name: row.name,
    items: (row.items ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      category: i.category as LocalGroceryPreset["items"][number]["category"],
    })),
    version: row.version,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
  return db.groceryPresets.put(local);
}

function applyWeeklyPlan(row: PulledWeeklyPlan): Promise<unknown> {
  const local: LocalWeeklyPlan = {
    id: row.id,
    weekStart: row.week_start,
    plan: rowsToDayPlans(row.day_plans ?? []),
    dismissedNames: row.dismissed_ingredient_names ?? [],
    presetIds: row.preset_ids ?? [],
    version: row.version,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
  return db.weeklyPlans.put(local);
}

function applyGroceryItem(row: PulledGroceryItem): Promise<unknown> {
  const local: LocalGroceryItem = {
    id: row.id,
    weeklyPlanId: row.weekly_plan_id,
    name: row.name,
    quantity: row.quantity,
    category: row.category as LocalGroceryItem["category"],
    checked: row.checked,
    toVerify: row.to_verify,
    version: row.version,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
  return db.groceryItems.put(local);
}

async function refreshEntityAfterConflict(entity: SyncEntity, id: string, canonicalId?: string): Promise<void> {
  const targetId = canonicalId ?? id;
  switch (entity) {
    case "meal": {
      const row = await refetchMeal(targetId);
      if (row) await applyMeal(row);
      break;
    }
    case "groceryPreset": {
      const row = await refetchGroceryPreset(targetId);
      if (row) await applyGroceryPreset(row);
      break;
    }
    case "weeklyPlan": {
      const row = await refetchWeeklyPlan(targetId);
      if (row) await applyWeeklyPlan(row);
      // Remap: if the id we pushed under wasn't canonical, drop our stale
      // local row and repoint everything that still references it — local
      // grocery items and any queued ops (a queued grocery-item op pushed
      // under the dead plan id would raise "Weekly plan not found" and
      // wedge the queue).
      if (targetId !== id) {
        await db.weeklyPlans.delete(id);
        await db.groceryItems.where("weeklyPlanId").equals(id).modify({ weeklyPlanId: targetId });
        await db.syncQueue.toCollection().modify((item) => {
          if (item.entity === "groceryItem" && (item.payload as LocalGroceryItem | null)?.weeklyPlanId === id) {
            (item.payload as LocalGroceryItem).weeklyPlanId = targetId;
          } else if (item.entity === "weeklyPlan" && item.entityId === id) {
            item.entityId = targetId;
            if (item.payload) (item.payload as LocalWeeklyPlan).id = targetId;
            if (item.baseVersion === null && row) item.baseVersion = row.version;
          }
        });
      }
      break;
    }
    case "groceryItem": {
      const row = await refetchGroceryItem(targetId);
      if (row) await applyGroceryItem(row);
      if (targetId !== id) await db.groceryItems.delete(id);
      break;
    }
  }
}

// An op enqueued while a previous push for the same entity was in flight
// carries the pre-push local version as its baseVersion (bumpLocalVersion
// only lands when that push's response arrives). Pushing that stale base
// would conflict and drop the edit even though it cleanly chains onto our
// own acknowledged write. Re-reading the local version at push time is
// safe: pullAndApply skips entities with pending ops, so while an op is
// queued the local version only ever advances via our own push bumps.
async function refreshBaseVersion(op: CoalescedOp): Promise<number | null> {
  if (op.baseVersion === null) return null;
  switch (op.entity) {
    case "meal":
      return (await db.meals.get(op.entityId))?.version ?? op.baseVersion;
    case "groceryPreset":
      return (await db.groceryPresets.get(op.entityId))?.version ?? op.baseVersion;
    case "weeklyPlan":
      return (await db.weeklyPlans.get(op.entityId))?.version ?? op.baseVersion;
    case "groceryItem":
      return (await db.groceryItems.get(op.entityId))?.version ?? op.baseVersion;
  }
}

// After a week-collision conflict the canonical server row is already in
// Dexie (refreshEntityAfterConflict); overlay the rejected payload's edits
// on top of it and queue a normal version-checked update so the user's
// selection isn't silently dropped.
async function reapplyWeeklyPlanEdit(canonicalId: string, payload: LocalWeeklyPlan): Promise<void> {
  const canonical = await db.weeklyPlans.get(canonicalId);
  if (!canonical || canonical.deletedAt) return;
  const merged: LocalWeeklyPlan = {
    ...canonical,
    plan: { ...canonical.plan, ...payload.plan },
    dismissedNames: [...new Set([...canonical.dismissedNames, ...payload.dismissedNames])],
    presetIds: [...new Set([...canonical.presetIds, ...payload.presetIds])],
    updatedAt: new Date().toISOString(),
  };
  await db.weeklyPlans.put(merged);
  await enqueue("weeklyPlan", canonicalId, "upsert", canonical.version, merged);
}

async function flushSingleOp(op: CoalescedOp): Promise<void> {
  const result = await pushOp({
    opId: "",
    entity: op.entity,
    entityId: op.entityId,
    op: op.op,
    baseVersion: await refreshBaseVersion(op),
    payload: op.payload,
    createdAt: "",
  });

  if (result.status === "conflict") {
    emitConflict({ entity: op.entity, entityId: op.entityId });
    // Conflict responses include the server's canonical id, which differs
    // from ours when the push collided with an existing row (weekly-plan
    // week collision) — refetch that row and drop our stale local one.
    await refreshEntityAfterConflict(op.entity, op.entityId, result.id);
    if (op.entity === "weeklyPlan" && op.op === "upsert" && (op.baseVersion === null || result.id !== op.entityId)) {
      // Null base: this client thought it was creating the week's plan but
      // another device created it first. Remapped id: the edit went to a
      // stale local duplicate of the week's row. Either way this is a
      // wrong-row collision, not a concurrent edit of the same row, so per
      // upsert_weekly_plan's contract adopt the canonical row and re-apply
      // the edit as a real (version-checked) update instead of dropping it.
      await reapplyWeeklyPlanEdit(result.id, op.payload as LocalWeeklyPlan);
    }
  } else if (result.id !== op.entityId) {
    // Server assigned a different canonical id (weekly-plan collision).
    await refreshEntityAfterConflict(op.entity, op.entityId, result.id);
  } else if (typeof result.version === "number") {
    await bumpLocalVersion(op.entity, op.entityId, result.version);
  }

  await db.syncQueue.bulkDelete(op.seqs);
}

// Grocery items are still individually-versioned leaf roots (Decision 3/4),
// but "generate/clear week" queues one op per item, so those are batched
// into a single sync_grocery_items round trip instead of one call per item.
// The RPC returns the resolved row inline on remap/conflict, so no
// follow-up select is needed either.
async function flushGroceryItemBatch(ops: CoalescedOp[]): Promise<void> {
  // An op whose plan row is gone (both locally and hence on the server —
  // plans are only deleted after a server round trip) can never sync:
  // sync_grocery_item raises "Weekly plan not found", which would abort
  // this and every future flush and wedge the queue behind it. Drop them.
  const alive: CoalescedOp[] = [];
  for (const op of ops) {
    const planId = (op.payload as LocalGroceryItem | null)?.weeklyPlanId;
    if (planId && (await db.weeklyPlans.get(planId))) {
      alive.push(op);
    } else {
      await db.syncQueue.bulkDelete(op.seqs);
    }
  }
  ops = alive;
  if (ops.length === 0) return;

  const results = await pushGroceryItems(
    await Promise.all(
      ops.map(async (op) => {
        const row = op.payload as LocalGroceryItem;
        return {
          weeklyPlanId: row.weeklyPlanId,
          clientId: op.entityId,
          name: row.name,
          category: row.category,
          quantity: row.quantity,
          checked: row.checked,
          toVerify: row.toVerify,
          baseVersion: await refreshBaseVersion(op),
          deleted: op.op === "delete",
        };
      }),
    ),
  );

  const byClientId = new Map(results.map((r) => [r.client_id, r]));
  for (const op of ops) {
    const result = byClientId.get(op.entityId);
    if (!result) continue;

    if (result.status === "conflict") {
      emitConflict({ entity: "groceryItem", entityId: op.entityId });
      if (result.row) await applyGroceryItem(result.row);
      else await refreshEntityAfterConflict("groceryItem", op.entityId);
    } else if (result.id !== op.entityId) {
      if (result.row) {
        await applyGroceryItem(result.row);
        await db.groceryItems.delete(op.entityId);
      } else {
        await refreshEntityAfterConflict("groceryItem", op.entityId, result.id);
      }
    } else if (typeof result.version === "number") {
      await bumpLocalVersion("groceryItem", op.entityId, result.version);
    }

    await db.syncQueue.bulkDelete(op.seqs);
  }
}

async function flushQueue(): Promise<void> {
  const items = await db.syncQueue.orderBy("seq").toArray();
  const ops = coalesce(items);

  let pendingGroceryItems: CoalescedOp[] = [];
  const flushPendingGroceryItems = async () => {
    if (pendingGroceryItems.length === 0) return;
    const batch = pendingGroceryItems;
    pendingGroceryItems = [];
    await flushGroceryItemBatch(batch);
  };

  for (const op of ops) {
    if (op.entity === "groceryItem") {
      pendingGroceryItems.push(op);
      continue;
    }
    // Flush any grocery items queued ahead of this op first to preserve
    // ordering (e.g. a weekly_plan upsert must land before items that
    // reference it).
    await flushPendingGroceryItems();
    await flushSingleOp(op);
  }
  await flushPendingGroceryItems();
}

async function bumpLocalVersion(entity: SyncEntity, id: string, version: number): Promise<void> {
  switch (entity) {
    case "meal": {
      const row = await db.meals.get(id);
      if (row) await db.meals.put({ ...row, version });
      break;
    }
    case "groceryPreset": {
      const row = await db.groceryPresets.get(id);
      if (row) await db.groceryPresets.put({ ...row, version });
      break;
    }
    case "weeklyPlan": {
      const row = await db.weeklyPlans.get(id);
      if (row) await db.weeklyPlans.put({ ...row, version });
      break;
    }
    case "groceryItem": {
      const row = await db.groceryItems.get(id);
      if (row) await db.groceryItems.put({ ...row, version });
      break;
    }
  }
}

async function pullAndApply(): Promise<void> {
  const cursor = await getCursor();
  const result = await pullChanges(cursor);

  // A local write made after flushQueue()'s snapshot (but before this pull
  // lands) has its op still sitting in syncQueue, unpushed. Applying a
  // pulled row for that same entity here would blindly overwrite that
  // newer local edit with stale (pre-edit) server data. Skip those; the
  // pending op's own flush + the next pull will reconcile them correctly.
  const pending = await db.syncQueue.toArray();
  const isPending = (entity: SyncEntity, id: string) =>
    pending.some((p) => p.entity === entity && p.entityId === id);

  await db.transaction("rw", db.meals, db.groceryPresets, db.weeklyPlans, db.groceryItems, async () => {
    await Promise.all([
      ...result.meals.filter((r) => !isPending("meal", r.id)).map(applyMeal),
      ...result.grocery_presets.filter((r) => !isPending("groceryPreset", r.id)).map(applyGroceryPreset),
      ...result.weekly_plans.filter((r) => !isPending("weeklyPlan", r.id)).map(applyWeeklyPlan),
      ...result.grocery_items.filter((r) => !isPending("groceryItem", r.id)).map(applyGroceryItem),
    ]);
  });

  await setCursor(result.watermark);
}

async function updatePendingCount(): Promise<void> {
  syncStatus.pendingCount = await db.syncQueue.count();
}

let inFlight: Promise<void> | null = null;

async function runSync(): Promise<void> {
  if (!syncStatus.online) return;

  const withLock = async () => {
    syncStatus.state = "syncing";
    try {
      await flushQueue();
      await pullAndApply();
      syncStatus.lastSyncAt = new Date().toISOString();
      syncStatus.state = "idle";
      emitSynced();
      backoffMs = MIN_BACKOFF_MS;
      if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
    } catch (err) {
      syncStatus.state = "error";
      scheduleBackoffRetry();
      console.error("[sync] failed", err);
    } finally {
      await updatePendingCount();
    }
  };

  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    await navigator.locks.request(LOCK_NAME, withLock);
  } else {
    await withLock();
  }
}

export function sync(): Promise<void> {
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

function scheduleBackoffRetry(): void {
  if (backoffTimer) return;
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void sync();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
}

export function scheduleDebouncedSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void sync();
  }, DEBOUNCE_MS);
}

// ============================================================
// Triggers — no Background Sync API on iOS Safari, so the engine
// only ever runs in foreground JS: launch, connectivity changes,
// return-to-foreground, and shortly after each local write.
// ============================================================

export function initSyncEngine(): void {
  db.syncQueue.hook("creating", () => {
    scheduleDebouncedSync();
  });

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      syncStatus.online = true;
      void sync();
    });
    window.addEventListener("offline", () => {
      syncStatus.online = false;
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void sync();
    });
  }

  void updatePendingCount();
  void sync();
}
