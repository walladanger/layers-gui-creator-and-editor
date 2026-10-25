import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Plus, X } from 'lucide-react';
import type { ChangeTarget, Comment } from '../../services/types';
import { BridgeService, type BridgeNode } from '../../services/bridgeService';

/** One element in the target app, as the bridge describes it (§4 RNode, trimmed). */
export interface PickedNode { nid: string; tag: string; label: string; text?: string; rid?: string; comp?: string; selector: string }
interface Rect { x: number; y: number; width: number; height: number }

export const COMMENT_KINDS = ['Change', 'Question', 'Idea', 'Bug'] as const;
export type CommentKind = (typeof COMMENT_KINDS)[number];

/** Comment text carries its kind as a prefix, so the fixed §5 `comments` row needs no new column. */
export function commentText(kind: CommentKind, text: string) {
  const body = text.trim();
  return kind === 'Change' ? body : `[${kind}] ${body}`;
}
export function readCommentKind(text: string): { kind: CommentKind; body: string } {
  const m = /^\[(Question|Idea|Bug)\] ([\s\S]*)$/.exec(text);
  return m ? { kind: m[1] as CommentKind, body: m[2] } : { kind: 'Change', body: text };
}
export function badgeText(n: PickedNode) {
  const t = n.text ? ` “${n.text.length > 28 ? `${n.text.slice(0, 28)}…` : n.text}”` : '';
  return `${n.label}${t}${n.comp ? ` in ${n.comp}` : ''}`;
}
export function targetOf(n: PickedNode): ChangeTarget {
  return { selector: n.selector, label: n.label, textSnippet: n.text, rid: n.rid, comp: n.comp };
}

/** View subscription only; transport lives in the typed service. */
function useBridge(bridge: BridgeService, onRects: (r: Record<string, Rect>) => void) {
  const rectsCb = useRef(onRects); rectsCb.current = onRects;
  useEffect(() => bridge.subscribe(m => { if (m.type === 'rect.update') rectsCb.current((m.payload?.rects ?? {}) as Record<string, Rect>); }), [bridge]);
  return useCallback(async (type: string, payload: Record<string, unknown>) => {
    try { return { type: `${type}.ok`, payload: await bridge.request(type, payload) }; }
    catch { return { type: `${type}.err`, payload: {} as Record<string, unknown> }; }
  }, [bridge]);
}

/** Extra facts recorded with a comment so the exact element and its look can be recalled later. */
export interface CommentMeta { kind: CommentKind; body: string; tag: string; rect?: Rect; styles?: Record<string, string> }

export interface FrameOverlayProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  bridge: BridgeService;
  onSelect?(node: BridgeNode): void;
  tool: string;
  pins: Comment[];
  showPins: boolean;
  onSaveComment(input: { text: string; target: ChangeTarget; px: number; py: number; meta?: CommentMeta }): Promise<void> | void;
  onStop(): void;
}

