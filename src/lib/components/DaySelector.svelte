<script lang="ts">
  import type { DayKey } from "../types";
  import { meals } from "../../data/meals";
  import { weeklyPlan } from "../stores/weeklyPlan";

  interface Props {
    day: DayKey;
    label: string;
  }

  let { day, label }: Props = $props();

  function onChange(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    weeklyPlan.setDay(day, value || undefined);
  }
</script>

<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <label class="mb-2 block text-sm font-semibold text-slate-900" for="day-{day}">
    {label}
  </label>
  <select
    id="day-{day}"
    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
    value={$weeklyPlan[day] ?? ""}
    onchange={onChange}
  >
    <option value="">— Select a meal —</option>
    {#each meals as meal}
      <option value={meal.id}>{meal.name}</option>
    {/each}
  </select>
</div>
