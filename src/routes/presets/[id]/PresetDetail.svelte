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
    <p class="text-ink-2">{$_("presets.notFound")}</p>
    <button
      type="button"
      onclick={goBack}
      class="text-sm font-semibold text-accent-deep hover:underline"
    >
      {$_("presets.back")}
    </button>
  </div>
{:else}
  <div class="flex flex-col pb-4">
    <button
      type="button"
      onclick={goBack}
      class="group mb-4 inline-flex items-center gap-1.5 self-start py-1 text-sm font-semibold text-accent-deep"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="size-[15px] transition-transform group-hover:-translate-x-0.5">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {$_("presets.back")}
    </button>

    <form
      class="flex flex-col gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {#if error}
        <p class="rounded-input border border-danger bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      {/if}

      <label class="block">
        <span class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{$_("presets.name")}</span>
        <input
          type="text"
          bind:value={name}
          maxlength={50}
          class="w-full rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
          placeholder={$_("presets.namePlaceholder")}
        />
      </label>

      <IngredientListEditor legend={$_("presets.ingredients")} bind:rows />

      <div class="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t border-rule bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onclick={goBack}
          class="rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-rule-strong hover:bg-paper-2"
        >
          {$_("presets.cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          class="rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50"
        >
          {$_("presets.save")}
        </button>
      </div>
    </form>
  </div>
{/if}
