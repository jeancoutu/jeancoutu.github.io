<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <h2 class="text-sm font-semibold text-orange-600">{title}</h2>
  <div class="mt-3">
    {@render children()}
  </div>
</section>
