<script lang="ts">
  import DurationBadge from "../../../lib/components/DurationBadge.svelte";
  import { getMealById } from "../../../lib/stores/meals";
  import { navigate } from "../../../lib/utils/router";
  import { durationLabel } from "../../../lib/utils/duration";

  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  let meal = $derived(getMealById(id));

  function goBack() {
    navigate("/meals");
  }
</script>

{#if !meal}
  <div class="space-y-4 text-center">
    <p class="text-slate-600">Meal not found.</p>
    <button
      type="button"
      onclick={goBack}
      class="text-sm font-medium text-orange-600 hover:text-orange-700"
    >
      ← Back to Meals
    </button>
  </div>
{:else}
  <div class="space-y-6">
    <button
      type="button"
      onclick={goBack}
      class="text-sm font-medium text-orange-600 hover:text-orange-700"
    >
      ← Back to Meals
    </button>

    <header>
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-bold text-slate-900">{meal.name}</h1>
        <DurationBadge duration={meal.duration} />
      </div>
      <p class="mt-2 text-sm text-slate-600">
        Duration: {durationLabel(meal.duration)}
      </p>
    </header>

    <section>
      <h2 class="mb-2 text-lg font-semibold text-slate-900">Ingredients</h2>
      <ul class="space-y-1 rounded-xl border border-slate-200 bg-white p-4">
        {#each meal.ingredients as ingredient}
          <li class="text-sm text-slate-700">
            – {ingredient.quantity}
            {ingredient.name}
          </li>
        {/each}
      </ul>
    </section>

    <section>
      <h2 class="mb-2 text-lg font-semibold text-slate-900">Instructions</h2>
      <ol class="list-decimal space-y-2 rounded-xl border border-slate-200 bg-white p-4 pl-8">
        {#each meal.instructions as step, i}
          <li class="text-sm text-slate-700">
            <span class="sr-only">Step {i + 1}:</span>
            {step}
          </li>
        {/each}
      </ol>
    </section>
  </div>
{/if}
