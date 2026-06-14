<script lang="ts">
  import { _ } from "svelte-i18n";
  import DurationBadge from "../../../lib/components/DurationBadge.svelte";
  import MealFormModal from "../../../lib/components/MealFormModal.svelte";
  import { allMeals } from "../../../lib/stores/meals";
  import { navigate } from "../../../lib/utils/router";

  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  let meals = $derived($allMeals);
  let meal = $derived(meals.find((candidate) => candidate.id === id));
  let editMealOpen = $state(false);

  function goBack() {
    navigate("/meals");
  }
</script>

{#if !meal}
  <div class="space-y-4 text-center">
    <p class="text-slate-600">{$_("mealDetail.notFound")}</p>
    <button
      type="button"
      onclick={goBack}
      class="text-sm font-medium text-orange-600 hover:text-orange-700"
    >
      {$_("mealDetail.back")}
    </button>
  </div>
{:else}
  <div class="space-y-6">
    <button
      type="button"
      onclick={goBack}
      class="text-sm font-medium text-orange-600 hover:text-orange-700"
    >
      {$_("mealDetail.back")}
    </button>

    <header>
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-bold text-slate-900">{meal.name}</h1>
        <DurationBadge duration={meal.duration} />
        <button
          type="button"
          onclick={() => (editMealOpen = true)}
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
        >
          {$_("mealDetail.edit")}
        </button>
      </div>
      <p class="mt-2 text-sm text-slate-600">
        {$_("duration.label")} {$_("duration." + meal.duration)}
      </p>
      {#if meal.url}
        <a
          href={meal.url}
          target="_blank"
          rel="noopener noreferrer"
          class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          {$_("mealDetail.viewGuide")}
          <span aria-hidden="true">↗</span>
        </a>
      {/if}
    </header>

    <section>
      <h2 class="mb-2 text-lg font-semibold text-slate-900">{$_("mealDetail.ingredients")}</h2>
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
      <h2 class="mb-2 text-lg font-semibold text-slate-900">{$_("mealDetail.instructions")}</h2>
      <ol class="list-decimal space-y-2 rounded-xl border border-slate-200 bg-white p-4 pl-8">
        {#each meal.instructions as step, i}
          <li class="text-sm text-slate-700">
            <span class="sr-only">{$_("mealDetail.step", { values: { n: i + 1 } })}</span>
            {step}
          </li>
        {/each}
      </ol>
    </section>
  </div>
{/if}

<MealFormModal
  open={editMealOpen}
  meal={meal}
  onclose={() => (editMealOpen = false)}
/>
