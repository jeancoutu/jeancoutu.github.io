<script lang="ts">
  import { _, locale } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import { weeklyPlan } from "../stores/weeklyPlan.svelte";
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
    const stored = weeklyPlan.plans;
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

  let activeWeek = $derived(weeklyPlan.selectedWeek);

  let listEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (open && listEl) {
      const container = listEl;
      requestAnimationFrame(() => {
        container.querySelector('[data-active="true"]')?.scrollIntoView({ block: "center" });
      });
    }
  });

  function selectWeek(weekKey: string) {
    weeklyPlan.setSelectedWeek(weekKey);
    onclose();
  }
</script>

<Modal open={open} title={$_("weekPicker.title")} {onclose}>
  <p class="mb-3 text-sm text-ink-2">
    {$_("weekPicker.intro")}
  </p>

  <div class="-mx-4 max-h-80 overflow-y-auto" bind:this={listEl}>
    {#each weekOptions as week (week.key)}
      <button
        type="button"
        data-active={week.key === activeWeek}
        onclick={() => selectWeek(week.key)}
        class="flex w-full items-center justify-between gap-2 border-b border-rule px-4 py-3 text-left font-body text-[0.9375rem] text-ink transition last:border-b-0 hover:bg-paper-2
          {week.key === activeWeek ? 'bg-accent-tint font-semibold hover:bg-accent-tint-2' : ''}"
      >
        <span class="flex flex-wrap items-center gap-2">
          {week.label}
          {#if week.isCurrent}
            <span class="shrink-0 rounded-pill bg-accent-tint-2 px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-accent-deep uppercase tracking-wide">
              {$_("weekPicker.thisWeek")}
            </span>
          {/if}
        </span>
        {#if week.hasPlan}
          <span class="shrink-0 text-xs font-medium whitespace-nowrap text-sage">{$_("weekPicker.hasPlan")}</span>
        {/if}
      </button>
    {/each}
  </div>
</Modal>
