import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import type { FakeSupabase } from "../fixtures/fakeSupabase";

// Unlike engine.test.ts (which mocks `../../lib/sync/rpc` entirely and
// exercises engine.ts's own logic in isolation), this file swaps out the
// underlying `supabase` client for the PGlite-backed fake so `rpc.ts` and
// `engine.ts` run unmodified against the real schema.sql RPCs — a true
// end-to-end push/conflict/pull test.
vi.mock("../../lib/supabase", async () => {
  const { createFakeSupabase } = await import("../fixtures/fakeSupabase");
  const fake = await createFakeSupabase();
  // `db/index.ts` -> `stores/auth.svelte.ts` calls `supabase.auth.onAuthStateChange`
  // at import time; the fake backend only implements `rpc`/`from`, so stub
  // `auth` the same way the global setup.ts mock does.
  return {
    supabase: {
      ...fake,
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  };
});

const { supabase } = await import("../../lib/supabase");
const fake = supabase as unknown as FakeSupabase;

const { db, enqueue } = await import("../../lib/db");
const { sync } = await import("../../lib/sync/engine");
const { syncStatus } = await import("../../lib/sync/status.svelte");

describe("sync engine against a real PGlite-backed Supabase", () => {
  beforeEach(async () => {
    await Promise.all([
      db.meals.clear(),
      db.weeklyPlans.clear(),
      db.groceryItems.clear(),
      db.groceryPresets.clear(),
      db.syncQueue.clear(),
      db.meta.clear(),
    ]);
    syncStatus.online = true;
    await fake._testHelpers.signInAsNewUser();
  });

  it("pushes a queued local insert through the real upsert_meal RPC", async () => {
    const local = {
      id: crypto.randomUUID(),
      name: "Chicken Soup",
      duration: "short" as const,
      url: "",
      supperDays: [],
      instructions: [],
      tags: ["soup", "comfort"],
      needsPrepAhead: false,
      ingredients: [{ name: "Chicken", quantity: "1 lb", category: "meat" as const }],
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    await db.meals.put(local);
    await enqueue("meal", local.id, "upsert", null, local);

    await sync();

    expect(await db.syncQueue.count()).toBe(0);
    const stored = await db.meals.get(local.id);
    expect(stored?.version).toBe(1);

    const serverRow = await fake.from("meals").select("*").eq("id", local.id).maybeSingle();
    expect(serverRow.data).toMatchObject({ name: "Chicken Soup", tags: ["soup", "comfort"] });
  });

  it("on a server-side conflict, drops the local op and adopts the server row (server wins)", async () => {
    const mealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "Original",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });
    // Another device already pushed an update, so the server is at version 2.
    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: 1,
      p_name: "Server wins",
      p_duration: "short",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
      p_tags: ["server-tag"],
    });

    // This client still thinks it's at version 1 and queues a conflicting edit.
    const staleLocal = {
      id: mealId,
      name: "Local edit (stale)",
      duration: "short" as const,
      url: "",
      supperDays: [],
      instructions: [],
      tags: ["local-tag"],
      needsPrepAhead: false,
      ingredients: [],
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    await db.meals.put(staleLocal);
    await enqueue("meal", mealId, "upsert", 1, staleLocal);

    await sync();

    expect(await db.syncQueue.count()).toBe(0);
    const stored = await db.meals.get(mealId);
    expect(stored?.name).toBe("Server wins");
    expect(stored?.version).toBe(2);
    expect(stored?.tags).toEqual(["server-tag"]);
  });

  it("pulls changes made directly on the server and applies them to Dexie, advancing the cursor", async () => {
    const mealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: mealId,
      p_base_version: null,
      p_name: "From another device",
      p_duration: "long",
      p_url: "",
      p_supper_days: ["friday"],
      p_instructions: ["Roast"],
      p_ingredients: [{ name: "Turkey", quantity: "1", category: "meat" }],
      p_tags: ["holiday"],
    });

    expect(await db.meals.get(mealId)).toBeUndefined();

    await sync();

    const stored = await db.meals.get(mealId);
    expect(stored).toMatchObject({ name: "From another device", duration: "long", version: 1 });
    expect(stored?.ingredients).toEqual([{ name: "Turkey", quantity: "1", category: "meat", section: null }]);
    expect(stored?.tags).toEqual(["holiday"]);
  });

  it("converges local state after a push-then-pull round trip involving a second device", async () => {
    // This device creates a meal offline.
    const localMealId = crypto.randomUUID();
    const local = {
      id: localMealId,
      name: "Local Meal",
      duration: "short" as const,
      url: "",
      supperDays: [],
      instructions: [],
      tags: [],
      needsPrepAhead: false,
      ingredients: [],
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    await db.meals.put(local);
    await enqueue("meal", localMealId, "upsert", null, local);

    // A second device (same household) creates its own meal directly on the server.
    const remoteMealId = crypto.randomUUID();
    await fake.rpc("upsert_meal", {
      p_id: remoteMealId,
      p_base_version: null,
      p_name: "Remote Meal",
      p_duration: "medium",
      p_url: "",
      p_supper_days: [],
      p_instructions: [],
      p_ingredients: [],
    });

    await sync();

    expect(await db.syncQueue.count()).toBe(0);
    const localAfter = await db.meals.get(localMealId);
    const remoteAfter = await db.meals.get(remoteMealId);
    expect(localAfter?.name).toBe("Local Meal");
    expect(localAfter?.version).toBe(1);
    expect(remoteAfter?.name).toBe("Remote Meal");
  });
});
