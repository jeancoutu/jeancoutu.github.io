import { writable } from 'svelte/store';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export const session = writable<Session | null>(null);
export const sessionLoading = writable(true);

supabase.auth.getSession().then(({ data }) => {
  session.set(data.session);
  sessionLoading.set(false);
});

supabase.auth.onAuthStateChange((_event, newSession) => {
  session.set(newSession);
});
