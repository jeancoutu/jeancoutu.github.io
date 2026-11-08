import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

type Fake = Awaited<ReturnType<typeof createFakeSupabase>>;

async function makePlan(fake: Fake, weekStart: string, costcoEnabled?: boolean): Promise<string> {
  const id = crypto.randomUUID();
  await fake.rpc("upsert_weekly_plan", {
    p_id: id,
    p_base_version: null,
    p_week_start: weekStart,
    p_dismissed_names: [],
    p_day_plans: [],
    p_preset_ids: [],
    ...(costcoEnabled === undefined ? {} : { p_costco_enabled: costcoEnabled }),
  });
  return id;
}

function itemArgs(planId: string, id: string, extra: Record<string, unknown> = {}) {
  return {
    p_weekly_plan_id: planId,
    p_client_id: id,
    p_name: "Paper towels",
    p_category: "aisle",
    p_quantity: "1",
    p_checked: false,
    p_to_verify: false,
    p_base_version: null,
    p_deleted: false,
    ...extra,
  };
}

describe("costco_enabled on upsert_weekly_plan", () => {
  it("defaults to false and is stored when set on insert", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const off = await makePlan(fake, "2026-01-05");
    const on = await makePlan(fake, "2026-01-12", true);

    const offRow = await fake.from("weekly_plans").select("*").eq("id", off).maybeSingle();
    const onRow = await fake.from("weekly_plans").select("*").eq("id", on).maybeSingle();
    expect(offRow.data).toMatchObject({ costco_enabled: false });
    expect(onRow.data).toMatchObject({ costco_enabled: true });
  });

  it("updates the flag when sent, and leaves it unchanged when omitted (null)", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05", true);

    const base = {
      p_id: planId,
      p_week_start: "2026-01-05",
      p_dismissed_names: [],
      p_day_plans: [],
      p_preset_ids: [],
    };

    const omitted = await fake.rpc("upsert_weekly_plan", { ...base, p_base_version: 1 });
    expect(omitted.data).toMatchObject({ status: "ok", version: 2 });
    let row = await fake.from("weekly_plans").select("*").eq("id", planId).maybeSingle();
    expect(row.data).toMatchObject({ costco_enabled: true });

    const off = await fake.rpc("upsert_weekly_plan", { ...base, p_base_version: 2, p_costco_enabled: false });
    expect(off.data).toMatchObject({ status: "ok", version: 3 });
    row = await fake.from("weekly_plans").select("*").eq("id", planId).maybeSingle();
    expect(row.data).toMatchObject({ costco_enabled: false });
  });
});

describe("is_costco on grocery items", () => {
  it("lets a Costco row and a normal row share name+category without merging", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05", true);

    const normalId = crypto.randomUUID();
    const costcoId = crypto.randomUUID();
    const normal = await fake.rpc("sync_grocery_item", itemArgs(planId, normalId));
    const costco = await fake.rpc("sync_grocery_item", itemArgs(planId, costcoId, { p_is_costco: true }));

    expect(normal.data).toMatchObject({ status: "ok", id: normalId });
    expect(costco.data).toMatchObject({ status: "ok", id: costcoId });

    const rows = await fake._testHelpers.raw.query("select * from grocery_items where weekly_plan_id = $1", [planId]);
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: normalId, is_costco: false }),
        expect.objectContaining({ id: costcoId, is_costco: true }),
      ]),
    );
  });

  it("still merges two Costco rows with the same name+category", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05", true);

    const firstId = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", itemArgs(planId, firstId, { p_is_costco: true, p_quantity: "2" }));
    const secondId = crypto.randomUUID();
    const { data } = await fake.rpc(
      "sync_grocery_item",
      itemArgs(planId, secondId, { p_is_costco: true, p_quantity: "3", p_checked: true }),
    );

    expect(data).toMatchObject({ status: "ok", id: firstId });
    const merged = await fake.from("grocery_items").select("*").eq("id", firstId).maybeSingle();
    expect(merged.data).toMatchObject({ quantity: "2, 3", checked: true, is_costco: true });
  });

  it("does not change an existing row's section on update", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05", true);

    const id = crypto.randomUUID();
    await fake.rpc("sync_grocery_item", itemArgs(planId, id, { p_is_costco: true }));
    await fake.rpc("sync_grocery_item", itemArgs(planId, id, { p_base_version: 1, p_quantity: "5" }));

    const row = await fake.from("grocery_items").select("*").eq("id", id).maybeSingle();
    expect(row.data).toMatchObject({ quantity: "5", is_costco: true });
  });

  it("batched sync_grocery_items honours is_costco (and defaults it to false when omitted)", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();
    const planId = await makePlan(fake, "2026-01-05", true);

    const normalId = crypto.randomUUID();
    const costcoId = crypto.randomUUID();
    const base = {
      weekly_plan_id: planId,
      name: "Paper towels",
      category: "aisle",
      quantity: "1",
      checked: false,
      to_verify: false,
      base_version: null,
      deleted: false,
    };
    const { data, error } = await fake.rpc("sync_grocery_items", {
      p_items: [
        { ...base, client_id: normalId },
        { ...base, client_id: costcoId, is_costco: true },
      ],
    });

    expect(error).toBeNull();
    expect(data).toEqual([
      expect.objectContaining({ client_id: normalId, status: "ok", id: normalId }),
      expect.objectContaining({ client_id: costcoId, status: "ok", id: costcoId }),
    ]);
    const rows = await fake._testHelpers.raw.query("select * from grocery_items where weekly_plan_id = $1", [planId]);
    expect(rows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: normalId, is_costco: false }),
        expect.objectContaining({ id: costcoId, is_costco: true }),
      ]),
    );
  });
});

