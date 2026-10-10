// The only module that touches the Supabase client. Components never import it; they use ServicesProvider.
import { supabase } from '../integrations/supabase/client';
import { lovable } from '../integrations/lovable';
import type { AuthService, AuthUser } from './authService';
import { createSupabaseAdapters, type SupabaseLikeClient } from './supabaseAdapter';
import { createIndexedDbQueueStore } from './queuedWriter';
import { createStudioRuntime, type StudioRuntime } from './runtime';

const toUser = (u: { id: string; email?: string | null } | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email ?? null } : null);

export function createSupabaseAuthService(): AuthService {
  return {
    async getUser() { const { data } = await supabase.auth.getSession(); return toUser(data.session?.user); },
    onChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { kind: 'failure', message: error.message } : { kind: 'success' };
    },
    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) return { kind: 'failure', message: error.message };
      return { kind: 'success', needsConfirmation: !data.session };
    },
    async signInWithGoogle() {
      const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
      if (result.error) return { kind: 'failure', message: result.error instanceof Error ? result.error.message : String(result.error) };
      return { kind: 'success' };
    },
    async signOut() { await supabase.auth.signOut(); },
  };
}

export function createSupabaseRuntime(): StudioRuntime {
  return createStudioRuntime({
    auth: createSupabaseAuthService(),
    adapters: createSupabaseAdapters(supabase as unknown as SupabaseLikeClient),
    store: createIndexedDbQueueStore(),
    listenOnline: true,
  });
}
