<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { DurationTag } from "../../lib/types";
  import MealCard from "../../lib/components/MealCard.svelte";
  import MealFormModal from "../../lib/components/MealFormModal.svelte";
  import { meals } from "../../lib/stores/meals.svelte";

  const durationValues: (DurationTag | "all")[] = ["all", "short", "medium", "long"];

  let createMealOpen = $state(false);

  function durationOptionKey(value: DurationTag | "all"): string {
    return value === "all" ? "duration.all" : `duration.${value}`;
  }
</script>

<div class="space-y-4">
  <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{$_("meals.title")}</h1>
      <p class="mt-1 text-sm text-slate-600">{$_("meals.subtitle")}</p>
    </div>
    <button
      type="button"
      onclick={() => (createMealOpen = true)}
      class="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700"
    >
      {$_("meals.create")}
    </button>
  </header>

  <div class="space-y-3">
    <input
      type="search"
      placeholder={$_("meals.searchPlaceholder")}
      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      bind:value={meals.search}
    />

    <select
      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      value={meals.durationFilter}
      onchange={(e) => (meals.durationFilter = e.currentTarget.value as DurationTag | "all")}
    >
      {#each durationValues as value}
        <option {value}>{$_(durationOptionKey(value))}</option>
      {/each}
    </select>

    {#if meals.allTags.length > 0}
      <div class="flex gap-2 overflow-x-auto pb-1">
        {#each meals.allTags as tag (tag)}
          <button
            type="button"
            aria-pressed={meals.tagFilter === tag}
            onclick={() => (meals.tagFilter = meals.tagFilter === tag ? null : tag)}
            class={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
              meals.tagFilter === tag
                ? "bg-orange-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tag}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if meals.filtered.length === 0}
    <p class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {$_("meals.noResults")}
    </p>
  {:else}
    <div class="space-y-3">
      {#each meals.filtered as meal (meal.id)}
        <MealCard {meal} />
      {/each}
    </div>
  {/if}
</div>

{#if createMealOpen}
  <MealFormModal open={true} onclose={() => (createMealOpen = false)} />
{/if}
