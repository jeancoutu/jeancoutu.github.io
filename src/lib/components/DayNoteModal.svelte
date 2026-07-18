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
      class="rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-rule-strong hover:bg-paper-2"
    >
      {$_("planner.note.cancel")}
    </button>
    {#if note}
      <button
        type="button"
        onclick={clear}
        class="rounded-pill border border-danger bg-transparent px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-tint"
      >
        {$_("planner.note.clear")}
      </button>
    {/if}
    <button
      type="button"
      onclick={save}
      class="rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none"
    >
      {$_("planner.note.save")}
    </button>
  {/snippet}
  <textarea
    rows="3"
    maxlength={MAX_LENGTH}
    bind:value
    placeholder={$_("planner.note.placeholder")}
    class="min-h-26 w-full rounded-input border border-rule bg-paper px-3.5 py-3 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
  ></textarea>
</Modal>
