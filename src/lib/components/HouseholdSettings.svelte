<script lang="ts">
  import { _ } from "svelte-i18n";
  import { auth } from "../stores/auth.svelte";
  import {
    getHouseholdMembers,
    getHouseholdInvites,
    getPendingInvites,
    inviteMember,
    cancelInvite,
    acceptInvite,
    removeMember,
    leaveHousehold,
    type HouseholdMember,
    type HouseholdInvite,
  } from "../api/household";

  let allMembers = $state<HouseholdMember[]>([]);
  let outgoingInvites = $state<HouseholdInvite[]>([]);
  let incomingInvites = $state<HouseholdInvite[]>([]);
  let myUserId = $derived(auth.session?.user?.id ?? null);
  let myEmail = $derived(auth.session?.user?.email ?? null);
  let emailInput = $state("");
  let inviting = $state(false);
  let inviteError = $state("");

  $effect(() => {
    if (myEmail) void reload();
  });

  async function reload() {
    if (!myEmail) return;
    [allMembers, outgoingInvites, incomingInvites] = await Promise.all([
      getHouseholdMembers(),
      getHouseholdInvites(myEmail),
      getPendingInvites(myEmail),
    ]);
  }

  async function handleInvite() {
    const email = emailInput.trim();
    if (!email) return;
    inviting = true;
    inviteError = "";
    try {
      await inviteMember(email);
      emailInput = "";
      if (myEmail) outgoingInvites = await getHouseholdInvites(myEmail);
    } catch (e) {
      inviteError = e instanceof Error ? e.message : $_("household.settings.inviteError");
    } finally {
      inviting = false;
    }
  }

  async function handleCancelInvite(id: string) {
    await cancelInvite(id);
    if (myEmail) outgoingInvites = await getHouseholdInvites(myEmail);
  }

  async function handleRemoveMember(userId: string) {
    await removeMember(userId);
    allMembers = await getHouseholdMembers();
  }

  async function handleLeave() {
    try {
      await leaveHousehold();
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to leave household");
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptInvite(id);
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to accept invite");
    }
  }

  let otherMembers = $derived(allMembers.filter((m) => m.user_id !== myUserId));
  let isShared = $derived(allMembers.length > 1);
</script>

<div class="flex flex-col gap-6">
  <!-- My household: other members -->
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-medium text-slate-700">{$_("household.settings.myHousehold")}</h2>
      {#if isShared}
        <button
          onclick={handleLeave}
          class="text-xs font-medium text-red-600 hover:underline"
        >
          {$_("household.settings.leave")}
        </button>
      {/if}
    </div>

    {#if otherMembers.length > 0}
      <ul class="flex flex-col gap-2">
        {#each otherMembers as m (m.user_id)}
          <li class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <span class="text-slate-700">{m.email}</span>
            <button
              onclick={() => handleRemoveMember(m.user_id)}
              class="text-xs font-medium text-red-600 hover:underline"
            >
              {$_("household.settings.remove")}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if outgoingInvites.length > 0}
      <ul class="flex flex-col gap-2">
        {#each outgoingInvites as inv (inv.id)}
          <li class="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span class="text-slate-500">{inv.invite_email}</span>
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-400">{$_("household.settings.pending")}</span>
              <button
                onclick={() => handleCancelInvite(inv.id)}
                class="text-xs font-medium text-slate-500 hover:underline"
              >
                {$_("household.settings.cancelInvite")}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if otherMembers.length === 0 && outgoingInvites.length === 0}
      <p class="text-sm text-slate-400">{$_("household.settings.noMembers")}</p>
    {/if}

    <div class="flex gap-2">
      <input
        type="email"
        bind:value={emailInput}
        placeholder={$_("household.settings.emailPlaceholder")}
        class="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
        onkeydown={(e) => e.key === "Enter" && handleInvite()}
      />
      <button
        onclick={handleInvite}
        disabled={inviting || !emailInput.trim()}
        class="shrink-0 rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {$_("household.settings.invite")}
      </button>
    </div>
    {#if inviteError}
      <p class="text-xs text-red-600">{inviteError}</p>
    {/if}
  </div>

  <!-- Incoming invites for the current user -->
  {#if incomingInvites.length > 0}
    <div class="flex flex-col gap-3">
      <h2 class="text-sm font-medium text-slate-700">{$_("household.settings.pendingInvites")}</h2>
      <ul class="flex flex-col gap-2">
        {#each incomingInvites as inv (inv.id)}
          <li class="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm">
            <span class="text-slate-700">
              {$_("household.settings.invitedBy", { values: { email: inv.invited_by_email } })}
            </span>
            <button
              onclick={() => handleAccept(inv.id)}
              class="text-xs font-medium text-orange-600 hover:underline"
            >
              {$_("household.settings.accept")}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
