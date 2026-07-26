import "fake-indexeddb/auto";
import { db } from "../lib/db";
import { meals } from "../lib/stores/meals.svelte";
import { weeklyPlan } from "../lib/stores/weeklyPlan.svelte";
import { groceryList } from "../lib/stores/groceryList.svelte";
import { groceryPresets } from "../lib/stores/groceryPresets.svelte";
import { getWeekSaturday, toWeekKey } from "../lib/utils/weekDates";

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

// Component tests never sign in (auth.session stays null, per setup.ts's
// supabase mock), so every store's auth-gated reactive loader is a no-op —
// store state carries over between tests unless reset directly here.
export function resetStores(): void {
  meals.all = [];
  meals.search = "";
  meals.tagFilter = null;
  weeklyPlan.plans = {};
  weeklyPlan.dismissedNamesPerWeek = {};
  weeklyPlan.selectedWeek = toWeekKey(getWeekSaturday());
  groceryList.itemsByWeek = {};
  groceryPresets.all = [];
  groceryPresets.activeIdsByWeek = {};
}

export * from "@testing-library/svelte";
export { default as userEvent } from "@testing-library/user-event";
