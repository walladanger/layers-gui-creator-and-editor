import { useState } from 'react';
import {
  Hand, MessageSquarePlus, Minus, MousePointer2, PanelLeft, PanelRight, PenLine, Plus, RotateCcw, SquarePlus,
} from 'lucide-react';
import { useOptionalWindowManager } from '../../windows/WindowManagerProvider';
import { editorWindowIds, editorWindowRegistry } from '../editor-windows/editorWindows';
import { useCanvasLayout, type RightRailTab } from './canvasLayout';
import './canvas.css';

export type CanvasTool = 'grab' | 'comment' | 'draw' | 'insert' | 'hand';

const tools: { id: CanvasTool; label: string; key?: string; icon: typeof Hand }[] = [
  { id: 'grab', label: 'Grab', key: 'V', icon: MousePointer2 },
  { id: 'comment', label: 'Comment', key: 'C', icon: MessageSquarePlus },
  { id: 'draw', label: 'Draw', key: 'D', icon: PenLine },
  { id: 'insert', label: 'Insert', icon: SquarePlus },
  { id: 'hand', label: 'Hand', key: 'Space', icon: Hand },
];

const rightTabs: { id: RightRailTab; label: string; empty: string }[] = [
  { id: 'inspector', label: 'Inspector', empty: 'Select something on the canvas to edit its style.' },
  { id: 'comments', label: 'Comments', empty: 'No comments yet.' },
  { id: 'production', label: 'Production', empty: 'Your changes will be listed here.' },
];

const ZOOM_MIN = 10;
const ZOOM_MAX = 400;

export function CanvasPage() {
  const [tool, setTool] = useState<CanvasTool>('grab');
  const [zoom, setZoom] = useState(100);
  const { layout, update, reset } = useCanvasLayout();
  const windows = useOptionalWindowManager();
  const changeZoom = (delta: number) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)));

  const resetLayout = () => {
    reset();
    windows?.state.windows.forEach((window) => windows.close(window.id));
  };

  return (
    <div className="canvas-page" data-left-open={layout.leftRailOpen} data-right-open={layout.rightRailOpen}>
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
        <button type="button" onClick={resetLayout}><RotateCcw aria-hidden="true" size={16} /><span>Reset layout</span></button>
        <button type="button" aria-label={layout.rightRailOpen ? 'Hide side panel' : 'Show side panel'} aria-pressed={layout.rightRailOpen} onClick={() => update({ rightRailOpen: !layout.rightRailOpen })}>
          <PanelRight aria-hidden="true" size={16} />
        </button>
      </div>

      {layout.leftRailOpen ? (
        <aside className="canvas-rail canvas-rail--left" aria-label="Layers">
          <h2 className="canvas-rail__heading">Layers</h2>
          <div className="editor-empty">
            <p className="editor-empty__title">No layers yet</p>
            <p className="editor-empty__text">Connect an app to see its layers.</p>
          </div>
        </aside>
      ) : null}

      <section className="canvas-stage" aria-label="Canvas" data-tool={tool}>
        <div className="editor-empty">
          <p className="editor-empty__title">No frames yet</p>
          <p className="editor-empty__text">Open a project to show your app here.</p>
        </div>
      </section>

      {layout.rightRailOpen ? (
        <aside className="canvas-rail canvas-rail--right" aria-label="Side panel">
          <div className="canvas-tabs" role="tablist" aria-label="Side panel tabs">
            {rightTabs.map((tab) => (
              <button key={tab.id} type="button" role="tab" id={`canvas-tab-${tab.id}`} aria-selected={layout.rightTab === tab.id}
                aria-controls="canvas-tabpanel" onClick={() => update({ rightTab: tab.id })}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="canvas-tabpanel" role="tabpanel" id="canvas-tabpanel" aria-labelledby={`canvas-tab-${layout.rightTab}`}>
            <div className="editor-empty">
              <p className="editor-empty__title">{rightTabs.find((tab) => tab.id === layout.rightTab)?.label}</p>
              <p className="editor-empty__text">{rightTabs.find((tab) => tab.id === layout.rightTab)?.empty}</p>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
