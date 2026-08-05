<script lang="ts">
  import { _ } from "svelte-i18n";
  import { router } from "./lib/utils/router.svelte";
  import BottomNav from "./lib/components/BottomNav.svelte";
  import Planner from "./routes/planner/Planner.svelte";
  import Meals from "./routes/meals/Meals.svelte";
  import MealDetail from "./routes/meal/[id]/MealDetail.svelte";
  import AuthGate from "./lib/components/AuthGate.svelte";
  import PendingInviteBanner from "./lib/components/PendingInviteBanner.svelte";
  import Toast from "./lib/components/Toast.svelte";
  import Settings from "./routes/settings/Settings.svelte";
  import PresetsList from "./routes/presets/PresetsList.svelte";
  import PresetDetail from "./routes/presets/[id]/PresetDetail.svelte";
  import { dbStatus } from "./lib/db/status.svelte";

  let showNav = $derived(router.current.name !== "meal" && router.current.name !== "preset");

  $effect(() => {
    document.title = $_(`app.title`);
  });
</script>

{#if dbStatus.openFailed}
  <div
    class="flex min-h-full w-full flex-col items-center justify-center gap-2 bg-paper px-6 text-center"
  >
    <h1 class="text-lg font-semibold text-ink">{$_("app.storageUnavailable.title")}</h1>
    <p class="max-w-[30ch] text-sm leading-relaxed text-ink-2">
      {$_("app.storageUnavailable.message")}
    </p>
  </div>
{:else}
  <AuthGate>
    <Toast />
    <PendingInviteBanner />
    <div class="mx-auto flex min-h-full w-full max-w-lg flex-col bg-paper">
      <main class="flex-1 px-4 pt-4 {showNav ? 'pb-24' : 'pb-4'}">
        {#if router.current.name === "planner"}
          <Planner />
        {:else if router.current.name === "meals"}
          <Meals />
        {:else if router.current.name === "meal"}
          <MealDetail id={router.current.id} />
        {:else if router.current.name === "presets"}
          <PresetsList />
        {:else if router.current.name === "preset"}
          <PresetDetail id={router.current.id} />
        {:else if router.current.name === "settings"}
          <Settings />
        {/if}
      </main>

      {#if showNav}
        <BottomNav />
      {/if}
    </div>
  </AuthGate>
{/if}
