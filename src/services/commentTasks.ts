import {
  flattenTasks, newTaskId, readStoredTasks, seedTasks, writeTasksExternally,
  type TaskKind, type TaskNode, type TaskSource,
} from './taskTracker';
import { captureScreenSnapshot } from './screenSnapshots';
import { saveCommentShots } from './shotStore';

/** Style values kept with each comment so the exact look at that moment can be recalled. */
export const RECORDED_STYLES = [
  'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'line-height',
  'border-radius', 'border', 'padding', 'margin', 'width', 'height', 'display', 'gap', 'box-shadow', 'opacity',
] as const;

const DEMO_NOTES_KEY = 'panel-lab:notes';
const DEMO_EDITS_KEY = 'panel-lab:edits';

export function kindOf(raw: string): TaskKind {
  const k = raw.trim().toLowerCase();
  if (k === 'bug') return 'Bug';
  if (k === 'idea') return 'Idea';
  if (k === 'question') return 'Question';
  if (k === 'improvement') return 'Improvement';
  return 'Change';
}

/** Turn a recorded comment into a Production task. */
export function taskFromSource(source: TaskSource, id: string = newTaskId()): TaskNode {
  const first = source.text.split('\n')[0].trim();
  const label = first.length > 90 ? `${first.slice(0, 88)}…` : first || 'Comment';
  const kind = kindOf(source.kind);
  return {
    id, label, done: false, children: [], kind, status: 'todo',
    priority: kind === 'Bug' ? 'high' : 'normal', notes: source.text, source,
  };
}

export function linkedCommentIds(tasks: TaskNode[]): Set<string> {
  return new Set(flattenTasks(tasks).map(t => t.source?.commentId).filter(Boolean) as string[]);
}

/** Adds one task per new comment; comments that already have a task are skipped. */
export function addCommentTasks(tasks: TaskNode[], sources: TaskSource[]): TaskNode[] {
  const linked = linkedCommentIds(tasks);
  const fresh = sources.filter(s => !linked.has(s.commentId) && (linked.add(s.commentId), true));
  return fresh.length ? [...tasks, ...fresh.map(s => taskFromSource(s))] : tasks;
}

export function recordCommentTasks(sources: TaskSource[]) {
  const current = readStoredTasks() ?? seedTasks();
  const next = addCommentTasks(current, sources);
  if (next !== current) writeTasksExternally(next);
}

export function readStyles(el: Element): Record<string, string> {
  const view = el.ownerDocument.defaultView;
  if (!view) return {};
  const cs = view.getComputedStyle(el);
  return Object.fromEntries(RECORDED_STYLES.map(p => [p, cs.getPropertyValue(p)]).filter(([, v]) => v));
}

async function smallScreenshot(iframe: HTMLIFrameElement): Promise<string | undefined> {
  try {
    const png = await captureScreenSnapshot(iframe);
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = png; });
    const scale = Math.min(1, 360 / Math.max(1, img.width));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch { return undefined; }
}

interface DemoNote { id: string; text: string; kind?: string; path?: string; px?: number; py?: number; layout?: string; label?: string; createdAt?: number }

function readJson<T>(key: string): T | null {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}

function demoFrame(): HTMLIFrameElement | null {
  return [...document.querySelectorAll('iframe')].find(f => {
    try { return Boolean(f.contentDocument && f.src.includes('/targets/')); } catch { return false; }
  }) ?? null;
}

/** Build the full record for a comment made in the demo app's own comment tool. */
export function sourceFromDemoNote(note: DemoNote, frame: HTMLIFrameElement | null, edits: unknown): TaskSource {
  let el: Element | null = null;
  try { el = note.path && frame?.contentDocument ? frame.contentDocument.querySelector(note.path) : null; } catch { el = null; }
  const r = el?.getBoundingClientRect();
  return {
    commentId: `demo:${note.id}`, origin: 'demo', createdAt: note.createdAt ?? Date.now(),
    text: note.text, kind: note.kind ?? 'Change',
    element: {
      label: note.label || note.path || 'Element', selector: note.path,
      tag: el?.tagName.toLowerCase(), text: el?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120) || undefined,
    },
    location: {
      route: '/targets/radium-mock.html', layout: note.layout, px: note.px, py: note.py,
      rect: r ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : undefined,
    },
    viewport: frame ? { width: frame.clientWidth, height: frame.clientHeight } : undefined,
    styles: el ? readStyles(el) : undefined,
    edits: edits ?? undefined,
  };
}

