<script lang="ts">
  import { _ } from "svelte-i18n";
  import { router, navigate } from "../utils/router.svelte";

  const tabs = [
    { id: "planner" as const, labelKey: "nav.planner", path: "/planner" },
    { id: "meals" as const, labelKey: "nav.meals", path: "/meals" },
    { id: "settings" as const, labelKey: "nav.settings", path: "/settings" },
  ];

  function isActive(tabId: "planner" | "meals" | "settings"): boolean {
    const current = router.current;
    if (tabId === "planner") {
      return current.name === "planner";
    }
    if (tabId === "meals") {
      return current.name === "meals" || current.name === "meal";
    }
    return current.name === "settings";
  }
</script>

<nav
  class="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white safe-area-pb"
  aria-label={$_("nav.main")}
>
  <div class="mx-auto flex max-w-lg">
    {#each tabs as tab}
      <button
        type="button"
        onclick={() => navigate(tab.path)}
        class="flex flex-1 flex-col items-center gap-1 py-2 text-sm font-medium transition
          {isActive(tab.id)
          ? 'text-orange-600'
          : 'text-slate-500 hover:text-slate-700'}"
        aria-current={isActive(tab.id) ? "page" : undefined}
      >
        <span
          class="h-1 w-8 rounded-full transition
            {isActive(tab.id) ? 'bg-orange-500' : 'bg-transparent'}"
        ></span>
        {$_(tab.labelKey)}
      </button>
    {/each}
  </div>
</nav>

<style>
  .safe-area-pb {
    padding-bottom: calc(env(safe-area-inset-bottom, 0) + 0.5rem);
  }
</style>
