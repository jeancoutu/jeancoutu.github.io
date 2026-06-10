<script lang="ts">
  import { _ } from "svelte-i18n";
  import Modal from "./Modal.svelte";

  interface Props {
    open: boolean;
    url: string;
    onclose: () => void;
  }

  let { open, url, onclose }: Props = $props();

  let copyMessage = $state("");

  async function copyUrl() {
    copyMessage = "";
    try {
      await navigator.clipboard.writeText(url);
      onclose();
    } catch {
      copyMessage = $_("share.copyError");
    }
  }
</script>

<Modal open={open} title={$_("share.title")} {onclose}>
  <p class="mb-3 text-sm text-slate-600">
    {$_("share.intro")}
  </p>

  <div class="flex gap-2">
    <input
      type="text"
      readonly
      value={url}
      class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
      onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
    />
    <button
      type="button"
      onclick={copyUrl}
      class="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
    >
      {$_("share.copy")}
    </button>
  </div>

  {#if copyMessage}
    <p class="mt-2 text-sm text-slate-600" role="status">{copyMessage}</p>
  {/if}
</Modal>
