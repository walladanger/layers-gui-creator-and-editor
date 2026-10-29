/** Full-size comment screenshots, kept in IndexedDB by comment id. Tasks hold only small thumbnails. */
export interface CommentShotRecord { commentId: string; element?: string; view?: string; createdAt: number }

const DB = 'layers-shots';
const STORE = 'shots';
let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('No IndexedDB'));
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'commentId' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error ?? new Error('Could not open screenshot storage')); };
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const req = work(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Screenshot storage failed'));
  }));
}

export async function saveCommentShots(record: CommentShotRecord): Promise<boolean> {
  try { await run('readwrite', (s) => s.put(record)); return true; } catch { return false; }
}
export async function getCommentShots(commentId: string): Promise<CommentShotRecord | null> {
  try { return (await run<CommentShotRecord | undefined>('readonly', (s) => s.get(commentId))) ?? null; } catch { return null; }
}
export async function removeCommentShots(commentId: string): Promise<void> {
  try { await run('readwrite', (s) => s.delete(commentId)); } catch { /* nothing stored */ }
}
/** For tests: forget the open connection so a fresh IndexedDB can be used. */
export function resetShotStore() { opening = null; }
