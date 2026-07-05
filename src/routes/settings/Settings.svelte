<script lang="ts">
  import { _ } from "svelte-i18n";
  import HouseholdSettings from "../../lib/components/HouseholdSettings.svelte";
  import SettingsCard from "../../lib/components/SettingsCard.svelte";
  import { navigate } from "../../lib/utils/router.svelte";
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
</div>
