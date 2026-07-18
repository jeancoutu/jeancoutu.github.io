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
      {isError ? 'border-danger-tint bg-danger-tint text-danger' : 'border-warn-tint bg-warn-tint text-warn'}"
  >
    <span class="h-1.5 w-1.5 rounded-full {isError ? 'bg-danger' : 'bg-warn'}"></span>
    {label}
  </div>
{/if}
