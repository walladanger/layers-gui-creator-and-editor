import { BridgeService, type BridgeNode, type BridgeStyles } from './bridgeService';
import type { Frame } from './types';
import type { StudioServices } from './services';

export const LIVE_STYLE_FIELDS = [
  { property: 'background-color', label: 'Background colour', type: 'color' },
  { property: 'color', label: 'Text colour', type: 'color' },
  { property: 'border-color', label: 'Edge colour', type: 'color' },
  { property: 'border-radius', label: 'Corner radius', type: 'number', max: 200 },
  { property: 'border-width', label: 'Edge thickness', type: 'number', max: 40 },
  { property: 'padding', label: 'Inner spacing', type: 'number', max: 200 },
  { property: 'gap', label: 'Item spacing', type: 'number', max: 200 },
  { property: 'font-size', label: 'Text size', type: 'number', max: 200 },
  { property: 'width', label: 'Width', type: 'number', max: 3840 },
  { property: 'height', label: 'Height', type: 'number', max: 4000 },
] as const;
export interface StyleStep { node: BridgeNode; scope: 'instance' | 'all'; before: Record<string, string>; after: Record<string, string> }
interface Attachment { bridge: BridgeService; frame: Frame; services?: StudioServices; steps: StyleStep[]; redo: StyleStep[]; session?: Promise<string>; unsubscribe(): void }
interface LiveSnapshot { connected: boolean; node: BridgeNode | null; values: Record<string, string>; scope: 'instance' | 'all'; busy: boolean; canUndo: boolean; canRedo: boolean; error: string | null; count: number }
const empty: LiveSnapshot = { connected: false, node: null, values: {}, scope: 'instance', busy: false, canUndo: false, canRedo: false, error: null, count: 0 };
class LiveStyleService {
  private attachments = new Map<string, Attachment>();
  private active: string | null = null;
  private state: LiveSnapshot = empty;
  private listeners = new Set<() => void>();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<LiveSnapshot>) { const a = this.active ? this.attachments.get(this.active) : undefined; this.state = { ...this.state, ...patch, canUndo: !!a?.steps.length, canRedo: !!a?.redo.length, count: a?.steps.length ?? 0 }; this.listeners.forEach(l => l()); }
  attach(id: string, bridge: BridgeService, frame: Frame, services?: StudioServices) {
    const a: Attachment = { bridge, frame, services, steps: [], redo: [], unsubscribe: () => undefined };
    a.unsubscribe = bridge.subscribe(m => { if (m.type === 'dom.changed' && this.active === id && this.state.node && !this.state.busy) void this.recover(a); });
    this.attachments.set(id, a); this.active = id; this.publish({ ...empty, connected: true });
    return () => { a.unsubscribe(); if (this.attachments.get(id) !== a) return; this.attachments.delete(id); if (this.active === id) { this.active = null; this.publish(empty); } };
  }
  select = async (id: string, node: BridgeNode) => {
    const a = this.attachments.get(id); if (!a) return;
    this.active = id; this.publish({ node, scope: 'instance', busy: true, error: null, connected: true });
    try { const styles = await a.bridge.request<BridgeStyles>('style.get', { nid: node.nid }); if (this.active === id && this.state.node?.nid === node.nid) this.publish({ values: styles.computed, busy: false }); }
    catch (error) { this.publish({ busy: false, error: String(error) }); }
  };
  setScope = (scope: 'instance' | 'all') => this.publish({ scope });
  private async recover(a: Attachment) {
    const selected = this.state.node; if (!selected) return;
    try {
      const { nodes } = await a.bridge.request<{ nodes: BridgeNode[] }>('tree.get', { depth: 12 });
      const n = (selected.rid ? nodes.filter(n => n.rid === selected.rid)[selected.instanceIndex] : undefined) ?? nodes.find(n => n.selector === selected.selector);
      if (!n) { this.publish({ node: null, error: 'The selected item disappeared. Your saved changes are kept.' }); return; }
      const styles = await a.bridge.request<BridgeStyles>('style.get', { nid: n.nid });
      this.publish({ node: n, values: styles.computed });
    } catch { /* frame may be reloading; FrameHost handles reconnection */ }
  }
  private async record(a: Attachment, step: StyleStep) {
    if (!a.services) return;
    a.session ??= a.services.sessions.list(a.frame.project_id).then(list => list.find(s => s.status === 'open')?.id ?? a.services?.sessions.create(a.frame.project_id, 'Live app styling').then(s => s.id)).then(id => { if (!id) throw new Error('Could not open a styling session.'); return id; });
    const session_id = await a.session;
    await a.services.changes.record({ session_id, frame_id: a.frame.id, kind: 'style', target: { rid: step.node.rid, comp: step.node.comp, selector: step.node.selector, label: step.node.label, textSnippet: step.node.text, instanceScope: step.scope, breakpoint: a.frame.breakpoint }, before: step.before, after: step.after, css: Object.entries(step.after).map(([p, v]) => `${p}: ${v};`).join('\n') });
  }
  private async applyStep(a: Attachment, step: StyleStep, reverse = false) {
    await a.bridge.request('preview.style', { nid: step.node.nid, scope: step.scope, props: reverse ? step.before : step.after });
    await this.record(a, reverse ? { ...step, before: step.after, after: step.before } : step);
    if (this.state.node?.nid === step.node.nid) { const s = await a.bridge.request<BridgeStyles>('style.get', { nid: step.node.nid }); this.publish({ values: s.computed }); }
  }
  edit = async (property: string, value: string) => {
    const a = this.active ? this.attachments.get(this.active) : undefined; const node = this.state.node;
    if (!a || !node || this.state.busy || !LIVE_STYLE_FIELDS.some(f => f.property === property) || this.state.values[property] === value) return;
    const step: StyleStep = { node, scope: this.state.scope, before: { [property]: this.state.values[property] ?? '' }, after: { [property]: value } };
    this.publish({ busy: true, error: null });
    try { await this.applyStep(a, step); a.steps.push(step); a.redo = []; this.publish({ busy: false }); }
    catch (error) { this.publish({ busy: false, error: `Change could not finish: ${error instanceof Error ? error.message : 'Try again.'}` }); }
  };
  undo = async () => { await this.history(true); };
  redo = async () => { await this.history(false); };
  private async history(reverse: boolean) {
    const a = this.active ? this.attachments.get(this.active) : undefined; if (!a || this.state.busy) return;
    const source = reverse ? a.steps : a.redo; const step = source.at(-1); if (!step) return;
    this.publish({ busy: true, error: null });
    try { await this.applyStep(a, step, reverse); source.pop(); (reverse ? a.redo : a.steps).push(step); this.publish({ busy: false }); }
    catch (error) { this.publish({ busy: false, error: String(error) }); }
  }
  exportCss = () => {
    const a = this.active ? this.attachments.get(this.active) : undefined;
    const rules = new Map<string, Record<string, string>>();
    a?.steps.forEach(s => rules.set(s.node.selector, { ...rules.get(s.node.selector), ...s.after }));
    return [...rules].map(([selector, props]) => `${selector} {\n${Object.entries(props).map(([p, v]) => `  ${p}: ${v};`).join('\n')}\n}`).join('\n\n');
  };
}
export const liveStyleService = new LiveStyleService();
