<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { DayKey, MealSlot } from "../types";
  import { meals } from "../stores/meals.svelte";
  import { weeklyPlan } from "../stores/weeklyPlan.svelte";
  import { setGroceryItemsForWeek } from "../stores/groceryList.svelte";
  import { navigate } from "../utils/router.svelte";
  import DayNoteModal from "./DayNoteModal.svelte";

  interface Props {
    day: DayKey;
  }

  let { day }: Props = $props();

  const slots: MealSlot[] = ["diner", "supper"];

  let noteModalOpen = $state(false);

  let sortedMeals = $derived(
    [...meals.all].sort((a, b) => a.name.localeCompare(b.name)),
  );

  async function onChange(slot: MealSlot, e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    const updatedGroceries = await weeklyPlan.setDay(day, slot, value || undefined);
    if (updatedGroceries !== null) {
      setGroceryItemsForWeek(weeklyPlan.selectedWeek, updatedGroceries);
    }
  }

  function viewRecipe(mealId: string) {
    navigate(`/meal/${encodeURIComponent(mealId)}`);
  }
</script>

<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <div class="mb-3 flex items-center gap-2">
    <p class="text-sm font-semibold text-slate-900">{$_(`day.${day}`)}</p>
    <button
      type="button"
      onclick={() => (noteModalOpen = true)}
      class="flex size-6 shrink-0 items-center justify-center rounded-md transition
        {weeklyPlan.current[day]?.note
        ? 'bg-orange-500 text-white hover:bg-orange-600'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}"
      title={weeklyPlan.current[day]?.note ? $_("planner.note.edit") : $_("planner.note.add")}
      aria-label={weeklyPlan.current[day]?.note ? $_("planner.note.edit") : $_("planner.note.add")}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-3.5" aria-hidden="true">
        <path d="M14.688 3.312a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414L8.414 15.586a1 1 0 0 1-.39.242l-3.5 1.166a.5.5 0 0 1-.632-.633l1.166-3.5a1 1 0 0 1 .242-.39l9.274-9.273a1 1 0 0 1 .414-.293Z" />
      </svg>
    </button>
  </div>
  <div class="space-y-3">
    {#each slots as slot}
      <label class="block" for="day-{day}-{slot}">
        <span class="mb-1 block text-xs font-medium text-slate-600">{$_(`slot.${slot}`)}</span>
        <div class="flex gap-2">
          <select
            id="day-{day}-{slot}"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            value={weeklyPlan.current[day]?.[slot] ?? ""}
            onchange={(e) => onChange(slot, e)}
          >
            <option value="">{$_("slot.selectMeal")}</option>
            {#each sortedMeals as meal}
              <option value={meal.id}>{meal.name}</option>
            {/each}
          </select>
          {#if weeklyPlan.current[day]?.[slot]}
            <button
              type="button"
              onclick={() => viewRecipe(weeklyPlan.current[day]?.[slot] as string)}
              class="flex size-[46px] shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
              title={$_("mealCard.viewRecipe")}
              aria-label={$_("mealCard.viewRecipe")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true">
                <path d="M10 3.5c-4.29 0-7.86 2.64-9.32 6.34a.75.75 0 0 0 0 .32C2.14 13.86 5.71 16.5 10 16.5s7.86-2.64 9.32-6.34a.75.75 0 0 0 0-.32C17.86 6.14 14.29 3.5 10 3.5Zm0 11a4.17 4.17 0 1 1 0-8.34 4.17 4.17 0 0 1 0 8.34Z" />
                <path d="M10 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
              </svg>
            </button>
          {/if}
        </div>
      </label>
    {/each}
    {#if weeklyPlan.current[day]?.note}
      <p class="whitespace-pre-wrap text-xs italic text-slate-500">{weeklyPlan.current[day]?.note}</p>
    {/if}
  </div>
</div>

<DayNoteModal
  open={noteModalOpen}
  {day}
  note={weeklyPlan.current[day]?.note}
  onclose={() => (noteModalOpen = false)}
  onsave={(value) => weeklyPlan.setDayNote(day, value)}
/>
