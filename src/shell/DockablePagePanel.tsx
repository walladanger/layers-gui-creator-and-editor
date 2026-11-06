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

  const fit = (next: PanelBounds): PanelBounds => {
    const parent = panel.current?.closest('.app-shell__workspace-content') as HTMLElement | null;
    const area = parent?.getBoundingClientRect();
    const areaWidth = area?.width || window.innerWidth;
    const areaHeight = area?.height || window.innerHeight;
    const width = clamp(next.width, Math.min(MIN_WIDTH, areaWidth), Math.min(MAX_WIDTH, areaWidth));
    const height = clamp(next.height, Math.min(MIN_HEIGHT, areaHeight), areaHeight);
    return { width, height, x: clamp(next.x, 0, Math.max(0, areaWidth - width)), y: clamp(next.y, 0, Math.max(0, areaHeight - height)) };
  };

  useEffect(() => {
    if (docked) return;
    const resize = () => setBounds(current => {
      const next = fit(current);
      return Object.keys(next).every(key => next[key as keyof PanelBounds] === current[key as keyof PanelBounds]) ? current : next;
    });
    const parent = panel.current?.closest('.app-shell__workspace-content');
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    if (parent) observer?.observe(parent);
    window.addEventListener('resize', resize);
    resize();
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [docked]);

  const begin = (event: ReactPointerEvent<HTMLElement>, kind: Gesture['kind']) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const parent = panel.current?.closest('.app-shell__workspace-content') as HTMLElement | null;
    const parentRect = parent?.getBoundingClientRect();
    const rect = panel.current?.getBoundingClientRect();
    const original = docked && rect?.width && parentRect
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
      } else setBounds(fit({ ...op.original, width: op.original.width + dx, height: op.original.height + dy }));
      return;
    }
    if (op.docked && Math.hypot(dx, dy) < 5) return;
    if (op.docked) onDockChange(false);
    setBounds(fit({ ...op.original, x: op.original.x + dx, y: op.original.y + dy }));
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
          onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
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
          onPointerDown={e => begin(e, 'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
          onKeyDown={e => {
            if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
            e.preventDefault();
            const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
            if (docked && vertical) return;
            const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 20 : -20;
            if (docked) onDockWidthChange(clamp(dockWidth + delta, MIN_WIDTH, MAX_DOCK_WIDTH));
            else setBounds(b => fit({ ...b, ...(vertical ? { height: b.height + delta } : { width: b.width + delta }) }));
          }} />
      </section>
    </div>
  );
}
