import { supabase } from "../supabase";
import type {
  LocalGroceryItem,
  LocalGroceryPreset,
  LocalMeal,
  LocalWeeklyPlan,
  SyncQueueItem,
} from "../db";
import type { DayKey, WeeklyPlan } from "../types";
import { DAYS } from "../types";

export interface PushResult {
  status: "ok" | "conflict";
  id: string;
  version?: number;
}

function dayPlansToRows(plan: WeeklyPlan) {
  return DAYS.filter(({ key }) => plan[key]).map(({ key }) => ({
    day_key: key,
    note: plan[key]?.note ?? null,
    supper_meal_id: plan[key]?.supper ?? null,
    diner_meal_id: plan[key]?.diner ?? null,
  }));
}

export function rowsToDayPlans(
  rows: { day_key: string; note: string | null; supper_meal_id: string | null; diner_meal_id: string | null }[],
): WeeklyPlan {
  const plan: WeeklyPlan = {};
  for (const row of rows) {
    const day = row.day_key as DayKey;
    const entry: { supper?: string; diner?: string; note?: string } = {};
    if (row.supper_meal_id) entry.supper = row.supper_meal_id;
    if (row.diner_meal_id) entry.diner = row.diner_meal_id;
    if (row.note) entry.note = row.note;
    if (entry.supper || entry.diner || entry.note) plan[day] = entry;
  }
  return plan;
}

// The generated Database type only knows about the RPCs that existed at the
// last `npm run gen:types` run. These sync RPCs are new (Issue 0b) — cast to
// bypass the stale strict typing; re-run gen:types after applying 0b's SQL
// and this cast can be narrowed.
type UntypedSupabase = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
  };
};
const untypedSupabase = supabase as unknown as UntypedSupabase;

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await untypedSupabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

async function selectOne<T>(table: string, columns: string, id: string): Promise<T | null> {
  const { data, error } = await untypedSupabase.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as T | null;
}

async function pushMeal(op: SyncQueueItem): Promise<PushResult> {
  if (op.op === "delete") {
    return callRpc<PushResult>("delete_meal", { p_id: op.entityId, p_base_version: op.baseVersion });
  }
  const row = op.payload as LocalMeal;
  return callRpc<PushResult>("upsert_meal", {
    p_id: row.id,
    p_base_version: op.baseVersion,
    p_name: row.name,
    p_duration: row.duration,
    p_url: row.url,
    p_supper_days: row.supperDays,
    p_instructions: row.instructions,
    p_ingredients: row.ingredients,
    // Old queued payloads (written before tags existed) send null, which
    // upsert_meal coalesces to "keep the server's tags" instead of wiping.
    p_tags: row.tags ?? null,
  });
}

async function pushGroceryPreset(op: SyncQueueItem): Promise<PushResult> {
  if (op.op === "delete") {
    return callRpc<PushResult>("delete_grocery_preset", { p_id: op.entityId, p_base_version: op.baseVersion });
  }
  const row = op.payload as LocalGroceryPreset;
  return callRpc<PushResult>("upsert_grocery_preset", {
    p_id: row.id,
    p_base_version: op.baseVersion,
    p_name: row.name,
    p_items: row.items,
  });
}

async function pushWeeklyPlan(op: SyncQueueItem): Promise<PushResult> {
  if (op.op === "delete") {
    return callRpc<PushResult>("delete_weekly_plan", { p_id: op.entityId, p_base_version: op.baseVersion });
  }
  const row = op.payload as LocalWeeklyPlan;
  return callRpc<PushResult>("upsert_weekly_plan", {
    p_id: row.id,
    p_base_version: op.baseVersion,
    p_week_start: row.weekStart,
    p_dismissed_names: row.dismissedNames,
    p_day_plans: dayPlansToRows(row.plan),
    p_preset_ids: row.presetIds,
  });
}

async function pushGroceryItem(op: SyncQueueItem): Promise<PushResult> {
  if (op.op === "delete") {
    const row = op.payload as LocalGroceryItem;
    return callRpc<PushResult>("sync_grocery_item", {
      p_weekly_plan_id: row.weeklyPlanId,
      p_client_id: op.entityId,
      p_name: row.name,
      p_category: row.category,
      p_quantity: row.quantity,
      p_checked: row.checked,
      p_to_verify: row.toVerify,
      p_base_version: op.baseVersion,
      p_deleted: true,
    });
  }
  const row = op.payload as LocalGroceryItem;
  return callRpc<PushResult>("sync_grocery_item", {
    p_weekly_plan_id: row.weeklyPlanId,
    p_client_id: row.id,
    p_name: row.name,
    p_category: row.category,
    p_quantity: row.quantity,
    p_checked: row.checked,
    p_to_verify: row.toVerify,
    p_base_version: op.baseVersion,
    p_deleted: false,
  });
}

