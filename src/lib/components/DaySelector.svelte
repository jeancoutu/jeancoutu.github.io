<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { DayKey, MealSlot } from "../types";
  import { meals } from "../stores/meals.svelte";
  import { weeklyPlan } from "../stores/weeklyPlan.svelte";
  import { setGroceryItemsForWeek } from "../stores/groceryList.svelte";
  import { navigate } from "../utils/router.svelte";
  import { isToday } from "../utils/weekDates";
  import DayNoteModal from "./DayNoteModal.svelte";
  import Modal from "./Modal.svelte";

  interface Props {
    day: DayKey;
  }

  let { day }: Props = $props();

  const slots: MealSlot[] = ["diner", "supper"];

  let noteModalOpen = $state(false);
  let pickerSlot = $state<MealSlot | null>(null);
  let pickerQuery = $state("");

  let today = $derived(isToday(weeklyPlan.selectedWeek, day));

  let sortedMeals = $derived(
    [...meals.all].sort((a, b) => a.name.localeCompare(b.name)),
  );

  let filteredMeals = $derived(
    pickerQuery.trim()
      ? sortedMeals.filter((m) => m.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
      : sortedMeals,
  );

  function mealName(id: string | undefined): string | undefined {
    if (!id) return undefined;
    return meals.all.find((m) => m.id === id)?.name;
  }

  function openPicker(slot: MealSlot) {
    pickerQuery = "";
    pickerSlot = slot;
  }

  async function selectMeal(mealId: string | undefined) {
    const slot = pickerSlot;
    if (!slot) return;
    const updatedGroceries = await weeklyPlan.setDay(day, slot, mealId);
    if (updatedGroceries !== null) {
      setGroceryItemsForWeek(weeklyPlan.selectedWeek, updatedGroceries);
    }
    pickerSlot = null;
  }

  function viewRecipe(mealId: string) {
    navigate(`/meal/${encodeURIComponent(mealId)}`);
  }
</script>

<section class="border-b border-rule py-4 first:pt-0">
  <div class="mb-2 flex items-center justify-between gap-2">
    <span class="flex min-w-0 items-baseline gap-2 font-display text-base font-semibold [overflow-wrap:anywhere] {today ? 'text-accent-deep' : 'text-ink'}">
      {$_(`day.${day}`)}
      {#if today}
        <span class="shrink-0 rounded-pill bg-accent-tint-2 px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-accent-deep uppercase tracking-wide">
          {$_("planner.today")}
        </span>
      {/if}
    </span>
    <button
      type="button"
      onclick={() => (noteModalOpen = true)}
      class="flex size-8 shrink-0 items-center justify-center rounded-icon transition
        {weeklyPlan.current[day]?.note
        ? 'text-accent-deep hover:bg-accent-tint'
        : 'text-ink-3 hover:bg-paper-2 hover:text-ink'}"
      title={weeklyPlan.current[day]?.note ? $_("planner.note.edit") : $_("planner.note.add")}
      aria-label={weeklyPlan.current[day]?.note ? $_("planner.note.edit") : $_("planner.note.add")}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[15px]" aria-hidden="true">
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
  </div>

  <div>
    {#each slots as slot (slot)}
      {@const mealId = weeklyPlan.current[day]?.[slot]}
      {@const name = mealName(mealId)}
      <div class="-mx-2 flex items-center gap-2">
        <button
          type="button"
          onclick={() => openPicker(slot)}
          class="flex min-w-0 flex-1 items-center gap-2 rounded-input px-2 py-2.5 text-left transition hover:bg-surface active:bg-paper-2
            {!name ? 'border-[1.5px] border-dashed border-rule-strong text-ink-3 hover:border-accent hover:bg-accent-tint hover:text-accent-deep' : ''}"
        >
          <span class="flex size-8 shrink-0 items-center justify-center rounded-icon bg-paper-2 text-ink-2">
            {#if slot === "diner"}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
                <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />
              </svg>
            {/if}
          </span>
          <span class="min-w-0 flex-1">
            <p class="m-0 text-[0.6875rem] tracking-wide text-ink-3 uppercase">{$_(`slot.${slot}`)}</p>
            <p class="m-0 truncate text-[0.9375rem] font-medium {name ? 'text-ink' : ''}">
              {name ?? $_("planner.pickMeal.emptySlot")}
            </p>
          </span>
        </button>
        {#if name && mealId}
          <button
            type="button"
            onclick={() => viewRecipe(mealId)}
            class="flex size-8 shrink-0 items-center justify-center text-ink-3 transition hover:text-ink"
            title={$_("mealCard.viewRecipe")}
            aria-label={$_("mealCard.viewRecipe")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        {/if}
      </div>
    {/each}
    {#if weeklyPlan.current[day]?.note}
      <p class="mt-2 text-xs whitespace-pre-wrap text-ink-3 italic">{weeklyPlan.current[day]?.note}</p>
    {/if}
  </div>
</section>

<DayNoteModal
  open={noteModalOpen}
  {day}
  note={weeklyPlan.current[day]?.note}
  onclose={() => (noteModalOpen = false)}
  onsave={(value) => weeklyPlan.setDayNote(day, value)}
/>

<Modal
  open={pickerSlot !== null}
  title={$_("planner.pickMeal.title")}
  onclose={() => (pickerSlot = null)}
>
  <div class="relative mb-3">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none absolute top-1/2 left-3.5 size-[17px] -translate-y-1/2 text-ink-3">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
    <input
      type="text"
      bind:value={pickerQuery}
      placeholder={$_("planner.pickMeal.searchPlaceholder")}
      class="w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 pl-10 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
    />
  </div>
  <div class="-mx-4">
    {#if pickerSlot && weeklyPlan.current[day]?.[pickerSlot] && !pickerQuery.trim()}
      <button
        type="button"
        onclick={() => selectMeal(undefined)}
        class="flex w-full items-center gap-2 border-b border-rule px-4 py-3 text-left font-body text-[0.9375rem] text-danger transition hover:bg-danger-tint"
      >
        {$_("planner.pickMeal.clear")}
      </button>
    {/if}
    {#if filteredMeals.length === 0}
      <p class="px-4 py-6 text-center text-sm text-ink-3">{$_("planner.pickMeal.empty")}</p>
    {:else}
      {#each filteredMeals as meal (meal.id)}
        {@const selected = pickerSlot && weeklyPlan.current[day]?.[pickerSlot] === meal.id}
        <button
          type="button"
          onclick={() => selectMeal(meal.id)}
          class="flex w-full items-center justify-between gap-2 border-b border-rule px-4 py-3 text-left font-body text-[0.9375rem] text-ink transition last:border-b-0 hover:bg-paper-2
            {selected ? 'bg-accent-tint font-semibold text-accent-deep hover:bg-accent-tint-2' : ''}"
        >
          <span>{meal.name}</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 {selected ? '' : 'invisible'}">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      {/each}
    {/if}
  </div>
</Modal>