export function FrameOverlay({ bridge, onSelect, tool, pins, showPins, onSaveComment, onStop }: FrameOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<PickedNode | null>(null);
  const [picked, setPicked] = useState<{ node: PickedNode; px: number; py: number } | null>(null);
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [kind, setKind] = useState<CommentKind>('Change');
  const [draft, setDraft] = useState('');
  const call = useBridge(bridge, (r) => setRects((old) => ({ ...old, ...r })));
  const busy = useRef(false);
  const active = tool === 'grab' || tool === 'comment';

  const watchIds = [hover?.nid, picked?.node.nid].filter(Boolean) as string[];
  const watchKey = watchIds.join(',');
  useEffect(() => { if (active) void call('rect.watch', { nids: watchIds }); }, [watchKey, active, call]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!active) { setHover(null); setPicked(null); } }, [active]);
  useEffect(() => { setPicked(null); setDraft(''); }, [tool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !active) return;
      if (picked) setPicked(null); else onStop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, picked, onStop]);

  const local = (clientX: number, clientY: number) => {
    const el = overlayRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const s = r.width / (el.offsetWidth || r.width || 1);
    return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
  };
  const resolve = async (x: number, y: number): Promise<PickedNode | null> => {
    const h = await call('hit.test', { x, y, mode: 'block' });
    const nid = h.payload.nid as string | null | undefined;
    if (!nid) return null;
    const t = await call('tree.get', { rootNid: nid, depth: 0 });
    return ((t.payload.nodes as PickedNode[] | undefined) ?? [])[0] ?? null;
  };

  const onMove = async (e: React.PointerEvent) => {
    if (busy.current || (picked && tool === 'comment')) return;
    busy.current = true;
    const { x, y } = local(e.clientX, e.clientY);
    const n = await resolve(x, y);
    busy.current = false;
    setHover((old) => (old?.nid === n?.nid ? old : n));
  };
  const onClick = async (e: React.MouseEvent) => {
    const { x, y } = local(e.clientX, e.clientY);
    const n = await resolve(x, y);
    if (!n) { setPicked(null); return; }
    setPicked({ node: n, px: Math.round(x), py: Math.round(y) });
    setDraft(''); setKind('Change');
    if (tool === 'grab') onSelect?.(n as BridgeNode);
  };
  const save = async () => {
    if (!picked || !draft.trim()) return;
    const st = await call('style.get', { nid: picked.node.nid });
    const styles = st.type === 'style.get.ok' ? (st.payload as { computed?: Record<string, string> }).computed ?? (st.payload as Record<string, string>) : undefined;
    const meta: CommentMeta = { kind, body: draft.trim(), tag: picked.node.tag, rect: rects[picked.node.nid], styles: styles && typeof styles === 'object' ? Object.fromEntries(Object.entries(styles).filter(([, v]) => typeof v === 'string')) : undefined };
    await onSaveComment({ text: commentText(kind, draft), target: targetOf(picked.node), px: picked.px, py: picked.py, meta });
    setPicked(null); setDraft('');
  };

  const box = (n: PickedNode | null | undefined, variant: 'hover' | 'picked') => {
    const r = n ? rects[n.nid] : undefined;
    if (!n || !r) return null;
    return (
      <div className={`pick-box pick-box--${variant}`} style={{ left: r.x, top: r.y, width: r.width, height: r.height }}>
        <span className="pick-box__badge">{badgeText(n)}</span>
      </div>
    );
  };
  const pickedRect = picked ? rects[picked.node.nid] : undefined;

  return (
    <>
      {showPins ? pins.map((c, i) => (
        <span key={c.id} className="comment-pin" data-status={c.status} style={{ left: c.px ?? 0, top: c.py ?? 0 }} title={readCommentKind(c.text).body}>{i + 1}</span>
      )) : null}
      {active ? (
        <div ref={overlayRef} className="frame-overlay" data-tool={tool} aria-label={tool === 'comment' ? 'Comment layer' : 'Grab layer'}
          onPointerMove={(e) => void onMove(e)} onPointerLeave={() => setHover(null)} onClick={(e) => void onClick(e)}>
          {hover?.nid !== picked?.node.nid ? box(hover, 'hover') : null}
          {box(picked?.node, 'picked')}
        </div>
      ) : null}
      {tool === 'comment' && picked ? (
        <>
          <span className="comment-plus" style={{ left: picked.px - 11, top: picked.py - 11 }} aria-hidden="true"><Plus size={12} /></span>
          <div className="comment-pop" role="dialog" aria-label="Leave a comment"
            style={{ left: picked.px + 16, top: Math.max(8, Math.min(picked.py + 8, (pickedRect?.y ?? 0) + (pickedRect?.height ?? 0) + 8)) }}
            onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <div className="comment-pop__head">
              <code>{badgeText(picked.node)}</code>
              <button type="button" aria-label="Close" onClick={() => setPicked(null)}><X size={14} /></button>
            </div>
            <div className="comment-pop__kinds" role="group" aria-label="Kind of comment">
              {COMMENT_KINDS.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
            </div>
            <textarea autoFocus aria-label="Comment" placeholder="What should change here?" value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); } }} />
            <div className="comment-pop__foot">
              <span>Ctrl+Enter</span>
              <button type="button" onClick={() => setPicked(null)}>Cancel</button>
              <button type="button" className="comment-pop__send" disabled={!draft.trim()} onClick={() => void save()}>Comment</button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
