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
  class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border-0 bg-white p-0 shadow-xl backdrop:bg-slate-900/50"
  onclose={handleClose}
  onclick={(e) => {
    if (e.target === dialogEl) handleClose();
  }}
>
  <div class="flex flex-col">
    <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <h2 class="text-lg font-semibold text-slate-900">{title}</h2>
      <button
        type="button"
        onclick={handleClose}
        class="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label={$_("modal.close")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
          <path
            d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
          />
        </svg>
      </button>
    </header>

    <div class="px-4 py-4">
      {@render children()}
    </div>

    {#if footer}
      <footer class="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
        {@render footer()}
      </footer>
    {/if}
  </div>
</dialog>
