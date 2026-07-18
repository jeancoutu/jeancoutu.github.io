<script lang="ts">
  import { _ } from "svelte-i18n";
  import { groceryPresets, addPreset, deletePresetById } from "../../lib/stores/groceryPresets.svelte";
  import { navigate } from "../../lib/utils/router.svelte";

  let newName = $state("");
  let creating = $state(false);
  let error = $state("");
  let confirmingDeleteId = $state<string | null>(null);

  async function createPreset() {
    const name = newName.trim();
    if (!name || creating) return;
    creating = true;
    error = "";
    try {
      const preset = await addPreset({ name, items: [] });
      newName = "";
      navigate(`/preset/${encodeURIComponent(preset.id)}`);
    } catch {
      error = $_("presets.errors.save");
    } finally {
      creating = false;
    }
  }

  async function removePreset(id: string) {
    if (confirmingDeleteId !== id) {
      confirmingDeleteId = id;
      return;
    }
    confirmingDeleteId = null;
    try {
      await deletePresetById(id);
    } catch {
      error = $_("presets.errors.delete");
    }
  }
</script>

<div>
  <header class="mb-4">
    <h1 class="m-0 mb-1 font-display text-[clamp(1.4rem,5vw+0.4rem,1.75rem)] font-bold tracking-[-0.015em] text-ink">{$_("presets.title")}</h1>
    <p class="m-0 text-sm leading-[1.45] text-ink-2">{$_("presets.subtitle")}</p>
  </header>

  {#if error}
    <p class="mb-4 rounded-input border border-danger bg-danger-tint px-3 py-2 text-sm text-danger">
      {error}
    </p>
  {/if}

  <form
    class="mb-6 flex gap-2"
    onsubmit={(event) => {
      event.preventDefault();
      createPreset();
    }}
  >
    <label class="min-w-0 flex-1">
      <span class="sr-only">{$_("presets.namePlaceholder")}</span>
      <input
        type="text"
        bind:value={newName}
        maxlength={50}
        placeholder={$_("presets.namePlaceholder")}
        class="w-full rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
      />
    </label>
    <button
      type="submit"
      disabled={!newName.trim() || creating}
      class="shrink-0 rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50"
    >
      {$_("presets.create")}
    </button>
  </form>

  {#if groceryPresets.all.length === 0}
    <p class="rounded-card border-[1.5px] border-dashed border-rule p-6 text-center text-sm text-ink-3">
      {$_("presets.empty")}
    </p>
  {:else}
    <div>
      {#each groceryPresets.all as preset (preset.id)}
        <div class="flex items-center gap-2 border-b border-rule py-[0.85rem] last:border-b-0">
          <button
            type="button"
            onclick={() => navigate(`/preset/${encodeURIComponent(preset.id)}`)}
            class="min-w-0 flex-1 rounded-input py-1 text-left transition hover:bg-paper-2"
          >
            <span class="mb-0.5 block truncate text-[0.9375rem] font-semibold text-ink">{preset.name}</span>
            <span class="block text-[0.8125rem] text-ink-2">
              {$_("presets.itemCount", { values: { n: preset.items.length } })}
            </span>
          </button>
          {#if confirmingDeleteId === preset.id}
            <button
              type="button"
              onclick={() => removePreset(preset.id)}
              class="shrink-0 rounded-pill bg-danger px-3 py-1.5 text-sm font-semibold text-surface transition hover:brightness-95"
            >
              {$_("presets.deleteConfirm")}
            </button>
            <button
              type="button"
              onclick={() => (confirmingDeleteId = null)}
              class="shrink-0 rounded-pill border border-rule px-3 py-1.5 text-sm font-semibold text-ink-2 transition hover:bg-paper-2"
            >
              {$_("presets.deleteCancel")}
            </button>
          {:else}
            <button
              type="button"
              onclick={() => removePreset(preset.id)}
              class="flex size-[1.9rem] shrink-0 items-center justify-center rounded-icon text-ink-3 transition hover:bg-danger-tint hover:text-danger"
              aria-label={$_("presets.delete")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[15px]">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6h14z" />
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
