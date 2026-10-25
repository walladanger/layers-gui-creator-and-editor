import { describe, it, expect as vExpect, vi as vVi, beforeEach, afterEach } from 'vitest';
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

import { createMemoryDatabase, MemoryDatabase } from './memoryAdapter';

describe('guestPersistence focused unit tests', () => {
  let store: Record<string, string>;
  let mockStorage: Storage;

  beforeEach(() => {
    store = {};
    mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      length: 0,
      key: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('guestUserId edge cases', () => {
    it('should generate, save and return new UUID if not in storage', () => {
      const mockUUID = '12345678-1234-1234-1234-1234567890ab';

      vi.stubGlobal('crypto', {
        randomUUID: vi.fn(() => mockUUID)
      });

      const id = guestUserId(mockStorage);

      expect(id).toBe(mockUUID);
      expect(mockStorage.setItem).toHaveBeenCalledWith('layers.guestId', mockUUID);
      expect(store['layers.guestId']).toBe(mockUUID);

      vi.unstubAllGlobals();
    });

    it('should return a generated ID even if storage is undefined', () => {
      const id = guestUserId(undefined);
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('setGuestUserId edge cases', () => {
    it('should handle undefined storage gracefully', () => {
      expect(() => setGuestUserId('new-id', undefined)).not.toThrow();
    });
  });

  describe('loadGuestDatabase edge cases', () => {
    it('should return null if storage is undefined', () => {
      expect(loadGuestDatabase(undefined)).toBeNull();
    });

    it('should return null if parsed data is missing tables', () => {
      store['layers.guestDb.v1'] = JSON.stringify({ version: 1 });
      expect(loadGuestDatabase(mockStorage)).toBeNull();
    });

    it('should load tables correctly and ignore invalid tables and rows', () => {
      store['layers.guestDb.v1'] = JSON.stringify({
        version: 1,
        tables: {
          projects: [
            { id: 'proj-1', name: 'Project 1' },
            { name: 'Missing ID' }, // invalid row missing id
            'Invalid Row Type', // invalid row type
            null, // invalid row type
          ],
          unknown_table: [
            { id: 'unknown', name: 'Unknown' } // table not in tableNames
          ],
          frames: 'Not an array', // invalid table structure
        }
      });

      const db = loadGuestDatabase(mockStorage);

      expect(db).not.toBeNull();
      expect(db?.projects.get('proj-1')).toEqual({ id: 'proj-1', name: 'Project 1' });
      expect(db?.projects.size).toBe(1);

      // Other tables should be empty maps
      expect(db?.frames.size).toBe(0);
      expect(db?.sessions.size).toBe(0);
    });
  });

  describe('saveGuestDatabase edge cases', () => {
    it('should not throw if storage is undefined', () => {
      const db = createMemoryDatabase();
      expect(() => saveGuestDatabase(db, undefined)).not.toThrow();
    });

    it('should gracefully handle storage errors (e.g. quota exceeded)', () => {
      const db = createMemoryDatabase();

      // Simulate quota exceeded
      mockStorage.setItem = vi.fn(() => {
        throw new Error('Quota exceeded');
      });

      expect(() => saveGuestDatabase(db, mockStorage)).not.toThrow();
    });
  });

  describe('startGuestPersistence edge cases', () => {
    let mockDocument: any;
    let mockWindow: any;
    let db: MemoryDatabase;
    let listeners: Record<string, Function[]>;

    beforeEach(() => {
      vi.useFakeTimers();
      db = createMemoryDatabase();
      listeners = {};

      const addListener = (event: string, callback: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      };

      const removeListener = (event: string, callback: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(cb => cb !== callback);
        }
      };

      mockDocument = {
        visibilityState: 'visible',
        addEventListener: vi.fn(addListener),
        removeEventListener: vi.fn(removeListener),
      };

      mockWindow = {
        addEventListener: vi.fn(addListener),
        removeEventListener: vi.fn(removeListener),
      };

      vi.stubGlobal('document', mockDocument);
      vi.stubGlobal('window', mockWindow);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('should save database when document visibility is hidden', () => {
      startGuestPersistence(db, mockStorage, 2000);

      mockDocument.visibilityState = 'hidden';
      // Trigger the event listener
      listeners['visibilitychange']?.forEach(cb => cb());

      expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should not save database when document visibility is visible', () => {
      startGuestPersistence(db, mockStorage, 2000);

      mockDocument.visibilityState = 'visible';
      // Trigger the event listener
      listeners['visibilitychange']?.forEach(cb => cb());

      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('should save database when page is hidden', () => {
      startGuestPersistence(db, mockStorage, 2000);

      // Trigger the event listener
      listeners['pagehide']?.forEach(cb => cb());

      expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('teardown should stop the interval, remove listeners, and save one last time', () => {
      const stop = startGuestPersistence(db, mockStorage, 2000);

      stop();

      // Should have saved one last time
      expect(mockStorage.setItem).toHaveBeenCalledTimes(1);

      // Listeners should be removed
      expect(mockDocument.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));

      // Interval should be cleared
      (mockStorage.setItem as any).mockClear();
      vi.advanceTimersByTime(2000);
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle undefined storage gracefully', () => {
      const stop = startGuestPersistence(db, undefined, 2000);
      expect(typeof stop).toBe('function');
      expect(() => stop()).not.toThrow();
    });
  });
});
