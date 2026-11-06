import { Maximize2, Minimize2, Pin, PinOff, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { PRODUCT_NAME } from '../app/brand';
import { getNativeWindowService, type NativeWindowService } from '../windows/nativeWindowService';
import { LogoMark } from './LogoMark';

export interface TitleBarProps {
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  nativeWindowService?: NativeWindowService;
  isMaximized?: boolean;
  /** Replaceable brand mark; defaults to the Ember flame. */
  logo?: ReactNode;
  productName?: string;
}

export const FLOATING_KEY = 'layers.floating';

export function shouldStartTitleBarDragging(target: EventTarget | null, button: number): boolean {
  return button === 0 && !(target instanceof Element && target.closest('button, a, input, select, textarea, summary, [role="button"], [contenteditable="true"]'));
}

export function TitleBar({
  onMinimize, onToggleMaximize, onClose, nativeWindowService: providedService,
  isMaximized, logo = <LogoMark />, productName = PRODUCT_NAME,
}: TitleBarProps) {
  const nativeWindowService = useMemo(() => providedService ?? getNativeWindowService(), [providedService]);
  const [uncontrolledMaximized, setUncontrolledMaximized] = useState(false);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void nativeWindowService.observeMaximized?.(value => {
      if (!disposed) setUncontrolledMaximized(value);
    }).then(unlisten => {
      if (disposed) unlisten();
      else stop = unlisten;
    }).catch(() => { /* Keep the controls usable if observation is unavailable. */ });
    return () => { disposed = true; stop?.(); };
  }, [nativeWindowService]);
  const maximized = isMaximized ?? uncontrolledMaximized;
  const canFloat = Boolean(nativeWindowService.setAlwaysOnTop);
  const [floating, setFloating] = useState(() => { try { return localStorage.getItem(FLOATING_KEY) === '1'; } catch { return false; } });
  useEffect(() => {
    if (canFloat && floating) void nativeWindowService.setAlwaysOnTop?.(true).catch(() => setFloating(false));
  }, [nativeWindowService]); // Restore the saved preference when connecting a window.

  const perform = async (action: () => void | Promise<void>, message: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setActionError('');
    try { await action(); }
    catch { setActionError(message); }
    finally { pending.current = false; setBusy(false); }
  };
  const toggleFloating = () => perform(async () => {
    const next = !floating;
    await nativeWindowService.setAlwaysOnTop?.(next);
    setFloating(next);
    try { localStorage.setItem(FLOATING_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
  }, 'Could not change floating mode. Try again.');
  const toggleMaximize = () => perform(async () => {
    if (onToggleMaximize) onToggleMaximize();
    else await nativeWindowService.toggleMaximize();
    // Real window services report their state, including snap/restore and Esc.
    if (isMaximized === undefined && !nativeWindowService.observeMaximized) setUncontrolledMaximized(value => !value);
  }, 'Could not resize the window. Try again.');
  const startDragging = (event: PointerEvent<HTMLElement>) => {
    if (!shouldStartTitleBarDragging(event.target, event.button)) return;
    void nativeWindowService.startDragging().catch(() => setActionError('Could not move the window. Try again.'));
  };
  return (
    <header className="title-bar" onPointerDown={startDragging} onDoubleClick={event => {
      if (shouldStartTitleBarDragging(event.target, event.button)) void toggleMaximize();
    }}>
      <div className="title-bar__identity">{logo}<span>{productName}</span></div>
      <div className="title-bar__drag-region" data-testid="title-bar-drag-region"><div id="canvas-command-menu" /></div>
      <div className="title-bar__window-actions" aria-label="Window controls">
        {canFloat && <button type="button" className="title-bar__action" disabled={busy} aria-pressed={floating} data-floating={floating}
          aria-label={floating ? 'Stop floating' : 'Float on top'} title={floating ? 'Stop keeping Layers above other windows' : 'Keep Layers above other windows'} onClick={() => void toggleFloating()}>
          {floating ? <PinOff aria-hidden="true" size={15} /> : <Pin aria-hidden="true" size={15} />}
        </button>}
        {(onMinimize || nativeWindowService.nativeControls !== false) && <button type="button" className="title-bar__action" disabled={busy} aria-label="Minimize window" title="Minimize window"
          onClick={() => void perform(onMinimize ?? nativeWindowService.minimize, 'Could not minimize the window. Try again.')}><Minimize2 aria-hidden="true" size={16} /></button>}
        <button type="button" className="title-bar__action" disabled={busy} aria-label={maximized ? 'Restore window' : 'Maximize window'} title={maximized ? 'Restore window' : 'Maximize window'} onClick={() => void toggleMaximize()}>
          <Maximize2 aria-hidden="true" size={15} />
        </button>
        {(onClose || nativeWindowService.nativeControls !== false) && <button type="button" className="title-bar__action title-bar__action--close" disabled={busy} aria-label="Close window" title="Close window"
          onClick={() => void perform(onClose ?? nativeWindowService.close, 'Could not close the window. Try again.')}><X aria-hidden="true" size={17} /></button>}
      </div>
      {actionError && <div className="title-bar__error" role="alert"><span>{actionError}</span><button type="button" aria-label="Dismiss window error" onClick={() => setActionError('')}><X aria-hidden="true" size={14} /></button></div>}
    </header>
  );
}
