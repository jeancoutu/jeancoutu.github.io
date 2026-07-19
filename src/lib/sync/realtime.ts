import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { onUserChange } from "../stores/auth.svelte";
import { scheduleDebouncedSync } from "./engine";
import { refreshHousehold } from "../stores/household.svelte";

// Realtime never patches state directly (Decision 7): every event just
// triggers the same debounced delta-sync pull used for local writes, so
// there is one code path for "something changed" regardless of source.
// RLS scopes the underlying replication stream to the caller's household,
// same as any other Supabase query, so no extra household filter is needed.
const TABLES = ["meals", "weekly_plans", "grocery_presets", "grocery_items"] as const;

// Household membership/invites aren't part of the offline sync engine (see
// src/lib/api/household.ts) — they're a plain Dexie-backed read cache
// (src/lib/repos/householdRepo.ts), so a change just triggers a direct
// cache refresh rather than scheduleDebouncedSync's delta-pull machinery.
const HOUSEHOLD_TABLES = ["household_memberships", "household_invites"] as const;

const CHANNEL_NAME = "mealplanner-sync-realtime";

let channel: RealtimeChannel | null = null;
let hasSession = false;

let householdDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const HOUSEHOLD_DEBOUNCE_MS = 800;

function scheduleHouseholdRefresh(): void {
  if (householdDebounceTimer) clearTimeout(householdDebounceTimer);
  householdDebounceTimer = setTimeout(() => {
    householdDebounceTimer = null;
    void refreshHousehold();
  }, HOUSEHOLD_DEBOUNCE_MS);
}

function teardown(): void {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
}

function subscribe(): void {
  teardown();
  let ch = supabase.channel(CHANNEL_NAME);
  for (const table of TABLES) {
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
      scheduleDebouncedSync();
    });
  }
  for (const table of HOUSEHOLD_TABLES) {
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
      scheduleHouseholdRefresh();
    });
  }
  ch.subscribe();
  channel = ch;
}

// iOS Safari kills the realtime socket whenever the PWA is backgrounded, so
// coming back to foreground/online must re-establish the channel rather than
// assume the old one is still live; the plain delta pull on the same
// triggers (engine.ts) already covers the gap while the socket is down for
// meals/plans/presets/items. Household data has no delta pull to fall back
// on (it's a full refetch cache, not part of pull_changes), so online/
// visibilitychange also force a refresh here — otherwise a change missed
// while the socket was dead (e.g. removed from the household, an invite
// accepted) wouldn't surface until the next unrelated mutation. The initial
// login case doesn't need this: household.svelte.ts's own onUserChange
// already loads from cache (or network if empty) on session start, and
// forcing a second unconditional fetch here would undercut that cache-first
// design on every app launch.
export function initRealtimeSync(): void {
  onUserChange((session) => {
    hasSession = session !== null;
    if (hasSession) {
      subscribe();
    } else {
      teardown();
    }
  });

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      if (hasSession) {
        subscribe();
        void refreshHousehold();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && hasSession) {
        subscribe();
        void refreshHousehold();
      }
    });
  }
}
