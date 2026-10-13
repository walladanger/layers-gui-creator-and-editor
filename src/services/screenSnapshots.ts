import type { ScreenEntry } from './projectSource';

export interface ScreenSelection { screen: ScreenEntry; sourceKey: string; revision: number }
const listeners = new Set<() => void>();
let snapshots: Readonly<Record<string, string>> = {};
export const screenSnapshotKey = (sourceKey: string, screenId: string) => JSON.stringify([sourceKey, screenId]);
export const subscribeScreenSnapshots = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getScreenSnapshots = () => snapshots;

/** Session-only, bounded preview cache, separate from production change-record screenshots. */
export function saveScreenSnapshot(sourceKey: string, screenId: string, dataUrl: string) {
  if (!dataUrl.startsWith('data:image/png;base64,')) return;
  const key = screenSnapshotKey(sourceKey, screenId);
  const entries = Object.entries(snapshots).filter(([k]) => k !== key).slice(-39);
  snapshots = { ...Object.fromEntries(entries), [key]: dataUrl };
  listeners.forEach((listener) => listener());
}

/** Capture same-origin frames directly; connected external targets use Contract A's screenshot command. */
export async function captureScreenSnapshot(iframe: HTMLIFrameElement): Promise<string> {
  try {
    const doc = iframe.contentDocument;
    if (doc?.documentElement && doc.body?.children.length) {
      await doc.fonts?.ready;
      const { domToPng } = await import('modern-screenshot');
      return await domToPng(doc.documentElement, {
        width: iframe.clientWidth, height: iframe.clientHeight,
        scale: Math.min(1, 400 / Math.max(1, iframe.clientWidth)),
      });
    }
  } catch { /* A cross-origin document is only accessible through its bridge. */ }
  const target = iframe.contentWindow;
  const origin = new URL(iframe.src, window.location.href).origin;
  if (!target || origin === 'null') throw new Error('Preview unavailable');
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); };
    const receive = (event: MessageEvent) => {
      const m = event.data;
      if (event.source !== target || event.origin !== origin || m?.ns !== 'radium' || m.v !== 1 || m.id !== id) return;
      if (m.type === 'screenshot.ok' && typeof m.payload?.dataUrl === 'string') {
        cleanup(); resolve(m.payload.dataUrl);
      } else if (m.type === 'screenshot.err') { cleanup(); reject(new Error('Preview unavailable')); }
    };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('Preview unavailable')); }, 8000);
    window.addEventListener('message', receive);
    target.postMessage({ ns: 'radium', v: 1, id, type: 'screenshot', payload: {} }, origin);
  });
}