describe("is_costco on grocery presets", () => {
  const items = [{ name: "Rice", quantity: "10kg", category: "aisle" }];

  it("creates a Costco list and keeps it flagged across updates", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const id = crypto.randomUUID();
    const created = await fake.rpc("upsert_grocery_preset", {
      p_id: id,
      p_base_version: null,
      p_name: "Costco",
      p_items: items,
      p_is_costco: true,
    });
    expect(created.data).toMatchObject({ status: "ok", id, version: 1 });

    // Update path ignores p_is_costco: a preset never changes kind.
    await fake.rpc("upsert_grocery_preset", {
      p_id: id,
      p_base_version: 1,
      p_name: "Costco",
      p_items: items,
      p_is_costco: false,
    });
    const row = await fake.from("grocery_presets").select("*").eq("id", id).maybeSingle();
    expect(row.data).toMatchObject({ is_costco: true });
  });

  it("answers a second live Costco list with a conflict pointing at the canonical row", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const firstId = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", {
      p_id: firstId,
      p_base_version: null,
      p_name: "Costco",
      p_items: items,
      p_is_costco: true,
    });

    const secondId = crypto.randomUUID();
    const { data, error } = await fake.rpc("upsert_grocery_preset", {
      p_id: secondId,
      p_base_version: null,
      p_name: "Costco",
      p_items: [],
      p_is_costco: true,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: firstId, version: 1 });
    const rows = await fake._testHelpers.raw.query("select id from grocery_presets where id = $1", [secondId]);
    expect(rows.rows).toHaveLength(0);
  });

  it("allows a new Costco list once the previous one is deleted", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const firstId = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", {
      p_id: firstId,
      p_base_version: null,
      p_name: "Costco",
      p_items: items,
      p_is_costco: true,
    });
    await fake.rpc("delete_grocery_preset", { p_id: firstId, p_base_version: 1 });

    const secondId = crypto.randomUUID();
    const { data } = await fake.rpc("upsert_grocery_preset", {
      p_id: secondId,
      p_base_version: null,
      p_name: "Costco",
      p_items: items,
      p_is_costco: true,
    });
    expect(data).toMatchObject({ status: "ok", id: secondId });
  });

  it("normal presets are unaffected (default is_costco false, any number allowed)", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    for (const name of ["A", "B"]) {
      const { data } = await fake.rpc("upsert_grocery_preset", {
        p_id: crypto.randomUUID(),
        p_base_version: null,
        p_name: name,
        p_items: items,
      });
      expect(data).toMatchObject({ status: "ok" });
    }
    const rows = await fake._testHelpers.raw.query("select * from grocery_presets");
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows).toEqual([
      expect.objectContaining({ is_costco: false }),
      expect.objectContaining({ is_costco: false }),
    ]);
  });
});

describe("pull_changes costco fields", () => {
  it("returns costco_enabled on plans and is_costco on items and presets", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const planId = await makePlan(fake, "2026-01-05", true);
    await fake.rpc("sync_grocery_item", itemArgs(planId, crypto.randomUUID(), { p_is_costco: true }));
    await fake.rpc("upsert_grocery_preset", {
      p_id: crypto.randomUUID(),
      p_base_version: null,
      p_name: "Costco",
      p_items: [],
      p_is_costco: true,
    });

    const { data } = await fake.rpc("pull_changes", { p_since: null });
    const result = data as {
      weekly_plans: { costco_enabled: boolean }[];
      grocery_items: { is_costco: boolean }[];
      grocery_presets: { is_costco: boolean }[];
    };
    expect(result.weekly_plans[0]!.costco_enabled).toBe(true);
    expect(result.grocery_items[0]!.is_costco).toBe(true);
    expect(result.grocery_presets[0]!.is_costco).toBe(true);
  });
});
