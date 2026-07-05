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

<div class="space-y-4">
  <header>
    <h1 class="text-2xl font-bold text-slate-900">{$_("presets.title")}</h1>
    <p class="mt-1 text-sm text-slate-600">{$_("presets.subtitle")}</p>
  </header>

  {#if error}
    <p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  {/if}

  <form
    class="flex gap-2"
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
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
    </label>
    <button
      type="submit"
      disabled={!newName.trim() || creating}
      class="shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50"
    >
      {$_("presets.create")}
    </button>
  </form>

  {#if groceryPresets.all.length === 0}
    <p class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {$_("presets.empty")}
    </p>
  {:else}
    <ul class="space-y-3">
      {#each groceryPresets.all as preset (preset.id)}
        <li class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onclick={() => navigate(`/preset/${encodeURIComponent(preset.id)}`)}
            class="min-w-0 flex-1 text-left"
          >
            <span class="block truncate text-lg font-semibold text-slate-900">{preset.name}</span>
            <span class="block text-sm text-slate-500">
              {$_("presets.itemCount", { values: { n: preset.items.length } })}
            </span>
          </button>
          {#if confirmingDeleteId === preset.id}
            <button
              type="button"
              onclick={() => removePreset(preset.id)}
              class="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-600"
            >
              {$_("presets.deleteConfirm")}
            </button>
            <button
              type="button"
              onclick={() => (confirmingDeleteId = null)}
              class="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {$_("presets.deleteCancel")}
            </button>
          {:else}
            <button
              type="button"
              onclick={() => removePreset(preset.id)}
              class="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
              aria-label={$_("presets.delete")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
