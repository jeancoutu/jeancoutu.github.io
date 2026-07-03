import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

class AuthStore {
  session = $state<Session | null>(null);
  loading = $state(true);
}

export const auth = new AuthStore();

supabase.auth.onAuthStateChange((_event, newSession) => {
  auth.session = newSession;
  auth.loading = false;
});

export function onUserChange(cb: (session: Session | null) => void | Promise<void>): void {
  let prev: string | null = null;
  $effect.root(() => {
    $effect(() => {
      const id = auth.session?.user?.id ?? null;
      if (id === prev) return;
      prev = id;
      void cb(auth.session);
    });
  });
}