let syncing = false;
/** Picks up comments made in the demo app and adds a task for each new one. */
export async function syncDemoNotes(): Promise<number> {
  if (syncing) return 0;
  const notes = readJson<DemoNote[]>(DEMO_NOTES_KEY);
  if (!Array.isArray(notes) || !notes.length) return 0;
  const linked = linkedCommentIds(readStoredTasks() ?? []);
  const fresh = notes.filter(n => n && typeof n.id === 'string' && typeof n.text === 'string' && !linked.has(`demo:${n.id}`));
  if (!fresh.length) return 0;
  syncing = true;
  try {
    const frame = demoFrame();
    const edits = readJson<unknown>(DEMO_EDITS_KEY);
    const shot = frame ? await smallScreenshot(frame) : undefined;
    recordCommentTasks(fresh.map(n => ({ ...sourceFromDemoNote(n, frame, edits), screenshot: shot })));
    return fresh.length;
  } finally { syncing = false; }
}

let started = false;
export function startCommentTaskSync(): () => void {
  if (started || typeof window === 'undefined') return () => undefined;
  started = true;
  const run = () => { void syncDemoNotes(); };
  const onStorage = (e: StorageEvent) => { if (e.key === DEMO_NOTES_KEY) run(); };
  window.addEventListener('storage', onStorage);
  const timer = window.setInterval(run, 2500);
  run();
  return () => { started = false; window.removeEventListener('storage', onStorage); window.clearInterval(timer); };
}

function loadImage(src: string, timeoutMs = 4000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => reject(new Error('Image did not load')), timeoutMs);
    img.onload = () => { window.clearTimeout(timer); resolve(img); };
    img.onerror = () => { window.clearTimeout(timer); reject(new Error('Image did not load')); };
    img.src = src;
  });
}

type Rect = NonNullable<TaskSource['location']['rect']>;
/** A small copy of a screenshot; with `mark`, the commented element is outlined and the click is pinned. */
export async function thumbnail(dataUrl: string, maxWidth: number, mark?: { rect?: Rect; px?: number; py?: number; viewportWidth: number }, quality = 0.72): Promise<string | undefined> {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxWidth / Math.max(1, img.width));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
    const g = canvas.getContext('2d');
    if (!g) return undefined;
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (mark) {
      const k = canvas.width / Math.max(1, mark.viewportWidth);
      g.lineWidth = 2; g.strokeStyle = '#ff3d7f'; g.fillStyle = '#ff3d7f';
      if (mark.rect) g.strokeRect(mark.rect.x * k, mark.rect.y * k, mark.rect.width * k, mark.rect.height * k);
      if (mark.px != null && mark.py != null) { g.beginPath(); g.arc(mark.px * k, mark.py * k, 5, 0, Math.PI * 2); g.fill(); }
    }
    return canvas.toDataURL('image/jpeg', quality);
  } catch { return undefined; }
}

/** Record a comment made with the studio's own Comment tool on a connected app. */
export async function recordCanvasComment(input: {
  commentId: string; text: string; kind: string; projectId: string; frameId: string; route: string;
  element: TaskSource['element']; px: number; py: number;
  rect?: TaskSource['location']['rect']; styles?: Record<string, string>; viewport?: TaskSource['viewport'];
  iframe?: HTMLIFrameElement | null; shots?: { element?: string; view?: string; viewport?: { width: number; height: number } };
}) {
  const shots = input.shots;
  const mark = { rect: input.rect, px: input.px, py: input.py, viewportWidth: shots?.viewport?.width ?? input.viewport?.width ?? 1 };
  const [view, element, markedView] = await Promise.all([
    shots?.view ? thumbnail(shots.view, 360, mark) : input.iframe ? smallScreenshot(input.iframe) : undefined,
    shots?.element ? thumbnail(shots.element, 320) : undefined,
    shots?.view ? thumbnail(shots.view, 1600, mark, 0.86) : undefined,
  ]);
  const stored = shots?.view || shots?.element ? await saveCommentShots({ commentId: input.commentId, element: shots.element, view: markedView ?? shots.view, createdAt: Date.now() }) : false;
  recordCommentTasks([{
    commentId: input.commentId, origin: 'canvas', createdAt: Date.now(), text: input.text, kind: input.kind,
    element: input.element, location: { route: input.route, px: input.px, py: input.py, rect: input.rect },
    viewport: shots?.viewport ?? input.viewport, styles: input.styles, screenshot: view, elementShot: element,
    fullShots: stored || undefined, projectId: input.projectId, frameId: input.frameId,
  }]);
}

export const POSITION_WORDS = { before: 'before', after: 'after', prepend: 'at the start of', append: 'at the end of' } as const;

