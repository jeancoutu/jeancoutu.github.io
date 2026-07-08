import "fake-indexeddb/auto";
import { db } from "../lib/db";

// Clears every Dexie table between component tests so state doesn't leak
// across tests (mirrors the beforeEach pattern already used by repo tests).
export async function resetDb(): Promise<void> {
  await db.meals.clear();
  await db.groceryPresets.clear();
  await db.weeklyPlans.clear();
  await db.groceryItems.clear();
  await db.syncQueue.clear();
  await db.meta.clear();
}

export * from "@testing-library/svelte";
export { default as userEvent } from "@testing-library/user-event";
