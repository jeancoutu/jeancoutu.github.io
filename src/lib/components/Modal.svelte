<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { open, title, onclose, children, footer }: Props = $props();

  let dialogEl = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) {
      dialogEl.showModal();
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  });

  function handleClose() {
    onclose();
  }
</script>

<dialog
  bind:this={dialogEl}
  class="sheet-dialog m-0 mt-auto max-h-[92dvh] w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-[oklch(21%_0.012_40_/_0.42)]"
  onclose={handleClose}
  onclick={(e) => {
    if (e.target === dialogEl) handleClose();
  }}
>
  <div class="flex max-h-[92dvh] flex-col rounded-t-[20px] bg-surface shadow-float">
    <div class="mx-auto mt-2 h-1 w-9 shrink-0 rounded-pill bg-rule-strong"></div>
    <header class="flex shrink-0 items-center justify-between border-b border-rule px-4 py-3">
      <h2 class="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      <button
        type="button"
        onclick={handleClose}
        class="flex size-8 shrink-0 items-center justify-center rounded-icon text-ink-3 transition hover:bg-paper-2 hover:text-ink"
        aria-label={$_("modal.close")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="size-[18px]">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>

    <div class="overflow-y-auto px-4 py-4">
      {@render children()}
    </div>

    {#if footer}
      <footer class="flex shrink-0 justify-end gap-2 border-t border-rule px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {@render footer()}
      </footer>
    {/if}
  </div>
</dialog>

<style>
  .sheet-dialog {
    animation: sheet-scrim-in var(--dur-med) var(--ease-out);
  }
  .sheet-dialog > div {
    animation: sheet-in 260ms var(--ease-out);
  }
  @keyframes sheet-scrim-in {
    from {
      opacity: 0;
    }
  }
  @keyframes sheet-in {
    from {
      transform: translateY(100%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet-dialog,
    .sheet-dialog > div {
      animation-duration: 0.001ms !important;
    }
  }
</style>
