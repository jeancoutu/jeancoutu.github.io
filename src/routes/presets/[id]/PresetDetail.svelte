<script lang="ts">
  import { _ } from "svelte-i18n";
  import IngredientListEditor from "../../../lib/components/IngredientListEditor.svelte";
  import { groceryPresets, updatePresetById } from "../../../lib/stores/groceryPresets.svelte";
  import { navigate, hasNavigatedInApp } from "../../../lib/utils/router.svelte";
  import type { Ingredient } from "../../../lib/types";

  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  let preset = $derived(groceryPresets.all.find((candidate) => candidate.id === id));

  let name = $state("");
  let rows = $state<Ingredient[]>([]);
  let loadedId = $state<string | null>(null);
  let error = $state("");
  let saving = $state(false);

  $effect(() => {
    if (preset && loadedId !== preset.id) {
      name = preset.name;
      rows = preset.items.map((item) => ({ ...item }));
      loadedId = preset.id;
    }
  });

  function goBack() {
    if (hasNavigatedInApp()) {
      window.history.back();
    } else {
      navigate("/presets");
    }
  }

  async function save() {
    if (!preset) return;
    if (!name.trim()) {
      error = $_("presets.errors.name");
      return;
    }
    saving = true;
    error = "";
    try {
      await updatePresetById(preset.id, { name, items: rows });
      goBack();
    } catch {
      error = $_("presets.errors.save");
    } finally {
      saving = false;
    }
  }
</script>

{#if !preset}
  <div class="space-y-4 text-center">
    <p class="text-slate-600">{$_("presets.notFound")}</p>
    <button
      type="button"
      onclick={goBack}
      class="text-sm font-medium text-orange-600 hover:text-orange-700"
    >
      {$_("presets.back")}
    </button>
  </div>
{:else}
  <div class="space-y-6">
    <button
      type="button"
      onclick={goBack}
      class="text-sm font-medium text-orange-600 hover:text-orange-700"
    >
      {$_("presets.back")}
    </button>

    <form
      class="space-y-4"
      onsubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {#if error}
        <p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      {/if}

      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">{$_("presets.name")}</span>
        <input
          type="text"
          bind:value={name}
          maxlength={50}
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          placeholder={$_("presets.namePlaceholder")}
        />
      </label>

      <IngredientListEditor legend={$_("presets.ingredients")} bind:rows />

      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={goBack}
          class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
        >
          {$_("presets.cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          class="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50"
        >
          {$_("presets.save")}
        </button>
      </div>
    </form>
  </div>
{/if}
