<script lang="ts">
  import { _ } from "svelte-i18n";
  import { auth } from "../stores/auth.svelte";
  import { household, refreshHousehold, acceptHouseholdInvite } from "../stores/household.svelte";
  import { inviteMember, cancelInvite, removeMember } from "../api/household";

  let myUserId = $derived(auth.session?.user?.id ?? null);
  let myEmail = $derived(auth.session?.user?.email ?? null);
  let emailInput = $state("");
  let inviting = $state(false);
  let inviteError = $state("");
  let accepting = $state(false);

  async function handleInvite() {
    const email = emailInput.trim();
    if (!email) return;
    inviting = true;
    inviteError = "";
    try {
      await inviteMember(email);
      emailInput = "";
      await refreshHousehold();
    } catch (e) {
      inviteError = e instanceof Error ? e.message : $_("household.settings.inviteError");
    } finally {
      inviting = false;
    }
  }

  async function handleCancelInvite(id: string) {
    await cancelInvite(id);
    await refreshHousehold();
  }

  async function handleRemoveMember(userId: string) {
    await removeMember(userId);
    await refreshHousehold();
  }

  async function handleAccept(id: string) {
    if (accepting) return;
    accepting = true;
    try {
      await acceptHouseholdInvite(id);
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to accept invite");
      accepting = false;
    }
  }

  let otherMembers = $derived(household.members.filter((m) => m.user_id !== myUserId));
  let outgoingInvites = $derived(household.invites.filter((inv) => inv.invite_email !== myEmail));
  let incomingInvites = $derived(household.invites.filter((inv) => inv.invite_email === myEmail));
</script>

<div class="flex flex-col gap-4">
  <!-- My household: other members -->
  <div>
    {#if otherMembers.length > 0}
      <div>
        {#each otherMembers as m (m.user_id)}
          <div class="flex items-center justify-between gap-2 border-b border-rule py-2.5 last:border-b-0">
            <span class="min-w-0 [overflow-wrap:anywhere] text-[0.9375rem] text-ink">{m.email}</span>
            <button
              onclick={() => handleRemoveMember(m.user_id)}
              class="shrink-0 rounded-input px-1.5 py-1 text-[0.8125rem] font-semibold text-danger transition hover:bg-danger-tint"
            >
              {$_("household.settings.remove")}
            </button>
          </div>
        {/each}
      </div>
    {/if}

    {#if outgoingInvites.length > 0}
      <div>
        {#each outgoingInvites as inv (inv.id)}
          <div class="flex items-center justify-between gap-2 border-b border-rule py-2.5 last:border-b-0">
            <span class="min-w-0 [overflow-wrap:anywhere] text-[0.9375rem] text-ink-3">{inv.invite_email}</span>
            <div class="flex shrink-0 items-center gap-2">
              <span class="text-xs text-ink-3">{$_("household.settings.pending")}</span>
              <button
                onclick={() => handleCancelInvite(inv.id)}
                class="rounded-input px-1.5 py-1 text-[0.8125rem] font-semibold text-ink-3 transition hover:bg-paper-2 hover:text-ink"
              >
                {$_("household.settings.cancelInvite")}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if otherMembers.length === 0 && outgoingInvites.length === 0}
      <p class="text-sm text-ink-3">{$_("household.settings.noMembers")}</p>
    {/if}

    <div class="mt-3 flex gap-2">
      <input
        type="email"
        bind:value={emailInput}
        placeholder={$_("household.settings.emailPlaceholder")}
        class="min-w-0 flex-1 rounded-input border border-rule bg-paper px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
        onkeydown={(e) => e.key === "Enter" && handleInvite()}
      />
      <button
        onclick={handleInvite}
        disabled={inviting || !emailInput.trim()}
        class="shrink-0 rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50"
      >
        {$_("household.settings.invite")}
      </button>
    </div>
    {#if inviteError}
      <p class="mt-1.5 text-xs text-danger">{inviteError}</p>
    {/if}
  </div>

  <!-- Incoming invites for the current user -->
  {#if incomingInvites.length > 0}
    <div>
      <h2 class="mb-2 font-body text-[0.8125rem] font-semibold text-ink">{$_("household.settings.pendingInvites")}</h2>
      <div class="flex flex-col gap-2">
        {#each incomingInvites as inv (inv.id)}
          <div class="flex items-center justify-between gap-2 rounded-input border border-accent-tint-2 bg-accent-tint px-3 py-2.5 text-sm">
            <span class="min-w-0 [overflow-wrap:anywhere] text-ink">
              {$_("household.settings.invitedBy", { values: { email: inv.invited_by_email } })}
            </span>
            <button
              onclick={() => handleAccept(inv.id)}
              disabled={accepting}
              class="shrink-0 rounded-input px-1.5 py-1 text-xs font-semibold text-accent-deep transition hover:bg-accent-tint-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {$_("household.settings.accept")}
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
