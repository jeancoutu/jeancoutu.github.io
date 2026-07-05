<script lang="ts">
  import { _ } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import type { DayKey } from "../types";

  interface Props {
    open: boolean;
    day: DayKey;
    note: string | null | undefined;
    onclose: () => void;
    onsave: (note: string | null) => void;
  }

  let { open, day, note, onclose, onsave }: Props = $props();

  const MAX_LENGTH = 280;

  let value = $state("");

  $effect(() => {
    if (open) value = note ?? "";
  });

  function save() {
    const trimmed = value.trim();
    onsave(trimmed || null);
    onclose();
  }

  function clear() {
    onsave(null);
    onclose();
  }
</script>

<Modal open={open} title={$_("planner.note.title", { values: { day: $_(`day.${day}`) } })} {onclose}>
  {#snippet footer()}
    <button
      type="button"
      onclick={onclose}
      class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
    >
      {$_("planner.note.cancel")}
    </button>
    {#if note}
      <button
        type="button"
        onclick={clear}
        class="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100"
      >
        {$_("planner.note.clear")}
      </button>
    {/if}
    <button
      type="button"
      onclick={save}
      class="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700"
    >
      {$_("planner.note.save")}
    </button>
  {/snippet}
  <textarea
    rows="3"
    maxlength={MAX_LENGTH}
    bind:value
    placeholder={$_("planner.note.placeholder")}
    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
  ></textarea>
</Modal>
