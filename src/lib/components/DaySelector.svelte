<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { DayKey, MealSlot } from "../types";
  import { allMeals } from "../stores/meals";
  import { weeklyPlan } from "../stores/weeklyPlan";

  interface Props {
    day: DayKey;
  }

  let { day }: Props = $props();

  const slots: MealSlot[] = ["diner", "supper"];

  function onChange(slot: MealSlot, e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    weeklyPlan.setDay(day, slot, value || undefined);
  }
</script>

<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <p class="mb-3 text-sm font-semibold text-slate-900">{$_(`day.${day}`)}</p>
  <div class="space-y-3">
    {#each slots as slot}
      <label class="block" for="day-{day}-{slot}">
        <span class="mb-1 block text-xs font-medium text-slate-600">{$_(`slot.${slot}`)}</span>
        <select
          id="day-{day}-{slot}"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          value={$weeklyPlan[day]?.[slot] ?? ""}
          onchange={(e) => onChange(slot, e)}
        >
          <option value="">{$_("slot.selectMeal")}</option>
          {#each $allMeals as meal}
            <option value={meal.id}>{meal.name}</option>
          {/each}
        </select>
      </label>
    {/each}
  </div>
</div>
