import { useCallback, useEffect, useState } from 'react';
import { setBridgeConnected } from './EditorStatus';
import {
  GitCommitHorizontal, Hand, LayoutGrid, Maximize, MessageSquarePlus, Minus, MousePointer2, PanelLeft, PenLine, Plus, RotateCcw, SquarePlus,
} from 'lucide-react';
import { useOptionalWindowManager } from '../../windows/WindowManagerProvider';
import { editorWindowIds, editorWindowRegistry } from '../editor-windows/editorWindows';
import { useCanvasLayout } from './canvasLayout';
import { CanvasStage } from './CanvasStage';
import { CommandRibbon } from './CommandRibbon';
import { clampZoom, type CanvasView } from './canvasView';
import type { BridgeState } from './FrameHost';
import './canvas.css';

export type CanvasTool = 'use' | 'grab' | 'comment' | 'draw' | 'insert' | 'hand';

const tools: { id: CanvasTool; label: string; key?: string; icon: typeof Hand }[] = [
  { id: 'grab', label: 'Grab', key: 'V', icon: MousePointer2 },
  { id: 'comment', label: 'Comment', key: 'C', icon: MessageSquarePlus },
  { id: 'draw', label: 'Draw', key: 'D', icon: PenLine },
  { id: 'insert', label: 'Insert', icon: SquarePlus },
  { id: 'hand', label: 'Hand', key: 'Space', icon: Hand },
];

export function CanvasPage() {
  const [tool, setTool] = useState<CanvasTool>('use');
  const [view, setViewState] = useState<CanvasView>({ x: 48, y: 48, zoom: 100 });
  const [fitRequest, setFitRequest] = useState(0);
  const [bridge, setBridge] = useState<BridgeState | null>(null);
  useEffect(() => { setBridgeConnected(bridge === 'ready'); return () => setBridgeConnected(false); }, [bridge]);
  const setView = useCallback((next: CanvasView | ((v: CanvasView) => CanvasView)) => {
    setViewState((v) => { const n = typeof next === 'function' ? next(v) : next; return { ...n, zoom: clampZoom(n.zoom) }; });
  }, []);
  const zoom = view.zoom;
  const { layout, update, reset } = useCanvasLayout();
  const windows = useOptionalWindowManager();
  const changeZoom = (delta: number) => setView((v) => ({ ...v, zoom: v.zoom + delta }));

  const resetLayout = () => {
    reset();
    windows?.state.windows.forEach((window) => windows.close(window.id));
  };

  return (
    <div className="canvas-page" data-left-open={layout.leftRailOpen} data-right-open="false">
      <CommandRibbon />
      <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
        <button type="button" aria-label={layout.leftRailOpen ? 'Hide layers' : 'Show layers'} aria-pressed={layout.leftRailOpen} onClick={() => update({ leftRailOpen: !layout.leftRailOpen })}>
          <PanelLeft aria-hidden="true" size={16} />
        </button>
        <div className="canvas-toolbar__group">
          {tools.map(({ id, label, key, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={tool === id} title={key ? `${label} (${key})` : label} onClick={() => setTool(id)}>
              <Icon aria-hidden="true" size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="canvas-toolbar__group" aria-label="Zoom">
          <button type="button" aria-label="Zoom out" onClick={() => changeZoom(-10)}><Minus aria-hidden="true" size={16} /></button>
          <output aria-label="Zoom level">{zoom}%</output>
          <button type="button" aria-label="Zoom in" onClick={() => changeZoom(10)}><Plus aria-hidden="true" size={16} /></button>
          <button type="button" onClick={() => setFitRequest((n) => n + 1)}><Maximize aria-hidden="true" size={16} /><span>Fit</span></button>
        </div>
        <div className="canvas-toolbar__group canvas-toolbar__windows" aria-label="Windows">
          {editorWindowIds.map((id) => {
            const open = windows?.state.windows.some((window) => window.id === id) ?? false;
            const title = editorWindowRegistry[id].title;
            return (
              <button key={id} type="button" aria-pressed={open} aria-label={`${open ? 'Close' : 'Open'} ${title} window`} disabled={!windows}
                onClick={() => (open ? windows?.close(id) : windows?.open(id))}>
                {title}
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Open Screens window" disabled={!windows} onClick={() => windows?.open('screen-catalog')}>
          <LayoutGrid aria-hidden="true" size={16} /><span>Screens</span>
        </button>
        <button type="button" aria-label="Open Git window" disabled={!windows} onClick={() => windows?.open('git')}>
          <GitCommitHorizontal aria-hidden="true" size={16} /><span>Git</span>
        </button>
        <button type="button" onClick={resetLayout}><RotateCcw aria-hidden="true" size={16} /><span>Reset layout</span></button>
      </div>

      <section className="canvas-stage" aria-label="Canvas" data-tool={tool}>
        <CanvasStage tool={tool} onToolChange={setTool} view={view} onViewChange={setView} fitRequest={fitRequest} onBridgeChange={setBridge} />
      </section>

    </div>
  );
}
