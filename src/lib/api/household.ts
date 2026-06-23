import { supabase } from "../supabase";

export interface HouseholdMember {
  id: string;
  owner_id: string;
  member_id: string | null;
  invite_email: string;
  owner_email?: string;
  status: 'pending' | 'accepted';
}

export async function inviteMember(email: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("household_members").insert({
    owner_id: user.id,
    invite_email: email,
    owner_email: user.email,
    status: 'pending',
  });
  if (error) throw error;
}

export async function getMembers(): Promise<HouseholdMember[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("household_members")
    .select("id, owner_id, member_id, invite_email, status")
    .eq("owner_id", user.id);
  if (error) throw error;
  return data as HouseholdMember[];
}

export async function removeMember(id: string): Promise<void> {
  const { error } = await supabase.from("household_members").delete().eq("id", id);
  if (error) throw error;
}

export async function getPendingInvites(): Promise<HouseholdMember[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("household_members")
    .select("id, owner_id, member_id, invite_email, owner_email, status")
    .eq("invite_email", user.email)
    .eq("status", "pending");
  if (error) throw error;
  return data as HouseholdMember[];
}

export async function getAcceptedMemberships(): Promise<HouseholdMember[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("household_members")
    .select("id, owner_id, member_id, invite_email, owner_email, status")
    .eq("member_id", user.id)
    .eq("status", "accepted");
  if (error) throw error;
  return data as HouseholdMember[];
}

export async function acceptInvite(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("household_members")
    .update({ status: 'accepted', member_id: user.id })
    .eq("id", id);
  if (error) throw error;
}
