<script lang="ts">

  import { _, locale } from "svelte-i18n";

  import { DAYS } from "../../lib/types";

  import DaySelector from "../../lib/components/DaySelector.svelte";

  import GroceryList from "../../lib/components/GroceryList.svelte";

  import WeekPickerModal from "../../lib/components/WeekPickerModal.svelte";

  import { weeklyPlan } from "../../lib/stores/weeklyPlan.svelte";
  import { reloadGroceryItemsForWeek, clearGroceryItemsForWeek } from "../../lib/stores/groceryList.svelte";

  import { formatWeekRange, isCurrentWeek } from "../../lib/utils/weekDates";



  let weekPickerOpen = $state(false);

  let activeWeek = $derived(weeklyPlan.selectedWeek);

  let weekLabel = $derived(formatWeekRange(activeWeek, $locale ?? "en"));

</script>



<div class="space-y-4">

  <button

    type="button"

    onclick={() => (weekPickerOpen = true)}

    class="flex w-full items-center justify-between gap-3 rounded-lg text-left transition hover:bg-slate-100/80 active:bg-slate-100"

  >

    <h1 class="text-2xl font-bold text-slate-900">{weekLabel}</h1>

    <span class="flex shrink-0 items-center gap-1 text-sm text-orange-600">

      {#if isCurrentWeek(activeWeek)}

        <span class="text-slate-500">{$_("planner.thisWeek")}</span>

      {/if}

      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">

        <path

          fill-rule="evenodd"

          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"

          clip-rule="evenodd"

        />

      </svg>

    </span>

  </button>



  <div class="flex gap-2">

    <button

      type="button"

      onclick={async () => { await weeklyPlan.autoFillWeek(); await reloadGroceryItemsForWeek(weeklyPlan.selectedWeek); }}

      class="min-w-0 flex-1 truncate rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700"

    >

      {$_("planner.autoFill")}

    </button>

    <button

      type="button"

      onclick={async () => { await weeklyPlan.clearWeek(); clearGroceryItemsForWeek(weeklyPlan.selectedWeek); }}

      class="min-w-0 flex-1 truncate rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"

    >

      {$_("planner.clear")}

    </button>

    <button

      type="button"

      onclick={async () => { await weeklyPlan.reloadWeek(); await reloadGroceryItemsForWeek(weeklyPlan.selectedWeek); }}

      class="shrink-0 rounded-lg border border-slate-300 bg-white p-2.5 text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"

      title={$_("planner.refresh")}

    >

      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">

        <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd" />

      </svg>

    </button>

  </div>



  <div class="space-y-3">

    {#each DAYS as day}

      <DaySelector day={day.key} />

    {/each}

  </div>



  <GroceryList />

</div>



<WeekPickerModal open={weekPickerOpen} onclose={() => (weekPickerOpen = false)} />
