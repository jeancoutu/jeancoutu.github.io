<script lang="ts">
  import IngredientSearch from "./IngredientSearch.svelte";
  import type { Ingredient } from "../types";

  interface Props {
    legend: string;
    rows: Ingredient[];
  }

  let { legend, rows = $bindable() }: Props = $props();
</script>

<fieldset class="block">
  <legend class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{legend}</legend>
  {#if rows.length > 0}
    <div class="mb-1.5">
      {#each rows as row, i (i)}
        <div class="flex items-center gap-2 border-b border-rule py-2">
          <span class="min-w-0 flex-1 [overflow-wrap:anywhere] text-[0.9375rem] text-ink">{row.name}</span>
          <input
            type="text"
            bind:value={row.quantity}
            class="w-19 shrink-0 rounded-input border border-rule bg-surface px-2.5 py-1.5 text-center font-body text-[0.8125rem] text-ink focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
          />
          <button
            type="button"
            onclick={() => (rows = rows.filter((_, j) => j !== i))}
            class="flex size-7 shrink-0 items-center justify-center rounded-icon text-ink-3 transition hover:bg-danger-tint hover:text-danger"
            aria-label="Remove"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="size-[14px]">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
  <IngredientSearch onAdd={(ing) => (rows = [...rows, { ...ing, quantity: "1" }])} />
</fieldset>
