import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, enqueue, getCursor, type LocalGroceryItem, type LocalMeal, type LocalWeeklyPlan } from "../../lib/db";

vi.mock("../../lib/sync/rpc", async () => {
  const actual = await vi.importActual<typeof import("../../lib/sync/rpc")>("../../lib/sync/rpc");
  return {
    ...actual,
    pushOp: vi.fn(),
    pushGroceryItems: vi.fn(),
    pullChanges: vi.fn(),
    refetchMeal: vi.fn(),
    refetchGroceryPreset: vi.fn(),
    refetchWeeklyPlan: vi.fn(),
    refetchGroceryItem: vi.fn(),
  };
});

// Household refresh is a separate Supabase-backed cache (src/lib/stores/household.svelte.ts),
// out of scope for this sync-engine unit test — the global supabase mock (src/tests/setup.ts)
// only stubs `auth`, so an unmocked call here would hit `supabase.from` and throw.
vi.mock("../../lib/stores/household.svelte", () => ({
  refreshHousehold: vi.fn().mockResolvedValue(undefined),
}));

const rpc = await import("../../lib/sync/rpc");
const { sync, resetLocalCache } = await import("../../lib/sync/engine");
const { syncStatus, onSynced } = await import("../../lib/sync/status.svelte");

const pushOp = vi.mocked(rpc.pushOp);
const pushGroceryItems = vi.mocked(rpc.pushGroceryItems);
const pullChanges = vi.mocked(rpc.pullChanges);
const refetchMeal = vi.mocked(rpc.refetchMeal);
const refetchWeeklyPlan = vi.mocked(rpc.refetchWeeklyPlan);
const refetchGroceryItem = vi.mocked(rpc.refetchGroceryItem);

const emptyPull = { watermark: "2026-01-01T00:00:00.000Z", meals: [], weekly_plans: [], grocery_presets: [], grocery_items: [] };

