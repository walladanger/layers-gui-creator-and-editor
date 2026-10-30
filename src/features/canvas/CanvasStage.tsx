import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useOptionalServices } from '../../services/ServicesProvider';
import { useOptionalWindowManager } from '../../windows/WindowManagerProvider';
import { FolderOpen, Link2, Shapes } from 'lucide-react';
import type { ChangeTarget, Comment, Frame, Project } from '../../services/types';
import { ToolPill, NotesDrawer } from './ToolPill';
import type { CanvasView } from './canvasView';
import { fitView, zoomAt } from './canvasView';
import { FrameHost, type BridgeState } from './FrameHost';
import { onOpenProjectScreens, onOpenScreen, requestProjectImport } from '../screen-catalog/catalogBus';
import type { CommentMeta } from './FrameOverlay';
import { recordCanvasComment } from '../../services/commentTasks';
import type { ScreenSelection } from '../../services/screenSnapshots';
import { canvasProjectContext } from '../../services/canvasProjectContext';
import { liveStyleService } from '../../services/liveStyleService';

export const PROJECT_KEY = 'radium.canvasProject';

export interface CanvasStageProps {
  tool: string;
  onToolChange?(tool: 'use' | 'grab' | 'comment'): void;
  view: CanvasView;
  onViewChange(next: CanvasView | ((v: CanvasView) => CanvasView)): void;
  fitRequest: number;
  onBridgeChange?(state: BridgeState | null): void;
}

export function CanvasStage(props: CanvasStageProps) {
  const ctx = useOptionalServices();
  if (!ctx?.user) {
    return (
      <div className="editor-empty">
        <p className="editor-empty__title">No frames yet</p>
        <p className="editor-empty__text">Open a project to show your app here.</p>
      </div>
    );
  }
  return <ProjectCanvas {...props} />;
}

