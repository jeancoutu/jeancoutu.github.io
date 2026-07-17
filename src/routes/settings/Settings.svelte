<script lang="ts">
  import { _ } from "svelte-i18n";
  import HouseholdSettings from "../../lib/components/HouseholdSettings.svelte";
  import SettingsCard from "../../lib/components/SettingsCard.svelte";
  import Modal from "../../lib/components/Modal.svelte";
  import { navigate } from "../../lib/utils/router.svelte";
  import { signOut } from "../../lib/auth";
  import { syncStatus } from "../../lib/sync/status.svelte";
  import { resetLocalCache } from "../../lib/sync/engine";
  import { checkForAppUpdate } from "../../lib/pwa";

  let confirmSignOutOpen = $state(false);
  let confirmClearCacheOpen = $state(false);
  let clearingCache = $state(false);
  let checkingForUpdate = $state(false);

  async function handleCheckForUpdate() {
    checkingForUpdate = true;
    try {
      await checkForAppUpdate();
    } finally {
      checkingForUpdate = false;
    }
  }

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

  async function confirmClearCache() {
    clearingCache = true;
    try {
      await resetLocalCache();
    } finally {
      clearingCache = false;
      confirmClearCacheOpen = false;
    }
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
  <SettingsCard title={$_("settings.update.title")}>
    <p class="text-sm text-slate-600">{$_("settings.update.description")}</p>
    <button
      type="button"
      onclick={handleCheckForUpdate}
      disabled={checkingForUpdate}
      class="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
    >
      {checkingForUpdate ? $_("settings.update.checking") : $_("settings.update.check")}
    </button>
  </SettingsCard>
  <SettingsCard title={$_("settings.cache.title")}>
    <p class="text-sm text-slate-600">{$_("settings.cache.description")}</p>
    <button
      type="button"
      onclick={() => (confirmClearCacheOpen = true)}
      class="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
    >
      {$_("settings.cache.clear")}
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

<Modal
  open={confirmClearCacheOpen}
  title={$_("settings.cache.confirmTitle")}
  onclose={() => (confirmClearCacheOpen = false)}
>
  {#snippet footer()}
    <button
      type="button"
      onclick={() => (confirmClearCacheOpen = false)}
      disabled={clearingCache}
      class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
    >
      {$_("settings.cache.cancel")}
    </button>
    <button
      type="button"
      onclick={confirmClearCache}
      disabled={clearingCache}
      class="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 active:bg-red-800 disabled:opacity-50"
    >
      {clearingCache ? $_("settings.cache.clearing") : $_("settings.cache.confirmAction")}
    </button>
  {/snippet}
  <p class="text-sm text-slate-600">
    {$_("settings.cache.confirmMessage", { values: { n: syncStatus.pendingCount } })}
  </p>
</Modal>
