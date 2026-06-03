<script lang="ts">
  import { route, navigate } from "../utils/router";

  const tabs = [
    { id: "planner" as const, label: "Planner", path: "/planner" },
    { id: "meals" as const, label: "Meals", path: "/meals" },
  ];

  function isActive(tabId: "planner" | "meals"): boolean {
    const current = $route;
    if (tabId === "planner") {
      return current.name === "planner";
    }
    return current.name === "meals" || current.name === "meal";
  }
</script>

<nav
  class="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white safe-area-pb"
  aria-label="Main navigation"
>
  <div class="mx-auto flex max-w-lg">
    {#each tabs as tab}
      <button
        type="button"
        onclick={() => navigate(tab.path)}
        class="flex flex-1 flex-col items-center gap-1 py-3 text-sm font-medium transition
          {isActive(tab.id)
          ? 'text-orange-600'
          : 'text-slate-500 hover:text-slate-700'}"
        aria-current={isActive(tab.id) ? "page" : undefined}
      >
        <span
          class="h-1 w-8 rounded-full transition
            {isActive(tab.id) ? 'bg-orange-500' : 'bg-transparent'}"
        ></span>
        {tab.label}
      </button>
    {/each}
  </div>
</nav>

<style>
  .safe-area-pb {
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
</style>
