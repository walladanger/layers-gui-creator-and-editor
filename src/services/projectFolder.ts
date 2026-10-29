// Writes production lists into the app's own folder (`.radium/production/`), where a coding agent
// can read them. Uses the File System Access API (Chrome, Edge and the desktop app); the chosen
// folder is remembered per project so the next save needs no picking.
export interface WritableFile { createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }> }
export interface WritableDir {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WritableDir>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WritableFile>;
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
}
export interface FolderFile { path: string; data: string | Blob }

const DB = 'layers-folders';
const STORE = 'folders';
type Picker = (options?: { id?: string; mode?: 'readwrite' }) => Promise<WritableDir>;
const picker = () => (typeof window !== 'undefined' ? (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker : undefined);
export const supportsProjectFolders = () => !!picker();

function store<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('No IndexedDB')); return; }
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = work(open.result.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => { resolve(req.result); open.result.close(); };
      req.onerror = () => { reject(req.error); open.result.close(); };
    };
  });
}
const remember = (key: string, dir: WritableDir) => store('readwrite', (s) => s.put(dir, key)).catch(() => undefined);
const recall = (key: string) => store<WritableDir | undefined>('readonly', (s) => s.get(key)).catch(() => undefined);

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',', 2);
  const type = /^data:([^;,]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bytes = atob(body ?? '');
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) out[i] = bytes.charCodeAt(i);
  return new Blob([out], { type });
}

/** The remembered folder for a project if access is still granted, else asks the user to pick one. */
export async function projectFolder(projectKey: string, { pick = false } = {}): Promise<WritableDir | null> {
  if (!pick) {
    const saved = await recall(projectKey);
    if (saved) {
      const state = (await saved.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
      if (state === 'granted' || (await saved.requestPermission?.({ mode: 'readwrite' })) === 'granted') return saved;
    }
  }
  const choose = picker();
  if (!choose) throw new Error('This browser cannot write to folders. Use Chrome, Edge or the desktop app, or download the files instead.');
  let dir: WritableDir;
  try { dir = await choose({ id: 'layers-project', mode: 'readwrite' }); } catch { return null; }
  await remember(projectKey, dir);
  return dir;
}

/** Writes files under `dir`, creating folders on the way; paths use forward slashes. */
export async function writeFiles(dir: WritableDir, files: FolderFile[]): Promise<void> {
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name || parts.some((p) => p === '..')) throw new Error(`Unsafe path: ${file.path}`);
    let here = dir;
    for (const part of parts) here = await here.getDirectoryHandle(part, { create: true });
    const out = await (await here.getFileHandle(name, { create: true })).createWritable();
    await out.write(file.data);
    await out.close();
  }
}

/** Saves a file through the browser's download bar, for browsers without folder access. */
export function downloadFile(name: string, data: string | Blob, type = 'text/plain') {
  const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type }) : data);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