function ProjectCanvas({ tool, onToolChange, view, onViewChange, fitRequest, onBridgeChange }: CanvasStageProps) {
  const context = useOptionalServices();
  if (!context) return null;
  const { runtime, user } = context;
  const windows = useOptionalWindowManager();
  const { projects: projectService, frames: frameService, comments: commentService } = runtime.services;
  const [connectOpen, setConnectOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showPins, setShowPins] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [projects, setProjects] = useState<Project[] | null>(null);
  // Start on a clean canvas; a saved or demo project only opens when explicitly chosen.
  const [projectId, setProjectId] = useState<string | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [pickedScreen, setPickedScreen] = useState<(ScreenSelection & { frameId: string }) | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const project = projects?.find((p) => p.id === projectId) ?? null;

  useEffect(() => {
    canvasProjectContext.setProject(project?.id ?? null);
    liveStyleService.clearSelection();
    return () => canvasProjectContext.setProject(null);
  }, [project?.id]);

  useEffect(() => { void projectService.list().then(setProjects).catch(() => setProjects([])); }, [projectService, user?.id]);

  useEffect(() => {
    if (!project) { localStorage.removeItem(PROJECT_KEY); setFrames([]); return; }
    localStorage.setItem(PROJECT_KEY, project.id);
    let active = true;
    void frameService.list(project.id).then(async (list) => {
      if (!active) return;
      if (list.length === 0) list = [await frameService.add({ project_id: project.id, label: 'Desktop' })];
      setFrames(list);
    }).catch(() => setFrames([]));
    return () => { active = false; };
  }, [project?.id, frameService]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project) { setComments([]); return; }
    let live = true;
    void commentService.list(project.id).then((list) => { if (live) setComments(list); }).catch(() => undefined);
    return () => { live = false; };
  }, [project?.id, commentService]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveComment = async (frame: Frame, { meta, iframe, route, ...input }: { text: string; target: ChangeTarget; px: number; py: number; meta?: CommentMeta; iframe?: HTMLIFrameElement | null; route?: string }) => {
    const c = await commentService.add({ project_id: frame.project_id, frame_id: frame.id, ...input });
    setComments((list) => [...list, c]);
    void recordCanvasComment({
      commentId: c.id, text: meta?.body ?? input.text, kind: meta?.kind ?? 'Change', projectId: frame.project_id, frameId: frame.id,
      route: route ?? frame.route, px: input.px, py: input.py, rect: meta?.rect, styles: meta?.styles, iframe, shots: meta?.shots,
      viewport: { width: frame.width, height: frame.height },
      element: { label: input.target.label ?? 'Element', selector: input.target.selector, rid: input.target.rid, comp: input.target.comp, text: input.target.textSnippet, tag: meta?.tag },
    });
  };
  const toggleDone = async (c: Comment) => {
    const status = c.status === 'done' ? 'open' : 'done';
    setComments((list) => list.map((x) => (x.id === c.id ? { ...x, status } : x)));
    await commentService.setStatus(c.id, status);
  };
  const removeComment = async (c: Comment) => {
    setComments((list) => list.filter((x) => x.id !== c.id));
    await commentService.remove(c.id);
  };

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const view = fitView(frames.map((f) => ({ x: f.canvas_x, y: f.canvas_y, width: f.width, height: f.height + 40 })),
      { width: el.clientWidth, height: el.clientHeight });
    const rightmost = frames.length ? Math.max(...frames.map(f => f.canvas_x + f.width)) : 0;
    // Keep the complete group anchored to the right editing area.
    onViewChange({ ...view, x: Math.max(32, el.clientWidth - 48 - rightmost * view.zoom / 100) });
  }, [frames, onViewChange]);
  const fitOnce = useRef<string | null>(null);
  useEffect(() => { if (frames.length && fitOnce.current !== project?.id) { fitOnce.current = project?.id ?? null; fit(); } }, [frames, fit, project?.id]);
  useEffect(() => { if (fitRequest) fit(); }, [fitRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement)?.closest('input,textarea,select')) return;
      e.preventDefault(); setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) onViewChange((v) => zoomAt(v, v.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top));
      else onViewChange((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onViewChange]);

  const connectApp = async (event: React.FormEvent) => {
    event.preventDefault(); setConnecting(true); setConnectError('');
    try {
      const next = await projectService.create({ name: appName, target_mode: 'live', target_url: appUrl });
      setProjects(list => [...(list ?? []), next]); setProjectId(next.id); setConnectOpen(false); setAppName(''); setAppUrl('');
    } catch (error) { setConnectError(error instanceof Error ? error.message : 'Could not connect that app.'); }
    finally { setConnecting(false); }
  };

  const canPan = tool === 'hand' || spaceDown;
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 1 && !(e.button === 0 && canPan)) return;
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY };
    setPanning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x; const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    onViewChange((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const endPan = () => { drag.current = null; setPanning(false); };

  const patchFrame = (id: string, patch: Partial<Frame>) => {
    setFrames((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    void frameService.update(id, patch);
  };
  const framesRef = useRef(frames);
  framesRef.current = frames;
  // Each distinct screen stays open as its own canvas frame rather than replacing
  // the first screen; the original blank starter frame is reused once.
  useEffect(() => onOpenScreen((selection) => {
    if (!project || !selection.screen.route) {
      setLoadError('Select a saved project or connect a running app before loading a screen.');
      return;
    }
    const opened = framesRef.current.find(f => f.route === selection.screen.route && f.label === selection.screen.name);
    if (opened) {
      setPickedScreen({ ...selection, frameId: opened.id });
      return;
    }
    const first = framesRef.current[0];
    if (framesRef.current.length === 1 && first && first.label === 'Desktop' && first.route === '/') {
      setPickedScreen({ ...selection, frameId: first.id });
      patchFrame(first.id, { route: selection.screen.route, label: selection.screen.name });
      return;
    }
    void frameService.add({
      project_id: project.id, route: selection.screen.route, label: selection.screen.name,
      width: first?.width ?? 1440, height: first?.height ?? 900,
      canvas_x: framesRef.current.length ? Math.max(...framesRef.current.map(f => f.canvas_x + f.width)) + 64 : 0,
      canvas_y: 0,
    }).then(frame => {
      framesRef.current = [...framesRef.current, frame];
      setFrames(framesRef.current);
      setPickedScreen({ ...selection, frameId: frame.id });
      fitOnce.current = null;
    }).catch(error => setLoadError(error instanceof Error ? error.message : 'Could not open this screen.'));
  }), [project?.id, frameService]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opening a saved project's screens also switches the canvas to that project.
  useEffect(() => onOpenProjectScreens((p) => {
    // Newly imported projects may not be in the original list. Keep the canvas
    // in sync immediately, including the URL when preview starts later.
    setProjects(list => {
      const current = list ?? [];
      return current.some(item => item.id === p.id)
        ? current.map(item => item.id === p.id ? p : item)
        : [...current, p];
    });
    setProjectId(p.id);
  }), []);
  const duplicate = async (frame: Frame) => {
    const right = Math.max(...frames.map((f) => f.canvas_x + f.width));
    const copy = await frameService.add({ project_id: frame.project_id, route: frame.route, label: frame.label, width: frame.width, height: frame.height, canvas_x: right + 80, canvas_y: frame.canvas_y });
    setFrames((list) => [...list, copy]);
  };
  const remove = (frame: Frame) => { setFrames((list) => list.filter((f) => f.id !== frame.id)); void frameService.remove(frame.id); };
  const useSnapshot = async () => {
    if (!project) return;
    await projectService.update(project.id, { target_mode: 'snapshot' });
    setProjects((list) => list?.map((p) => (p.id === project.id ? { ...p, target_mode: 'snapshot' } : p)) ?? null);
  };
  const addFrame = async () => {
    if (!project) return;
    const right = frames.length ? Math.max(...frames.map((f) => f.canvas_x + f.width)) + 80 : 0;
    const frame = await frameService.add({ project_id: project.id, width: 390, height: 844, canvas_x: right, label: 'Mobile' });
    setFrames((list) => [...list, frame]);
  };

  const bridgeStates = useRef(new Map<string, BridgeState>());
  const reportBridge = useCallback((id: string, state: BridgeState) => {
    bridgeStates.current.set(id, state);
    const all = [...bridgeStates.current.values()];
    onBridgeChange?.(all.includes('ready') ? 'ready' : all[0] ?? null);
  }, [onBridgeChange]);

  if (projects === null) return <div className="editor-empty"><p className="editor-empty__text">Loading…</p></div>;
  if (!project) {
    return (
      <div className="canvas-viewport canvas-viewport--welcome">
        <section className="canvas-load" aria-label="Load workspace">
          <h2>Ready to load a page</h2>
          <p>Select a project folder or import one from GitHub to begin visual editing.</p>
          <div className="canvas-load__actions">
            <button type="button" onClick={() => { requestProjectImport('folder'); windows?.open('screen-catalog'); }}><FolderOpen size={17} aria-hidden="true" /> Select Folder</button>
            <button type="button" onClick={() => { requestProjectImport('github'); windows?.open('screen-catalog'); }}><Link2 size={17} aria-hidden="true" /> GitHub Project</button>
            <button type="button" onClick={() => windows?.open('assets')}><Shapes size={17} aria-hidden="true" /> Assets</button>
          </div>
          {projects && projects.length > 0 ? (
            <label>Open saved project
              <select aria-label="Open saved project" value={projectId ?? ''} onChange={e => { setLoadError(''); setProjectId(e.target.value || null); }}>
                <option value="">Choose a project…</option>
                {projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : null}
          {loadError && <p role="alert">{loadError}</p>}
        </section>
        {connectOpen && <div className="live-connect-backdrop">
          <form className="live-connect" role="dialog" aria-modal="true" aria-label="Connect a running app" onSubmit={e => void connectApp(e)}>
            <h2>Connect a running app</h2>
            <label>App name<input aria-label="App name" required value={appName} onChange={e => setAppName(e.target.value)} placeholder="My app" /></label>
            <label>App address<input aria-label="App address" type="url" required value={appUrl} onChange={e => setAppUrl(e.target.value)} placeholder="http://localhost:5173" /></label>
            {connectError && <p role="alert">{connectError}</p>}
            <div className="live-style__actions">
              <button type="button" onClick={() => setConnectOpen(false)}>Cancel</button>
              <button type="submit" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</button>
            </div>
          </form>
        </div>}
        <ToolPill tool={tool} onTool={t => onToolChange?.(t)} showPins={showPins}
          onTogglePins={() => setShowPins(v => !v)} notesOpen={notesOpen}
          onToggleNotes={() => setNotesOpen(v => !v)} openCount={0} />
      </div>
    );
  }

  return (
    <div className="canvas-viewport" ref={stageRef} data-panning={panning} data-can-pan={canPan}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPan} onPointerCancel={endPan}>
      <div className="canvas-viewport__project" onPointerDown={(e) => e.stopPropagation()}>
        <select aria-label="Project" value={project.id} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button type="button" data-help="canvas.connect" data-help-ask onClick={() => windows?.open('screen-catalog')}>Add application</button>
        <button type="button" data-help="canvas.add-frame" onClick={() => void addFrame()}>Add frame</button>
      </div>
      {connectOpen && <div className="live-connect-backdrop" onPointerDown={e => e.stopPropagation()}>
        <form className="live-connect" role="dialog" aria-modal="true" aria-label="Connect a running app" onSubmit={e => void connectApp(e)}>
          <h2>Connect a running app</h2>
          <label>App name<input aria-label="App name" required value={appName} onChange={e => setAppName(e.target.value)} placeholder="My app" /></label>
          <label>App address<input aria-label="App address" type="url" required value={appUrl} onChange={e => setAppUrl(e.target.value)} placeholder="http://localhost:5173" /></label>
          {connectError && <p role="alert">{connectError}</p>}
          <div className="live-style__actions"><button type="button" onClick={() => setConnectOpen(false)}>Cancel</button><button type="submit" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</button></div>
        </form>
      </div>}
      <div className="canvas-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom / 100})` }}>
        {frames.map((frame) => (
          <FrameHost key={frame.id} frame={frame} project={project}
            pickedScreen={pickedScreen?.frameId === frame.id ? pickedScreen : undefined}
            onChange={(patch) => patchFrame(frame.id, patch)}
            onDuplicate={() => void duplicate(frame)} onDelete={() => remove(frame)}
            onBridgeState={(s) => reportBridge(frame.id, s)}
            onUseSnapshot={() => void useSnapshot()}
            tool={tool} pins={comments.filter((c) => c.frame_id === frame.id)} showPins={showPins}
            onSaveComment={(c) => saveComment(frame, c)} onStopTool={() => onToolChange?.('use')} />
        ))}
      </div>
      <ToolPill tool={tool} onTool={(t) => onToolChange?.(t)} showPins={showPins} onTogglePins={() => setShowPins((v) => !v)}
        notesOpen={notesOpen} onToggleNotes={() => setNotesOpen((v) => !v)} openCount={comments.filter((c) => c.status === 'open').length} />
      {notesOpen ? <NotesDrawer comments={comments} onClose={() => setNotesOpen(false)} onToggleDone={(c) => void toggleDone(c)} onRemove={(c) => void removeComment(c)} /> : null}
    </div>
  );
}