describe("sync engine", () => {
  beforeEach(async () => {
    await Promise.all([db.meals.clear(), db.weeklyPlans.clear(), db.groceryItems.clear(), db.syncQueue.clear(), db.meta.clear()]);
    vi.clearAllMocks();
    syncStatus.online = true;
    pullChanges.mockResolvedValue(emptyPull);
  });

  it("on conflict, drops the local op and refreshes the entity from the server", async () => {
    const local: LocalMeal = {
      id: "m1", name: "Local edit", duration: "short", url: "", supperDays: [], instructions: [], tags: [], ingredients: [],
      version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
    };
    await db.meals.put(local);
    await enqueue("meal", "m1", "upsert", 1, local);

    pushOp.mockResolvedValueOnce({ status: "conflict", id: "m1" });
    refetchMeal.mockResolvedValueOnce({
      id: "m1", name: "Server wins", duration: "short", url: "", supper_days: [], instructions: [], tags: [], ingredients: [],
      version: 2, updated_at: "2026-01-02T00:00:00.000Z", deleted_at: null,
    });

    await sync();

    expect(await db.syncQueue.count()).toBe(0);
    const stored = await db.meals.get("m1");
    expect(stored?.name).toBe("Server wins");
    expect(stored?.version).toBe(2);
  });

  it("remaps a local id to the server-assigned canonical id on collision", async () => {
    const local: LocalWeeklyPlan = {
      id: "local-temp-id", weekStart: "2026-01-05", plan: {}, dismissedNames: [], presetIds: [],
      version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
    };
    await db.weeklyPlans.put(local);
    await enqueue("weeklyPlan", "local-temp-id", "upsert", null, local);

    pushOp.mockResolvedValueOnce({ status: "ok", id: "canonical-id", version: 3 });
    refetchWeeklyPlan.mockResolvedValueOnce({
      id: "canonical-id", week_start: "2026-01-05", dismissed_ingredient_names: [], day_plans: [], preset_ids: [],
      version: 3, updated_at: "2026-01-02T00:00:00.000Z", deleted_at: null,
    });

    await sync();

    expect(await db.weeklyPlans.get("local-temp-id")).toBeUndefined();
    const canonical = await db.weeklyPlans.get("canonical-id");
    expect(canonical?.version).toBe(3);
    expect(await db.syncQueue.count()).toBe(0);
  });

  // Grocery-item ops are only flushed while their plan row exists locally
  // (dead references are dropped instead of wedging the queue), so seed it.
  async function seedPlanRow(id: string): Promise<void> {
    await db.weeklyPlans.put({
      id, weekStart: "2026-01-05", plan: {}, dismissedNames: [], presetIds: [],
      version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
    });
  }

  it("remaps a grocery item id on merge collision without touching other entities", async () => {
    await seedPlanRow("plan-1");
    const local: LocalGroceryItem = {
      id: "local-item", weeklyPlanId: "plan-1", name: "Carrots", quantity: "2", category: "vegetables", checked: false, toVerify: false,
      version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
    };
    await db.groceryItems.put(local);
    await enqueue("groceryItem", "local-item", "upsert", null, local);

    pushGroceryItems.mockResolvedValueOnce([
      {
        client_id: "local-item",
        status: "ok",
        id: "merged-item",
        version: 4,
        row: {
          id: "merged-item", weekly_plan_id: "plan-1", name: "Carrots", quantity: "5", category: "vegetables", checked: false, to_verify: false,
          version: 4, updated_at: "2026-01-02T00:00:00.000Z", deleted_at: null,
        },
      },
    ]);

    await sync();

    expect(pushOp).not.toHaveBeenCalled();
    expect(refetchGroceryItem).not.toHaveBeenCalled();
    expect(await db.groceryItems.get("local-item")).toBeUndefined();
    const merged = await db.groceryItems.get("merged-item");
    expect(merged?.quantity).toBe("5");
  });

  it("batches multiple queued grocery-item ops into a single sync_grocery_items call", async () => {
    await seedPlanRow("plan-1");
    const itemA: LocalGroceryItem = {
      id: "item-a", weeklyPlanId: "plan-1", name: "Carrots", quantity: "2", category: "vegetables", checked: false, toVerify: false,
      version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
    };
    const itemB: LocalGroceryItem = {
      id: "item-b", weeklyPlanId: "plan-1", name: "Rice", quantity: "1", category: "aisle", checked: false, toVerify: false,
      version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
    };
    await db.groceryItems.bulkPut([itemA, itemB]);
    await enqueue("groceryItem", "item-a", "upsert", null, itemA);
    await enqueue("groceryItem", "item-b", "upsert", null, itemB);

    pushGroceryItems.mockResolvedValueOnce([
      { client_id: "item-a", status: "ok", id: "item-a", version: 2 },
      { client_id: "item-b", status: "ok", id: "item-b", version: 2 },
    ]);

    await sync();

    expect(pushGroceryItems).toHaveBeenCalledTimes(1);
    expect((await db.groceryItems.get("item-a"))?.version).toBe(2);
    expect((await db.groceryItems.get("item-b"))?.version).toBe(2);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it("drops queued grocery-item ops whose plan row no longer exists instead of wedging the queue", async () => {
    const orphan: LocalGroceryItem = {
      id: "orphan-item", weeklyPlanId: "gone-plan", name: "Carrots", quantity: "2", category: "vegetables", checked: false, toVerify: false,
      version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
    };
    await enqueue("groceryItem", "orphan-item", "upsert", null, orphan);

    await sync();

    expect(pushGroceryItems).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(0);
    expect(syncStatus.state).toBe("idle");
  });

  it("advances the cursor to the server watermark after a successful pull", async () => {
    expect(await getCursor()).toBeNull();
    pullChanges.mockResolvedValueOnce({ ...emptyPull, watermark: "2026-03-01T12:00:00.000Z" });

    await sync();

    expect(await getCursor()).toBe("2026-03-01T12:00:00.000Z");
    expect(pullChanges).toHaveBeenCalledWith(null);
  });

  it("passes the stored cursor as `since` on the next pull", async () => {
    pullChanges.mockResolvedValueOnce({ ...emptyPull, watermark: "2026-03-01T12:00:00.000Z" });
    await sync();

    pullChanges.mockResolvedValueOnce({ ...emptyPull, watermark: "2026-03-02T12:00:00.000Z" });
    await sync();

    expect(pullChanges).toHaveBeenLastCalledWith("2026-03-01T12:00:00.000Z");
  });

  it("applies pulled rows (including tombstones) to Dexie", async () => {
    pullChanges.mockResolvedValueOnce({
      ...emptyPull,
      meals: [{
        id: "pulled-meal", name: "From server", duration: "short", url: "", supper_days: [], instructions: [], tags: [], ingredients: [],
        version: 1, updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null,
      }],
    });

    await sync();
    expect((await db.meals.get("pulled-meal"))?.name).toBe("From server");

    pullChanges.mockResolvedValueOnce({
      ...emptyPull,
      meals: [{
        id: "pulled-meal", name: "From server", duration: "short", url: "", supper_days: [], instructions: [], tags: [], ingredients: [],
        version: 2, updated_at: "2026-01-02T00:00:00.000Z", deleted_at: "2026-01-02T00:00:00.000Z",
      }],
    });
    await sync();

    expect((await db.meals.get("pulled-meal"))?.deletedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("does not sync while offline", async () => {
    syncStatus.online = false;
    await enqueue("meal", "m1", "upsert", null, { id: "m1" });

    await sync();

    expect(pushOp).not.toHaveBeenCalled();
    expect(pullChanges).not.toHaveBeenCalled();
  });

  describe("resetLocalCache", () => {
    it("discards local data and any queued (even unsynced) ops, then does a fresh full pull", async () => {
      // Establish a cursor from a prior sync so we can tell the reset
      // actually forces a full pull (since=null) rather than a delta one.
      pullChanges.mockResolvedValueOnce({ ...emptyPull, watermark: "2026-02-01T00:00:00.000Z" });
      await sync();
      expect(await getCursor()).toBe("2026-02-01T00:00:00.000Z");

      const local: LocalMeal = {
        id: "m1", name: "Local edit", duration: "short", url: "", supperDays: [], instructions: [], tags: [], ingredients: [],
        version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
      };
      await db.meals.put(local);
      await enqueue("meal", "m1", "upsert", 1, local); // never pushed

      pullChanges.mockResolvedValueOnce({
        ...emptyPull,
        watermark: "2026-04-01T00:00:00.000Z",
        meals: [{
          id: "server-meal", name: "Fresh from server", duration: "short", url: "", supper_days: [], instructions: [], tags: [], ingredients: [],
          version: 1, updated_at: "2026-04-01T00:00:00.000Z", deleted_at: null,
        }],
      });

      await resetLocalCache();

      expect(pushOp).not.toHaveBeenCalled(); // the queued op was dropped, not flushed
      expect(pullChanges).toHaveBeenLastCalledWith(null);
      expect(await db.syncQueue.count()).toBe(0);
      expect(await db.meals.get("m1")).toBeUndefined();
      expect((await db.meals.get("server-meal"))?.name).toBe("Fresh from server");
      expect(await getCursor()).toBe("2026-04-01T00:00:00.000Z");
      expect(syncStatus.pendingCount).toBe(0);
      expect(syncStatus.state).toBe("idle");
    });

    it("notifies synced listeners immediately (so stores clear right away) and again once the pull lands", async () => {
      await db.meals.put({
        id: "m1", name: "Stale", duration: "short", url: "", supperDays: [], instructions: [], tags: [], ingredients: [],
        version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
      } satisfies LocalMeal);

      const seenMealCounts: number[] = [];
      const unsubscribe = onSynced(() => {
        seenMealCounts.push(-1); // sentinel; overwritten below once we can read Dexie
      });

      pullChanges.mockResolvedValueOnce(emptyPull);
      await resetLocalCache();
      unsubscribe();

      expect(seenMealCounts.length).toBe(2);
    });

    it("leaves data cleared but does not repopulate while offline", async () => {
      syncStatus.online = false;
      await db.meals.put({
        id: "m1", name: "Stale", duration: "short", url: "", supperDays: [], instructions: [], tags: [], ingredients: [],
        version: 1, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
      } satisfies LocalMeal);

      await resetLocalCache();

      expect(pullChanges).not.toHaveBeenCalled();
      expect(await db.meals.get("m1")).toBeUndefined();
      expect(await getCursor()).toBeNull();
      expect(syncStatus.pendingCount).toBe(0);
    });
  });
});
