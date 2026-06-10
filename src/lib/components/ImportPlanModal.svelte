<script lang="ts">
  import { _, locale } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import { weeklyPlan } from "../stores/weeklyPlan";
  import { importGroceryList } from "../stores/groceryList";
  import { pendingSharePlan } from "../stores/pendingSharePlan";
  import { formatWeekRange } from "../utils/weekDates";

  interface Props {
    open: boolean;
  }

  let { open }: Props = $props();

  let payload = $derived($pendingSharePlan);

  let weekLabel = $derived(
    payload ? formatWeekRange(payload.weekStart, $locale ?? "en") : "",
  );

  function importPlan() {
    if (!payload) return;
    weeklyPlan.importPlan(payload.plan, payload.weekStart);

    if (payload.groceryList) {
      importGroceryList(payload.weekStart, payload.groceryList);
    }

    pendingSharePlan.clear();
  }

  function dismiss() {
    pendingSharePlan.clear();
  }
</script>

<Modal open={open} title={$_("import.title")} onclose={dismiss}>
  {#if payload}
    <p class="text-sm text-slate-700">
      {$_("import.body", { values: { week: weekLabel } })}
    </p>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      onclick={dismiss}
      class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      {$_("import.notNow")}
    </button>
    <button
      type="button"
      onclick={importPlan}
      class="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
    >
      {$_("import.confirm")}
    </button>
  {/snippet}
</Modal>
