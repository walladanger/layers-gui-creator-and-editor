import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  guestUserId,
  setGuestUserId,
  loadGuestDatabase,
  saveGuestDatabase,
  startGuestPersistence
} from './guestPersistence';
import { createMemoryDatabase, MemoryDatabase } from './memoryAdapter';
import { tableNames } from './types';

describe('guestPersistence', () => {
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

  describe('guestUserId', () => {
    it('should return existing ID from storage', () => {
      store['layers.guestId'] = 'test-id';
      expect(guestUserId(mockStorage)).toBe('test-id');
    });

    it('should generate, save and return new UUID if not in storage', () => {
      const mockUUID = '12345678-1234-1234-1234-1234567890ab';
      const originalUUID = crypto.randomUUID;
      crypto.randomUUID = vi.fn(() => mockUUID) as any;

      const id = guestUserId(mockStorage);

      expect(id).toBe(mockUUID);
      expect(mockStorage.setItem).toHaveBeenCalledWith('layers.guestId', mockUUID);
      expect(store['layers.guestId']).toBe(mockUUID);

      crypto.randomUUID = originalUUID;
    });

    it('should return a generated ID even if storage is undefined', () => {
      const id = guestUserId(undefined);
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('setGuestUserId', () => {
    it('should explicitly set the ID in storage', () => {
      setGuestUserId('new-id', mockStorage);
      expect(mockStorage.setItem).toHaveBeenCalledWith('layers.guestId', 'new-id');
      expect(store['layers.guestId']).toBe('new-id');
    });

    it('should handle undefined storage gracefully', () => {
      expect(() => setGuestUserId('new-id', undefined)).not.toThrow();
    });
  });

  describe('loadGuestDatabase', () => {
    it('should return null if there is no database in storage', () => {
      expect(loadGuestDatabase(mockStorage)).toBeNull();
    });

    it('should return null if storage is undefined', () => {
      expect(loadGuestDatabase(undefined)).toBeNull();
    });

    it('should return null if storage has invalid JSON', () => {
      store['layers.guestDb.v1'] = 'invalid-json';
      expect(loadGuestDatabase(mockStorage)).toBeNull();
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

  describe('saveGuestDatabase', () => {
    it('should save all tables into storage as JSON', () => {
      const db = createMemoryDatabase();
      db.projects.set('proj-1', { id: 'proj-1', name: 'Test Project' } as any);
      db.frames.set('frame-1', { id: 'frame-1', label: 'Test Frame' } as any);

      saveGuestDatabase(db, mockStorage);

      expect(mockStorage.setItem).toHaveBeenCalledWith('layers.guestDb.v1', expect.any(String));

      const savedStr = store['layers.guestDb.v1'];
      const parsed = JSON.parse(savedStr);

      expect(parsed.version).toBe(1);
      expect(parsed.tables.projects).toEqual([{ id: 'proj-1', name: 'Test Project' }]);
      expect(parsed.tables.frames).toEqual([{ id: 'frame-1', label: 'Test Frame' }]);
      expect(parsed.tables.sessions).toEqual([]); // Empty table
    });

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

  describe('startGuestPersistence', () => {
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

    it('should set an interval that saves the database', () => {
      startGuestPersistence(db, mockStorage, 2000);

      expect(mockStorage.setItem).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(mockStorage.setItem).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2000);
      expect(mockStorage.setItem).toHaveBeenCalledTimes(2);
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
