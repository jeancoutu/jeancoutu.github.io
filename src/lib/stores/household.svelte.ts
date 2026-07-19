import { acceptInvite as acceptInviteApi, leaveHousehold as leaveHouseholdApi, type HouseholdMember, type HouseholdInvite } from "../api/household";
import { onUserChange } from "./auth.svelte";
import { getCachedHousehold, refreshHouseholdCache, type HouseholdCache } from "../repos/householdRepo";
import { wipeLocalDb } from "../db";

class HouseholdStore {
  members = $state<HouseholdMember[]>([]);
  invites = $state<HouseholdInvite[]>([]);
  loaded = $state(false);
}

export const household = new HouseholdStore();

function apply(cache: HouseholdCache): void {
  household.members = cache.members;
  household.invites = cache.invites;
  household.loaded = true;
}

// Reads come from Dexie first (instant, no network round trip on every page
// load); the cache is only ever refreshed on demand — after a local mutation
// or when the realtime subscription (src/lib/sync/realtime.ts) reports a
// change to household_memberships / household_invites.
export async function refreshHousehold(): Promise<void> {
  apply(await refreshHouseholdCache());
}

// Leaving/accepting changes which household's data RLS scopes to, but the
// user id (and therefore currentUserId in src/lib/db) doesn't change, so
// the automatic wipe-on-user-switch never fires. Without an explicit wipe,
// the old household's meals/plans/members — and the just-consumed invite
// itself — stay cached in Dexie and get shown as still current after
// reload. Both call sites (HouseholdSettings, PendingInviteBanner) must
// wipe identically, so that logic lives here instead of being duplicated.
export async function acceptHouseholdInvite(id: string): Promise<void> {
  await acceptInviteApi(id);
  await wipeLocalDb();
}

export async function leaveCurrentHousehold(): Promise<void> {
  await leaveHouseholdApi();
  await wipeLocalDb();
}

onUserChange(async (session) => {
  if (!session) {
    household.members = [];
    household.invites = [];
    household.loaded = false;
    return;
  }
  const cached = await getCachedHousehold();
  if (cached) {
    apply(cached);
  } else {
    await refreshHousehold();
  }
});
