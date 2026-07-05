<script lang="ts">
  import IngredientSearch from "./IngredientSearch.svelte";
  import type { Ingredient } from "../types";

  interface Props {
    legend: string;
    rows: Ingredient[];
  }

  let { legend, rows = $bindable() }: Props = $props();
</script>

<fieldset class="space-y-2">
  <legend class="mb-1 text-sm font-medium text-slate-700">{legend}</legend>
  {#if rows.length > 0}
    <ul class="space-y-1">
      {#each rows as row, i}
        <li class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span class="flex-1 truncate text-sm text-slate-800">{row.name}</span>
          <input
            type="text"
            bind:value={row.quantity}
            class="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <button
            type="button"
            onclick={() => (rows = rows.filter((_, j) => j !== i))}
            class="text-slate-400 transition hover:text-red-500"
            aria-label="Remove"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <IngredientSearch onAdd={(ing) => (rows = [...rows, { ...ing, quantity: "1" }])} />
</fieldset>
