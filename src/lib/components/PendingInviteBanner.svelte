<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "svelte-i18n";
  import { getPendingInvites, acceptInvite, type HouseholdMember } from "../api/household";

  let invites = $state<HouseholdMember[]>([]);
  let dismissed = $state<Set<string>>(new Set());

  onMount(async () => {
    try {
      invites = await getPendingInvites();
    } catch {
      // silently ignore — user may not be in any household
    }
  });

  async function accept(invite: HouseholdMember) {
    await acceptInvite(invite.id);
    window.location.reload();
  }

  function dismiss(id: string) {
    dismissed = new Set([...dismissed, id]);
  }

  let visible = $derived(invites.filter((i) => !dismissed.has(i.id)));
</script>

{#each visible as invite (invite.id)}
  <div class="flex items-center justify-between gap-3 bg-blue-50 px-4 py-3 text-sm text-blue-900 border-b border-blue-200">
    <span>{$_("household.inviteBanner", { values: { email: invite.invite_email } })}</span>
    <div class="flex shrink-0 gap-2">
      <button
        onclick={() => accept(invite)}
        class="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
      >
        {$_("household.accept")}
      </button>
      <button
        onclick={() => dismiss(invite.id)}
        class="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        {$_("household.dismiss")}
      </button>
    </div>
  </div>
{/each}
