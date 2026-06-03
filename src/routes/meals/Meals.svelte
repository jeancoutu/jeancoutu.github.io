<script lang="ts">
  import type { DurationTag } from "../../lib/types";
  import MealCard from "../../lib/components/MealCard.svelte";
  import {
    filteredMeals,
    mealSearch,
    durationFilter,
  } from "../../lib/stores/meals";

  const durationOptions: { value: DurationTag | "all"; label: string }[] = [
    { value: "all", label: "All durations" },
    { value: "short", label: "Short" },
    { value: "medium", label: "Medium" },
    { value: "long", label: "Long" },
  ];
</script>

<div class="space-y-4">
  <header>
    <h1 class="text-2xl font-bold text-slate-900">Meals</h1>
    <p class="mt-1 text-sm text-slate-600">Browse and search available meals.</p>
  </header>

  <div class="space-y-3">
    <input
      type="search"
      placeholder="Search meals by name…"
      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      bind:value={$mealSearch}
    />

    <select
      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      bind:value={$durationFilter}
    >
      {#each durationOptions as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  {#if $filteredMeals.length === 0}
    <p class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      No meals match your search.
    </p>
  {:else}
    <div class="space-y-3">
      {#each $filteredMeals as meal (meal.id)}
        <MealCard {meal} />
      {/each}
    </div>
  {/if}
</div>
