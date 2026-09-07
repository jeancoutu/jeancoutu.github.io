import { describe, it, expect, beforeEach, vi } from "vitest";

let idCounter = 0;

const mockGetAll = vi.fn();

vi.mock("../../lib/repos/mealIdeaRepo", () => ({
  mealIdeaRepo: {
    getAll: () => mockGetAll(),
    create: vi.fn((text: string) =>
      Promise.resolve({ id: `idea-${++idCounter}`, text, createdAt: `2026-0${idCounter}-01T00:00:00.000Z` }),
    ),
    update: vi.fn((id: string, text: string) =>
      Promise.resolve({ id, text, createdAt: "2026-01-01T00:00:00.000Z" }),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

async function importStore() {
  const mod = await import("../../lib/stores/mealIdeas.svelte");
  const { emitSynced } = await import("../../lib/sync/status.svelte");
  return { ...mod, emitSynced };
}

describe("mealIdeas store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    idCounter = 0;
    mockGetAll.mockResolvedValue([]);
  });

  it("starts empty", async () => {
    const { mealIdeas } = await importStore();
    expect(mealIdeas.all).toEqual([]);
  });

  it("addIdea prepends the new idea so newest stays first", async () => {
    const { mealIdeas, addIdea } = await importStore();
    await addIdea("First");
    await addIdea("Second");
    expect(mealIdeas.all.map((i) => i.text)).toEqual(["Second", "First"]);
  });

  it("updateIdea replaces the matching idea in place", async () => {
    const { mealIdeas, addIdea, updateIdea } = await importStore();
    const created = await addIdea("Draft");
    await updateIdea(created.id, "Final");
    expect(mealIdeas.all).toHaveLength(1);
    expect(mealIdeas.all[0]!.text).toBe("Final");
  });

  it("deleteIdeaById removes the idea from the store", async () => {
    const { mealIdeas, addIdea, deleteIdeaById } = await importStore();
    const a = await addIdea("Keep");
    const b = await addIdea("Drop");
    await deleteIdeaById(b.id);
    expect(mealIdeas.all.map((i) => i.id)).toEqual([a.id]);
  });

  it("re-reads from the repo after a sync completes", async () => {
    const { mealIdeas, emitSynced } = await importStore();
    mockGetAll.mockResolvedValue([
      { id: "srv-1", text: "From another device", createdAt: "2026-05-01T00:00:00.000Z" },
    ]);

    emitSynced();

    await vi.waitFor(() => {
      expect(mealIdeas.all.map((i) => i.text)).toEqual(["From another device"]);
    });
  });
});
