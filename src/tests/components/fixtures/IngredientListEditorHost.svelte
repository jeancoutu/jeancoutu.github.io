<script lang="ts">
  import IngredientListEditor from "../../../lib/components/IngredientListEditor.svelte";
  import type { Ingredient } from "../../../lib/types";

  interface Props {
    initialRows: Ingredient[];
    onRowsChange: (rows: Ingredient[]) => void;
  }

  let { initialRows, onRowsChange }: Props = $props();
  let rows = $state(initialRows.map((row) => ({ ...row })));

  $effect(() => {
    onRowsChange(rows.map((row) => ({ ...row })));
  });
</script>

<IngredientListEditor legend="Ingredients" bind:rows />
