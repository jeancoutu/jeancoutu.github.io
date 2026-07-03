import { writable } from 'svelte/store';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export const session = writable<Session | null>(null);
export const sessionLoading = writable(true);

supabase.auth.onAuthStateChange((_event, newSession) => {
  session.set(newSession);
  sessionLoading.set(false);
});

export function onUserChange(cb: (session: Session | null) => void | Promise<void>): void {
  let prev: string | null = null;
  session.subscribe((s) => {
    const id = s?.user?.id ?? null;
    if (id === prev) return;
    prev = id;
    void cb(s);
  });
}
