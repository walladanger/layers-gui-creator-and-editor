import { Eye, EyeOff, List, MessageSquare, MousePointer2, Move, Play, Redo2, Trash2, Undo2, X, Check } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { originalMenuService } from '../../services/originalMenuService';
import { liveStyleService } from '../../services/liveStyleService';
import type { Comment } from '../../services/types';
import { readCommentKind } from './FrameOverlay';

type PillTool = 'use' | 'grab' | 'comment';

const PILL_POS_KEY = 'layers.toolPillPos';
type PillPos = { x: number; y: number };

function readStoredPillPos(): PillPos | null {
  try {
    const raw = localStorage.getItem(PILL_POS_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw) as PillPos;
    return typeof pos.x === 'number' && typeof pos.y === 'number' ? pos : null;
  } catch { return null; }
}

interface PillDrag {
  startX: number; startY: number; originX: number; originY: number;
  parentRect: { left: number; top: number; width: number; height: number };
  pillWidth: number; pillHeight: number; moved: boolean;
}

const hints: Partial<Record<string, string>> = {
  grab: 'Click anything to pick it · Esc to stop',
  comment: 'Click anything to leave a comment · Esc to stop',
};

export interface ToolPillProps {
  tool: string;
  onTool(tool: PillTool): void;
  showPins: boolean;
  onTogglePins(): void;
  notesOpen: boolean;
  onToggleNotes(): void;
  openCount: number;
}

/** The floating pill at the bottom of the canvas: plain words, one icon each. */
export function ToolPill({ tool, onTool, showPins, onTogglePins, notesOpen, onToggleNotes, openCount }: ToolPillProps) {
  const live = useSyncExternalStore(liveStyleService.subscribe, liveStyleService.getSnapshot);
  const original = useSyncExternalStore(originalMenuService.subscribe, originalMenuService.getSnapshot);
  const history = live.connected ? live : original;
  const undo = live.connected ? liveStyleService.undo : originalMenuService.undo;
  const redo = live.connected ? liveStyleService.redo : originalMenuService.redo;
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(event.key.toLowerCase()) || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      if (event.shiftKey || event.key.toLowerCase() === 'y') void redo(); else void undo();
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [undo, redo]);
  const [pos, setPos] = useState<PillPos | null>(readStoredPillPos);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<PillDrag | null>(null);
  const suppressClick = useRef(false);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const wrap = event.currentTarget;
    const rect = wrap.getBoundingClientRect();
    const parent = wrap.offsetParent as HTMLElement | null;
    const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    drag.current = { startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, parentRect, pillWidth: rect.width, pillHeight: rect.height, moved: false };
    try { wrap.setPointerCapture(event.pointerId); } catch { /* jsdom and older browsers */ }
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    if (!state.moved) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 4) return;
      state.moved = true;
      setDragging(true);
    }
    const parentRect = state.parentRect;
    const x = Math.min(Math.max(state.originX + event.clientX - state.startX - parentRect.left, 0), Math.max(parentRect.width - state.pillWidth, 0));
    const y = Math.min(Math.max(state.originY + event.clientY - state.startY - parentRect.top, 0), Math.max(parentRect.height - state.pillHeight, 0));
    setPos({ x, y });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (state.moved) {
      suppressClick.current = true;
      setPos((current) => { if (current) { try { localStorage.setItem(PILL_POS_KEY, JSON.stringify(current)); } catch { /* ignore */ } } return current; });
    }
    drag.current = null;
    setDragging(false);
  };
  const modes: { id: PillTool; label: string; title: string; Icon: typeof Move }[] = [
    { id: 'use', label: 'Use', title: 'Use your app normally', Icon: MousePointer2 },
    { id: 'grab', label: 'Grab', title: 'Pick a part of the page (V)', Icon: Move },
    { id: 'comment', label: 'Comment', title: 'Leave a note on a part of the page (C)', Icon: MessageSquare },
  ];
  const hint = hints[tool];
  return (
    <div className="tool-pill-wrap" data-dragging={dragging || undefined}
      style={pos ? { left: pos.x, top: pos.y, bottom: 'auto', transform: 'none' } : undefined}
      onPointerDown={(e) => { e.stopPropagation(); beginDrag(e); }}
      onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; } }}>
      {hint ? <p className="tool-pill__hint" role="status">{hint}</p> : null}
      <div className="tool-pill" role="toolbar" aria-label="Editing tools">
        {modes.map(({ id, label, title, Icon }) => (
          <button key={id} type="button" title={title} aria-pressed={tool === id} onClick={() => onTool(id)}>
            <Icon aria-hidden="true" size={15} /><span>{label}</span>
          </button>
        ))}
        <span className="tool-pill__sep" aria-hidden="true" />
        <button type="button" className="tool-pill__icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!history.canUndo} onClick={() => void undo()}><Undo2 aria-hidden="true" size={15} /></button>
        <button type="button" className="tool-pill__icon" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!history.canRedo} onClick={() => void redo()}><Redo2 aria-hidden="true" size={15} /></button>
        <span className="tool-pill__sep" aria-hidden="true" />
        <button type="button" title={showPins ? 'Hide comment pins' : 'Show comment pins'} aria-pressed={showPins} onClick={onTogglePins}>
          {showPins ? <Eye aria-hidden="true" size={15} /> : <EyeOff aria-hidden="true" size={15} />}<span>Pins</span>
        </button>
        <button type="button" title="Motion and effects (coming next)" disabled><Play aria-hidden="true" size={15} /><span>Motion</span></button>
        <button type="button" title="All your notes for the to-do list" aria-pressed={notesOpen} onClick={onToggleNotes}>
          <List aria-hidden="true" size={15} /><span>Notes</span>
          {openCount ? <span className="tool-pill__count" aria-label={`${openCount} open`}>{openCount}</span> : null}
        </button>
      </div>
    </div>
  );
}

export function NotesDrawer({ comments, onClose, onToggleDone, onRemove }: {
  comments: Comment[]; onClose(): void; onToggleDone(c: Comment): void; onRemove(c: Comment): void;
}) {
  return (
    <aside className="notes-drawer" aria-label="Notes" onPointerDown={(e) => e.stopPropagation()}>
      <div className="notes-drawer__head">
        <b>Notes</b>
        <button type="button" aria-label="Close notes" onClick={onClose}><X size={14} /></button>
      </div>
      <p className="notes-drawer__intro">Every comment you leave lands here and goes on the to-do list for the AI helper.</p>
      {comments.length === 0 ? <p className="notes-drawer__empty">No notes yet. Pick Comment, then click anything on the page.</p> : (
        <ol className="notes-drawer__list">
          {comments.map((c) => {
            const { kind, body } = readCommentKind(c.text);
            return (
              <li key={c.id} data-status={c.status}>
                <div className="notes-drawer__meta"><span className="notes-drawer__kind">{kind}</span><code>{c.target.label ?? c.target.selector ?? 'page'}</code></div>
                <p>{body}</p>
                <div className="notes-drawer__actions">
                  <button type="button" onClick={() => onToggleDone(c)}><Check size={13} aria-hidden="true" />{c.status === 'done' ? 'Reopen' : 'Done'}</button>
                  <button type="button" aria-label="Delete note" onClick={() => onRemove(c)}><Trash2 size={13} aria-hidden="true" /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
