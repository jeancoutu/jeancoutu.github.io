<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { Meal } from "../types";
  import DurationBadge from "./DurationBadge.svelte";
  import { navigate } from "../utils/router.svelte";

  interface Props {
    meal: Meal;
  }

  let { meal }: Props = $props();

  function viewRecipe() {
    navigate(`/meal/${encodeURIComponent(meal.id)}`);
  }
</script>

<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <div class="flex items-start justify-between gap-2">
    <h2 class="text-lg font-semibold text-slate-900">{meal.name}</h2>
    <DurationBadge duration={meal.duration} />
  </div>
  {#if meal.tags.length > 0}
    <div class="mt-2 flex flex-wrap gap-1.5">
      {#each meal.tags as tag (tag)}
        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{tag}</span>
      {/each}
    </div>
  {/if}
  <button
    type="button"
    onclick={viewRecipe}
    class="mt-4 w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700"
  >
    {$_("mealCard.viewRecipe")}
  </button>
</article>