export async function pushOp(op: SyncQueueItem): Promise<PushResult> {
  switch (op.entity) {
    case "meal":
      return pushMeal(op);
    case "groceryPreset":
      return pushGroceryPreset(op);
    case "weeklyPlan":
      return pushWeeklyPlan(op);
    case "groceryItem":
      return pushGroceryItem(op);
  }
}

export interface PulledMeal {
  id: string;
  name: string;
  duration: string;
  url: string;
  supper_days: string[];
  instructions: string[];
  tags: string[];
  ingredients: { name: string; quantity: string; category: string; section: string | null }[];
  version: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface PulledGroceryPreset {
  id: string;
  name: string;
  items: { name: string; quantity: string; category: string }[];
  version: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface PulledWeeklyPlan {
  id: string;
  week_start: string;
  dismissed_ingredient_names: string[];
  day_plans: { day_key: string; note: string | null; supper_meal_id: string | null; diner_meal_id: string | null }[];
  preset_ids: string[];
  version: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface PulledGroceryItem {
  id: string;
  weekly_plan_id: string;
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
  to_verify: boolean;
  version: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface PullChangesResult {
  watermark: string;
  meals: PulledMeal[];
  weekly_plans: PulledWeeklyPlan[];
  grocery_presets: PulledGroceryPreset[];
  grocery_items: PulledGroceryItem[];
}

export interface GroceryItemBatchInput {
  weeklyPlanId: string;
  clientId: string;
  name: string;
  category: string;
  quantity: string;
  checked: boolean;
  toVerify: boolean;
  baseVersion: number | null;
  deleted: boolean;
}

export interface GroceryItemBatchResult {
  client_id: string;
  status: "ok" | "conflict";
  id: string;
  version?: number;
  row?: PulledGroceryItem;
}

// Batched sibling of pushGroceryItem: one round trip for the whole set of
// queued grocery-item ops (generate/clear week touch every item at once).
export async function pushGroceryItems(items: GroceryItemBatchInput[]): Promise<GroceryItemBatchResult[]> {
  const payload = items.map((item) => ({
    weekly_plan_id: item.weeklyPlanId,
    client_id: item.clientId,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    checked: item.checked,
    to_verify: item.toVerify,
    base_version: item.baseVersion,
    deleted: item.deleted,
  }));
  return callRpc<GroceryItemBatchResult[]>("sync_grocery_items", { p_items: payload });
}

export async function pullChanges(since: string | null): Promise<PullChangesResult> {
  return callRpc<PullChangesResult>("pull_changes", { p_since: since });
}

// Used only for conflict recovery (Decision 5: server wins + refresh the
// single entity). Everyday reads go through pull_changes; these are the
// one exception where the sync engine talks to Supabase directly.

export async function refetchMeal(id: string): Promise<PulledMeal | null> {
  const data = await selectOne<
    Omit<PulledMeal, "ingredients"> & { meal_ingredients: PulledMeal["ingredients"] }
  >(
    "meals",
    "id, name, duration, url, supper_days, instructions, tags, version, updated_at, deleted_at, meal_ingredients(name, quantity, category, section)",
    id,
  );
  if (!data) return null;
  return { ...data, ingredients: data.meal_ingredients ?? [] };
}

export async function refetchGroceryPreset(id: string): Promise<PulledGroceryPreset | null> {
  const data = await selectOne<
    Omit<PulledGroceryPreset, "items"> & { grocery_preset_items: PulledGroceryPreset["items"] }
  >(
    "grocery_presets",
    "id, name, version, updated_at, deleted_at, grocery_preset_items(name, quantity, category)",
    id,
  );
  if (!data) return null;
  return { ...data, items: data.grocery_preset_items ?? [] };
}

export async function refetchWeeklyPlan(id: string): Promise<PulledWeeklyPlan | null> {
  const data = await selectOne<
    Omit<PulledWeeklyPlan, "preset_ids"> & { weekly_plan_grocery_presets: { preset_id: string }[] }
  >(
    "weekly_plans",
    "id, week_start, dismissed_ingredient_names, version, updated_at, deleted_at, day_plans(day_key, note, supper_meal_id, diner_meal_id), weekly_plan_grocery_presets(preset_id)",
    id,
  );
  if (!data) return null;
  return {
    ...data,
    day_plans: data.day_plans ?? [],
    preset_ids: (data.weekly_plan_grocery_presets ?? []).map((r) => r.preset_id),
  };
}

export async function refetchGroceryItem(id: string): Promise<PulledGroceryItem | null> {
  return selectOne<PulledGroceryItem>(
    "grocery_items",
    "id, weekly_plan_id, name, quantity, category, checked, to_verify, version, updated_at, deleted_at",
    id,
  );
}
