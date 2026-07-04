<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { DayKey, MealSlot } from "../types";
  import { meals } from "../stores/meals.svelte";
  import { weeklyPlan } from "../stores/weeklyPlan.svelte";
  import { setGroceryItemsForWeek } from "../stores/groceryList.svelte";
  import { navigate } from "../utils/router.svelte";

  interface Props {
    day: DayKey;
  }

  let { day }: Props = $props();

  const slots: MealSlot[] = ["diner", "supper"];

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
  <p class="mb-3 text-sm font-semibold text-slate-900">{$_(`day.${day}`)}</p>
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
  </div>
</div>
