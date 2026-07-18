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

<div class="flex flex-col gap-4">
  <h1 class="m-0 font-display text-[clamp(1.4rem,5vw+0.4rem,1.75rem)] font-bold tracking-[-0.015em] text-ink">{$_("settings.title")}</h1>
  <SettingsCard title={$_("settings.household.title")}>
    <HouseholdSettings />
  </SettingsCard>
  <SettingsCard title={$_("settings.presets.title")}>
    <p class="m-0 mb-3 text-sm leading-[1.45] text-ink-2">{$_("settings.presets.description")}</p>
    <button
      type="button"
      onclick={() => navigate("/presets")}
      class="w-full rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-rule-strong hover:bg-paper-2"
    >
      {$_("settings.presets.manage")}
    </button>
  </SettingsCard>
  <SettingsCard title={$_("settings.update.title")}>
    <p class="m-0 mb-3 text-sm leading-[1.45] text-ink-2">{$_("settings.update.description")}</p>
    <button
      type="button"
      onclick={handleCheckForUpdate}
      disabled={checkingForUpdate}
      class="flex w-full items-center justify-center gap-1.5 rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-rule-strong hover:bg-paper-2 disabled:opacity-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
        <path d="M4 4v5h5M20 20v-5h-5M4.5 15a8 8 0 0 0 14.7 3.3M19.5 9A8 8 0 0 0 4.8 5.7" />
      </svg>
      {checkingForUpdate ? $_("settings.update.checking") : $_("settings.update.check")}
    </button>
  </SettingsCard>
  <SettingsCard title={$_("settings.cache.title")}>
    <p class="m-0 mb-3 text-sm leading-[1.45] text-ink-2">{$_("settings.cache.description")}</p>
    <button
      type="button"
      onclick={() => (confirmClearCacheOpen = true)}
      class="w-full rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-rule-strong hover:bg-paper-2"
    >
      {$_("settings.cache.clear")}
    </button>
  </SettingsCard>
  <SettingsCard title={$_("settings.account.title")}>
    <button
      type="button"
      onclick={handleSignOutClick}
      class="w-full rounded-pill border border-danger bg-transparent px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-tint"
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
      class="rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-rule-strong hover:bg-paper-2"
    >
      {$_("settings.account.cancel")}
    </button>
    <button
      type="button"
      onclick={confirmSignOut}
      class="rounded-pill bg-danger px-4 py-2.5 text-sm font-semibold text-surface transition hover:brightness-95"
    >
      {$_("settings.account.signOutAnyway")}
    </button>
  {/snippet}
  <p class="text-sm text-ink-2">
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
      class="rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-rule-strong hover:bg-paper-2 disabled:opacity-50"
    >
      {$_("settings.cache.cancel")}
    </button>
    <button
      type="button"
      onclick={confirmClearCache}
      disabled={clearingCache}
      class="rounded-pill bg-danger px-4 py-2.5 text-sm font-semibold text-surface transition hover:brightness-95 disabled:opacity-50"
    >
      {clearingCache ? $_("settings.cache.clearing") : $_("settings.cache.confirmAction")}
    </button>
  {/snippet}
  <p class="text-sm text-ink-2">
    {$_("settings.cache.confirmMessage", { values: { n: syncStatus.pendingCount } })}
  </p>
</Modal>
