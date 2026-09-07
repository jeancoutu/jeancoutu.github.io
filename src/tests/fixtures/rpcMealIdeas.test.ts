import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";

describe("upsert_meal_idea / delete_meal_idea RPCs", () => {
  it("insert path creates an idea at version 1", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const ideaId = crypto.randomUUID();
    const { data, error } = await fake.rpc("upsert_meal_idea", {
      p_id: ideaId,
      p_base_version: null,
      p_text: "Try shakshuka https://example.com/recipe",
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: ideaId, version: 1 });

    const refetched = await fake.from("meal_ideas").select("*").eq("id", ideaId).maybeSingle();
    expect(refetched.data).toMatchObject({ text: "Try shakshuka https://example.com/recipe" });
  });

  it("update path with a matching base_version bumps the version and replaces the text", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const ideaId = crypto.randomUUID();
    await fake.rpc("upsert_meal_idea", { p_id: ideaId, p_base_version: null, p_text: "Draft" });

    const { data, error } = await fake.rpc("upsert_meal_idea", {
      p_id: ideaId,
      p_base_version: 1,
      p_text: "Final",
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: ideaId, version: 2 });

    const refetched = await fake.from("meal_ideas").select("*").eq("id", ideaId).maybeSingle();
    expect(refetched.data).toMatchObject({ text: "Final" });
  });

  it("returns a version conflict when base_version is stale", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const ideaId = crypto.randomUUID();
    await fake.rpc("upsert_meal_idea", { p_id: ideaId, p_base_version: null, p_text: "Draft" });

    const { data, error } = await fake.rpc("upsert_meal_idea", {
      p_id: ideaId,
      p_base_version: 99,
      p_text: "Stale edit",
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "conflict", id: ideaId, version: 1 });
  });

  it("delete_meal_idea soft-deletes via deleted_at when the version matches", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const ideaId = crypto.randomUUID();
    await fake.rpc("upsert_meal_idea", { p_id: ideaId, p_base_version: null, p_text: "Ephemeral" });

    const { data, error } = await fake.rpc("delete_meal_idea", { p_id: ideaId, p_base_version: 1 });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok", id: ideaId, version: 2 });

    const refetched = await fake.from("meal_ideas").select("*").eq("id", ideaId).maybeSingle();
    expect((refetched.data as { deleted_at: string | null }).deleted_at).not.toBeNull();
  });

  it("delete_meal_idea is idempotent for an unknown id", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const { data, error } = await fake.rpc("delete_meal_idea", {
      p_id: crypto.randomUUID(),
      p_base_version: 1,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "ok" });
  });

  it("pull_changes returns meal ideas after the cursor and includes tombstones", async () => {
    const fake = await createFakeSupabase();
    await fake._testHelpers.signInAsNewUser();

    const firstId = crypto.randomUUID();
    await fake.rpc("upsert_meal_idea", { p_id: firstId, p_base_version: null, p_text: "First" });

    const firstPull = (await fake.rpc("pull_changes", { p_since: null })).data as {
      watermark: string;
      meal_ideas: { id: string }[];
    };
    expect(firstPull.meal_ideas.map((i) => i.id)).toEqual([firstId]);

    const secondId = crypto.randomUUID();
    await fake.rpc("upsert_meal_idea", { p_id: secondId, p_base_version: null, p_text: "Second" });
    await fake.rpc("delete_meal_idea", { p_id: firstId, p_base_version: 1 });

    const { data } = await fake.rpc("pull_changes", { p_since: firstPull.watermark });
    const result = data as { meal_ideas: { id: string; text: string; created_at: string; deleted_at: string | null }[] };

    const byId = new Map(result.meal_ideas.map((i) => [i.id, i]));
    expect(byId.get(secondId)).toMatchObject({ text: "Second" });
    expect(byId.get(secondId)?.created_at).toBeTruthy();
    expect(byId.get(firstId)?.deleted_at).not.toBeNull();
  });
});
