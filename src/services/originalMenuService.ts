/** Same-origin demo adapter. The original HTML remains the authority for actions and values. */
export interface OriginalControl {
  key: string;
  tag: string;
  text?: string;
  attrs?: Record<string, string>;
  children?: OriginalControl[];
}
export interface OriginalSection {
  id: string;
  label: string;
  controls: OriginalControl[];
  actions: OriginalControl[];
}
export interface OriginalDialog { title: string; text: string; ok: string; danger: boolean }
export interface OriginalMenuSnapshot { connected: boolean; canUndo: boolean; canRedo: boolean; sections: OriginalSection[]; dialog?: OriginalDialog; toast?: string; commentBox?: { label: string; controls: OriginalControl[] } }
type StyleState = Record<string, unknown>;
type HistoryEntry = { kind: 'style'; before: StyleState; after: StyleState; control?: string; at: number } | { kind: 'native'; before: string; after: string };
type FrameHistory = { undo: HistoryEntry[]; redo: HistoryEntry[]; style: StyleState; edits: string; replaying: boolean };
const EMPTY: OriginalMenuSnapshot = { connected: false, canUndo: false, canRedo: false, sections: [] };
const ATTRS = ['type', 'min', 'max', 'step', 'value', 'placeholder', 'aria-label', 'aria-pressed', 'aria-checked', 'role', 'title', 'readonly', 'disabled', 'for'];
const TAGS = new Set(['div', 'span', 'section', 'p', 'b', 'small', 'label', 'input', 'output', 'button', 'textarea', 'ul', 'ol', 'li', 'select', 'option', 'h4', 'details', 'summary']);

export class OriginalMenuService {
  private frames = new Map<string, Document>();
  private active: string | null = null;
  private listeners = new Set<() => void>();
  private controls = new Map<string, HTMLElement>();
  private snapshot: OriginalMenuSnapshot = EMPTY;
  private counter = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private observers = new Map<string, MutationObserver>();
  private pointerListeners = new Map<string, { doc: Document; listener: () => void }>();
  private histories = new Map<string, FrameHistory>();
  private keyboardListeners = new Map<string, (event: KeyboardEvent) => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;

  attach(id: string, doc: Document) {
    this.detach(id);
    if (!doc.querySelector('#panel .lab-sec')) return () => undefined;
    this.frames.set(id, doc);
    this.histories.set(id, { undo: [], redo: [], style: this.readStyle(doc), edits: this.readEdits(doc), replaying: false });
    this.active = this.active ?? id;
    // Open the original motion controls once; hide their presentation, never their execution.
    doc.querySelector<HTMLButtonElement>('#openMotion')?.click();
    const notes = doc.querySelector<HTMLButtonElement>('#ed-bar [data-ed="drawer"]');
    if (notes?.getAttribute('aria-pressed') === 'false') notes.click();
    const chrome = doc.createElement('style');
    chrome.id = 'layers-demo-chrome';
    chrome.textContent = '#panel,#ed-motion,#ed-insp,#ed-drawer,#ed-bar,#ed-hint,#ed-chip,#ed-pop,.topbar h1,.topbar .hint{display:none!important}.lab{grid-template-columns:minmax(0,1fr);max-width:none}.topbar{display:none}.frame{min-width:0}';
    doc.head.appendChild(chrome);
    const observer = new MutationObserver(() => this.schedule());
    for (const el of [doc.getElementById('panel'), doc.getElementById('ed'), doc.getElementById('layer')]) if (el) observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    this.observers.set(id, observer);
    const listener = () => { if (this.active !== id) { this.active = id; this.refresh(); } };
    doc.addEventListener('pointerdown', listener, { capture: true });
    this.pointerListeners.set(id, { doc, listener });
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(event.key.toLowerCase()) || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      this.active = id;
      this.stepHistory(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo');
    };
    doc.addEventListener('keydown', keyboard, true);
    this.keyboardListeners.set(id, keyboard);
    this.refresh();
    return () => this.detach(id);
  }

  detach(id: string) {
    const keyboard = this.keyboardListeners.get(id);
    const frame = this.frames.get(id);
    if (keyboard) frame?.removeEventListener('keydown', keyboard, true);
    this.keyboardListeners.delete(id);
    this.histories.delete(id);
    this.observers.get(id)?.disconnect();
    this.observers.delete(id);
    const pointer = this.pointerListeners.get(id);
    pointer?.doc.removeEventListener('pointerdown', pointer.listener, { capture: true });
    this.pointerListeners.delete(id);
    this.frames.get(id)?.getElementById('layers-demo-chrome')?.remove();
    this.frames.delete(id);
    if (this.active === id) this.active = this.frames.keys().next().value ?? null;
    this.refresh();
  }

