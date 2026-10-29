// Turns open Production tasks (from comments) and live style edits into a production list a coding
// agent can follow: Markdown for reading, JSON (`radium-production/v1`) for tools, and screenshot files.
// Pure apart from the `now` and image inputs, so the output is stable and testable.
import type { TaskNode } from '../../services/taskTracker';
import { parseRid } from '../../services/bridgeService';
import type { LiveStyleChange } from '../../services/liveStyleService';

export interface ShotImages { view?: string; element?: string }
export interface ProductionShot { path: string; dataUrl: string }
export interface ProductionItemJson {
  id: string; title: string; kind: string; priority: 'p1' | 'p2' | 'p3'; status: string;
  file?: string; line?: number; column?: number; component?: string; selector?: string; element?: string; elementText?: string;
  route?: string; viewport?: { width: number; height: number }; scope?: 'instance' | 'all-instances';
  comment?: string; instructions?: string; steps?: string[];
  changes?: { kind: 'style'; property: string; before: string; after: string }[];
  /** For "add this component or icon" items: what to add, and where relative to the element. */
  insert?: { library: string; name: string; position: string; install?: string; importLine: string; usage: string };
  css?: string; currentStyles?: Record<string, string>;
  screenshots?: { view?: string; element?: string };
}
export interface ProductionList { markdown: string; json: { schema: 'radium-production/v1'; project: string; generatedAt: string; items: ProductionItemJson[] }; shots: ProductionShot[] }

const PRIORITY = { high: 'p1', normal: 'p2', low: 'p3' } as const;

/**
 * Open tasks that came from comments on this project's app. Their sub-tasks become steps, not items.
 * Hand-written tasks without a comment are left out: they are notes about the studio itself.
 */
export function productionTasks(tasks: TaskNode[], projectId?: string): TaskNode[] {
  const open = (t: TaskNode) => !t.done && t.status !== 'done';
  const mine = (t: TaskNode) => !!t.source && (!projectId || !t.source.projectId || t.source.projectId === projectId);
  const out: TaskNode[] = [];
  const walk = (list: TaskNode[]) => { for (const t of list) { if (mine(t)) { if (open(t)) out.push(t); } else walk(t.children); } };
  walk(tasks);
  return out;
}
const ext = (dataUrl: string) => (dataUrl.startsWith('data:image/png') ? 'png' : 'jpg');
const one = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * @param images  full-size screenshots by comment id; tasks without them fall back to their thumbnails
 */
export function compileProductionList(input: { project: string; projectId?: string; tasks: TaskNode[]; styleChanges?: LiveStyleChange[]; images?: Record<string, ShotImages>; now?: Date }): ProductionList {
  const items: ProductionItemJson[] = [];
  const shots: ProductionShot[] = [];
  const id = () => `RPL-${String(items.length + 1).padStart(3, '0')}`;

  for (const t of productionTasks(input.tasks, input.projectId)) {
    const s = t.source;
    const where = parseRid(s?.element.rid);
    const item: ProductionItemJson = {
      id: id(), title: t.label, kind: s?.insert ? 'Insert' : t.kind ?? 'Change', priority: PRIORITY[t.priority ?? 'normal'], status: t.status ?? 'todo',
      file: where?.file, line: where?.line, column: where?.column, component: s?.element.comp, selector: s?.element.selector,
      element: s?.element.label, elementText: s?.element.text, route: s?.location.route, viewport: s?.viewport,
      comment: s?.text, instructions: t.notes && t.notes !== s?.text ? t.notes : undefined,
      steps: t.children.length ? t.children.map(c => c.label) : undefined, currentStyles: s?.styles,
      insert: s?.insert ? { ...s.insert } : undefined,
    };
    if (s) {
      const full = input.images?.[s.commentId];
      const view = full?.view ?? s.screenshot; const element = full?.element ?? s.elementShot;
      const screenshots: ProductionItemJson['screenshots'] = {};
      if (view) { const path = `shots/${item.id}-view.${ext(view)}`; shots.push({ path, dataUrl: view }); screenshots.view = path; }
      if (element) { const path = `shots/${item.id}-element.${ext(element)}`; shots.push({ path, dataUrl: element }); screenshots.element = path; }
      if (view || element) item.screenshots = screenshots;
    }
    items.push(item);
  }

  // Live style edits: one item per element, every property it changed.
  const byElement = new Map<string, LiveStyleChange[]>();
  for (const c of input.styleChanges ?? []) {
    const key = JSON.stringify([c.node.rid ?? c.node.selector, c.scope === 'all' ? 'all' : c.node.instanceIndex, c.breakpoint]);
    byElement.set(key, [...(byElement.get(key) ?? []), c]);
  }
  for (const list of byElement.values()) {
    const n = list[0].node; const where = parseRid(n.rid);
    const changes = list.map(c => ({ kind: 'style' as const, property: c.property, before: c.before, after: c.after }));
    items.push({
      id: id(), title: `Restyle ${n.label}${n.text ? ` “${one(n.text).slice(0, 40)}”` : ''}`, kind: 'Style', priority: 'p2', status: 'todo',
      file: where?.file, line: where?.line, column: where?.column, component: n.comp, selector: n.selector, element: n.label, elementText: n.text,
      route: list[0].route, scope: list[0].scope === 'all' ? 'all-instances' : 'instance', changes,
      css: changes.map(c => `${c.property}: ${c.after};`).join(' '),
    });
  }

  const generatedAt = (input.now ?? new Date()).toISOString();
  return { markdown: toMarkdown(input.project, generatedAt, items), json: { schema: 'radium-production/v1', project: input.project, generatedAt, items }, shots };
}

