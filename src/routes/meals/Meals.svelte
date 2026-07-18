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

<div>
  <header class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <h1 class="m-0 mb-0.5 font-display text-[clamp(1.4rem,5vw+0.4rem,1.75rem)] font-bold tracking-[-0.015em] text-ink">{$_("meals.title")}</h1>
      <p class="m-0 text-sm text-ink-2">{$_("meals.subtitle")}</p>
    </div>
    <button
      type="button"
      onclick={() => (createMealOpen = true)}
      class="flex shrink-0 items-center gap-1.5 rounded-pill bg-accent px-3.5 py-2.5 text-[0.8125rem] font-semibold whitespace-nowrap text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[15px]">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {$_("meals.create")}
    </button>
  </header>

  <div class="relative my-4 mb-2">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none absolute top-1/2 left-3.5 size-[17px] -translate-y-1/2 text-ink-3">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
    <input
      type="search"
      placeholder={$_("meals.searchPlaceholder")}
      class="w-full rounded-input border border-rule bg-surface px-3.5 py-2.5 pl-10 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
      bind:value={meals.search}
    />
  </div>

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <select
      class="appearance-none rounded-pill border border-rule bg-surface bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23606b73%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[right_0.6rem_center] bg-no-repeat py-1.5 pr-[1.9rem] pl-3.5 font-body text-[0.8125rem] font-medium text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      value={meals.durationFilter}
      onchange={(e) => (meals.durationFilter = e.currentTarget.value as DurationTag | "all")}
    >
      {#each durationValues as value (value)}
        <option {value}>{$_(durationOptionKey(value))}</option>
      {/each}
    </select>

    {#each meals.allTags as tag (tag)}
      {@const active = meals.tagFilter === tag}
      <button
        type="button"
        aria-pressed={active}
        onclick={() => (meals.tagFilter = active ? null : tag)}
        class="shrink-0 rounded-pill px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition
          {active ? 'bg-accent-tint text-accent-deep' : 'border border-rule text-ink-2 hover:border-rule-strong hover:bg-paper-2'}"
      >
        {tag}
      </button>
    {/each}
  </div>

  {#if meals.filtered.length === 0}
    <p class="rounded-card border-[1.5px] border-dashed border-rule p-6 text-center text-sm text-ink-3">
      {$_("meals.noResults")}
    </p>
  {:else}
    <div>
      {#each meals.filtered as meal (meal.id)}
        <MealCard {meal} />
      {/each}
    </div>
  {/if}
</div>

<MealFormModal open={createMealOpen} onclose={() => (createMealOpen = false)} />
