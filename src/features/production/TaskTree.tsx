import { useMemo, useState } from 'react';
import { Check, ClipboardCopy, Crosshair, Info, Plus, Sparkles, X } from 'lucide-react';
import {
  TASK_KINDS, TASK_PRIORITIES, TASK_STATUSES, useTaskTracker,
  type TaskFields, type TaskKind, type TaskNode, type TaskPriority, type TaskStatus,
} from '../../services/taskTracker';
import { describeElement, exportAgentPlan, showOnCanvas } from '../../services/commentTasks';
import { REVIEW_OPTIONS, requestReview, type ReviewAction, type ReviewSuggestion } from '../../services/taskReview';
import './taskTree.css';

const STATUS_LABEL: Record<TaskStatus, string> = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };
const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High', normal: 'Normal', low: 'Low' };

interface Filters { kind: TaskKind | 'all'; priority: TaskPriority | 'all'; status: TaskStatus | 'all' }

interface RowProps {
  node: TaskNode;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  toggle: (id: string) => void;
  rename: (id: string, label: string) => void;
  remove: (id: string) => void;
  add: (parentId: string | null, label: string) => string;
  addMany: (parentId: string, labels: string[]) => void;
  update: (id: string, fields: TaskFields) => void;
  aiReview: boolean;
  visible: (n: TaskNode) => boolean;
}

