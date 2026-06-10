<script lang="ts">

  import { _, locale } from "svelte-i18n";

  import { DAYS } from "../../lib/types";

  import DaySelector from "../../lib/components/DaySelector.svelte";

  import GroceryList from "../../lib/components/GroceryList.svelte";

  import WeekPickerModal from "../../lib/components/WeekPickerModal.svelte";

  import ImportPlanModal from "../../lib/components/ImportPlanModal.svelte";

  import ShareWeekModal from "../../lib/components/ShareWeekModal.svelte";

  import { selectedWeek, weeklyPlan } from "../../lib/stores/weeklyPlan";

  import { pendingSharePlan } from "../../lib/stores/pendingSharePlan";

  import { buildPlannerShareUrl } from "../../lib/utils/planShare";

  import { formatWeekRange, isCurrentWeek } from "../../lib/utils/weekDates";



  let weekPickerOpen = $state(false);

  let shareModalOpen = $state(false);

  let shareUrl = $state("");



  let activeWeek = $derived($selectedWeek);

  let weekLabel = $derived(formatWeekRange(activeWeek, $locale ?? "en"));

  let importModalOpen = $derived(!!$pendingSharePlan);



  function openShareModal() {

    shareUrl = buildPlannerShareUrl(

      weeklyPlan.getSnapshot(),

      weeklyPlan.getSelectedWeek(),

    );

    shareModalOpen = true;

  }

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



  <div class="flex flex-wrap items-center gap-2">

    <button

      type="button"

      onclick={() => weeklyPlan.autoFillWeek()}

      class="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700"

    >

      {$_("planner.autoFill")}

    </button>

    <button

      type="button"

      onclick={() => weeklyPlan.clearWeek()}

      class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"

    >

      {$_("planner.clear")}

    </button>

    <button

      type="button"

      onclick={openShareModal}

      class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"

    >

      {$_("planner.share")}

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

<ImportPlanModal open={importModalOpen} />

<ShareWeekModal

  open={shareModalOpen}

  url={shareUrl}

  onclose={() => (shareModalOpen = false)}

/>

