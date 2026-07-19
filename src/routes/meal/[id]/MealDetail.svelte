<script lang="ts">
  import { _ } from "svelte-i18n";
  import DurationBadge from "../../../lib/components/DurationBadge.svelte";
  import MealFormModal from "../../../lib/components/MealFormModal.svelte";
  import { meals } from "../../../lib/stores/meals.svelte";
  import { navigate, hasNavigatedInApp } from "../../../lib/utils/router.svelte";
  import { groupIngredientsBySection } from "../../../lib/utils/ingredientSections";

  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  let meal = $derived(meals.all.find((candidate) => candidate.id === id));
  let ingredientSections = $derived(meal ? groupIngredientsBySection(meal.ingredients) : []);
  let editMealOpen = $state(false);
  let duplicateMealOpen = $state(false);

  function goBack() {
    if (hasNavigatedInApp()) {
      window.history.back();
    } else {
      navigate("/meals");
    }
  }
</script>

{#if !meal}
  <div class="space-y-4 text-center">
    <p class="text-ink-2">{$_("mealDetail.notFound")}</p>
    <button
      type="button"
      onclick={goBack}
      class="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-deep hover:underline"
    >
      {$_("mealDetail.back")}
    </button>
  </div>
{:else}
  <div>
    <button
      type="button"
      onclick={goBack}
      class="group mb-4 inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-accent-deep"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="size-[15px] transition-transform group-hover:-translate-x-0.5">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {$_("mealDetail.back")}
    </button>

    <header class="mb-2">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <h1 class="min-w-0 [overflow-wrap:anywhere] font-display text-[clamp(1.5rem,6vw+0.4rem,1.875rem)] font-bold tracking-[-0.015em] text-ink">{meal.name}</h1>
        <DurationBadge duration={meal.duration} />
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onclick={() => (editMealOpen = true)}
          class="flex flex-1 items-center justify-center gap-1.5 rounded-pill border border-rule px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper-2 hover:border-rule-strong"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[15px]">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          {$_("mealDetail.edit")}
        </button>
        <button
          type="button"
          onclick={() => (duplicateMealOpen = true)}
          class="flex flex-1 items-center justify-center gap-1.5 rounded-pill border border-rule px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper-2 hover:border-rule-strong"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[15px]">
            <rect x="8" y="8" width="13" height="13" rx="2" />
            <path d="M4 16V4a2 2 0 0 1 2-2h12" />
          </svg>
          {$_("mealDetail.duplicate")}
        </button>
      </div>
      {#if meal.tags.length > 0}
        <div class="mb-3 flex flex-wrap gap-1.5">
          {#each meal.tags as tag (tag)}
            <span class="rounded-pill bg-paper-2 px-2.5 py-1 text-xs font-medium text-ink-3">{tag}</span>
          {/each}
        </div>
      {/if}
      {#if meal.url}
        <a
          href={meal.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-deep hover:underline"
        >
          {$_("mealDetail.viewGuide")}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[13px]" aria-hidden="true">
            <path d="M7 17L17 7M7 7h10v10" />
          </svg>
        </a>
      {/if}
    </header>

    <section>
      <h2 class="mb-2 font-body text-[0.8125rem] font-bold tracking-[0.03em] text-ink-2 uppercase">{$_("mealDetail.ingredients")}</h2>
      <div class="mb-6 flex flex-col gap-4 rounded-card border border-rule bg-surface p-4">
        {#each ingredientSections as block (block.section ?? "__unlabeled")}
          <div>
            {#if block.section}
              <h3 class="mb-1.5 font-body text-[0.75rem] font-bold tracking-[0.03em] text-ink-3 uppercase">{block.section}</h3>
            {/if}
            <ul class="flex list-none flex-col gap-2.5">
              {#each block.ingredients as ingredient, i (i)}
                <li class="flex items-baseline gap-2.5 text-[0.9375rem] text-ink">
                  <span class="mt-2 size-[5px] shrink-0 self-start rounded-full bg-accent"></span>
                  <span><span class="tabular-nums">{ingredient.quantity}</span> {ingredient.name}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </section>

    <section>
      <h2 class="mb-2 font-body text-[0.8125rem] font-bold tracking-[0.03em] text-ink-2 uppercase">{$_("mealDetail.instructions")}</h2>
      <ol class="flex list-none flex-col gap-3 rounded-card border border-rule bg-surface p-4">
        {#each meal.instructions as step, i (i)}
          <li class="flex gap-3 text-[0.9375rem] leading-relaxed text-ink">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[0.8125rem] font-bold text-accent-deep">{i + 1}</span>
            <span>{step}</span>
          </li>
        {/each}
      </ol>
    </section>
  </div>
{/if}

{#if (editMealOpen || duplicateMealOpen) && meal}
  {#key (editMealOpen ? "edit-" : "dup-") + meal.id}
    <MealFormModal
      open={true}
      meal={editMealOpen ? meal : undefined}
      duplicateOf={duplicateMealOpen ? meal : undefined}
      onclose={() => {
        editMealOpen = false;
        duplicateMealOpen = false;
      }}
    />
  {/key}
{/if}
