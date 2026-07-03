<script lang="ts">
  import { _ } from "svelte-i18n";
  import { session } from "../stores/auth";
  import { getPendingInvites, acceptInvite, type HouseholdInvite } from "../api/household";

  let invites = $state<HouseholdInvite[]>([]);
  let dismissed = $state<Set<string>>(new Set());
  let myEmail = $derived($session?.user?.email ?? null);

  $effect(() => {
    if (!myEmail) return;
    const email = myEmail;
    getPendingInvites(email)
      .then((result) => {
        invites = result;
      })
      .catch(() => {
        // silently ignore — user may not be authenticated yet
      });
  });

  async function accept(invite: HouseholdInvite) {
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
    <span>{$_("household.inviteBanner", { values: { email: invite.invited_by_email } })}</span>
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
