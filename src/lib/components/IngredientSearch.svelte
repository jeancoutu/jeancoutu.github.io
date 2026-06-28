<script lang="ts">
  import { _ } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import { allMeals } from "../stores/meals";
  import { ingredientCategories } from "../../data/ingredientCategories";
  import { INGREDIENT_CATEGORIES } from "../types";
  import type { IngredientCategory } from "../types";

  interface Props {
    onAdd: (ingredient: { name: string; category: IngredientCategory }) => void;
  }

  let { onAdd }: Props = $props();

  let query = $state("");
  let focused = $state(false);
  let showCategoryModal = $state(false);
  let pendingName = $state("");

  type KnownSuggestion = { name: string; category: IngredientCategory; isNew: false };
  type NewSuggestion = { name: string; category: null; isNew: true };
  type Suggestion = KnownSuggestion | NewSuggestion;

  const knownIngredients = $derived.by(() => {
    const combined = new Map<string, { name: string; category: IngredientCategory }>();

    // allMeals first (lower priority — can be overwritten by dict)
    for (const meal of $allMeals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase();
        if (!combined.has(key)) {
          combined.set(key, { name: ing.name, category: ing.category });
        }
      }
    }

    // Static dict overwrites (higher priority)
    for (const [name, category] of Object.entries(ingredientCategories)) {
      combined.set(name.toLowerCase(), { name, category: category as IngredientCategory });
    }

    return combined;
  });

  const suggestions = $derived.by<Suggestion[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const q = trimmed.toLowerCase();
    const matches: KnownSuggestion[] = [];

    for (const [key, entry] of knownIngredients) {
      if (key.includes(q)) {
        matches.push({ name: entry.name, category: entry.category, isNew: false });
      }
    }

    matches.sort((a, b) => a.name.localeCompare(b.name));

    return [...matches, { name: trimmed, category: null, isNew: true }];
  });

  function selectSuggestion(suggestion: Suggestion) {
    if (suggestion.isNew) {
      pendingName = query.trim();
      showCategoryModal = true;
    } else {
      onAdd({ name: suggestion.name, category: suggestion.category });
      query = "";
    }
  }

  function selectCategory(category: IngredientCategory) {
    onAdd({ name: pendingName, category });
    showCategoryModal = false;
    query = "";
    pendingName = "";
  }
</script>

<div class="relative">
  <input
    type="text"
    bind:value={query}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
    placeholder={$_("meals.create.ingredientSearch.placeholder")}
    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
    autocomplete="off"
  />

  {#if focused && suggestions.length > 0}
    <ul class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
      {#each suggestions as suggestion}
        <li>
          <button
            type="button"
            onmousedown={(e) => {
              e.preventDefault();
              selectSuggestion(suggestion);
            }}
            class={[
              "w-full px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 active:bg-slate-100",
              suggestion.isNew ? "border-t border-slate-100 text-orange-600 font-medium" : "text-slate-800",
            ].join(" ")}
          >
            {#if suggestion.isNew}
              {$_("meals.create.ingredientSearch.createNew", { values: { name: suggestion.name } })}
            {:else}
              {suggestion.name}
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<Modal
  open={showCategoryModal}
  title={$_("meals.create.ingredientSearch.categoryTitle")}
  onclose={() => (showCategoryModal = false)}
>
  <div class="grid grid-cols-1 gap-2">
    {#each INGREDIENT_CATEGORIES as category}
      <button
        type="button"
        onclick={() => selectCategory(category)}
        class="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 active:bg-orange-100"
      >
        {$_(`grocery.category.${category}`)}
      </button>
    {/each}
  </div>
</Modal>
