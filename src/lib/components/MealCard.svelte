<script lang="ts">
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

<button
  type="button"
  onclick={viewRecipe}
  class="flex w-full items-center gap-3 rounded-input border-b border-rule px-1 py-[0.85rem] text-left transition last:border-b-0 hover:bg-paper-2 active:bg-accent-tint"
>
  <span class="min-w-0 flex-1">
    <p class="m-0 mb-1 [overflow-wrap:anywhere] font-body text-[0.9375rem] font-semibold text-ink">{meal.name}</p>
    <span class="flex flex-wrap items-center gap-1.5">
      <DurationBadge duration={meal.duration} />
      {#each meal.tags as tag (tag)}
        <span class="rounded-pill bg-paper-2 px-2 py-0.5 text-[0.6875rem] text-ink-3">{tag}</span>
      {/each}
    </span>
  </span>
  <span class="shrink-0 text-ink-3">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[17px]">
      <path d="M9 6l6 6-6 6" />
    </svg>
  </span>
</button>
