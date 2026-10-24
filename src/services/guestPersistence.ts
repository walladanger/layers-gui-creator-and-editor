// Guest persistence: the app runs without sign-in, so the in-memory database is
// snapshotted to localStorage and restored on the next visit. Nothing leaves the browser.

import { createMemoryDatabase, type MemoryDatabase } from './memoryAdapter';
import { tableNames } from './types';

const DB_KEY = 'layers.guestDb.v1';
const GUEST_ID_KEY = 'layers.guestId';

function defaultStorage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

/** Stable id for the guest user, so saved projects stay owned by the same "user" across visits. */
export function guestUserId(storage: Storage | undefined = defaultStorage()): string {
  const existing = storage?.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  storage?.setItem(GUEST_ID_KEY, id);
  return id;
}

export function setGuestUserId(id: string, storage: Storage | undefined = defaultStorage()) {
  storage?.setItem(GUEST_ID_KEY, id);
}

/** Restores the saved guest database, or null when there is none (or it is unreadable). */
export function loadGuestDatabase(storage: Storage | undefined = defaultStorage()): MemoryDatabase | null {
  try {
    const raw = storage?.getItem(DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tables?: Record<string, unknown> };
    if (!parsed || typeof parsed !== 'object' || !parsed.tables) return null;
    const db = createMemoryDatabase();
    for (const name of tableNames) {
      const rows = parsed.tables[name];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string') {
          (db[name] as Map<string, unknown>).set((row as { id: string }).id, row);
        }
      }
    }
    return db;
  } catch {
    return null;
  }
}

export function saveGuestDatabase(db: MemoryDatabase, storage: Storage | undefined = defaultStorage()) {
  if (!storage) return;
  const tables: Record<string, unknown[]> = {};
  for (const name of tableNames) tables[name] = [...db[name].values()];
  try {
    storage.setItem(DB_KEY, JSON.stringify({ version: 1, tables }));
  } catch {
    // Storage full or blocked: keep running in memory rather than losing the session.
  }
}

/** Saves the guest database regularly and when the page is hidden or closed. Returns a stop function. */
export function startGuestPersistence(db: MemoryDatabase, storage: Storage | undefined = defaultStorage(), intervalMs = 2000): () => void {
  if (!storage) return () => undefined;
  const save = () => saveGuestDatabase(db, storage);
  const timer = setInterval(save, intervalMs);
  const onHide = () => { if (typeof document === 'undefined' || document.visibilityState === 'hidden') save(); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide);
  if (typeof window !== 'undefined') window.addEventListener('pagehide', save);
  return () => {
    clearInterval(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', save);
    save();
  };
}
