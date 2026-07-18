<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<section class="rounded-card border border-rule bg-surface p-4">
  <h2 class="m-0 font-body text-[0.8125rem] font-bold tracking-[0.03em] text-accent-deep uppercase">{title}</h2>
  <div class="mt-2.5">
    {@render children()}
  </div>
</section>
