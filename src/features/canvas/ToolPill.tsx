import { Eye, EyeOff, List, MessageSquare, MousePointer2, Move, Play, Redo2, Trash2, Undo2, X, Check } from 'lucide-react';
import type { Comment } from '../../services/types';
import { readCommentKind } from './FrameOverlay';

type PillTool = 'use' | 'grab' | 'comment';

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
  const modes: { id: PillTool; label: string; title: string; Icon: typeof Move }[] = [
    { id: 'use', label: 'Use', title: 'Use your app normally', Icon: MousePointer2 },
    { id: 'grab', label: 'Grab', title: 'Pick a part of the page (V)', Icon: Move },
    { id: 'comment', label: 'Comment', title: 'Leave a note on a part of the page (C)', Icon: MessageSquare },
  ];
  const hint = hints[tool];
  return (
    <div className="tool-pill-wrap" onPointerDown={(e) => e.stopPropagation()}>
      {hint ? <p className="tool-pill__hint" role="status">{hint}</p> : null}
      <div className="tool-pill" role="toolbar" aria-label="Editing tools">
        {modes.map(({ id, label, title, Icon }) => (
          <button key={id} type="button" title={title} aria-pressed={tool === id} onClick={() => onTool(id)}>
            <Icon aria-hidden="true" size={15} /><span>{label}</span>
          </button>
        ))}
        <span className="tool-pill__sep" aria-hidden="true" />
        <button type="button" className="tool-pill__icon" aria-label="Undo" title="Undo (coming with style editing)" disabled><Undo2 aria-hidden="true" size={15} /></button>
        <button type="button" className="tool-pill__icon" aria-label="Redo" title="Redo (coming with style editing)" disabled><Redo2 aria-hidden="true" size={15} /></button>
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