  setTool(tool: string) {
    const doc = this.active ? this.frames.get(this.active) : undefined;
    const mode = tool === 'grab' ? 'move' : tool === 'comment' ? 'comment' : 'use';
    doc?.querySelector<HTMLButtonElement>(`#ed-bar [data-ed="mode"][data-v="${mode}"]`)?.click();
    this.schedule();
  }

  openSection(id: string) {
    const doc = this.active ? this.frames.get(this.active) : undefined;
    if (!doc) return;
    if (id.startsWith('fx-') || id === 'motion-actions') {
      if (!doc.getElementById('ed-motion')) doc.getElementById('openMotion')?.click();
    } else if (id === 'inspector' && !doc.getElementById('ed-insp')) {
      doc.querySelector<HTMLButtonElement>('#ed-chip [data-ed="insp"]')?.click();
    } else if (id === 'notes' && !doc.getElementById('ed-drawer')) {
      doc.querySelector<HTMLButtonElement>('#ed-bar [data-ed="drawer"]')?.click();
    }
    this.refresh();
  }

  activate(key: string, value?: string) {
    const el = this.controls.get(key);
    if (!el?.isConnected) return;
    const view = el.ownerDocument.defaultView;
    if (!view) return;
    if (el.dataset.ed === 'undo' || el.dataset.ed === 'redo') { this.stepHistory(el.dataset.ed); return; }
    this.trackHistory(el.ownerDocument);
    const EventConstructor = (view as unknown as { Event: typeof Event }).Event;
    if (value !== undefined && 'value' in el) {
      (el as HTMLInputElement).value = value;
      el.dispatchEvent(new EventConstructor('input', { bubbles: true }));
      el.dispatchEvent(new EventConstructor('change', { bubbles: true }));
    } else if (el.tagName === 'SUMMARY' && el.parentElement?.tagName === 'DETAILS') {
      (el.parentElement as HTMLDetailsElement).open = !(el.parentElement as HTMLDetailsElement).open;
    } else if (el.id === 'copyCss') {
      const css = el.ownerDocument.querySelector<HTMLTextAreaElement>('#cssOut')?.value;
      if (css) void navigator.clipboard?.writeText(css);
    } else if (el.dataset.ed === 'copy-brief' || el.dataset.ed === 'copy-css') {
      // The embedded preview may not have clipboard permission; copy from the host's user gesture.
      const nav = view.navigator;
      const descriptor = Object.getOwnPropertyDescriptor(nav, 'clipboard');
      try {
        Object.defineProperty(nav, 'clipboard', { configurable: true, value: { writeText: (text: string) => navigator.clipboard.writeText(text) } });
        el.click();
      } finally {
        if (descriptor) Object.defineProperty(nav, 'clipboard', descriptor);
        else Reflect.deleteProperty(nav, 'clipboard');
      }
    } else el.click();
    this.trackHistory(el.ownerDocument, value !== undefined && el.dataset.knob ? el.dataset.knob : undefined);
    this.refresh();
  }

  undo = () => this.stepHistory('undo');
  redo = () => this.stepHistory('redo');

