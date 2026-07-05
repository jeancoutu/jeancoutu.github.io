<script lang="ts">
  import { _ } from "svelte-i18n";
  import HouseholdSettings from "../../lib/components/HouseholdSettings.svelte";
  import { navigate } from "../../lib/utils/router.svelte";
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-xl font-bold text-slate-900">{$_("settings.title")}</h1>
  <HouseholdSettings />
  <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-orange-600">
      {$_("settings.presets.title")}
    </h2>
    <p class="mt-2 text-sm text-slate-600">{$_("settings.presets.description")}</p>
    <button
      type="button"
      onclick={() => navigate("/presets")}
      class="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
    >
      {$_("settings.presets.manage")}
    </button>
  </section>
</div>
