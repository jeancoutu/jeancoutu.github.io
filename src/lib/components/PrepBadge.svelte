<script lang="ts">
  import { _ } from "svelte-i18n";

  interface Props {
    needsPrepAhead: boolean;
  }

  let { needsPrepAhead }: Props = $props();
</script>

{#if needsPrepAhead}
  <span class="inline-block rounded-pill bg-accent-tint px-2.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-accent-deep">
    {$_("meal.prepAhead")}
  </span>
{/if}
