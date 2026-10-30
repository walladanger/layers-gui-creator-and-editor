import { useEffect, useRef, useState } from 'react';
import { Copy, RefreshCw, Trash2 } from 'lucide-react';
import { BREAKPOINT_WIDTHS } from '../../services/services';
import type { ChangeTarget, Comment, Frame, Project } from '../../services/types';
import { FrameOverlay, type CommentMeta } from './FrameOverlay';
import { originalMenuService } from '../../services/originalMenuService';
import { BridgeService, VITE_PLUGIN_SNIPPET, bridgeOrigin, connectionSnippet, type BridgeInfo } from '../../services/bridgeService';
import { liveStyleService } from '../../services/liveStyleService';
import { assetInsertService } from '../../services/assetInsertService';
import { useOptionalServices } from '../../services/ServicesProvider';
import { captureScreenSnapshot, saveScreenSnapshot, type ScreenSelection } from '../../services/screenSnapshots';
import { REVEAL_EVENT, type RevealRequest } from '../../services/commentTasks';

export type BridgeState = 'loading' | 'ready' | 'no-bridge' | 'snapshot';

export const READY_TIMEOUT_MS = 3000;
export const BRIDGE_SCRIPT = '/radium-bridge.js';
export const SCREENSHOT_SCRIPT = '/radium-screenshot.js';

export function frameSrc(project: Pick<Project, 'target_url' | 'target_mode'>, route: string, editorOrigin = window.location.origin) {
  const base = project.target_url ?? '';
  if (!base) return 'about:blank';
  if (project.target_mode === 'demo') return base;
  try {
    const url = new URL(route || '/', base);
    if (project.target_mode === 'live') url.searchParams.set('radium-editor', editorOrigin);
    return url.toString();
  } catch { return base; }
}

const presets: { label: string; width: number }[] = [
  { label: '1440', width: BREAKPOINT_WIDTHS.desktop },
  { label: '1024', width: BREAKPOINT_WIDTHS.laptop },
  { label: '768', width: BREAKPOINT_WIDTHS.tablet },
  { label: '390', width: BREAKPOINT_WIDTHS.mobile },
];

export interface FrameHostProps {
  frame: Frame;
  project: Project;
  readyTimeoutMs?: number;
  onChange(patch: Partial<Pick<Frame, 'route' | 'width' | 'height'>>): void;
  onDuplicate(): void;
  onDelete(): void;
  onBridgeState?(state: BridgeState): void;
  onUseSnapshot?(): void;
  tool?: string;
  pins?: Comment[];
  showPins?: boolean;
  onSaveComment?(input: { text: string; target: ChangeTarget; px: number; py: number; meta?: CommentMeta; iframe?: HTMLIFrameElement | null; route?: string }): Promise<void> | void;
  onStopTool?(): void;
  pickedScreen?: ScreenSelection;
}

