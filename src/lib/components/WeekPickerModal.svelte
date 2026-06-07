<script lang="ts">
  import { _, locale } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import { allPlans, selectedWeek, weeklyPlan } from "../stores/weeklyPlan";
  import {
    addWeeks,
    formatWeekRange,
    getWeekSaturday,
    isCurrentWeek,
    toWeekKey,
  } from "../utils/weekDates";

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  const WEEKS_BEFORE = 8;
  const WEEKS_AFTER = 4;

  let weekOptions = $derived.by(() => {
    const stored = $allPlans;
    const loc = $locale ?? "en";
    const currentSaturday = getWeekSaturday();
    const options: { key: string; label: string; hasPlan: boolean; isCurrent: boolean }[] = [];

    for (let offset = -WEEKS_BEFORE; offset <= WEEKS_AFTER; offset++) {
      const saturday = addWeeks(currentSaturday, offset);
      const key = toWeekKey(saturday);
      const plan = stored[key];
      options.push({
        key,
        label: formatWeekRange(key, loc),
        hasPlan: !!plan && Object.keys(plan).length > 0,
        isCurrent: isCurrentWeek(key),
      });
    }

    return options;
  });

  let activeWeek = $derived($selectedWeek);

  function selectWeek(weekKey: string) {
    weeklyPlan.setSelectedWeek(weekKey);
    onclose();
  }
</script>

<Modal open={open} title={$_("weekPicker.title")} {onclose}>
  <p class="mb-3 text-sm text-slate-600">
    {$_("weekPicker.intro")}
  </p>

  <ul class="max-h-80 space-y-1 overflow-y-auto">
    {#each weekOptions as week (week.key)}
      <li>
        <button
          type="button"
          onclick={() => selectWeek(week.key)}
          class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition
            {week.key === activeWeek
            ? 'bg-orange-50 font-medium text-orange-700 ring-1 ring-orange-200'
            : 'text-slate-700 hover:bg-slate-50'}"
        >
          <span>
            {week.label}
            {#if week.isCurrent}
              <span class="ml-1 text-xs text-slate-500">({$_("weekPicker.thisWeek")})</span>
            {/if}
          </span>
          {#if week.hasPlan}
            <span class="text-xs text-slate-500">{$_("weekPicker.hasPlan")}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</Modal>
