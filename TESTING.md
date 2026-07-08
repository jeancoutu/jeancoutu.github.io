# Testing

Coverage-at-a-glance by feature area. See `ui-testing-plan.md` for the full plan this is tracked against.

- Component tests mount real `.svelte` files (`@testing-library/svelte`) and simulate real interaction — not store-level-only tests. They exercise UI → stores → repos → Dexie (`fake-indexeddb`) and never touch Supabase (the sync engine is only started from `src/main.ts`, never by these tests).
- i18n is initialized with the real `en`/`fr` locale JSON (`src/tests/setup.ts`), so assertions match actual rendered copy.
- Sync engine / RPC tests run the real `schema.md` SQL (adapted as `src/tests/fixtures/schema.sql`) against PGlite (WASM Postgres) via `src/tests/fixtures/fakeSupabase.ts` — no hand-written reimplementation of the Postgres logic.
- Known gap: no delete-meal UI exists (only an untested store function) — out of scope until that UI is built.

## Planner

- [x] Selecting a meal in a day/slot saves to `day_plans`, shows as selected, and (re)generates the grocery list (`src/tests/components/DaySelector.test.ts`)
- [x] Clearing a slot (blank option) removes that meal from the day (`src/tests/components/DaySelector.test.ts`)
- [x] Eye icon (only rendered when a slot has a meal) navigates to `/meal/:id` (`src/tests/components/DaySelector.test.ts`)
- [x] Week-label button opens `WeekPickerModal`; selecting a week updates the selection and closes the modal; "has plan"/"This Week" indicators are correct (`src/tests/components/Planner.test.ts`)
- [x] "Auto-fill" only fills empty supper slots, cascades supper → next day's diner, clears Saturday's diner (`src/tests/components/Planner.test.ts`; the "excludes meals used this/previous week" selection rules are exhaustively covered at the store level in `src/tests/stores/weeklyPlan.test.ts`)
- [x] "Clear" empties all day selects and the grocery list for the week (`src/tests/components/Planner.test.ts`)
- [x] "Refresh" reloads the week's plan and grocery items (`src/tests/components/Planner.test.ts`)
- [x] Note icon opens `DayNoteModal`; Save persists trimmed note (or null), Clear removes it, Cancel discards, saved note renders under the day (`src/tests/components/DaySelector.test.ts`)

## Grocery List

- [x] Preset pill buttons toggle `aria-pressed` and call `togglePresetForWeek`; disabled while in flight (`src/tests/components/GroceryList.test.ts`)
- [x] "+" per category reveals an inline add form; submit adds the item; Escape/Cancel resets the form (`src/tests/components/GroceryList.test.ts`)
- [x] Checkbox toggles `checked`; checked items sort to the bottom with strikethrough (`src/tests/components/GroceryList.test.ts`)
- [x] Long-press a custom item enters inline edit; Enter saves, Escape cancels (`src/tests/components/GroceryList.test.ts`)
- [x] Remove button: custom items call `removeGroceryItem`; plan-derived items call `dismissIngredient` (`src/tests/components/GroceryList.test.ts`)
- [x] Empty state renders when there are no items (`src/tests/components/GroceryList.test.ts`)

## Meals

- [ ] "Create" opens `MealFormModal` in create mode
- [ ] Search input filters the list by name
- [ ] Duration filter narrows the list
- [ ] Empty state renders when the filtered list is empty
- [ ] Clicking "View recipe" navigates to `/meal/:id`

## Meal Detail

- [ ] "Back" returns to `/meals` (or browser history if in-app)
- [ ] "Edit" opens the form pre-filled with current data; saving persists changes
- [ ] "Duplicate" opens the form pre-filled with a generated duplicate name; saving creates a new meal without mutating the original
- [ ] "View guide" link renders only when `meal.url` is set
- [ ] Validation: empty name, name > 50 chars, zero ingredients, zero non-blank instruction lines each block save with the matching error
- [ ] Day checkboxes toggle `supperDays`
- [ ] Ingredient editor: add row, remove row, edit quantity inline
- [ ] Save button disabled while saving; Cancel discards changes

## Presets

- [ ] Create form: "Create" disabled when name is blank; submitting creates the preset and navigates to its detail page
- [ ] Clicking a list item navigates to its detail page
- [ ] Delete is two-step: first click arms confirm/cancel, second click deletes
- [ ] Empty state renders when there are no presets
- [ ] Detail page: name validation blocks save on blank name; Save persists name + items and navigates back; Cancel discards and navigates back
- [ ] (Cross-reference) toggling a preset on/off for the active week is covered under Grocery List

## Sync Engine / RPC (PGlite-backed)

- [ ] `upsert_meal`: insert, update with matching version, conflict on stale version, ingredient replace-on-upsert
- [ ] `delete_meal`: soft-delete, version-conflict, already-deleted idempotency
- [ ] `upsert_grocery_preset` / `delete_grocery_preset`: same shape as meal
- [ ] `upsert_weekly_plan`: get-or-create by `(household_id, week_start)`, id remap, version conflict, day_plans/preset replace semantics
- [ ] `delete_weekly_plan`: soft delete, version conflict
- [ ] `sync_grocery_item` / `sync_grocery_items`: insert, update with version check, conflict with full row, merge-on-name-collision, revive-tombstone overwrite semantics, batched multi-item behavior
- [ ] `pull_changes`: only rows updated after `p_since`, includes tombstones, null `p_since` full pull, nested shape matches `engine.ts` expectations
- [ ] End-to-end: `engine.ts`'s `sync()` against the PGlite backend — push, conflict, pull, Dexie convergence
