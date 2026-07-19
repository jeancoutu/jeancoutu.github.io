import { db } from "../db";
import {
  getHouseholdMembers,
  getAllPendingInvites,
  type HouseholdMember,
  type HouseholdInvite,
} from "../api/household";

export interface HouseholdCache {
  members: HouseholdMember[];
  invites: HouseholdInvite[];
}

const CACHE_KEY = "householdCache";

export async function getCachedHousehold(): Promise<HouseholdCache | null> {
  const row = await db.meta.get(CACHE_KEY);
  return (row?.value as HouseholdCache | undefined) ?? null;
}

export async function refreshHouseholdCache(): Promise<HouseholdCache> {
  const [members, invites] = await Promise.all([getHouseholdMembers(), getAllPendingInvites()]);
  const cache: HouseholdCache = { members, invites };
  await db.meta.put({ key: CACHE_KEY, value: cache });
  return cache;
}
