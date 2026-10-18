/** Transport for the fixed radium v1 protocol. One client owns one frame. */
export interface BridgeMessage { ns: 'radium'; v: 1; id: string; type: string; payload: Record<string, unknown> }
export interface BridgeNode { nid: string; tag: string; label: string; text?: string; rid?: string; comp?: string; selector: string; instanceIndex: number; instanceCount: number }
export interface BridgeStyles { computed: Record<string, string>; inline: Record<string, string>; classList: string[] }
export function bridgeOrigin(src: string, origin = window.location.origin) {
  try { const url = new URL(src, origin); return /^https?:$/.test(url.protocol) ? url.origin : null; } catch { return null; }
}
export function connectionSnippet(origin = window.location.origin) {
  return `<script src="${origin}/radium-bridge.js"></script>`;
}
export class BridgeService {
  private pending = new Map<string, { type: string; resolve(value: Record<string, unknown>): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Set<(message: BridgeMessage) => void>();
  constructor(private target: () => Window | null, readonly origin: string) { window.addEventListener('message', this.receive); }
  subscribe = (listener: (message: BridgeMessage) => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private receive = (event: MessageEvent) => {
    const m = event.data;
    if (event.source !== this.target() || event.origin !== this.origin || !m || m.ns !== 'radium' || m.v !== 1 || typeof m.id !== 'string' || typeof m.type !== 'string') return;
    const item = this.pending.get(m.id);
    if (item && (m.type === `${item.type}.ok` || m.type === `${item.type}.err`)) {
      clearTimeout(item.timer); this.pending.delete(m.id);
      if (m.type.endsWith('.err')) item.reject(new Error(m.payload?.message ?? 'The app did not accept that change.'));
      else item.resolve(m.payload ?? {});
    }
    this.listeners.forEach(listener => listener(m));
  };
  request<T = Record<string, unknown>>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const target = this.target();
      if (!target) { reject(new Error('The app is no longer open.')); return; }
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The app did not answer. Try reconnecting.')); }, 3000);
      this.pending.set(id, { type, resolve: value => resolve(value as T), reject, timer });
      target.postMessage({ ns: 'radium', v: 1, id, type, payload }, this.origin);
    });
  }
  dispose() {
    window.removeEventListener('message', this.receive);
    this.pending.forEach(item => { clearTimeout(item.timer); item.reject(new Error('The app disconnected.')); });
    this.pending.clear(); this.listeners.clear();
  }
}
