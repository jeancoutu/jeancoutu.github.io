<script lang="ts">
  import { _ } from "svelte-i18n";
  import { navigate } from "../utils/router.svelte";
</script>

<button
  type="button"
  onclick={() => navigate("/settings")}
  class="group mb-4 inline-flex items-center gap-1.5 self-start py-1 text-sm font-semibold text-accent-deep"
>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="size-[15px] transition-transform group-hover:-translate-x-0.5">
    <path d="M15 6l-6 6 6 6" />
  </svg>
  {$_("settings.backToSettings")}
</button>
