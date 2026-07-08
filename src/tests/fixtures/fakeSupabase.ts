import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const schemaSql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "schema.sql"), "utf-8");

// The three `from(table).select(columns).eq("id", id)` shapes rpc.ts's
// refetch* helpers use — supabase-js's embedded-resource select syntax
// (e.g. "meals(...) meal_ingredients(...)") isn't real SQL, so each table
// used by rpc.ts gets a hand-written equivalent query instead of a generic
// translator.
const SELECT_QUERIES: Record<string, string> = {
  meals: `
    select m.id, m.name, m.duration, m.url, m.supper_days, m.instructions,
           m.version, m.updated_at, m.deleted_at,
           coalesce((
             select jsonb_agg(jsonb_build_object('name', mi.name, 'quantity', mi.quantity, 'category', mi.category))
             from meal_ingredients mi where mi.meal_id = m.id
           ), '[]'::jsonb) as meal_ingredients
    from meals m where m.id = $1
  `,
  grocery_presets: `
    select gp.id, gp.name, gp.version, gp.updated_at, gp.deleted_at,
           coalesce((
             select jsonb_agg(jsonb_build_object('name', gpi.name, 'quantity', gpi.quantity, 'category', gpi.category))
             from grocery_preset_items gpi where gpi.preset_id = gp.id
           ), '[]'::jsonb) as grocery_preset_items
    from grocery_presets gp where gp.id = $1
  `,
  weekly_plans: `
    select wp.id, wp.week_start, wp.dismissed_ingredient_names, wp.version, wp.updated_at, wp.deleted_at,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'day_key', dp.day_key, 'note', dp.note,
               'supper_meal_id', dp.supper_meal_id, 'diner_meal_id', dp.diner_meal_id
             )) from day_plans dp where dp.weekly_plan_id = wp.id
           ), '[]'::jsonb) as day_plans,
           coalesce((
             select jsonb_agg(jsonb_build_object('preset_id', wpgp.preset_id))
             from weekly_plan_grocery_presets wpgp where wpgp.weekly_plan_id = wp.id
           ), '[]'::jsonb) as weekly_plan_grocery_presets
    from weekly_plans wp where wp.id = $1
  `,
  grocery_items: `
    select gi.id, gi.weekly_plan_id, gi.name, gi.quantity, gi.category, gi.checked,
           gi.version, gi.updated_at, gi.deleted_at
    from grocery_items gi where gi.id = $1
  `,
};

// PGlite's pg-wire driver doesn't know these RPC params are Postgres arrays
// (day_key[], text[], uuid[]) and sends plain JS arrays as their default
// `.toString()` ("monday" instead of "{monday}"), which Postgres then fails
// to parse. Format any array argument as a real array literal so the
// implicit text->array[] cast (driven by each SQL function's declared
// parameter type) works.
function toArrayLiteral(value: string[]): string {
  const escape = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `{${value.map(escape).join(",")}}`;
}

// Only these RPC params are real Postgres array columns (day_key[], text[],
// uuid[]); every other array-shaped param (p_ingredients, p_items,
// p_day_plans, sync_grocery_items' p_items) is jsonb and must be left as a
// plain JS array/object for PGlite's default JSON encoding. A value-based
// heuristic (e.g. "every element is a string") can't tell these apart for an
// *empty* array — `[].every(...)` is vacuously true — which previously sent
// `{}` (an empty Postgres array literal) for an empty jsonb param, and
// `{}`::jsonb parses as a JSON object, not an array, breaking
// `jsonb_array_length()` downstream.
const NATIVE_ARRAY_PARAMS = new Set(["p_supper_days", "p_instructions", "p_preset_ids"]);

function formatRpcArgs(args: Record<string, unknown>): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    formatted[key] = NATIVE_ARRAY_PARAMS.has(key) && Array.isArray(value) ? toArrayLiteral(value as string[]) : value;
  }
  return formatted;
}

export type RpcResult = { data: unknown; error: { message: string } | null };

export interface FakeSupabase {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => Promise<RpcResult> };
    };
  };
  /** Test-only helpers, not part of the real supabase-js surface. */
  _testHelpers: {
    /** Creates an auth.users row + a household (or joins one), then makes it the caller for subsequent rpc()/from() calls. */
    signInAsNewUser: (opts?: { email?: string; householdId?: string }) => Promise<{ userId: string; householdId: string }>;
    /** Switches the simulated caller to an existing user without creating anything. */
    signInAs: (userId: string) => Promise<void>;
    raw: PGlite;
  };
}

// plpgsql functions are `security definer`, so they run with the schema
// owner's privileges regardless of caller role — running rpc()/from() as
// `app_user` here only matters for RLS on the direct-select path, but does
// so for both to mirror how the real client is always `authenticated`.
async function asAppUser<T>(db: PGlite, currentUserId: () => string | null, fn: () => Promise<T>): Promise<T> {
  const userId = currentUserId();
  await db.query("set role app_user");
  await db.query("select set_config('app.current_user_id', $1, false)", [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.query("reset role");
  }
}

export async function createFakeSupabase(): Promise<FakeSupabase> {
  const db = new PGlite();
  await db.exec(schemaSql);

  let currentUserId: string | null = null;

  const rpc: FakeSupabase["rpc"] = async (fn, args) => {
    const formattedArgs = formatRpcArgs(args);
    const keys = Object.keys(formattedArgs);
    const paramList = keys.map((key, i) => `${key} => $${i + 1}`).join(", ");
    const values = keys.map((key) => formattedArgs[key]);
    try {
      const result = await asAppUser(db, () => currentUserId, () => db.query(`select ${fn}(${paramList}) as result`, values));
      const rows = result.rows as { result: unknown }[];
      return { data: rows[0]?.result ?? null, error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
    }
  };

  const from: FakeSupabase["from"] = (table) => ({
    select: () => ({
      eq: (_column: string, value: string) => ({
        maybeSingle: async () => {
          const query = SELECT_QUERIES[table];
          if (!query) throw new Error(`fakeSupabase.from(): no fixture query for table "${table}"`);
          try {
            const result = await asAppUser(db, () => currentUserId, () => db.query(query, [value]));
            const rows = result.rows as Record<string, unknown>[];
            return { data: rows[0] ?? null, error: null };
          } catch (err) {
            return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
          }
        },
      }),
    }),
  });

  return {
    rpc,
    from,
    _testHelpers: {
      raw: db,
      signInAsNewUser: async (opts) => {
        const email = opts?.email ?? `test-${crypto.randomUUID()}@example.com`;
        // Inserting into auth.users fires the real `on_auth_user_created`
        // trigger (schema.sql), which creates a solo household + membership
        // exactly like production sign-up.
        const userResult = await db.query<{ id: string }>(
          "insert into auth.users (email) values ($1) returning id",
          [email],
        );
        const userId = userResult.rows[0]!.id;

        const membership = await db.query<{ household_id: string }>(
          "select household_id from household_memberships where user_id = $1",
          [userId],
        );
        let householdId = membership.rows[0]!.household_id;

        if (opts?.householdId && opts.householdId !== householdId) {
          const soloHouseholdId = householdId;
          await db.query("update household_memberships set household_id = $1 where user_id = $2", [
            opts.householdId,
            userId,
          ]);
          await db.query("delete from households where id = $1", [soloHouseholdId]);
          householdId = opts.householdId;
        }

        currentUserId = userId;
        return { userId, householdId };
      },
      signInAs: async (userId) => {
        currentUserId = userId;
      },
    },
  };
}
