<script lang="ts">
  import { _ } from "svelte-i18n";
  import HouseholdSettings from "../../lib/components/HouseholdSettings.svelte";
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-xl font-bold text-slate-900">{$_("settings.title")}</h1>
  <HouseholdSettings />
</div>
