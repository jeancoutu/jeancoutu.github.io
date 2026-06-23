<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    getMembers,
    inviteMember,
    removeMember,
    getAcceptedMemberships,
    getPendingInvites,
    acceptInvite,
    type HouseholdMember,
  } from "../api/household";

  let members = $state<HouseholdMember[]>([]);
  let memberships = $state<HouseholdMember[]>([]);
  let pendingInvites = $state<HouseholdMember[]>([]);
  let emailInput = $state("");
  let inviting = $state(false);
  let inviteError = $state("");

  onMount(async () => {
    await reload();
  });

  async function reload() {
    [members, memberships, pendingInvites] = await Promise.all([
      getMembers(),
      getAcceptedMemberships(),
      getPendingInvites(),
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
      members = await getMembers();
    } catch (e) {
      inviteError = e instanceof Error ? e.message : $_("household.settings.inviteError");
    } finally {
      inviting = false;
    }
  }

  async function handleRemove(id: string) {
    await removeMember(id);
    members = await getMembers();
  }

  async function handleLeave(id: string) {
    await removeMember(id);
    window.location.reload();
  }

  async function handleAccept(id: string) {
    try {
      await acceptInvite(id);
      await reload();
    } catch (e) {
      console.error("handleAccept failed:", e);
      alert(e instanceof Error ? e.message : "Failed to accept invite");
    }
  }

  let accepted = $derived(members.filter((m) => m.status === "accepted"));
  let pending = $derived(members.filter((m) => m.status === "pending"));
</script>

<section class="flex flex-col gap-6">
  <!-- Owner section: manage my household -->
  <div class="flex flex-col gap-4">
    <h2 class="text-base font-semibold text-slate-800">{$_("household.settings.myHousehold")}</h2>

    {#if accepted.length > 0}
      <ul class="flex flex-col gap-2">
        {#each accepted as m (m.id)}
          <li class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <span class="text-slate-700">{m.invite_email}</span>
            <button
              onclick={() => handleRemove(m.id)}
              class="text-xs font-medium text-red-600 hover:underline"
            >
              {$_("household.settings.remove")}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if pending.length > 0}
      <ul class="flex flex-col gap-2">
        {#each pending as m (m.id)}
          <li class="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span class="text-slate-500">{m.invite_email}</span>
            <span class="text-xs text-slate-400">{$_("household.settings.pending")}</span>
          </li>
        {/each}
      </ul>
    {/if}

    {#if accepted.length === 0 && pending.length === 0}
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

  <!-- Pending invites for the current user -->
  {#if pendingInvites.length > 0}
    <div class="flex flex-col gap-3">
      <h2 class="text-base font-semibold text-slate-800">{$_("household.settings.pendingInvites")}</h2>
      <ul class="flex flex-col gap-2">
        {#each pendingInvites as m (m.id)}
          <li class="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm">
            <span class="text-slate-700">
              {$_("household.settings.invitedBy", { values: { email: m.owner_email ?? m.owner_id } })}
            </span>
            <button
              onclick={() => handleAccept(m.id)}
              class="text-xs font-medium text-orange-600 hover:underline"
            >
              {$_("household.settings.accept")}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Member section: households I belong to -->
  {#if memberships.length > 0}
    <div class="flex flex-col gap-3">
      <h2 class="text-base font-semibold text-slate-800">{$_("household.settings.sharedWith")}</h2>
      <ul class="flex flex-col gap-2">
        {#each memberships as m (m.id)}
          <li class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <span class="text-slate-700">
              {$_("household.settings.memberOf", { values: { email: m.owner_email ?? m.owner_id } })}
            </span>
            <button
              onclick={() => handleLeave(m.id)}
              class="text-xs font-medium text-red-600 hover:underline"
            >
              {$_("household.settings.leave")}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
