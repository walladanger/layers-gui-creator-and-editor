import { afterEach, expect, it, vi } from 'vitest';
import { createStartupRuntime } from './startupRuntime';

const cloud = vi.hoisted(() => ({ createSupabaseRuntime: vi.fn(() => ({ cloud: true })) }));
vi.mock('./supabaseRuntime', () => cloud);

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each([
  ['', ''],
  ['https://example.supabase.co', ''],
  ['', 'sb_publishable_example'],
])('starts locally when cloud configuration is incomplete (%s, %s)', async (url, key) => {
  vi.stubEnv('VITE_SUPABASE_URL', url);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);
  const runtime = await createStartupRuntime();
  expect(await runtime.auth.getUser()).toBeNull();
  expect(cloud.createSupabaseRuntime).not.toHaveBeenCalled();
});

it('keeps cloud startup when both settings exist', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example');
  expect(await createStartupRuntime()).toEqual({ cloud: true });
  expect(cloud.createSupabaseRuntime).toHaveBeenCalledOnce();
});
