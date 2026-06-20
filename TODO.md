# Migration: localStorage → Supabase

## Stack
- Svelte PWA (TypeScript)
- Supabase JS client (`@supabase/supabase-js`)

## Schema reference

```
meals          (id, user_id, name, duration, url, supper_days[], instructions[])
meal_ingredients (id, meal_id, name, quantity, category)
ingredient_definitions (id, user_id, name, category)
weekly_plans   (id, user_id, week_start)
day_plans      (id, weekly_plan_id, day_key, supper_meal_id, diner_meal_id)
profiles       (id, user_id, display_name)
```

All tables have RLS enabled. Every row is scoped to `auth.uid()`.
`meal_ingredients` and `day_plans` are accessed through their parent (`meal_id`, `weekly_plan_id`).

---

## Task 1 — Install Supabase client and create the client module [DONE]

- Run `npm install @supabase/supabase-js@latest`
- Create `src/lib/supabase.ts` that initializes and exports the Supabase client
- Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`
- Add both variables to `.env.example` (values empty)

Do not touch any other file.

---

## Task 2 — Add authentication (login/logout) [DONE]

- Create `src/lib/auth.ts` with helpers: `signInWithMagicLink(email)`, `signOut()`, `getSession()`
- Create `src/lib/stores/auth.ts` with a Svelte store that holds the current session/user
- Subscribe to `supabase.auth.onAuthStateChange` to keep the store in sync
- Add a minimal `AuthGate.svelte` component: shows an email input + "Send magic link" button when logged out, renders `<slot />` when logged in
- Wrap the root layout/app shell with `<AuthGate>`

Do not migrate any data layer yet.

---

## Task 3 — Migrate the meals data layer [DONE]

- Create `src/lib/api/meals.ts` with these functions (all async, all scoped to the current user):
  - `getMeals(): Promise<Meal[]>` — fetch meals + their meal_ingredients in one query
  - `createMeal(meal: Omit<Meal, 'id'>): Promise<Meal>`
  - `updateMeal(id: string, meal: Partial<Meal>): Promise<Meal>`
  - `deleteMeal(id: string): Promise<void>`
- Each `Meal` maps to: `meals` row + `meal_ingredients` rows
- On create/update: upsert `meal_ingredients` rows, delete removed ones
- Create `src/lib/stores/meals.ts`: replace the existing localStorage store with one that calls the API functions above
- Remove all `localStorage` reads/writes related to meals from the codebase

---

## Task 4 — Migrate the ingredient definitions data layer [DONE]

- Create `src/lib/api/ingredients.ts` with:
  - `getIngredientDefinitions(): Promise<IngredientDefinition[]>`
  - `upsertIngredientDefinition(def: IngredientDefinition): Promise<void>`
  - `deleteIngredientDefinition(name: string): Promise<void>`
- Update `src/lib/stores/ingredients.ts`: replace localStorage with calls to the API above
- Remove all `localStorage` reads/writes related to ingredient definitions

---

## Task 5 — Migrate the weekly plan data layer [DONE]

- Create `src/lib/api/plan.ts` with:
  - `getWeeklyPlan(weekStart: string): Promise<WeeklyPlan>` — fetch weekly_plans row + all day_plans rows for that week
  - `setMealSlot(weekStart: string, day: DayKey, slot: MealSlot, mealId: string | null): Promise<void>` — upsert the relevant day_plans row
  - `clearPlan(weekStart: string): Promise<void>` — delete all day_plans for that week
- Update `src/lib/stores/plan.ts`: replace localStorage with calls to the API above
- Remove all `localStorage` reads/writes related to the plan

---

## Task 6 — Remove the share URL feature

- Find and delete all code related to generating or parsing a share URL (look for base64, `btoa`, `atob`, URL params, share link components/routes)
- Remove the share button from the UI
- Remove any route handler that decodes a shared plan from the URL
- Clean up any related types or utilities

---

## Task 7 — Final cleanup

- Search the entire codebase for any remaining `localStorage` calls and remove them
- Remove any feature flags or conditional logic that was guarding the old localStorage path
- Update `.env.example` if any variables were missed
- Verify the app builds without errors: `npm run build`