function toMarkdown(project: string, generatedAt: string, items: ProductionItemJson[]): string {
  const lines = [
    `# Production list: ${project}`,
    `Generated ${generatedAt} by Layers. ${items.length} item${items.length === 1 ? '' : 's'}.`,
    '',
    'Implement the items in order. Each one names the file and line (when known), the element, what to change and why.',
    'Screenshots are next to this file in `shots/`: `-view` shows the whole screen with the element outlined, `-element` shows just the element.',
    'Change only what is listed. After each item, run the app and check it, then tick it here.',
    '',
  ];
  for (const it of items) {
    lines.push(`## ${it.id} · ${it.title}  (${it.priority})`);
    lines.push(`- [ ] Done`);
    const at = it.file ? `\`${it.file}${it.line ? `:${it.line}` : ''}\`` : 'file unknown (search for the selector or text below)';
    lines.push(`- **Where:** ${at}${it.component ? ` · \`<${it.component}>\`` : ''}${it.element ? ` · \`${it.element}\`` : ''}${it.scope ? ` · ${it.scope === 'all-instances' ? 'all instances' : 'this instance only'}` : ''}`);
    if (it.elementText) lines.push(`- **Element text:** “${one(it.elementText)}”`);
    if (it.selector) lines.push(`- **Selector:** \`${it.selector}\``);
    if (it.route) lines.push(`- **Screen:** ${it.route}${it.viewport ? ` at ${it.viewport.width}×${it.viewport.height}` : ''}`);
    lines.push(`- **Kind:** ${it.kind} · **Status:** ${it.status}`);
    if (it.insert) {
      const where = { before: 'just before', after: 'just after', prepend: 'as the first child of', append: 'as the last child of' }[it.insert.position] ?? it.insert.position;
      const library = it.insert.library === 'shadcn' ? 'shadcn/ui' : it.insert.library === 'lucide' ? 'Lucide' : it.insert.library;
      lines.push(`- **Add:** ${library} \`${it.insert.name}\` ${where} the element above`);
      if (it.insert.install) lines.push(`- **Install:** \`${it.insert.install}\` (skip it if the app already has this component)`);
      lines.push(`- **Import:** \`${it.insert.importLine}\``);
      lines.push('- **Code:**', '', '  ```tsx', ...it.insert.usage.split('\n').map(l => `  ${l}`), '  ```', '');
      lines.push('- The screenshot shows a preview of it in place. Match the app’s own styling where it differs from the library default.');
    }
    else if (it.comment) lines.push(`- **Comment:** ${it.comment.split('\n').join('\n  ')}`);
    if (it.instructions) lines.push(`- **Done when:** ${it.instructions.split('\n').join('\n  ')}`);
    if (it.steps) lines.push(`- **Steps:** ${it.steps.join(' → ')}`);
    if (it.changes) {
      lines.push('- **Change:**');
      for (const c of it.changes) lines.push(`  - \`${c.property}\`: \`${c.before || '(unset)'}\` → \`${c.after}\``);
      lines.push(`- **CSS preview:** \`${it.css}\``);
    }
    if (it.currentStyles) {
      const keep = ['color', 'background-color', 'font-size', 'font-weight', 'border-radius', 'padding', 'width', 'height'];
      const shown = keep.filter(k => it.currentStyles?.[k]).map(k => `${k}: ${it.currentStyles![k]}`);
      if (shown.length) lines.push(`- **Current look:** ${shown.join('; ')}`);
    }
    if (it.screenshots?.view) lines.push(`- **Screenshot:** ![${it.id} screen](${it.screenshots.view})`);
    if (it.screenshots?.element) lines.push(`- **Element:** ![${it.id} element](${it.screenshots.element})`);
    lines.push('');
  }
  return lines.join('\n');
}
