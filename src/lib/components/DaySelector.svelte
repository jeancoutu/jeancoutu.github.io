<script lang="ts">
  import type { DayKey, MealSlot } from "../types";
  import { meals } from "../../data/meals";
  import { weeklyPlan } from "../stores/weeklyPlan";

  interface Props {
    day: DayKey;
    label: string;
  }

  let { day, label }: Props = $props();

  const slots: { key: MealSlot; label: string }[] = [
    { key: "supper", label: "Supper" },
    { key: "diner", label: "Diner" },
  ];

  function onChange(slot: MealSlot, e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    weeklyPlan.setDay(day, slot, value || undefined);
  }
</script>

<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <p class="mb-3 text-sm font-semibold text-slate-900">{label}</p>
  <div class="space-y-3">
    {#each slots as { key, label: slotLabel }}
      <label class="block" for="day-{day}-{key}">
        <span class="mb-1 block text-xs font-medium text-slate-600">{slotLabel}</span>
        <select
          id="day-{day}-{key}"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          value={$weeklyPlan[day]?.[key] ?? ""}
          onchange={(e) => onChange(key, e)}
        >
          <option value="">— Select a meal —</option>
          {#each meals as meal}
            <option value={meal.id}>{meal.name}</option>
          {/each}
        </select>
      </label>
    {/each}
  </div>
</div>
