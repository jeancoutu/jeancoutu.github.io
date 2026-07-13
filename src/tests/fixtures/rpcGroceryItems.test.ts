import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

async function makePlan(fake: Awaited<ReturnType<typeof createFakeSupabase>>, weekStart: string): Promise<string> {
  const id = crypto.randomUUID();
  await fake.rpc("upsert_weekly_plan", {
    p_id: id,
    p_base_version: null,
    p_week_start: weekStart,
    p_dismissed_names: [],
    p_day_plans: [],
    p_preset_ids: [],
  });
  return id;
}

describe("sync_grocery_item RPC", () => {
  it("insert path creates a new item", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05");

    const itemId = crypto.randomUUID();
    const { data, error } = await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: itemId,
      p_name: "Carrots",
      p_category: "vegetables",
      p_quantity: "2",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: itemId, version: 1 });
  });

  it("update path checks the version and applies the new fields", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05");

    const itemId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: itemId,
      p_name: "Carrots",
      p_category: "vegetables",
      p_quantity: "2",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    const { data, error } = await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: itemId,
      p_name: "Carrots",
      p_category: "vegetables",
      p_quantity: "3",
      p_checked: true,
      p_to_verify: false,
      p_base_version: 1,
      p_deleted: false,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: itemId, version: 2 });
  });

  it("returns a conflict (no row payload) when base_version is stale", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05");

    const itemId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: itemId,
      p_name: "Carrots",
      p_category: "vegetables",
      p_quantity: "2",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    const { data, error } = await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: itemId,
      p_name: "Carrots",
      p_category: "vegetables",
      p_quantity: "99",
      p_checked: false,
      p_to_verify: false,
      p_base_version: 99,
      p_deleted: false,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: itemId, version: 1 });
    expect(data).not.toHaveProperty("row");
  });

  it("merges quantities (concatenation) on a name+category collision between two different client ids", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05");

    const firstId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: firstId,
      p_name: "Rice",
      p_category: "aisle",
      p_quantity: "2 cups",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    const secondId = crypto.randomUUID();
    const { data, error } = await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: secondId,
      p_name: "Rice",
      p_category: "aisle",
      p_quantity: "1 cup",
      p_checked: true,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    expect(error).toBeNull();
    // Merged into the first client's row: canonical id is `firstId`, not `secondId`.
    expect(data).toMatchObject({ status: "ok", id: firstId });

    const refetched = await fake.from("grocery_items").select("*").eq("id", firstId).maybeSingle();
    expect(refetched.data).toMatchObject({ quantity: "2 cups, 1 cup", checked: true });
  });

  it("ORs to_verify on a name+category collision, same as checked", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05");

    const firstId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: firstId,
      p_name: "Rice",
      p_category: "aisle",
      p_quantity: "2 cups",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    const secondId = crypto.randomUUID();
    const { data, error } = await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: secondId,
      p_name: "Rice",
      p_category: "aisle",
      p_quantity: "1 cup",
      p_checked: false,
      p_to_verify: true,
      p_base_version: null,
      p_deleted: false,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: firstId });

    const refetched = await fake.from("grocery_items").select("*").eq("id", firstId).maybeSingle();
    expect(refetched.data).toMatchObject({ quantity: "2 cups, 1 cup", to_verify: true });
  });

  it("reviving a tombstoned row overwrites rather than merges the quantity", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05");

    const firstId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: firstId,
      p_name: "Rice",
      p_category: "aisle",
      p_quantity: "2 cups",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: firstId,
      p_name: "Rice",
      p_category: "aisle",
      p_quantity: "2 cups",
      p_checked: false,
      p_to_verify: false,
      p_base_version: 1,
      p_deleted: true,
    });

    const secondId = crypto.randomUUID();
    const { data, error } = await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: secondId,
      p_name: "Rice",
      p_category: "aisle",
      p_quantity: "5 cups",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: firstId });

    const refetched = await fake.from("grocery_items").select("*").eq("id", firstId).maybeSingle();
    expect(refetched.data).toMatchObject({ quantity: "5 cups", deleted_at: null });
  });
});

describe("sync_grocery_items RPC (batched)", () => {
  it("processes inserts, updates, conflicts, and merges in a single call", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05");

    const existingId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: existingId,
      p_name: "Eggs",
      p_category: "fridge",
      p_quantity: "6",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    const mergeTargetId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: mergeTargetId,
      p_name: "Butter",
      p_category: "fridge",
      p_quantity: "1 pack",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    const newId = crypto.randomUUID();
    const mergingId = crypto.randomUUID();

    const { data, error } = await fake.rpc("sync_grocery_items", {
      p_items: [
        {
          weekly_plan_id: planId,
          client_id: newId,
          name: "Carrots",
          category: "vegetables",
          quantity: "2",
          checked: false,
          to_verify: false,
          base_version: null,
          deleted: false,
        },
        {
          weekly_plan_id: planId,
          client_id: existingId,
          name: "Eggs",
          category: "fridge",
          quantity: "12",
          checked: true,
          to_verify: false,
          base_version: 1,
          deleted: false,
        },
        {
          weekly_plan_id: planId,
          client_id: mergingId,
          name: "Butter",
          category: "fridge",
          quantity: "1 more pack",
          checked: false,
          to_verify: false,
          base_version: null,
          deleted: false,
        },
      ],
    });

    expect(error).toBeNull();
    const results = data as {
      client_id: string;
      status: string;
      id: string;
      version?: number;
      row?: { quantity: string };
    }[];
    expect(results).toHaveLength(3);

    const insertResult = results.find((r) => r.client_id === newId)!;
    expect(insertResult).toMatchObject({ status: "ok", id: newId });
    expect(insertResult).not.toHaveProperty("row");

    const updateResult = results.find((r) => r.client_id === existingId)!;
    expect(updateResult).toMatchObject({ status: "ok", id: existingId, version: 2 });

    const mergeResult = results.find((r) => r.client_id === mergingId)!;
    expect(mergeResult).toMatchObject({ status: "ok", id: mergeTargetId });
    expect(mergeResult.row?.quantity).toBe("1 pack, 1 more pack");
  });

  it("reports a conflict (with the full server row) for a stale batched update", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05");

    const itemId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", {
      p_weekly_plan_id: planId,
      p_client_id: itemId,
      p_name: "Carrots",
      p_category: "vegetables",
      p_quantity: "2",
      p_checked: false,
      p_to_verify: false,
      p_base_version: null,
      p_deleted: false,
    });

    const { data, error } = await fake.rpc("sync_grocery_items", {
      p_items: [
        {
          weekly_plan_id: planId,
          client_id: itemId,
          name: "Carrots",
          category: "vegetables",
          quantity: "99",
          checked: false,
          to_verify: false,
          base_version: 99,
          deleted: false,
        },
      ],
    });

    expect(error).toBeNull();
    const result = (data as { client_id: string; status: string; id: string; version: number; row: { quantity: string } }[])[0]!;
    expect(result).toMatchObject({ client_id: itemId, status: "conflict", id: itemId, version: 1 });
    expect(result.row.quantity).toBe("2");
  });
});