  private readStyle(doc: Document): StyleState {
    try { return JSON.parse(doc.defaultView?.localStorage.getItem('panel-lab:style') ?? '{}') as StyleState; } catch { return {}; }
  }
  private readEdits(doc: Document) {
    try { return doc.defaultView?.localStorage.getItem('panel-lab:edits') ?? '{}'; } catch { return '{}'; }
  }
  private trackHistory(doc: Document, control?: string) {
    const history = this.active ? this.histories.get(this.active) : undefined;
    if (!history || history.replaying) return;
    const style = this.readStyle(doc);
    // Motion has its own controls and delayed saves; style undo must not rewind motion.
    const visual = (state: StyleState) => JSON.stringify(Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'motion')));
    if (visual(style) !== visual(history.style)) {
      const at = Date.now();
      const last = history.undo[history.undo.length - 1];
      if (control && last?.kind === 'style' && last.control === control && at - last.at < 800 && history.redo.length === 0) { last.after = style; last.at = at; }
      else history.undo.push({ kind: 'style', before: history.style, after: style, control, at });
      history.redo = [];
    }
    const edits = this.readEdits(doc);
    if (edits !== history.edits) { history.undo.push({ kind: 'native', before: history.edits, after: edits }); history.redo = []; }
    history.style = style; history.edits = edits;
    if (history.undo.length > 80) history.undo.splice(0, history.undo.length - 80);
  }

  /** Replay values through original handlers so appearance, exports and saved state agree. */
  private restoreStyle(doc: Document, state: StyleState) {
    const EventConstructor = (doc.defaultView as unknown as { Event: typeof Event }).Event;
    for (const [key, value] of Object.entries(state)) {
      if (key === 'motion' || JSON.stringify(this.readStyle(doc)[key]) === JSON.stringify(value)) continue;
      const buttons = [...doc.querySelectorAll<HTMLButtonElement>('#panel button')];
      const button = buttons.find(el => el.dataset.chip === key && el.dataset.v === String(value) || value === null && el.dataset.auto === key || key === 'size' && el.dataset.size === value || key === 'theme' && el.dataset.themePick === value);
      if (button) button.click();
      else {
        const input = [...doc.querySelectorAll<HTMLInputElement>('#panel [data-knob]')].find(el => el.dataset.knob === key);
        if (input) { input.value = String(value); input.dispatchEvent(new EventConstructor('input', { bubbles: true })); }
      }
    }
  }

  private stepHistory(direction: 'undo' | 'redo') {
    const doc = this.active ? this.frames.get(this.active) : undefined;
    const history = this.active ? this.histories.get(this.active) : undefined;
    if (!doc || !history) return;
    this.trackHistory(doc);
    const from = history[direction], to = history[direction === 'undo' ? 'redo' : 'undo'];
    const entry = from.pop();
    if (!entry) return;
    history.replaying = true;
    try {
      if (entry.kind === 'style') this.restoreStyle(doc, direction === 'undo' ? entry.before : entry.after);
      else {
        const button = doc.querySelector<HTMLButtonElement>(`#ed-bar [data-ed="${direction}"]`);
        if (!button || button.disabled) { from.push(entry); return; }
        button.click();
        // The original inspector coalesces continuous changes into one native step.
        const result = this.readEdits(doc);
        while ((direction === 'undo' ? entry.before : entry.after) !== result) {
          const previous = from[from.length - 1];
          if (previous?.kind !== 'native') break;
          from.pop();
          if (direction === 'undo') entry.before = previous.before; else entry.after = previous.after;
        }
      }
      to.push(entry);
    } finally {
      history.style = this.readStyle(doc); history.edits = this.readEdits(doc); history.replaying = false;
      this.refresh();
    }
  }

  /** Answer the original confirm box shown in the demo (it is mirrored into the host). */
  keyDown(key: string, event: { key: string; ctrlKey: boolean; metaKey: boolean }) {
    const el = this.controls.get(key);
    const view = el?.ownerDocument.defaultView;
    if (!el || !view) return;
    const Keyboard = (view as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent;
    el.dispatchEvent(new Keyboard('keydown', { key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, bubbles: true }));
    this.refresh();
  }

  answerDialog(ok: boolean) {
    const doc = this.active ? this.frames.get(this.active) : undefined;
    doc?.getElementById(ok ? 'dlg-ok' : 'dlg-cancel')?.click();
    this.refresh();
  }

  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.refresh(); }, 80);
  }

  private read(node: Node): OriginalControl | null {
    if (node.nodeType === 3) return { key: `text-${this.counter++}`, tag: 'text', text: node.textContent ?? '' };
    if (node.nodeType !== 1) return null;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (!TAGS.has(tag)) return null;
    let key = el.dataset.layersControl;
    if (!key) { key = `original-${this.counter++}`; el.dataset.layersControl = key; }
    this.controls.set(key, el);
    const attrs: Record<string, string> = {};
    for (const name of ATTRS) if (el.hasAttribute(name)) attrs[name] = el.getAttribute(name) ?? '';
    if ('value' in el) attrs.value = String((el as HTMLInputElement).value);
    if (tag === 'details') attrs.open = String((el as HTMLDetailsElement).open);
    if (tag === 'input' || tag === 'textarea') attrs['aria-label'] = el.getAttribute('aria-label') ?? el.ownerDocument.querySelector(`label[for="${el.id}"]`)?.textContent ?? el.getAttribute('placeholder') ?? 'Value';
    return { key, tag, attrs, children: tag === 'textarea' ? [] : [...el.childNodes].map(n => this.read(n)).filter((n): n is OriginalControl => n !== null) };
  }

  private children(el: Element | null, exclude?: (n: Node) => boolean) {
    return el ? [...el.childNodes].filter(n => !exclude?.(n)).map(n => this.read(n)).filter((n): n is OriginalControl => n !== null) : [];
  }

  private refresh() {
    this.controls.clear();
    const doc = this.active ? this.frames.get(this.active) : undefined;
    if (!doc) { this.snapshot = EMPTY; this.listeners.forEach(fn => fn()); return; }
    this.trackHistory(doc);
    const sections: OriginalSection[] = [];
    const saved = doc.querySelector('#panel [data-psec="looks"] .lab-body');
    sections.push({ id: 'saved', label: 'Saved looks', controls: this.children(saved, n => n.nodeType === 1 && ((n as Element).classList.contains('presets') || (n as Element).classList.contains('lab-sub'))), actions: [] });
    sections.push({ id: 'presets', label: 'Presets', controls: this.children(saved?.querySelector('.presets') ?? null), actions: [] });
    for (const detail of doc.querySelectorAll<HTMLElement>('#panel .lab-sec:not([data-psec="looks"])')) {
      const summary = detail.querySelector('summary');
      sections.push({ id: detail.dataset.psec ?? '', label: summary?.querySelector('span')?.textContent ?? '', controls: this.children(detail.querySelector('.lab-body')), actions: this.children(summary, n => n.nodeType !== 1 || (n as Element).tagName !== 'BUTTON') });
    }
    // Inspector sections remain functional even though their old floating sheet is hidden.
    const inspector = doc.getElementById('ed-insp');
    const selectedActions = this.children(doc.getElementById('ed-chip'));
    if (inspector || selectedActions.length) sections.push({ id: 'inspector', label: 'Selected item', controls: this.children(inspector, n => n.nodeType === 1 && (n as Element).classList.contains('ed-dh')), actions: selectedActions });
    for (const detail of doc.querySelectorAll<HTMLElement>('#ed-motion .fx')) {
      const summary = detail.querySelector('summary');
      sections.push({ id: `fx-${detail.dataset.fxsec}`, label: summary?.querySelector('.fx-name')?.textContent?.trim() ?? '', controls: this.children(detail.querySelector('.fx-body')), actions: this.children(summary, n => n.nodeType !== 1 || (n as Element).tagName !== 'BUTTON') });
    }
    const motionActions = doc.querySelector('#ed-motion > .ed-actions');
    if (motionActions) sections.push({ id: 'motion-actions', label: 'Motion actions', controls: this.children(motionActions), actions: [] });
    const reset = doc.getElementById('resetAll');
    if (reset) sections.push({ id: 'reset', label: 'Reset to original', controls: [this.read(reset)].filter((n): n is OriginalControl => n !== null), actions: [] });
    sections.push({ id: 'tools', label: 'Edit tools', controls: this.children(doc.getElementById('ed-bar')), actions: [] });
    const drawer = doc.getElementById('ed-drawer');
    if (drawer) sections.push({ id: 'notes', label: 'Comments and changes', controls: this.children(drawer), actions: [] });
    const dlg = doc.querySelector('#layer .dialog');
    const dialog = dlg ? { title: dlg.querySelector('h3')?.textContent ?? '', text: dlg.querySelector('p')?.textContent ?? '', ok: dlg.querySelector('#dlg-ok')?.textContent ?? 'OK', danger: !!dlg.querySelector('#dlg-ok.danger') } : undefined;
    const toast = doc.querySelector('#layer .toast')?.textContent ?? undefined;
    const pop = doc.getElementById('ed-pop');
    const commentBox = pop ? { label: pop.getAttribute('aria-label') ?? 'Comment', controls: this.children(pop) } : undefined;
    const history = this.active ? this.histories.get(this.active) : undefined;
    const canUndo = !!history?.undo.length, canRedo = !!history?.redo.length;
    for (const control of this.controls.values()) {
      if (control.dataset.ed === 'undo' || control.dataset.ed === 'redo') {
        // Only the mirrored description changes; leave the target's native stack buttons intact.
        const enabled = control.dataset.ed === 'undo' ? canUndo : canRedo;
        const update = (items: OriginalControl[]) => { for (const item of items) { if (item.key === control.dataset.layersControl && item.attrs) { if (enabled) delete item.attrs.disabled; else item.attrs.disabled = ''; } if (item.children) update(item.children); } };
        for (const section of sections) update(section.controls);
      }
    }
    this.snapshot = { connected: true, canUndo, canRedo, sections, dialog, toast, commentBox };
    this.listeners.forEach(fn => fn());
  }
}
export const originalMenuService = new OriginalMenuService();