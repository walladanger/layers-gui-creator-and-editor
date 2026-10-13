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
export interface OriginalMenuSnapshot { connected: boolean; sections: OriginalSection[] }
const EMPTY: OriginalMenuSnapshot = { connected: false, sections: [] };
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
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;

  attach(id: string, doc: Document) {
    this.detach(id);
    if (!doc.querySelector('#panel .lab-sec')) return () => undefined;
    this.frames.set(id, doc);
    this.active = this.active ?? id;
    // Open the original motion controls once; hide their presentation, never their execution.
    doc.querySelector<HTMLButtonElement>('#openMotion')?.click();
    const notes = doc.querySelector<HTMLButtonElement>('#ed-bar [data-ed="drawer"]');
    if (notes?.getAttribute('aria-pressed') === 'false') notes.click();
    const chrome = doc.createElement('style');
    chrome.id = 'layers-demo-chrome';
    chrome.textContent = '#panel,#ed-motion,#ed-insp,#ed-drawer,#ed-bar,#ed-hint,#ed-chip,.topbar h1,.topbar .hint{display:none!important}.lab{grid-template-columns:minmax(0,1fr);max-width:none}.topbar{display:none}.frame{min-width:0}';
    doc.head.appendChild(chrome);
    const observer = new MutationObserver(() => this.schedule());
    for (const el of [doc.getElementById('panel'), doc.getElementById('ed')]) if (el) observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    this.observers.set(id, observer);
    const listener = () => { if (this.active !== id) { this.active = id; this.refresh(); } };
    doc.addEventListener('pointerdown', listener, { capture: true });
    this.pointerListeners.set(id, { doc, listener });
    this.refresh();
    return () => this.detach(id);
  }

  detach(id: string) {
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

  activate(key: string, value?: string) {
    const el = this.controls.get(key);
    if (!el?.isConnected) return;
    const view = el.ownerDocument.defaultView;
    if (!view) return;
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
    } else el.click();
    this.refresh();
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 80);
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
    this.snapshot = { connected: true, sections };
    this.listeners.forEach(fn => fn());
  }
}
export const originalMenuService = new OriginalMenuService();