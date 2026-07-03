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
  <button
    type="button"
    onclick={viewRecipe}
    class="mt-4 w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700"
  >
    {$_("mealCard.viewRecipe")}
  </button>
</article>
