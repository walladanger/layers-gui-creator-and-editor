import { createMemoryRuntime } from './runtime';
import { guestUserId, loadGuestDatabase, saveGuestDatabase, setGuestUserId, startGuestPersistence } from './guestPersistence';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    map,
  } as unknown as Storage;
}

test('a saved guest database loads back with its projects and members', async () => {
  const storage = fakeStorage();
  const runtime = createMemoryRuntime();
  await runtime.auth.signUp('guest@radium.local', 'secret1');
  const user = await runtime.auth.getUser();
  runtime.setCurrentUser(user);
  await runtime.services.projects.create({ name: 'My app', target_mode: 'live', target_url: 'http://localhost:5173' });

  saveGuestDatabase(runtime.db, storage);
  const restored = loadGuestDatabase(storage);
  expect(restored).not.toBeNull();
  expect([...restored!.projects.values()].map((p) => p.name).sort()).toEqual(['Demo: Radium Ollama', 'My app']);
  expect(restored!.project_members.size).toBeGreaterThan(0);
});

test('loadGuestDatabase returns null for missing or corrupt data', () => {
  const storage = fakeStorage();
  expect(loadGuestDatabase(storage)).toBeNull();
  storage.setItem('layers.guestDb.v1', '{not json');
  expect(loadGuestDatabase(storage)).toBeNull();
  storage.setItem('layers.guestDb.v1', JSON.stringify({ tables: { projects: [{ name: 'no id' }] } }));
  expect(loadGuestDatabase(storage)!.projects.size).toBe(0);
});

test('the guest user id is stable once assigned', () => {
  const storage = fakeStorage();
  const first = guestUserId(storage);
  expect(guestUserId(storage)).toBe(first);
  setGuestUserId('fixed-id', storage);
  expect(guestUserId(storage)).toBe('fixed-id');
});

test('startGuestPersistence saves on interval and stop saves a final time', () => {
  vi.useFakeTimers();
  const storage = fakeStorage();
  const runtime = createMemoryRuntime();
  const stop = startGuestPersistence(runtime.db, storage, 1000);
  expect(loadGuestDatabase(storage)).toBeNull();
  vi.advanceTimersByTime(1000);
  expect(loadGuestDatabase(storage)).not.toBeNull();
  storage.removeItem('layers.guestDb.v1');
  stop();
  expect(loadGuestDatabase(storage)).not.toBeNull();
  vi.useRealTimers();
});
