import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useOptionalServices } from '../../services/ServicesProvider';
import type { Frame, Project } from '../../services/types';
import type { CanvasView } from './canvasView';
import { fitView, zoomAt } from './canvasView';
import { FrameHost, type BridgeState } from './FrameHost';

const PROJECT_KEY = 'radium.canvasProject';

export interface CanvasStageProps {
  tool: string;
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

function ProjectCanvas({ tool, view, onViewChange, fitRequest, onBridgeChange }: CanvasStageProps) {
  const { runtime, user } = useOptionalServices()!;
  const { projects: projectService, frames: frameService } = runtime.services;
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(() => localStorage.getItem(PROJECT_KEY));
  const [frames, setFrames] = useState<Frame[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const project = projects?.find((p) => p.id === projectId) ?? projects?.[0] ?? null;

  useEffect(() => { void projectService.list().then(setProjects).catch(() => setProjects([])); }, [projectService, user?.id]);

  useEffect(() => {
    if (!project) { setFrames([]); return; }
    localStorage.setItem(PROJECT_KEY, project.id);
    let active = true;
    void frameService.list(project.id).then(async (list) => {
      if (!active) return;
      if (list.length === 0) list = [await frameService.add({ project_id: project.id, label: 'Desktop' })];
      setFrames(list);
    }).catch(() => setFrames([]));
    return () => { active = false; };
  }, [project?.id, frameService]); // eslint-disable-line react-hooks/exhaustive-deps

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    onViewChange(fitView(frames.map((f) => ({ x: f.canvas_x, y: f.canvas_y, width: f.width, height: f.height + 40 })),
      { width: el.clientWidth, height: el.clientHeight }));
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
      <div className="editor-empty">
        <p className="editor-empty__title">No projects yet</p>
        <p className="editor-empty__text">Create one on the Projects page to show your app here.</p>
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
        <button type="button" onClick={() => void addFrame()}>Add frame</button>
      </div>
      <div className="canvas-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom / 100})` }}>
        {frames.map((frame) => (
          <FrameHost key={frame.id} frame={frame} project={project}
            onChange={(patch) => patchFrame(frame.id, patch)}
            onDuplicate={() => void duplicate(frame)} onDelete={() => remove(frame)}
            onBridgeState={(s) => reportBridge(frame.id, s)}
            onUseSnapshot={() => void useSnapshot()} />
        ))}
      </div>
    </div>
  );
}
