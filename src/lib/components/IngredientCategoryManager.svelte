<script lang="ts">
  import { _ } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import { meals, recategorizeIngredientEverywhere } from "../stores/meals.svelte";
  import { INGREDIENT_CATEGORIES } from "../types";
  import type { IngredientCategory } from "../types";
  import { syncStatus } from "../sync/status.svelte";
  import { showToast } from "../stores/toast.svelte";

  // This screen is a live projection over meals[].ingredients — there is no
  // persistent ingredient→category table (see ingredient-recategorize-plan.md).
  // Picking a category calls the server-authoritative recategorize_ingredient
  // RPC, which rewrites the category in every meal that uses the name.
  // grocery_items.category is intentionally left stale here; a meal-derived
  // grocery row still renders under the right aisle (groceryDisplay.ts takes
  // the category from the meal-plan projection), and orphaned rows are cleaned
  // by the next "clear week" / regenerate.

  type Row = {
    /** First-seen display spelling. */
    name: string;
    /** name.trim().toLowerCase() — the recategorize match key. */
    key: string;
    /** Majority category across the meals using this name (ties: INGREDIENT_CATEGORIES order). */
    category: IngredientCategory;
    /** True when the name's meals disagree on a category. */
    mixed: boolean;
    /** Names of the meals using this ingredient, sorted fr-locale. */
    mealNames: string[];
  };

  const rows = $derived.by<Row[]>(() => {
    const mealNameById = new Map(meals.all.map((m) => [m.id, m.name]));
    const groups = new Map<
      string,
      { name: string; mealIds: Set<string>; tally: Map<IngredientCategory, number> }
    >();

    for (const meal of meals.all) {
      for (const ing of meal.ingredients) {
        const key = ing.name.trim().toLowerCase();
        if (!key) continue;
        let group = groups.get(key);
        if (!group) {
          group = { name: ing.name.trim(), mealIds: new Set(), tally: new Map() };
          groups.set(key, group);
        }
        group.mealIds.add(meal.id);
        group.tally.set(ing.category, (group.tally.get(ing.category) ?? 0) + 1);
      }
    }

    const result: Row[] = [];
    for (const [key, group] of groups) {
      let majority: IngredientCategory = INGREDIENT_CATEGORIES[0]!;
      let best = -1;
      for (const category of INGREDIENT_CATEGORIES) {
        const count = group.tally.get(category) ?? 0;
        if (count > best) {
          best = count;
          majority = category;
        }
      }
      const mealNames = [...group.mealIds]
        .map((id) => mealNameById.get(id)?.trim())
        .filter((n): n is string => !!n)
        .sort((a, b) => a.localeCompare(b, "fr"));
      result.push({
        name: group.name,
        key,
        category: majority,
        mixed: group.tally.size > 1,
        mealNames,
      });
    }
    result.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return result;
  });

  let activeRow = $state<Row | null>(null);
  let busyKey = $state<string | null>(null);

  function openPicker(row: Row) {
    if (!syncStatus.online || busyKey) return;
    activeRow = row;
  }

  async function pick(category: IngredientCategory) {
    const row = activeRow;
    activeRow = null;
    if (!row) return;
    busyKey = row.key;
    try {
      const result = await recategorizeIngredientEverywhere(row.name, category);
      showToast($_("ingredients.recategorized", { values: { n: result.updated_meal_count } }));
    } catch {
      showToast($_("ingredients.error"));
    } finally {
      busyKey = null;
    }
  }
</script>

<div>
  <header class="mb-4">
    <h1 class="m-0 mb-1 font-display text-[clamp(1.4rem,5vw+0.4rem,1.75rem)] font-bold tracking-[-0.015em] text-ink">
      {$_("ingredients.title")}
    </h1>
    {#if !syncStatus.online}
      <p class="m-0 text-sm leading-[1.45] text-ink-3">{$_("ingredients.offline")}</p>
    {/if}
  </header>

  {#if rows.length === 0}
    <p class="rounded-card border-[1.5px] border-dashed border-rule p-6 text-center text-sm text-ink-3">
      {$_("ingredients.empty")}
    </p>
  {:else}
    <div>
      {#each rows as row (row.key)}
        <button
          type="button"
          onclick={() => openPicker(row)}
          disabled={!syncStatus.online || busyKey !== null}
          class="flex w-full items-center gap-3 border-b border-rule py-[0.85rem] text-left transition last:border-b-0 hover:bg-paper-2 disabled:pointer-events-none disabled:opacity-60"
        >
          <span class="min-w-0 flex-1">
            <span class="mb-0.5 block truncate text-[0.9375rem] font-semibold text-ink">{row.name}</span>
            <span class="line-clamp-2 text-[0.8125rem] leading-[1.4] text-ink-2">
              {row.mealNames.join(", ")}
            </span>
          </span>
          {#if busyKey === row.key}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              class="size-4 shrink-0 animate-spin text-ink-3"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          {:else}
            {#if row.mixed}
              <span class="shrink-0 rounded-pill bg-paper-2 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-ink-3 uppercase">
                {$_("ingredients.mixed")}
              </span>
            {/if}
            <span class="shrink-0 text-[0.8125rem] font-medium text-ink-2">
              {$_(`grocery.category.${row.category}`)}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<Modal
  open={activeRow !== null}
  title={$_("ingredients.chooseCategory")}
  onclose={() => (activeRow = null)}
>
  <div class="flex flex-col gap-2">
    {#each INGREDIENT_CATEGORIES as category (category)}
      <button
        type="button"
        onclick={() => pick(category)}
        class="w-full rounded-input border border-rule bg-surface px-4 py-3 text-left text-[0.9375rem] font-medium text-ink transition hover:border-accent hover:bg-accent-tint hover:text-accent-deep"
      >
        {$_(`grocery.category.${category}`)}
      </button>
    {/each}
  </div>
</Modal>
