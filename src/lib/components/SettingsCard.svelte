<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, headerAction, children }: { title: string; headerAction?: Snippet; children: Snippet } = $props();
</script>

<section class="rounded-card border border-rule bg-surface p-4">
  <div class="flex items-center justify-between gap-2">
    <h2 class="m-0 font-body text-[0.8125rem] font-bold tracking-[0.03em] text-accent-deep uppercase">{title}</h2>
    {#if headerAction}
      {@render headerAction()}
    {/if}
  </div>
  <div class="mt-2.5">
    {@render children()}
  </div>
</section>
