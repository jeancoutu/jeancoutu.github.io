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
Writes also enqueue a sync op; `src/lib/sync/engine.ts` flushes the queue and pulls deltas via RPCs (foreground-triggered only — no iOS Background Sync). Conflicts are server-wins: the losing local op is dropped and the entity is refetched. See `offline-sync-plan.md` for the full design.

## DB schema

Read `schema.md` when: adding tables, modifying RLS policies, or touching household membership/invite logic.

Core tables: `households` → `household_memberships`, `meals` → `meal_ingredients`, `weekly_plans` → `day_plans` + `grocery_items`.  
All user data is isolated by `household_id`; RLS is enforced at the DB level via `get_my_household_id()`.
