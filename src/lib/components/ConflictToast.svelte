<script lang="ts">
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import { onConflict, type ConflictEvent } from "../sync/status.svelte";

  interface ToastItem {
    id: number;
    message: string;
  }

  const ENTITY_LABEL_KEYS: Record<string, string> = {
    meal: "sync.conflict.entity.meal",
    groceryPreset: "sync.conflict.entity.groceryPreset",
    weeklyPlan: "sync.conflict.entity.weeklyPlan",
    groceryItem: "sync.conflict.entity.groceryItem",
  };

  let toasts = $state<ToastItem[]>([]);
  let nextId = 0;

  function dismiss(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
  }

  function handleConflict(event: ConflictEvent) {
    const entityLabel = $_(ENTITY_LABEL_KEYS[event.entity] ?? "sync.conflict.entity.generic");
    const message = event.name
      ? $_("sync.conflictToastNamed", { values: { name: event.name } })
      : $_("sync.conflictToast", { values: { entity: entityLabel } });
    const id = nextId++;
    toasts = [...toasts, { id, message }];
    setTimeout(() => dismiss(id), 6000);
  }

  onMount(() => onConflict(handleConflict));
</script>

{#if toasts.length > 0}
  <div
    class="fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4"
    style="padding-top: calc(env(safe-area-inset-top, 0) + 0.75rem)"
  >
    {#each toasts as toast (toast.id)}
      <div
        class="flex w-full max-w-md items-start justify-between gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
      >
        <span>{toast.message}</span>
        <button
          type="button"
          onclick={() => dismiss(toast.id)}
          class="shrink-0 text-slate-300 transition hover:text-white"
          aria-label={$_("sync.dismiss")}
        >
          ✕
        </button>
      </div>
    {/each}
  </div>
{/if}
