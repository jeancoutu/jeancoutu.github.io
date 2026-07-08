import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

describe("upsert_grocery_preset / delete_grocery_preset RPCs", () => {
  it("insert path creates a preset with its items", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const presetId = crypto.randomUUID();
    const { data, error } = await fake.rpc("upsert_grocery_preset", {
      p_id: presetId,
      p_base_version: null,
      p_name: "Weekly Staples",
      p_items: [{ name: "Milk", quantity: "1L", category: "fridge" }],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: presetId, version: 1 });

    const refetched = await fake.from("grocery_presets").select("*").eq("id", presetId).maybeSingle();
    expect(refetched.data).toMatchObject({
      name: "Weekly Staples",
      grocery_preset_items: [{ name: "Milk", quantity: "1L", category: "fridge" }],
    });
  });

  it("update path with matching version bumps version and replaces items", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const presetId = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", {
      p_id: presetId,
      p_base_version: null,
      p_name: "Weekly Staples",
      p_items: [{ name: "Milk", quantity: "1L", category: "fridge" }],
    });

    const { data, error } = await fake.rpc("upsert_grocery_preset", {
      p_id: presetId,
      p_base_version: 1,
      p_name: "Weekly Staples v2",
      p_items: [{ name: "Eggs", quantity: "12", category: "fridge" }],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: presetId, version: 2 });

    const refetched = await fake.from("grocery_presets").select("*").eq("id", presetId).maybeSingle();
    expect(refetched.data).toMatchObject({
      name: "Weekly Staples v2",
      grocery_preset_items: [{ name: "Eggs", quantity: "12", category: "fridge" }],
    });
  });

  it("returns a version conflict when base_version is stale", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const presetId = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", {
      p_id: presetId,
      p_base_version: null,
      p_name: "Weekly Staples",
      p_items: [],
    });

    const { data, error } = await fake.rpc("upsert_grocery_preset", {
      p_id: presetId,
      p_base_version: 99,
      p_name: "Stale Edit",
      p_items: [],
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: presetId, version: 1 });
  });

  it("delete_grocery_preset soft-deletes via deleted_at when the version matches", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const presetId = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", {
      p_id: presetId,
      p_base_version: null,
      p_name: "Weekly Staples",
      p_items: [],
    });

    const { data, error } = await fake.rpc("delete_grocery_preset", { p_id: presetId, p_base_version: 1 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: presetId, version: 2 });

    const refetched = await fake.from("grocery_presets").select("*").eq("id", presetId).maybeSingle();
    expect((refetched.data as { deleted_at: string | null }).deleted_at).not.toBeNull();
  });

  it("delete_grocery_preset returns a version conflict when base_version is stale", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const presetId = crypto.randomUUID();
    await fake.rpc("upsert_grocery_preset", {
      p_id: presetId,
      p_base_version: null,
      p_name: "Weekly Staples",
      p_items: [],
    });

    const { data, error } = await fake.rpc("delete_grocery_preset", { p_id: presetId, p_base_version: 99 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: presetId, version: 1 });
  });
});
