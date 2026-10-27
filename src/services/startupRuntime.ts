import { createMemoryRuntime, type StudioRuntime } from './runtime';

/** Standalone builds use the existing guest flow without importing an unconfigured cloud client. */
export async function createStartupRuntime(): Promise<StudioRuntime> {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    return createMemoryRuntime();
  }
  const { createSupabaseRuntime } = await import('./supabaseRuntime');
  return createSupabaseRuntime();
}
