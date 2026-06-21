<script lang="ts">
  import { _ } from "svelte-i18n";
  import { route } from "./lib/utils/router";
  import BottomNav from "./lib/components/BottomNav.svelte";
  import Planner from "./routes/planner/Planner.svelte";
  import Meals from "./routes/meals/Meals.svelte";
  import MealDetail from "./routes/meal/[id]/MealDetail.svelte";
  import AuthGate from "./lib/components/AuthGate.svelte";
  import PendingInviteBanner from "./lib/components/PendingInviteBanner.svelte";
  import Settings from "./routes/settings/Settings.svelte";

  let showNav = $derived($route.name !== "meal");

  $effect(() => {
    document.title = $_(`app.title`);
  });
</script>

<AuthGate>
  <PendingInviteBanner />
  <div class="mx-auto flex min-h-full w-full max-w-lg flex-col">
    <main class="flex-1 px-4 pt-4 {showNav ? 'pb-24' : 'pb-4'}">
      {#if $route.name === "planner"}
        <Planner />
      {:else if $route.name === "meals"}
        <Meals />
      {:else if $route.name === "meal"}
        <MealDetail id={$route.id} />
      {:else if $route.name === "settings"}
        <Settings />
      {/if}
    </main>

    {#if showNav}
      <BottomNav />
    {/if}
  </div>
</AuthGate>
