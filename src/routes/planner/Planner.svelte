<script lang="ts">

  import { _, locale } from "svelte-i18n";

  import { DAYS } from "../../lib/types";

  import DaySelector from "../../lib/components/DaySelector.svelte";

  import GroceryList from "../../lib/components/GroceryList.svelte";

  import WeekPickerModal from "../../lib/components/WeekPickerModal.svelte";

  import Modal from "../../lib/components/Modal.svelte";

  import { weeklyPlan } from "../../lib/stores/weeklyPlan.svelte";
  import { reloadGroceryItemsForWeek, clearGroceryItemsForWeek } from "../../lib/stores/groceryList.svelte";

  import { formatWeekRange, isCurrentWeek } from "../../lib/utils/weekDates";



  let weekPickerOpen = $state(false);

  let clearConfirmOpen = $state(false);

  let activeWeek = $derived(weeklyPlan.selectedWeek);

  let weekLabel = $derived(formatWeekRange(activeWeek, $locale ?? "en"));

  async function confirmClearWeek() {

    clearConfirmOpen = false;

    await weeklyPlan.clearWeek();

    clearGroceryItemsForWeek(weeklyPlan.selectedWeek);

  }

</script>



<div class="space-y-4">

  <header class="flex items-start justify-between gap-3">
    <h1 class="min-w-0 font-display text-[clamp(1.25rem,4vw+0.4rem,1.5rem)] font-semibold tracking-[-0.01em] break-words text-ink">
      {weekLabel}
    </h1>
    <button
      type="button"
      onclick={() => (weekPickerOpen = true)}
      class="flex shrink-0 items-center gap-1 rounded-pill border border-rule bg-surface px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap text-ink-2 transition hover:border-rule-strong hover:bg-paper-2"
    >
      {#if isCurrentWeek(activeWeek)}
        {$_("planner.thisWeek")}
      {/if}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  </header>

  <div class="flex gap-2">
    <button
      type="button"
      onclick={async () => { await weeklyPlan.autoFillWeek(); await reloadGroceryItemsForWeek(weeklyPlan.selectedWeek); }}
      class="flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0">
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      </svg>
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
