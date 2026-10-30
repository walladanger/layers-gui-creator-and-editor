import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { GripVertical, PanelLeft, X } from 'lucide-react';

interface PanelBounds { x: number; y: number; width: number; height: number }
type Gesture = { pointerId: number; startX: number; startY: number; original: PanelBounds; kind: 'move' | 'resize'; docked: boolean };

export interface DockablePagePanelProps {
  title: string;
  children: ReactNode;
  docked: boolean;
  onDockChange(value: boolean): void;
  dockWidth: number;
  onDockWidthChange(width: number): void;
  onClose(): void;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 760;
const MIN_HEIGHT = 220;
const MAX_DOCK_WIDTH = 600;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Navigation pages dock immediately, but dragging their title detaches them; resizing works in either mode. */
export function DockablePagePanel({
  title, children, docked, onDockChange, dockWidth, onDockWidthChange, onClose,
}: DockablePagePanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [bounds, setBounds] = useState<PanelBounds>({ x: 24, y: 24, width: dockWidth, height: 540 });

  useEffect(() => { if (docked) gesture.current = null; }, [docked]);

  const begin = (event: ReactPointerEvent<HTMLElement>, kind: Gesture['kind']) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const parent = panel.current?.closest('.app-shell__workspace-content') as HTMLElement | null;
    const parentRect = parent?.getBoundingClientRect();
    const rect = panel.current?.getBoundingClientRect();
    const original = docked && rect && parentRect
      ? { x: rect.left - parentRect.left, y: rect.top - parentRect.top, width: rect.width, height: rect.height }
      : bounds;
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, original, kind, docked };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const op = gesture.current;
    if (!op || event.pointerId !== op.pointerId) return;
    const dx = event.clientX - op.startX;
    const dy = event.clientY - op.startY;
    if (op.kind === 'resize') {
      if (op.docked) {
        onDockWidthChange(clamp(op.original.width + dx, MIN_WIDTH, MAX_DOCK_WIDTH));
      } else setBounds({ ...op.original, width: clamp(op.original.width + dx, MIN_WIDTH, MAX_WIDTH), height: Math.max(MIN_HEIGHT, op.original.height + dy) });
      return;
    }
    if (op.docked && Math.hypot(dx, dy) < 5) return;
    if (op.docked) onDockChange(false);
    setBounds({ ...op.original, x: Math.max(0, op.original.x + dx), y: Math.max(0, op.original.y + dy) });
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const style: CSSProperties | undefined = docked ? undefined : {
    position: 'absolute', left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height,
  };

  return (
    <div className="app-shell__page-layer" data-side="left" data-docked={docked}>
      <section ref={panel} className="app-shell__page-panel" aria-label={title} data-panel-docked={docked} style={style}>
        <header className="app-shell__page-header" onPointerDown={e => begin(e, 'move')}
          onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <GripVertical size={16} aria-hidden="true" />
          <strong>{title}</strong>
          <div className="app-shell__page-actions">
            {!docked && <button type="button" aria-label="Dock panel" title="Attach panel to left navigation" onPointerDown={e => e.stopPropagation()} onClick={() => onDockChange(true)}><PanelLeft size={15} /></button>}
            <button type="button" className="app-shell__page-close" aria-label="Close page" title="Close this panel" onPointerDown={e => e.stopPropagation()} onClick={onClose}><X size={15} /></button>
          </div>
        </header>
        <div className="app-shell__page-body">{children}</div>
        <div className="app-shell__page-resize" role="separator" aria-label={docked ? 'Resize docked panel' : 'Resize panel'}
          aria-orientation={docked ? 'vertical' : undefined} tabIndex={0}
          onPointerDown={e => begin(e, 'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
          onKeyDown={e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const delta = e.key === 'ArrowRight' ? 20 : -20;
            if (docked) onDockWidthChange(clamp(dockWidth + delta, MIN_WIDTH, MAX_DOCK_WIDTH));
            else setBounds(b => ({ ...b, width: clamp(b.width + delta, MIN_WIDTH, MAX_WIDTH) }));
          }} />
      </section>
    </div>
  );
}
