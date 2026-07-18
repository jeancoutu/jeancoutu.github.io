<script lang="ts">
  import { _ } from "svelte-i18n";
  import { auth } from "../stores/auth.svelte";
  import { getPendingInvites, acceptInvite, type HouseholdInvite } from "../api/household";

  let invites = $state<HouseholdInvite[]>([]);
  let dismissed = $state<Set<string>>(new Set());
  let myEmail = $derived(auth.session?.user?.email ?? null);

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
  <div class="flex items-center justify-between gap-3 border-b border-accent-tint-2 bg-accent-tint px-4 py-3 text-sm text-ink">
    <span class="min-w-0 [overflow-wrap:anywhere]">{$_("household.inviteBanner", { values: { email: invite.invited_by_email } })}</span>
    <div class="flex shrink-0 gap-2">
      <button
        onclick={() => accept(invite)}
        class="rounded-pill bg-accent px-3 py-1 text-xs font-semibold text-surface transition hover:bg-accent-deep"
      >
        {$_("household.accept")}
      </button>
      <button
        onclick={() => dismiss(invite.id)}
        class="rounded-pill border border-accent-tint-2 px-3 py-1 text-xs font-semibold text-accent-deep transition hover:bg-accent-tint-2"
      >
        {$_("household.dismiss")}
      </button>
    </div>
  </div>
{/each}
