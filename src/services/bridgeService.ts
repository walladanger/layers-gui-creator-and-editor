/** Transport for the fixed radium v1 protocol. One client owns one frame. */
export interface BridgeMessage { ns: 'radium'; v: 1; id: string; type: string; payload: Record<string, unknown> }
export interface BridgeNode { nid: string; tag: string; label: string; text?: string; rid?: string; comp?: string; selector: string; instanceIndex: number; instanceCount: number }
export interface BridgeStyles { computed: Record<string, string>; inline: Record<string, string>; classList: string[] }
/** What the bridge says about the app (the `hello` reply and `ready` event). */
export interface BridgeInfo { bridgeVersion?: string; url?: string; title?: string; framework?: string; hasSourceMap?: boolean; commands?: string[] }
/** A `screenshot` reply: `dataUrl` is the element (or the view when no element was asked for). */
export interface BridgeShot { dataUrl: string; viewDataUrl?: string; viewport?: { width: number; height: number }; rect?: { x: number; y: number; width: number; height: number } }
export const DEFAULT_TIMEOUT_MS = 3000;
export function bridgeOrigin(src: string, origin = window.location.origin) {
  try { const url = new URL(src, origin); return /^https?:$/.test(url.protocol) ? url.origin : null; } catch { return null; }
}
export function connectionSnippet(origin = window.location.origin) {
  return `<script src="${origin}/radium-bridge.js"></script>`;
}
export const VITE_PLUGIN_SNIPPET = `import radiumBridge from 'radium-bridge/vite';\n\nexport default defineConfig({\n  plugins: [radiumBridge(), react()],\n});`;
/** Older bridges do not list their commands; they only had the original set. */
export function bridgeSupports(info: BridgeInfo | null | undefined, command: string) {
  return info?.commands ? info.commands.includes(command) : ['hello', 'tree.get', 'hit.test', 'rect.watch', 'style.get', 'preview.style', 'preview.clear', 'tokens.get', 'nav.go'].includes(command);
}
/** `src/App.tsx:50:9` → file, line and column, for production lists. */
export function parseRid(rid: string | undefined): { file: string; line: number; column: number } | null {
  const m = rid ? /^(.*):(\d+):(\d+)$/.exec(rid) : null;
  return m ? { file: m[1], line: Number(m[2]), column: Number(m[3]) } : null;
}
export class BridgeService {
  private pending = new Map<string, { type: string; resolve(value: Record<string, unknown>): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Set<(message: BridgeMessage) => void>();
  info: BridgeInfo | null = null;
  constructor(private target: () => Window | null, readonly origin: string) { window.addEventListener('message', this.receive); }
  subscribe = (listener: (message: BridgeMessage) => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  supports = (command: string) => bridgeSupports(this.info, command);
  private receive = (event: MessageEvent) => {
    const m = event.data;
    if (event.source !== this.target() || event.origin !== this.origin || !m || m.ns !== 'radium' || m.v !== 1 || typeof m.id !== 'string' || typeof m.type !== 'string') return;
    if ((m.type === 'ready' || m.type === 'hello.ok') && m.payload && typeof m.payload === 'object') this.info = m.payload as BridgeInfo;
    const item = this.pending.get(m.id);
    if (item && (m.type === `${item.type}.ok` || m.type === `${item.type}.err`)) {
      clearTimeout(item.timer); this.pending.delete(m.id);
      if (m.type.endsWith('.err')) item.reject(new Error(m.payload?.message ?? 'The app did not accept that change.'));
      else item.resolve(m.payload ?? {});
    }
    this.listeners.forEach(listener => listener(m));
  };
  request<T = Record<string, unknown>>(type: string, payload: Record<string, unknown> = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    return new Promise((resolve, reject) => {
      const target = this.target();
      if (!target) { reject(new Error('The app is no longer open.')); return; }
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The app did not answer. Try reconnecting.')); }, timeoutMs);
      this.pending.set(id, { type, resolve: value => resolve(value as T), reject, timer });
      target.postMessage({ ns: 'radium', v: 1, id, type, payload }, this.origin);
    });
  }
  /** Element and view images for a comment; resolves to null when the app cannot take one. */
  async screenshot(nid?: string): Promise<BridgeShot | null> {
    if (!this.supports('screenshot')) return null;
    try {
      const shot = await this.request<BridgeShot>('screenshot', { nid, padding: 16, type: 'jpeg', quality: 0.85, maxWidth: 1280, maxElementWidth: 900 }, 10000);
      return typeof shot.dataUrl === 'string' && shot.dataUrl.startsWith('data:image/') ? shot : null;
    } catch { return null; }
  }
  dispose() {
    window.removeEventListener('message', this.receive);
    this.pending.forEach(item => { clearTimeout(item.timer); item.reject(new Error('The app disconnected.')); });
    this.pending.clear(); this.listeners.clear();
  }
}
