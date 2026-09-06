<script lang="ts">
  import { _ } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import { meals } from "../stores/meals.svelte";
  import { INGREDIENT_CATEGORIES } from "../types";
  import type { IngredientCategory } from "../types";

  interface Props {
    onAdd: (ingredient: { name: string; category: IngredientCategory }) => void;
    autofocus?: boolean;
  }

  let { onAdd, autofocus = false }: Props = $props();

  function focusOnMount(node: HTMLInputElement) {
    if (autofocus) node.focus();
  }

  let query = $state("");
  let focused = $state(false);
  let showCategoryModal = $state(false);
  let pendingName = $state("");

  type KnownSuggestion = { name: string; category: IngredientCategory; isNew: false };
  type NewSuggestion = { name: string; category: null; isNew: true };
  type Suggestion = KnownSuggestion | NewSuggestion;

  const knownIngredients = $derived.by(() => {
    const combined = new Map<string, { name: string; category: IngredientCategory }>();

    // Built purely from ingredients already used in saved meals; first occurrence wins.
    for (const meal of meals.all) {
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase();
        if (!combined.has(key)) {
          combined.set(key, { name: ing.name, category: ing.category });
        }
      }
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
    use:focusOnMount
    class="w-full rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
    autocomplete="off"
  />

  {#if focused && suggestions.length > 0}
    <ul class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-input border border-rule bg-surface shadow-float">
      {#each suggestions as suggestion (suggestion.name)}
        <li>
          <button
            type="button"
            onmousedown={(e) => {
              e.preventDefault();
              selectSuggestion(suggestion);
            }}
            class={[
              "w-full px-3.5 py-2.5 text-left text-[0.9375rem] transition hover:bg-paper-2",
              suggestion.isNew ? "border-t border-rule font-semibold text-accent-deep" : "text-ink",
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
  <div class="flex flex-col gap-2">
    {#each INGREDIENT_CATEGORIES as category (category)}
      <button
        type="button"
        onclick={() => selectCategory(category)}
        class="w-full rounded-input border border-rule bg-surface px-4 py-3 text-left text-[0.9375rem] font-medium text-ink transition hover:border-accent hover:bg-accent-tint hover:text-accent-deep"
      >
        {$_(`grocery.category.${category}`)}
      </button>
    {/each}
  </div>
</Modal>
