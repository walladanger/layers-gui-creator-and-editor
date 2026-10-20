import { ArrowLeft, CheckCheck, FileText, GitBranch, GitCommitHorizontal, History, Pencil, Play, Plus } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { buildBoard, finishable, moveTo, type BoardColumn } from './boardCore';
import type { Commit, GitSource, WorkBranches } from './gitCore';
import { createLocalGitSource, isDesktopRuntime, tauriInvoke } from './gitHost';
import { useTaskTracker, type TaskNode, type TaskStatus } from '../services/taskTracker';
import './board.css';

const PLAN_TEMPLATE = '# Plan\n\n## Goal\n\n## Steps\n- [ ] \n\n## Done when\n- [ ] \n';

/** The event the desktop shell (or an agent harness) listens for when a card's Start button is pressed. */
export const START_CODING_EVENT = 'layers:start-coding';
export interface StartCodingDetail { id: string; label: string; branch: string; plan: string }

const statusOf = (t: TaskNode): TaskStatus => t.status ?? (t.done ? 'done' : 'open');

function inline(text: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) =>
    part.length > 2 && part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code>
      : part.length > 4 && part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
}

/** Small markdown view for plans: headings, bullets, checklists, code blocks, **bold**, `code`. */
export function PlanView({ text }: { text: string }) {
  const out: ReactElement[] = [];
  let code: string[] | null = null;
  text.split('\n').forEach((raw, i) => {
    if (raw.trim().startsWith('```')) {
      if (code === null) code = [];
      else { out.push(<pre key={i}>{code.join('\n')}</pre>); code = null; }
      return;
    }
    if (code !== null) { code.push(raw); return; }
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(raw))) out.push(<div key={i} className={m[1].length === 1 ? 'plan-h1' : 'plan-h2'}>{inline(m[2])}</div>);
    else if ((m = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/.exec(raw))) out.push(<div key={i} className="plan-li"><input type="checkbox" checked={m[1] !== ' '} readOnly aria-label={m[2]} /><span data-done={m[1] !== ' '}>{inline(m[2])}</span></div>);
    else if ((m = /^\s*[-*]\s+(.*)$/.exec(raw))) out.push(<div key={i} className="plan-li"><span>•</span><span>{inline(m[1])}</span></div>);
    else if (!raw.trim()) out.push(<div key={i} className="plan-gap" />);
    else out.push(<div key={i}>{inline(raw)}</div>);
  });
  return <div className="plan-view">{out}</div>;
}

interface DetailProps {
  task: TaskNode; source: GitSource | null; work: WorkBranches | null;
  onClose: () => void; onPlan: (plan: string) => void; onStart: (task: TaskNode) => void;
}

