import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { onUserChange } from "../stores/auth.svelte";
import { scheduleDebouncedSync } from "./engine";

// Realtime never patches state directly (Decision 7): every event just
// triggers the same debounced delta-sync pull used for local writes, so
// there is one code path for "something changed" regardless of source.
// RLS scopes the underlying replication stream to the caller's household,
// same as any other Supabase query, so no extra household filter is needed.
const TABLES = ["meals", "weekly_plans", "grocery_presets", "grocery_items"] as const;

const CHANNEL_NAME = "mealplanner-sync-realtime";

let channel: RealtimeChannel | null = null;
let hasSession = false;

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
  ch.subscribe();
  channel = ch;
}

// iOS Safari kills the realtime socket whenever the PWA is backgrounded, so
// coming back to foreground/online must re-establish the channel rather than
// assume the old one is still live; the plain delta pull on the same
// triggers (engine.ts) already covers the gap while the socket is down.
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
      if (hasSession) subscribe();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && hasSession) subscribe();
    });
  }
}