export function FrameHost({ frame, project, readyTimeoutMs = READY_TIMEOUT_MS, onChange, onDuplicate, onDelete, onBridgeState, onUseSnapshot, tool = 'use', pins = [], showPins = true, onSaveComment, onStopTool, pickedScreen }: FrameHostProps) {
  const services = useOptionalServices()?.runtime.services;
  const [bridge, setBridge] = useState<BridgeService | null>(null);
  const [info, setInfo] = useState<BridgeInfo | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [connectWay, setConnectWay] = useState<'vite' | 'script'>('vite');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const detachMenu = useRef<(() => void) | null>(null);
  const [originalControls, setOriginalControls] = useState(false);
  useEffect(() => () => { detachMenu.current?.(); }, []);
  useEffect(() => { if (originalControls) originalMenuService.setTool(tool); }, [tool, originalControls]);
  const [reloadKey, setReloadKey] = useState(0);
  const snapshot = project.target_mode === 'snapshot';
  const [state, setState] = useState<BridgeState>(snapshot ? 'snapshot' : 'loading');
  const [dismissed, setDismissed] = useState(false);
  const [route, setRoute] = useState(frame.route);
  const src = frameSrc(project, frame.route);
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => { setRoute(frame.route); }, [frame.route]);
  useEffect(() => { onBridgeState?.(state); }, [state, onBridgeState]);

  useEffect(() => {
    if (snapshot) { setState('snapshot'); return; }
    setState('loading'); setDismissed(false);
    const origin = bridgeOrigin(src);
    if (!origin) { setState('no-bridge'); return; }
    const client = new BridgeService(() => iframeRef.current?.contentWindow ?? null, origin);
    setBridge(client); setInfo(null);
    const unsubscribe = client.subscribe(m => {
      if (m.type === 'ready' || m.type === 'hello.ok') { setState('ready'); setInfo(client.info); }
      // Links clicked inside the app show their address here; the frame's saved route stays as it was.
      if (m.type === 'route.changed' && typeof m.payload?.url === 'string') {
        liveStyleService.clearSelectionForFrame(frame.id);
        try { const u = new URL(m.payload.url); u.searchParams.delete('radium-editor'); setRoute(u.pathname + u.search + u.hash); } catch { /* ignore a bad address */ }
      }
    });
    const timer = window.setTimeout(() => setState(s => s === 'ready' ? s : 'no-bridge'), readyTimeoutMs);
    return () => { unsubscribe(); client.dispose(); setBridge(null); window.clearTimeout(timer); };
  }, [src, reloadKey, snapshot, readyTimeoutMs]);

  useEffect(() => {
    if (!bridge || state !== 'ready' || originalControls || snapshot) return;
    return liveStyleService.attach(frame.id, bridge, frame, services);
  }, [bridge, state, originalControls, snapshot, frame.id, services]);
  useEffect(() => {
    if (!bridge || state !== 'ready' || originalControls || snapshot) return;
    return assetInsertService.attach(frame.id, bridge);
  }, [bridge, state, originalControls, snapshot, frame.id]);

  // "Show on canvas" from a task: go to its screen, then let the app outline the element.
  useEffect(() => {
    if (!bridge || state !== 'ready' || project.target_mode !== 'live') return;
    const onReveal = (event: Event) => {
      const d = (event as CustomEvent<RevealRequest>).detail;
      if (!d || !bridge.supports('node.reveal')) return;
      void (async () => {
        if (d.route && d.route !== route) {
          await bridge.request('nav.go', { path: d.route }).catch(() => undefined);
          await new Promise((r) => window.setTimeout(r, 350));
        }
        await bridge.request('node.reveal', { rid: d.rid, selector: d.selector }).catch(() => undefined);
      })();
    };
    window.addEventListener(REVEAL_EVENT, onReveal);
    return () => window.removeEventListener(REVEAL_EVENT, onReveal);
  }, [bridge, state, project.target_mode, route]);

  // The demo's address never changes, so route changes are sent to the bridge (§4 `nav.go`).
  useEffect(() => {
    if (state !== 'ready' || project.target_mode !== 'demo') return;
    void bridge?.request('nav.go', { path: frame.route }).catch(() => undefined);
  }, [frame.route, state, project.target_mode, bridge]);

  useEffect(() => {
    if (!pickedScreen || pickedScreen.screen.route !== frame.route || state !== 'ready' || !loadVersion) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      void captureScreenSnapshot(iframe).then((dataUrl) => {
        if (active) saveScreenSnapshot(pickedScreen.sourceKey, pickedScreen.screen.id, dataUrl);
      }).catch(() => undefined);
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [pickedScreen, frame.route, state, loadVersion, reloadKey]);

  /** Same-origin targets (the demo) get the bridge injected, so the target file stays untouched. */
  const injectBridge = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      detachMenu.current?.();
      if (project.target_mode === 'demo' && doc.querySelector('#panel .lab-sec')) {
        detachMenu.current = originalMenuService.attach(frame.id, doc);
        setOriginalControls(true);
      } else setOriginalControls(false);
      if (doc.querySelector(`script[src="${BRIDGE_SCRIPT}"]`)) return;
      const script = doc.createElement('script');
      script.src = BRIDGE_SCRIPT;
      doc.head.appendChild(script);
    } catch { /* cross-origin: the app loads the bridge itself */ }
  };

  const snippet = connectionSnippet();

  return (
    <article className="frame-card" data-frame-id={frame.id} aria-label={`Frame ${frame.label ?? frame.route} at ${frame.width}`}
      style={{ left: frame.canvas_x, top: frame.canvas_y, width: frame.width }}>
      <div className="frame-card__bar" onPointerDown={(e) => e.stopPropagation()}>
        <form onSubmit={(e) => { e.preventDefault(); onChange({ route: route.startsWith('/') ? route : `/${route}` }); }}>
          <input aria-label="Route" value={route} onChange={(e) => setRoute(e.target.value)} />
        </form>
        <div className="frame-card__presets" role="group" aria-label="Breakpoints">
          {presets.map((p) => (
            <button key={p.width} type="button" aria-pressed={frame.width === p.width} onClick={() => onChange({ width: p.width })}>{p.label}</button>
          ))}
        </div>
        <label className="frame-card__size">W<input aria-label="Width" type="number" min={200} max={3840} defaultValue={frame.width} key={`w${frame.width}`}
          onBlur={(e) => { const n = Number(e.target.value); if (n >= 200 && n !== frame.width) onChange({ width: n }); }} /></label>
        <label className="frame-card__size">H<input aria-label="Height" type="number" min={200} max={4000} defaultValue={frame.height} key={`h${frame.height}`}
          onBlur={(e) => { const n = Number(e.target.value); if (n >= 200 && n !== frame.height) onChange({ height: n }); }} /></label>
        <span className="frame-card__state" data-state={state}
          title={state === 'ready' && project.target_mode === 'live' ? (info?.hasSourceMap ? 'Elements report their file and line, so production lists point at exact code.' : 'Connected without file and line ids. Add the radium-bridge Vite plugin to get them.') : undefined}>
          {state === 'ready' ? (project.target_mode === 'live' ? (info?.hasSourceMap ? 'Connected · file:line' : 'Connected · no source ids') : 'Connected') : state === 'loading' ? 'Connecting…' : state === 'snapshot' ? 'Snapshot' : 'Not connected'}
        </span>
        <button type="button" aria-label="Reload frame" onClick={() => setReloadKey((k) => k + 1)}><RefreshCw aria-hidden="true" size={14} /></button>
        <button type="button" aria-label="Duplicate frame" onClick={onDuplicate}><Copy aria-hidden="true" size={14} /></button>
        <button type="button" aria-label="Delete frame" onClick={onDelete}><Trash2 aria-hidden="true" size={14} /></button>
      </div>
      <div className="frame-card__body" style={{ height: frame.height }}>
        <iframe key={reloadKey} ref={iframeRef} src={src} title={`${project.name} ${frame.route}`} onLoad={() => { liveStyleService.clearSelectionForFrame(frame.id); setLoadVersion((v) => v + 1); if (!snapshot) { injectBridge(); void bridge?.request('hello', { editorVersion: '0.5.0' }).then(() => setState('ready')).catch(() => undefined); } }}
          sandbox={snapshot ? 'allow-scripts allow-forms' : undefined} />
        {state === 'ready' && !originalControls && bridge ? (
          <FrameOverlay iframeRef={iframeRef} bridge={bridge} onSelect={node => { void liveStyleService.select(frame.id, node); }} tool={tool} pins={pins} showPins={showPins}
            onSaveComment={(c) => onSaveComment?.({ ...c, iframe: iframeRef.current, route })} onStop={() => onStopTool?.()}
            onInsert={(anchor, position, px, py) => assetInsertService.place(bridge, { frameId: frame.id, projectId: project.id, route, anchor, position, px, py })} />
        ) : null}
        {state === 'no-bridge' && !dismissed ? (
          <div className="frame-connect" role="dialog" aria-label="Connect your app">
            <h3>Connect your app</h3>
            <p>{project.name} didn’t answer. Make sure it is running, then add the bridge so the studio can see it.</p>
            <div className="frame-connect__ways" role="tablist" aria-label="How to connect">
              <button type="button" role="tab" aria-selected={connectWay === 'vite'} onClick={() => setConnectWay('vite')}>Vite app (best)</button>
              <button type="button" role="tab" aria-selected={connectWay === 'script'} onClick={() => setConnectWay('script')}>Any web app</button>
            </div>
            {connectWay === 'vite' ? (
              <>
                <p className="frame-connect__label">1. In your app’s folder, install the bridge from your Layers folder</p>
                <code>npm i -D --install-links &lt;Layers folder&gt;/packages/radium-bridge</code>
                <p className="frame-connect__label">2. Add it to vite.config, before the React plugin</p>
                <pre><code>{VITE_PLUGIN_SNIPPET}</code></pre>
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(VITE_PLUGIN_SNIPPET); setCopyStatus('Config copied'); } catch { setCopyStatus('Select the config above and copy it'); } }}>Copy config</button>
                <p className="frame-connect__hint">3. Restart your dev server. Every element then reports its file and line, so comments and changes point at exact code. It only runs with the dev server; your production build is unchanged.</p>
              </>
            ) : (
              <>
                <p className="frame-connect__label">Add this line before &lt;/body&gt; in your app, then reload</p>
                <code>{snippet}</code>
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopyStatus('Connection line copied'); } catch { setCopyStatus('Select the line above and copy it'); } }}>Copy connection line</button>
                <p className="frame-connect__hint">If your app blocks the hosted script, <a href={BRIDGE_SCRIPT} download="radium-bridge.js">download the connection script</a> and <a href={SCREENSHOT_SCRIPT} download="radium-screenshot.js">its screenshot helper</a>, put both in your app’s public folder, and use this local line instead:</p>
                <code>{'<script src="/radium-bridge.js"></script>'}</code>
              </>
            )}
            {copyStatus && <p role="status">{copyStatus}</p>}
            <p className="frame-connect__hint">Changes are previews, not source-file edits. Keep the saved CSS and change records for your coding agent.</p>
            <p className="frame-connect__hint">Some sites block being shown inside other pages. Snapshot mode is view-only until a captured image is available. If your app is on your computer, open Layers in a separate tab and allow local-network access when your browser asks.</p>
            <div className="frame-connect__actions">
              <button type="button" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
              {onUseSnapshot ? <button type="button" onClick={onUseSnapshot}>Use snapshot mode</button> : null}
              <button type="button" onClick={() => setDismissed(true)}>Hide</button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
