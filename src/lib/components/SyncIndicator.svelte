<script lang="ts">
  import { _ } from "svelte-i18n";
  import { syncStatus } from "../sync/status.svelte";

  let visible = $derived(!syncStatus.online || syncStatus.state === "error" || syncStatus.pendingCount > 0);
  let isError = $derived(syncStatus.online && syncStatus.state === "error");
  let label = $derived(
    !syncStatus.online
      ? $_("sync.offline")
      : isError
        ? $_("sync.error")
        : $_("sync.pendingCount", { values: { n: syncStatus.pendingCount } }),
  );
</script>

{#if visible}
  <div
    class="flex items-center justify-center gap-1.5 border-t px-3 py-1 text-xs font-medium
      {isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}"
  >
    <span class="h-1.5 w-1.5 rounded-full {isError ? 'bg-red-500' : 'bg-amber-500'}"></span>
    {label}
  </div>
{/if}
