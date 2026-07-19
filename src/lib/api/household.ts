import { supabase } from "../supabase";

export interface HouseholdMember {
  user_id: string;
  email: string;
  joined_at: string;
}

export interface HouseholdInvite {
  id: string;
  household_id: string;
  invited_by: string;
  invited_by_email: string;
  invite_email: string;
  status: "pending";
  created_at: string;
}

export async function getMyHouseholdId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("household_memberships")
    .select("household_id")
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
  return data.household_id;
}

/** All members of the current user's household (includes the current user). */
export async function getHouseholdMembers(): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from("household_memberships")
    .select("user_id, email, joined_at");
  if (error) throw error;
  return data;
}

/** Pending invites sent FROM the current user's household. */
export async function getHouseholdInvites(userEmail: string): Promise<HouseholdInvite[]> {
  const { data, error } = await supabase
    .from("household_invites")
    .select("id, household_id, invited_by, invited_by_email, invite_email, status, created_at")
    .eq("status", "pending")
    .neq("invite_email", userEmail);
  if (error) throw error;
  return data as HouseholdInvite[];
}

/**
 * All pending invites visible to the current user: outgoing (sent from
 * their household) and incoming (sent to their email) in one query — RLS
 * already scopes rows to `household_id = get_my_household_id() OR
 * invite_email = auth.jwt() email`, so a single unfiltered select covers
 * both instead of two round trips.
 */
export async function getAllPendingInvites(): Promise<HouseholdInvite[]> {
  const { data, error } = await supabase
    .from("household_invites")
    .select("id, household_id, invited_by, invited_by_email, invite_email, status, created_at")
    .eq("status", "pending");
  if (error) throw error;
  return data as HouseholdInvite[];
}

/** Pending invites sent TO the current user's email. */
export async function getPendingInvites(userEmail: string): Promise<HouseholdInvite[]> {
  const { data, error } = await supabase
    .from("household_invites")
    .select("id, household_id, invited_by, invited_by_email, invite_email, status, created_at")
    .eq("invite_email", userEmail)
    .eq("status", "pending");
  if (error) throw error;
  return data as HouseholdInvite[];
}

export async function inviteMember(email: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership, error: membershipError } = await supabase
    .from("household_memberships")
    .select("household_id, email")
    .eq("user_id", user.id)
    .single();
  if (membershipError) throw membershipError;

  const { error } = await supabase.from("household_invites").insert({
    household_id: membership.household_id,
    invited_by: user.id,
    invited_by_email: membership.email,
    invite_email: email,
    status: "pending",
  });
  if (error) throw error;
}

export async function cancelInvite(id: string): Promise<void> {
  const { error } = await supabase.from("household_invites").delete().eq("id", id);
  if (error) throw error;
}

export async function acceptInvite(id: string): Promise<void> {
  const { error } = await supabase.rpc("accept_household_invite", { invite_id: id });
  if (error) throw error;
}

/** Remove another member from the shared household (they go back to a solo household). */
export async function removeMember(userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_from_household", { target_user_id: userId });
  if (error) throw error;
}

/** Leave the current shared household and go back to a solo household. */
export async function leaveHousehold(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.rpc("remove_from_household", { target_user_id: user.id });
  if (error) throw error;
}
