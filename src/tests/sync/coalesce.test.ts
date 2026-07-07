import { describe, expect, it } from "vitest";
import { coalesce } from "../../lib/sync/engine";
import type { SyncQueueItem } from "../../lib/db";

function op(overrides: Partial<SyncQueueItem> & Pick<SyncQueueItem, "seq">): SyncQueueItem {
  return {
    opId: `op-${overrides.seq}`,
    entity: "meal",
    entityId: "m1",
    op: "upsert",
    baseVersion: null,
    payload: null,
    createdAt: "",
    ...overrides,
  };
}

describe("sync queue coalescing", () => {
  it("collapses insert+update into a single upsert with the latest payload", () => {
    const result = coalesce([
      op({ seq: 1, baseVersion: null, payload: { name: "A" } }),
      op({ seq: 2, baseVersion: 1, payload: { name: "B" } }),
    ]);
    expect(result).toEqual([
      { entity: "meal", entityId: "m1", op: "upsert", baseVersion: null, payload: { name: "B" }, seqs: [1, 2] },
    ]);
  });

  it("collapses anything followed by a delete into a single delete", () => {
    const result = coalesce([
      op({ seq: 1, baseVersion: 3, payload: { name: "A" } }),
      op({ seq: 2, op: "delete", baseVersion: 3, payload: { name: "A" } }),
    ]);
    expect(result).toEqual([
      { entity: "meal", entityId: "m1", op: "delete", baseVersion: 3, payload: { name: "A" }, seqs: [1, 2] },
    ]);
  });

  it("drops the whole group when an unsynced insert is immediately deleted", () => {
    const result = coalesce([
      op({ seq: 1, baseVersion: null, payload: { name: "A" } }),
      op({ seq: 2, op: "delete", baseVersion: null, payload: { name: "A" } }),
    ]);
    expect(result).toEqual([]);
  });

  it("keeps separate entities and preserves FIFO order", () => {
    const result = coalesce([
      op({ seq: 1, entityId: "m1", payload: { name: "A" } }),
      op({ seq: 2, entityId: "m2", payload: { name: "B" } }),
      op({ seq: 3, entityId: "m1", baseVersion: 1, payload: { name: "A2" } }),
    ]);
    expect(result.map((r) => r.entityId)).toEqual(["m1", "m2"]);
    expect(result[0]).toMatchObject({ payload: { name: "A2" }, baseVersion: null, seqs: [1, 3] });
    expect(result[1]).toMatchObject({ payload: { name: "B" }, seqs: [2] });
  });

  it("keeps a real delete (base version from a previously synced row)", () => {
    const result = coalesce([op({ seq: 1, op: "delete", baseVersion: 5, payload: { name: "A" } })]);
    expect(result).toEqual([
      { entity: "meal", entityId: "m1", op: "delete", baseVersion: 5, payload: { name: "A" }, seqs: [1] },
    ]);
  });
});