/** Record a component or icon placed in a connected app, as a Production task for the agent. */
export async function recordInsertTask(input: {
  insertId: string; projectId: string; frameId: string; route: string; label: string; insert: NonNullable<TaskSource['insert']>;
  anchor: TaskSource['element']; px: number; py: number; rect?: TaskSource['location']['rect'];
  shots?: { element?: string; view?: string; viewport?: { width: number; height: number } };
}) {
  const where = `${POSITION_WORDS[input.insert.position]} ${input.anchor.label}${input.anchor.text ? ` “${input.anchor.text.slice(0, 40)}”` : ''}`;
  const shots = input.shots;
  const mark = { rect: input.rect, px: input.px, py: input.py, viewportWidth: shots?.viewport?.width ?? 1 };
  const [view, element, markedView] = await Promise.all([
    shots?.view ? thumbnail(shots.view, 360, mark) : undefined,
    shots?.element ? thumbnail(shots.element, 320) : undefined,
    shots?.view ? thumbnail(shots.view, 1600, mark, 0.86) : undefined,
  ]);
  const commentId = `insert:${input.insertId}`;
  const stored = shots?.view || shots?.element ? await saveCommentShots({ commentId, element: shots.element, view: markedView ?? shots.view, createdAt: Date.now() }) : false;
  recordCommentTasks([{
    commentId, origin: 'canvas', createdAt: Date.now(), kind: 'Change',
    text: `Add the ${input.label} ${where}.`,
    element: input.anchor, location: { route: input.route, px: input.px, py: input.py, rect: input.rect },
    viewport: shots?.viewport, screenshot: view, elementShot: element, fullShots: stored || undefined,
    insert: input.insert, projectId: input.projectId, frameId: input.frameId,
  }]);
}

export function describeElement(s: TaskSource): string {
  const e = s.element;
  const text = e.text ? ` “${e.text.length > 40 ? `${e.text.slice(0, 40)}…` : e.text}”` : '';
  return `${e.label}${text}${e.comp ? ` in ${e.comp}` : ''}`;
}

const PRIORITY_LABEL = { high: 'High', normal: 'Normal', low: 'Low' } as const;

/** A step-by-step plan of open tasks a coding agent can follow. */
export function exportAgentPlan(tasks: TaskNode[]): string {
  const open = flattenTasks(tasks).filter(t => !t.done);
  const lines = ['# Production plan', '', `${open.length} open task${open.length === 1 ? '' : 's'}. Do not change anything not listed here.`, ''];
  open.forEach((t, i) => {
    lines.push(`## ${i + 1}. ${t.label}`);
    lines.push(`- Kind: ${t.kind ?? 'Change'} · Priority: ${PRIORITY_LABEL[t.priority ?? 'normal']} · Status: ${t.status ?? 'todo'}`);
    if (t.source) {
      lines.push(`- Where: ${describeElement(t.source)}`);
      if (t.source.element.selector) lines.push(`- Selector: \`${t.source.element.selector}\``);
      if (t.source.element.rid) lines.push(`- Source id: \`${t.source.element.rid}\``);
      if (t.source.location.route) lines.push(`- Screen: ${t.source.location.route}${t.source.location.layout ? ` (layout ${t.source.location.layout})` : ''}`);
      if (t.source.viewport) lines.push(`- Window size: ${t.source.viewport.width}×${t.source.viewport.height}`);
      if (t.source.styles) lines.push(`- Current styles: ${Object.entries(t.source.styles).map(([k, v]) => `${k}: ${v}`).join('; ')}`);
      lines.push(`- Original comment (${new Date(t.source.createdAt).toISOString()}): ${t.source.text}`);
    }
    if (t.notes && t.notes !== t.source?.text) lines.push(`- What to do / done when: ${t.notes}`);
    if (t.children.length) lines.push(`- Steps: ${t.children.map(c => c.label).join(' → ')}`);
    lines.push('');
  });
  return lines.join('\n');
}

export const REVEAL_EVENT = 'layers:reveal';
export interface RevealRequest { rid?: string; selector?: string; route?: string }

/** Jump to the canvas and flash the exact element a task came from. */
export function showOnCanvas(source: TaskSource) {
  window.dispatchEvent(new CustomEvent('layers:navigate', { detail: { route: 'canvas' } }));
  // Connected apps are on another origin, so their bridge finds and outlines the element.
  if (source.origin === 'canvas') {
    const detail: RevealRequest = { rid: source.element.rid, selector: source.element.selector, route: source.location.route };
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail })), 250);
    return;
  }
  let tries = 0;
  const attempt = () => {
    tries += 1;
    const selector = source.element.selector;
    for (const f of document.querySelectorAll('iframe')) {
      try {
        const el = selector ? f.contentDocument?.querySelector(selector) as HTMLElement | null : null;
        if (!el) continue;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const prev = el.style.outline; const prevOff = el.style.outlineOffset;
        el.style.outline = '3px solid #ff3d7f'; el.style.outlineOffset = '2px';
        window.setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = prevOff; }, 2400);
        return;
      } catch { /* cross-origin frame */ }
    }
    if (tries < 12) window.setTimeout(attempt, 250);
  };
  window.setTimeout(attempt, 200);
}
