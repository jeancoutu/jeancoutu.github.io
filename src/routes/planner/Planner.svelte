<script lang="ts">
  import { DAYS } from "../../lib/types";
  import DaySelector from "../../lib/components/DaySelector.svelte";
  import IngredientSummary from "../../lib/components/IngredientSummary.svelte";
  import { weeklyPlan } from "../../lib/stores/weeklyPlan";
  import { buildPlannerShareUrl } from "../../lib/utils/planShare";

  let shareMessage = $state("");

  async function shareWeek() {
    const url = buildPlannerShareUrl(weeklyPlan.getSnapshot());
    shareMessage = "";

    if (navigator.share) {
      try {
        await navigator.share({ title: "Weekly meal plan", url });
        shareMessage = "Shared!";
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      shareMessage = "Link copied!";
    } catch {
      shareMessage = "Could not copy link.";
    }
  }
</script>

<div class="space-y-4">
  <header>
    <h1 class="text-2xl font-bold text-slate-900">Weekly Planner</h1>
  </header>

  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      onclick={() => weeklyPlan.autoFillWeek()}
      class="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700"
    >
      Auto Fill Week
    </button>
    <button
      type="button"
      onclick={() => weeklyPlan.clearWeek()}
      class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
    >
      Clear Week
    </button>
    <button
      type="button"
      onclick={shareWeek}
      class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
    >
      Share Week
    </button>
    {#if shareMessage}
      <span class="text-sm text-slate-600" role="status">{shareMessage}</span>
    {/if}
  </div>

  <div class="space-y-3">
    {#each DAYS as day}
      <DaySelector day={day.key} label={day.label} />
    {/each}
  </div>

  <IngredientSummary />
</div>
