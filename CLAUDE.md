# Weekly Meal Planner

SPA for planning household meals week by week, with a grocery list generated from the plan. This will mostly run on mobile (iOS).

## Stack

- **Svelte 5** + TypeScript, **Vite 6**, **Tailwind CSS 4**
- **Supabase** (Postgres + Auth + RLS) — all data is household-scoped via `get_my_household_id()`
- **Dexie.js** (IndexedDB) — offline-first local store; all data reads/writes go through it, not Supabase directly
- **svelte-i18n** for localization
- Deployed on Github Pages

## Commands

```bash
npm run dev       # dev server
npm run build     # production build → dist/
npm run check     # svelte-check type checking
npm run test      # vitest (single run)
npm run test:watch
```

## Key directories

| Path | Purpose |
|------|---------|
| `src/lib/db/` | Dexie schema (`meals`, `groceryPresets`, `weeklyPlans`, `groceryItems`, `syncQueue`, `meta`) — the local source of truth |
| `src/lib/repos/` | Repositories (`mealRepo.ts`, `groceryPresetRepo.ts`, `weeklyPlanRepo.ts`, `groceryItemRepo.ts`) — read/write Dexie, enqueue sync ops |
| `src/lib/sync/` | Sync engine (`engine.ts`: push/pull/conflict handling, `rpc.ts`: Supabase RPC calls, `realtime.ts`, `status.svelte.ts`) |
| `src/lib/api/` | Remaining direct-Supabase calls not yet offline (`household.ts` — auth/membership/invites) |
| `src/lib/stores/` | Svelte stores that call the repo layer and hold reactive state |
| `src/lib/components/` | UI components (modal, cards, navigation, …) |
| `src/routes/` | Page-level Svelte components: `planner/`, `meals/`, `meal/`, `settings/` |
| `src/data/` | Static data (ingredient categories) |

## Offline sync

Reads/writes go UI → stores → repos (`src/lib/repos/`) → Dexie (`src/lib/db/`), never straight to Supabase.
Writes also enqueue a sync op; `src/lib/sync/engine.ts` flushes the queue and pulls deltas via RPCs (foreground-triggered only — no iOS Background Sync). On conflict, the engine adopts the server's canonical id, remaps all local references (queued ops, related entities) to it, and re-queues the rejected edit merged on top — it does not simply drop the op and refetch, since dangling references to a dead local id would wedge the sync queue. See `offline-sync-plan.md` for the full design.

Dexie write gotchas:
- Svelte 5 `$state` deep-reactive objects must go through `$state.snapshot()` before being handed to Dexie — a raw Proxy nested in the payload throws `DataCloneError` and silently drops the write.
- Check-then-create patterns against Dexie (e.g. a repo's `getOrCreate`) must be wrapped in `db.transaction("rw", ...)` — an unguarded read-then-write can create duplicate rows under concurrent calls.

## Debugging

- Don't declare a bug fixed from passing tests or a plausible root cause alone — verify against the exact repro, and treat user-reported persistence as overriding a local pass.
- When locking in a regression test, `git stash` the fix file, confirm the test fails with the original error, then restore the fix and confirm it passes.
- Race-condition and sync bugs can have multiple independent causes — trace the full contract (e.g. conflict-response id remap, baseVersion refresh, pending-op skip) before fixing edge cases one at a time.

## Testing gotchas

- Dexie/store writes triggered by a UI interaction are async — assert with `vi.waitFor(...)`, not a synchronous read right after the interaction.
- `resetStores()` (test helper) must reset every store field used across tests, including `weeklyPlan.selectedWeek` — a missed field leaks state between tests.
- Test fixtures must use real enum values (e.g. `IngredientCategory`), not invented placeholders.
- `fakeSupabase.ts` fixture gaps surface when writing new RPC/e2e tests: check its array-vs-jsonb serialization heuristic and `SELECT_QUERIES` map cover the entity you're adding, and that the engine mock stubs `auth` (required at import time by `src/lib/db/index.ts`).
- Router module state (e.g. `hasNavigatedInApp`) persists across tests in the same file since `initRouter()` isn't called in tests — a second navigation test in one file can behave differently from the first.

## DB schema

Read `schema.md` when: adding tables, modifying RLS policies, or touching household membership/invite logic.

Core tables: `households` → `household_memberships`, `meals` → `meal_ingredients`, `weekly_plans` → `day_plans` + `grocery_items`.  
All user data is isolated by `household_id`; RLS is enforced at the DB level via `get_my_household_id()`.
