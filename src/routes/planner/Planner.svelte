<script lang="ts">

  import { _, locale } from "svelte-i18n";

  import { DAYS } from "../../lib/types";

  import DaySelector from "../../lib/components/DaySelector.svelte";

  import GroceryList from "../../lib/components/GroceryList.svelte";

  import WeekPickerModal from "../../lib/components/WeekPickerModal.svelte";

  import Modal from "../../lib/components/Modal.svelte";

  import { weeklyPlan } from "../../lib/stores/weeklyPlan.svelte";
  import { reloadGroceryItemsForWeek, clearGroceryItemsForWeek } from "../../lib/stores/groceryList.svelte";
  import { showToast } from "../../lib/stores/toast.svelte";

  import {
    addWeeks,
    formatWeekRange,
    getWeekSaturday,
    isCurrentWeek,
    parseWeekKey,
    toWeekKey,
  } from "../../lib/utils/weekDates";



  let weekPickerOpen = $state(false);

  let clearConfirmOpen = $state(false);

  let activeWeek = $derived(weeklyPlan.selectedWeek);

  let weekLabel = $derived(formatWeekRange(activeWeek, $locale ?? "en"));

  function shiftWeek(delta: number) {
    const target = toWeekKey(addWeeks(parseWeekKey(activeWeek), delta));
    void weeklyPlan.setSelectedWeek(target);
  }

  function jumpToToday() {
    void weeklyPlan.setSelectedWeek(toWeekKey(getWeekSaturday()));
  }

  async function confirmClearWeek() {

    clearConfirmOpen = false;

    try {
      await weeklyPlan.clearWeek();
      clearGroceryItemsForWeek(weeklyPlan.selectedWeek);
    } catch {
      showToast($_("planner.errors.clear"));
    }

  }

  async function handleAutoFill() {
    try {
      await weeklyPlan.autoFillWeek();
      await reloadGroceryItemsForWeek(weeklyPlan.selectedWeek);
    } catch {
      showToast($_("planner.errors.autoFill"));
    }
  }

</script>



<div class="space-y-4 select-none">

  <header>
    <div class="flex items-center gap-1">
      <button
        type="button"
        onclick={() => shiftWeek(-1)}
        aria-label={$_("planner.prevWeek")}
        class="flex size-14 shrink-0 items-center justify-center rounded-pill text-ink-3 transition hover:bg-paper-2 hover:text-ink active:scale-95 active:bg-accent-tint active:text-accent-deep"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        onclick={() => (weekPickerOpen = true)}
        aria-label={$_("weekPicker.title")}
        class="min-w-0 flex-1 overflow-hidden rounded-pill px-2 py-1 text-center"
      >
        <h1 class="truncate font-display text-[1.1875rem] font-semibold tracking-[-0.01em] text-ink">
          {weekLabel}
        </h1>
      </button>
      <button
        type="button"
        onclick={() => shiftWeek(1)}
        aria-label={$_("planner.nextWeek")}
        class="flex size-14 shrink-0 items-center justify-center rounded-pill text-ink-3 transition hover:bg-paper-2 hover:text-ink active:scale-95 active:bg-accent-tint active:text-accent-deep"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>

    <div class="mt-1 min-h-[20px] text-center">
      {#if isCurrentWeek(activeWeek)}
        <span class="inline-flex items-center rounded-pill bg-accent-tint px-2.5 py-0.5 text-xs font-semibold text-accent-deep">
          {$_("planner.thisWeek")}
        </span>
      {:else}
        <button
          type="button"
          onclick={jumpToToday}
          class="text-xs font-semibold text-accent-deep underline decoration-accent-deep/40 underline-offset-2"
        >
          {$_("planner.backToThisWeek")}
        </button>
      {/if}
    </div>

    <div class="mt-4 -mx-4 h-px bg-rule"></div>
  </header>

  <div class="flex gap-2">
    <button
      type="button"
      onclick={handleAutoFill}
      class="flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none"
    >
      <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{$_("planner.autoFill")}</span>
    </button>
    <button
      type="button"
      onclick={() => (clearConfirmOpen = true)}
      class="min-w-0 flex-1 truncate rounded-pill border border-rule px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-danger hover:bg-danger-tint hover:text-danger"
    >
      {$_("planner.clear")}
    </button>
  </div>

  <div>
    {#each DAYS as day (day.key)}
      <DaySelector day={day.key} />
    {/each}
  </div>

  <GroceryList />

</div>

<WeekPickerModal open={weekPickerOpen} onclose={() => (weekPickerOpen = false)} />
<Modal
  open={clearConfirmOpen}
  title={$_("planner.clearConfirmTitle")}
  onclose={() => (clearConfirmOpen = false)}
>
  {#snippet footer()}
    <button
      type="button"
      onclick={() => (clearConfirmOpen = false)}
      class="rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-rule-strong hover:bg-paper-2"
    >
      {$_("planner.clearCancel")}
    </button>
    <button
      type="button"
      onclick={confirmClearWeek}
      class="rounded-pill bg-danger px-4 py-2.5 text-sm font-semibold text-surface transition hover:brightness-95"
    >
      {$_("planner.clearConfirm")}
    </button>
  {/snippet}
  <p class="text-sm text-ink-2">
    {$_("planner.clearConfirmMessage")}
  </p>
</Modal>
