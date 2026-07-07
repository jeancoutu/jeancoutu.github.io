<script lang="ts">
  import { _ } from "svelte-i18n";
  import HouseholdSettings from "../../lib/components/HouseholdSettings.svelte";
  import SettingsCard from "../../lib/components/SettingsCard.svelte";
  import Modal from "../../lib/components/Modal.svelte";
  import { navigate } from "../../lib/utils/router.svelte";
  import { signOut } from "../../lib/auth";
  import { syncStatus } from "../../lib/sync/status.svelte";

  let confirmSignOutOpen = $state(false);

  function handleSignOutClick() {
    if (syncStatus.pendingCount > 0) {
      confirmSignOutOpen = true;
    } else {
      void signOut();
    }
  }

  function confirmSignOut() {
    confirmSignOutOpen = false;
    void signOut();
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-xl font-bold text-slate-900">{$_("settings.title")}</h1>
  <SettingsCard title={$_("settings.household.title")}>
    <HouseholdSettings />
  </SettingsCard>
  <SettingsCard title={$_("settings.presets.title")}>
    <p class="text-sm text-slate-600">{$_("settings.presets.description")}</p>
    <button
      type="button"
      onclick={() => navigate("/presets")}
      class="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
    >
      {$_("settings.presets.manage")}
    </button>
  </SettingsCard>
  <SettingsCard title={$_("settings.account.title")}>
    <button
      type="button"
      onclick={handleSignOutClick}
      class="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100"
    >
      {$_("settings.account.signOut")}
    </button>
  </SettingsCard>
</div>

<Modal
  open={confirmSignOutOpen}
  title={$_("settings.account.signOutConfirmTitle")}
  onclose={() => (confirmSignOutOpen = false)}
>
  {#snippet footer()}
    <button
      type="button"
      onclick={() => (confirmSignOutOpen = false)}
      class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
    >
      {$_("settings.account.cancel")}
    </button>
    <button
      type="button"
      onclick={confirmSignOut}
      class="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 active:bg-red-800"
    >
      {$_("settings.account.signOutAnyway")}
    </button>
  {/snippet}
  <p class="text-sm text-slate-600">
    {$_("settings.account.signOutWarning", { values: { n: syncStatus.pendingCount } })}
  </p>
</Modal>
