<script lang="ts">
  import { _ } from "svelte-i18n";
  import { router, navigate } from "../utils/router.svelte";
  import SyncIndicator from "./SyncIndicator.svelte";

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
  class="fixed bottom-0 left-0 right-0 z-50 border-t border-rule bg-surface safe-area-pb"
  aria-label={$_("nav.main")}
>
  <SyncIndicator />
  <div class="mx-auto flex max-w-lg">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        onclick={() => navigate(tab.path)}
        class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.6875rem] font-semibold transition
          {isActive(tab.id) ? 'text-accent-deep' : 'text-ink-3 hover:text-ink'}"
        aria-current={isActive(tab.id) ? "page" : undefined}
      >
        {#if tab.id === "planner"}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[21px]">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 3v3M16 3v3" />
          </svg>
        {:else if tab.id === "meals"}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[21px]">
            <path d="M7 3v6M11 3v6M7 9a4 2 0 0 0 8 0M17 3c-2 2-2 5 0 8v10" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[21px]">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        {/if}
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
