/**
 * Runs the same service suite against Lovable Cloud with real row-level security.
 * Skipped unless two confirmed test accounts are provided:
 *   RADIUM_LIVE_ALICE_EMAIL / RADIUM_LIVE_ALICE_PASSWORD / RADIUM_LIVE_BOB_EMAIL / RADIUM_LIVE_BOB_PASSWORD
 */
import { createClient } from '@supabase/supabase-js';
import { createMemoryQueueStore } from './queuedWriter';
import { createStudioRuntime } from './runtime';
import { createMemoryAuthService } from './authService';
import { createSupabaseAdapters, type SupabaseLikeClient } from './supabaseAdapter';
import { createSupabaseStorageAdapter, type SupabaseStorageLike } from './storageService';
import { runServiceSuite } from './serviceSuite';

const env = ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {});
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const accounts = {
  alice: { email: env.RADIUM_LIVE_ALICE_EMAIL, password: env.RADIUM_LIVE_ALICE_PASSWORD },
  bob: { email: env.RADIUM_LIVE_BOB_EMAIL, password: env.RADIUM_LIVE_BOB_PASSWORD },
};
const enabled = Boolean(url && key && accounts.alice.email && accounts.alice.password && accounts.bob.email && accounts.bob.password);

if (enabled) {
  runServiceSuite('Lovable Cloud adapters', async () => {
    const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
    const runtime = createStudioRuntime({
      auth: createMemoryAuthService(),
      adapters: createSupabaseAdapters(client as unknown as SupabaseLikeClient),
      store: createMemoryQueueStore(),
      storage: createSupabaseStorageAdapter(client.storage as unknown as SupabaseStorageLike),
    });
    return {
      services: runtime.services,
      writer: runtime.writer,
      async signInAs(label) {
        const { data, error } = await client.auth.signInWithPassword({ email: accounts[label].email!, password: accounts[label].password! });
        if (error || !data.user) throw error ?? new Error('sign-in failed');
        runtime.setCurrentUser({ id: data.user.id, email: data.user.email ?? null });
        return data.user.id;
      },
      async cleanup() { await client.auth.signOut(); },
    };
  });
} else {
  test.skip('Lovable Cloud adapters (set RADIUM_LIVE_* test accounts to run)', () => undefined);
}