function TaskDetail({ task, source, work, onClose, onPlan, onStart }: DetailProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [viewRev, setViewRev] = useState<number | null>(null);
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const revs = task.planHistory ?? [];
  const shown = viewRev ? revs[viewRev - 1] : null;
  const status = statusOf(task);

  useEffect(() => {
    if (!task.branch || !source || !work?.base) { setCommits(null); return; }
    let live = true;
    source.log({ ref: `${work.base}..${task.branch}`, limit: 15 }).then((c) => { if (live) setCommits(c); }, () => { if (live) setCommits([]); });
    return () => { live = false; };
  }, [task.branch, source, work?.base]);

  return (
    <div className="board-detail" role="region" aria-label="Card detail">
      <div className="board-detail__bar">
        <button type="button" onClick={onClose}><ArrowLeft size={14} aria-hidden="true" />Board</button>
        <span className="git-chip">{status === 'doing' && task.branch ? `doing · ${task.branch}` : status}</span>
        <span className="git-spacer" />
        {status === 'doing' && task.branch ? <button type="button" onClick={() => onStart(task)}><Play size={14} aria-hidden="true" />Start coding</button> : null}
      </div>
      <div className="board-detail__body">
        <h2>{task.label}</h2>
        {task.children.length ? (
          <ul className="board-subtasks">{task.children.map((c) => <li key={c.id} data-done={c.done}>{c.label}</li>)}</ul>
        ) : null}
        <section aria-label="Plan">
          <div className="board-plan__head">
            <FileText size={16} aria-hidden="true" /><h3>Plan</h3>
            {revs.length ? <span className="board-muted">revision {revs.length}</span> : null}
            <span className="git-spacer" />
            {!editing ? <button type="button" onClick={() => { setDraft(task.plan || PLAN_TEMPLATE); setEditing(true); setViewRev(null); }}><Pencil size={14} aria-hidden="true" />{task.plan ? 'Edit plan' : 'Write plan'}</button> : null}
          </div>
          {editing ? (
            <div>
              <textarea aria-label="Plan text" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { if (draft !== task.plan) onPlan(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
              <div className="board-plan__actions">
                <button type="button" onClick={() => { if (draft !== task.plan) onPlan(draft); setEditing(false); }}>Save revision</button>
                <button type="button" onClick={() => setEditing(false)}>Cancel</button>
                <span className="board-muted">Ctrl+Enter saves. Earlier revisions are kept.</span>
              </div>
            </div>
          ) : shown ? (
            <div className="board-plan__old">
              <div className="board-plan__actions">
                <span className="board-muted">Revision {viewRev} · {shown.ts.slice(0, 16).replace('T', ' ')}</span><span className="git-spacer" />
                <button type="button" onClick={() => { onPlan(shown.text); setViewRev(null); }}>Restore as new revision</button>
                <button type="button" onClick={() => setViewRev(null)}>Back to current</button>
              </div>
              <PlanView text={shown.text} />
            </div>
          ) : task.plan ? <PlanView text={task.plan} /> : <p className="git-note">No plan yet. Write one before moving this card onto a branch.</p>}
          {revs.length > 0 && !editing ? (
            <div className="board-revs"><History size={12} aria-hidden="true" /> Revisions:
              {revs.map((r, i) => <button key={r.ts + i} type="button" aria-pressed={viewRev === i + 1} title={r.ts} onClick={() => setViewRev(viewRev === i + 1 ? null : i + 1)}>{i + 1}</button>)}
            </div>
          ) : null}
        </section>
        {task.branch ? (
          <section aria-label="Branch commits">
            <h3><GitBranch size={16} aria-hidden="true" /> {task.branch}{work?.base ? <span className="board-muted"> commits ahead of {work.base}</span> : null}</h3>
            {commits === null ? <p className="git-note">No git history available.</p>
              : !commits.length ? <p className="git-note">Nothing ahead of {work?.base} yet.</p>
              : commits.map((c) => <div key={c.sha} className="board-commit"><GitCommitHorizontal size={14} aria-hidden="true" /><span>{c.subject}</span><code>{c.short}</code></div>)}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export interface BoardWindowProps {
  /** Supplied by tests/previews; otherwise the window uses the local repo remembered by the Git window. */
  initialSource?: GitSource;
  work?: WorkBranches | null;
  onStart?: (detail: StartCodingDetail) => void;
}

/**
 * Kanban over the production tasks: Open | Plan | (Doing) | one column per working branch | Done.
 * All column logic is the shared `boardCore` (identical in ClaudeDesktopClient). Tasks are the
 * top-level production tasks; moving a card never deletes anything.
 */
export function BoardWindow({ initialSource, work: workProp, onStart }: BoardWindowProps = {}) {
  const { tasks, update, add } = useTaskTracker();
  const [source] = useState<GitSource | null>(() => {
    if (initialSource) return initialSource;
    if (!isDesktopRuntime()) return null;
    try { const repo = localStorage.getItem('layers.git.repo'); return repo ? createLocalGitSource(repo, tauriInvoke) : null; } catch { return null; }
  });
  const [work, setWork] = useState<WorkBranches | null>(workProp ?? null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (workProp !== undefined || !source) return undefined;
    let live = true;
    const load = () => { source.workBranches().then((w) => { if (live) setWork(w); }, () => undefined); };
    load();
    const timer = setInterval(load, 8000);
    return () => { live = false; clearInterval(timer); };
  }, [source, workProp]);
  useEffect(() => { if (workProp !== undefined) setWork(workProp); }, [workProp]);

  const items = useMemo(() => tasks.map((t) => ({ id: t.id, status: statusOf(t), branch: t.branch ?? null })), [tasks]);
  const board = useMemo(() => buildBoard({ items, work: work ?? undefined }), [items, work]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const finish = finishable(board);

  const move = (id: string, column: BoardColumn) => update(id, moveTo(column));
  const start = (task: TaskNode) => {
    if (!task.branch) return;
    const detail: StartCodingDetail = { id: task.id, label: task.label, branch: task.branch, plan: task.plan ?? '' };
    if (onStart) onStart(detail);
    else window.dispatchEvent(new CustomEvent<StartCodingDetail>(START_CODING_EVENT, { detail }));
  };
  const open = openId ? byId.get(openId) : undefined;

  return (
    <div className="git-window board-window">
      <div className="git-window__bar">
        <button type="button" onClick={() => { const id = add(null, 'New task'); setOpenId(id); }}><Plus size={14} aria-hidden="true" />Card</button>
        <span className="git-chip" title="Cards finished by merging go to Done"><GitBranch size={12} aria-hidden="true" />base {board.base ?? 'none'}</span>
        <span className="git-spacer" />
        {finish.length ? <button type="button" onClick={() => finish.forEach((id) => update(id, { status: 'done' }))}><CheckCheck size={14} aria-hidden="true" />Finish merged ({finish.length})</button> : null}
      </div>
      <div className="board-cols">
        {board.columns.map((col) => (
          <section key={col.id} className="board-col" data-col={col.id} aria-label={col.title}
            onDragOver={(e) => { if (dragging) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (dragging) move(dragging, col); setDragging(null); }}>
            <header>{col.kind === 'branch' ? <GitBranch size={13} aria-hidden="true" /> : null}<span title={col.title}>{col.title}</span><span className="git-chip">{col.items.length}</span>
              {col.kind === 'branch' && col.ahead ? <span className="board-muted" title={`${col.ahead} commits ahead of ${board.base}`}>↑{col.ahead}</span> : null}
            </header>
            {col.items.map((item) => {
              const t = byId.get(item.id);
              if (!t) return null;
              return (
                <article key={t.id} className="board-card" data-card={t.id} draggable onDragStart={() => setDragging(t.id)} onDragEnd={() => setDragging(null)} onClick={() => setOpenId(t.id)}>
                  <div className="board-card__title">{t.label}</div>
                  <div className="board-muted board-card__plan" title={t.plan ? t.plan.slice(0, 300) : 'Click the card to write a plan'}>
                    <FileText size={12} aria-hidden="true" />{t.plan ? (t.plan.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? 'Plan').replace(/^\s*[-*]\s+(\[[ xX]\]\s*)?/, '') : 'no plan'}
                  </div>
                  <div className="board-card__row" onClick={(e) => e.stopPropagation()}>
                    <select aria-label="Move to" value={col.id} onChange={(e) => { const target = board.columns.find((c) => c.id === e.target.value); if (target) move(t.id, target); }}>
                      {board.columns.map((c) => <option key={c.id} value={c.id}>{c.kind === 'branch' ? `In progress · ${c.title}` : c.title}</option>)}
                    </select>
                    {col.kind === 'branch' ? <button type="button" onClick={() => start(t)}><Play size={12} aria-hidden="true" />Start</button> : null}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>
      {open ? <TaskDetail task={open} source={source} work={work} onClose={() => setOpenId(null)} onPlan={(plan) => update(open.id, { plan })} onStart={start} /> : null}
    </div>
  );
}