function countDescendants(node: TaskNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function Details({ node }: { node: TaskNode }) {
  const s = node.source;
  if (!s) return null;
  const facts: [string, string | undefined][] = [
    ['Comment', s.text], ['Kind', s.kind], ['Made', new Date(s.createdAt).toLocaleString()],
    ['Element', s.element.label], ['Tag', s.element.tag], ['Element text', s.element.text],
    ['Part of app', s.element.comp], ['Selector', s.element.selector], ['Source id', s.element.rid],
    ['Screen', s.location.route], ['Layout', s.location.layout],
    ['Clicked at', s.location.px != null ? `${s.location.px}, ${s.location.py}` : undefined],
    ['Position on page', s.location.rect ? `${s.location.rect.x}, ${s.location.rect.y} · ${s.location.rect.width}×${s.location.rect.height}` : undefined],
    ['Window size', s.viewport ? `${s.viewport.width}×${s.viewport.height}` : undefined],
  ];
  return <div className="task-tree__details" role="region" aria-label={`Details for "${node.label}"`}>
    {s.screenshot && <img src={s.screenshot} alt="Screen when the comment was made" />}
    <dl>{facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    {s.styles && <details><summary>Style values ({Object.keys(s.styles).length})</summary>
      <dl>{Object.entries(s.styles).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>}
    {s.edits != null && <details><summary>Style edits at that time</summary><pre>{JSON.stringify(s.edits, null, 2).slice(0, 4000)}</pre></details>}
  </div>;
}

function Review({ node, update, rename, addMany }: Pick<RowProps, 'node' | 'update' | 'rename' | 'addMany'>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [result, setResult] = useState<{ action: ReviewAction; s: ReviewSuggestion } | null>(null);
  const [error, setError] = useState('');

  const run = async (action: ReviewAction) => {
    setOpen(false); setBusy(action); setError(''); setResult(null);
    try { setResult({ action, s: await requestReview(action, node) }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Review failed'); }
    finally { setBusy(null); }
  };
  const accept = () => {
    if (!result) return;
    const { action, s } = result;
    if (action === 'rewrite') { if (s.title) rename(node.id, s.title); if (s.notes) update(node.id, { notes: s.notes }); }
    if (action === 'subtasks' && s.subtasks?.length) addMany(node.id, s.subtasks);
    if (action === 'priority') update(node.id, { kind: TASK_KINDS.includes(s.kind as TaskKind) ? s.kind as TaskKind : node.kind, priority: TASK_PRIORITIES.includes(s.priority as TaskPriority) ? s.priority as TaskPriority : node.priority });
    if (action === 'donecheck' && s.notes) update(node.id, { notes: [node.notes, `Done when:\n${s.notes}`].filter(Boolean).join('\n\n') });
    if (action === 'questions' && s.questions?.length) update(node.id, { notes: [node.notes, `Open questions:\n${s.questions.map(q => `- ${q}`).join('\n')}`].filter(Boolean).join('\n\n') });
    setResult(null);
  };

  return <div className="task-tree__review">
    <button type="button" className="task-tree__chip" aria-expanded={open} onClick={() => setOpen(v => !v)} disabled={busy !== null}>
      <Sparkles size={12} /> {busy ? 'Reviewing…' : 'Review by AI Agent'}
    </button>
    {open && <div className="task-tree__menu" role="menu">
      {REVIEW_OPTIONS.map(o => <button key={o.id} type="button" role="menuitem" onClick={() => void run(o.id)}>{o.label}</button>)}
    </div>}
    {error && <p className="task-tree__error" role="alert">{error}</p>}
    {result && <div className="task-tree__suggestion" role="region" aria-label="AI suggestion">
      <div><strong>Yours</strong><p>{node.label}{node.notes && node.notes !== node.label ? `\n\n${node.notes}` : ''}</p></div>
      <div><strong>Suggested</strong><p>{[
        result.s.title, result.s.notes,
        result.s.subtasks?.map(t => `• ${t}`).join('\n'),
        result.s.kind && `Kind: ${result.s.kind}`, result.s.priority && `Priority: ${result.s.priority}`, result.s.reason,
        result.s.questions?.map(q => `? ${q}`).join('\n'),
      ].filter(Boolean).join('\n\n')}</p></div>
      <div className="task-tree__suggestion-actions">
        <button type="button" onClick={() => setResult(null)}>Dismiss</button>
        <button type="button" className="task-tree__accept" onClick={accept}>Accept</button>
      </div>
    </div>}
  </div>;
}

function Row(props: RowProps) {
  const { node, editingId, setEditingId, toggle, rename, remove, add, update, aiReview, visible } = props;
  const [draft, setDraft] = useState(node.label);
  const [showDetails, setShowDetails] = useState(false);
  const editing = editingId === node.id;
  if (!visible(node)) return null;

  const commit = () => { rename(node.id, draft); setEditingId(null); };
  const onDelete = () => {
    const kids = countDescendants(node);
    const message = kids > 0 ? `Delete "${node.label}" and its ${kids} sub-task${kids === 1 ? '' : 's'}?` : `Delete "${node.label}"?`;
    if (window.confirm(message)) remove(node.id);
  };
  const onAddChild = () => setEditingId(add(node.id, 'New task'));
  const rich = Boolean(node.source || node.kind);

  return <li className="task-tree__item">
    <div className="task-tree__row">
      <button type="button" className="task-tree__dot" data-done={node.done ? 'true' : 'false'} aria-pressed={node.done}
        aria-label={node.done ? `Mark "${node.label}" as not done` : `Mark "${node.label}" as done`} onClick={() => toggle(node.id)}>
        {node.done && <Check size={10} strokeWidth={3.5} />}
      </button>
      {node.kind && <span className="task-tree__kind" data-kind={node.kind}>{node.kind}</span>}
      {editing
        ? <input className="task-tree__input" value={draft} autoFocus onChange={e => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(node.label); setEditingId(null); } }} />
        : <span className="task-tree__label" title="Double-click to rename" onDoubleClick={() => { setDraft(node.label); setEditingId(node.id); }}>{node.label}</span>}
      <span className="task-tree__controls">
        <button type="button" className="task-tree__icon-btn" aria-label={`Add a sub-task under "${node.label}"`} onClick={onAddChild}><Plus size={12} strokeWidth={2.5} /></button>
        <button type="button" className="task-tree__icon-btn" aria-label={`Delete "${node.label}"`} onClick={onDelete}><X size={12} strokeWidth={2.5} /></button>
      </span>
    </div>
    {rich && <div className="task-tree__meta">
      {node.source && <span className="task-tree__where" title={node.source.element.selector}>{describeElement(node.source)}</span>}
      <div className="task-tree__fields">
        <select aria-label={`Priority of "${node.label}"`} value={node.priority ?? 'normal'} onChange={e => update(node.id, { priority: e.target.value as TaskPriority })}>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        <select aria-label={`Status of "${node.label}"`} value={node.status ?? (node.done ? 'done' : 'todo')} onChange={e => update(node.id, { status: e.target.value as TaskStatus })}>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {node.source && <>
          <button type="button" className="task-tree__chip" aria-expanded={showDetails} onClick={() => setShowDetails(v => !v)}><Info size={12} /> Details</button>
          <button type="button" className="task-tree__chip" onClick={() => showOnCanvas(node.source!)}><Crosshair size={12} /> Show on canvas</button>
        </>}
      </div>
      {showDetails && <Details node={node} />}
      <textarea className="task-tree__notes" aria-label={`Notes for "${node.label}"`} placeholder='What "done" looks like' defaultValue={node.notes ?? ''}
        key={node.notes ?? ''} onBlur={e => { if (e.target.value !== (node.notes ?? '')) update(node.id, { notes: e.target.value }); }} />
      {aiReview && <Review node={node} update={update} rename={rename} addMany={props.addMany} />}
    </div>}
    {node.children.length > 0 && <ul className="task-tree__list">
      {node.children.map(child => <Row key={child.id} {...props} node={child} />)}
    </ul>}
  </li>;
}

/** `aiReview` is only enabled on the main Production page, keeping quick lists uncluttered. */
export function TaskTree({ title = 'Tasks', aiReview = false }: { title?: string; aiReview?: boolean }) {
  const { tasks, toggle, rename, remove, add, addMany, update } = useTaskTracker();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ kind: 'all', priority: 'all', status: 'all' });
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => {
    const own = (n: TaskNode) => (filters.kind === 'all' || n.kind === filters.kind)
      && (filters.priority === 'all' || (n.priority ?? 'normal') === filters.priority)
      && (filters.status === 'all' || (n.status ?? (n.done ? 'done' : 'todo')) === filters.status);
    const any = (n: TaskNode): boolean => own(n) || n.children.some(any);
    return any;
  }, [filters]);

  const onAddTop = () => setEditingId(add(null, 'New task'));
  const copyPlan = async () => {
    try { await navigator.clipboard.writeText(exportAgentPlan(tasks)); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt('Copy the plan:', exportAgentPlan(tasks)); }
  };
  const rowProps = { editingId, setEditingId, toggle, rename, remove, add, addMany, update, aiReview, visible };

  return <section className="task-tree" aria-label={title}>
    <div className="task-tree__head">
      <h2 className="task-tree__title">{title}</h2>
      <button type="button" className="task-tree__chip" onClick={() => void copyPlan()}><ClipboardCopy size={12} /> {copied ? 'Copied' : 'Copy plan for agent'}</button>
    </div>
    <div className="task-tree__filters" role="group" aria-label="Filter tasks">
      <select aria-label="Filter by kind" value={filters.kind} onChange={e => setFilters(f => ({ ...f, kind: e.target.value as Filters['kind'] }))}>
        <option value="all">All kinds</option>{TASK_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <select aria-label="Filter by priority" value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value as Filters['priority'] }))}>
        <option value="all">All priorities</option>{TASK_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
      </select>
      <select aria-label="Filter by status" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as Filters['status'] }))}>
        <option value="all">All statuses</option>{TASK_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
    </div>
    <ul className="task-tree__list">
      {tasks.map(node => <Row key={node.id} node={node} {...rowProps} />)}
    </ul>
    <button type="button" className="task-tree__add" onClick={onAddTop}><Plus size={12} strokeWidth={2.5} /> Add task</button>
  </section>;
}
