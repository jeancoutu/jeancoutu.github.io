# Feature: Household sharing

## Context
Users can invite another user by email to share their meals and weekly plan.
The invitee becomes a "member" of the owner's household and sees/edits the
owner's data transparently (RLS handles this — no app-level changes needed
for data fetching).

## New table (already created in Supabase)
household_members (id, owner_id, member_id, invite_email, status, created_at)
- status: 'pending' | 'accepted'
- member_id is null until the invite is accepted

---

## Task 1 — Invite API + store [DONE]

Create `src/lib/api/household.ts`:
- `inviteMember(email: string): Promise<void>`
  → insert into household_members (owner_id = current user, invite_email = email)
- `getMembers(): Promise<HouseholdMember[]>`
  → select from household_members where owner_id = current user
- `removeMember(id: string): Promise<void>`
  → delete from household_members
- `getPendingInvites(): Promise<HouseholdMember[]>`
  → select from household_members where member_id = current user and status = 'pending'
- `acceptInvite(id: string): Promise<void>`
  → update household_members set status = 'accepted', member_id = current user where id = id

Add type:
  interface HouseholdMember {
    id: string;
    owner_id: string;
    member_id: string | null;
    invite_email: string;
    status: 'pending' | 'accepted';
  }

---

## Task 2 — Pending invite banner [DONE]

On app load, call `getPendingInvites()`.
If results exist, show a banner at the top of the app:
  "[email] t'a invité à partager son meal plan. [Accepter] [Ignorer]"
- Accepter → call acceptInvite(id), reload the app
- Ignorer → dismiss the banner (no DB change)

---

## Task 3 — Settings page: manage household [DONE]

Create a `HouseholdSettings.svelte` component and add it to the settings/profile page.

When user is an owner:
- Show list of current members (name/email + Remove button)
- Show an email input + "Inviter" button → calls inviteMember()
- Show pending invites with status "En attente"

When user is a member (has accepted an invite):
- Show "Tu partages le meal plan de [owner email]"
- Show a "Quitter" button → calls removeMember(), reloads the app