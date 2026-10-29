import { Maximize2, Minimize2, Pin, PinOff, X } from 'lucide-react';
import { useEffect, useState, type PointerEvent, type ReactNode } from 'react';
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
  return button === 0 && !(target instanceof Element && target.closest('button'));
}

export function TitleBar({
  onMinimize,
  onToggleMaximize,
  onClose,
  nativeWindowService = getNativeWindowService(),
  isMaximized,
  logo = <LogoMark />,
  productName = PRODUCT_NAME,
}: TitleBarProps) {
  const [uncontrolledMaximized, setUncontrolledMaximized] = useState(false);
  useEffect(() => {
    const syncFullscreen = () => setUncontrolledMaximized(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  const maximized = isMaximized ?? uncontrolledMaximized;
  // Floating mode keeps the studio above the app you are editing; remembered between runs.
  const canFloat = Boolean(nativeWindowService.setAlwaysOnTop);
  const [floating, setFloating] = useState(() => { try { return localStorage.getItem(FLOATING_KEY) === '1'; } catch { return false; } });
  useEffect(() => { if (canFloat && floating) void nativeWindowService.setAlwaysOnTop?.(true).catch(() => setFloating(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleFloating = async () => {
    const next = !floating;
    try { await nativeWindowService.setAlwaysOnTop?.(next); } catch { return; }
    setFloating(next);
    try { localStorage.setItem(FLOATING_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
  };
  const invoke = (callback: (() => void) | undefined, nativeAction: () => Promise<void>) => {
    if (callback) callback();
    else void nativeAction();
  };
  const startDragging = (event: PointerEvent<HTMLElement>) => {
    if (!shouldStartTitleBarDragging(event.target, event.button)) return;
    void nativeWindowService.startDragging();
  };
  return (
    <header className="title-bar" data-tauri-drag-region onPointerDown={startDragging}>
      <div className="title-bar__identity" data-tauri-drag-region>
        {logo}
        <span>{productName}</span>
      </div>
      <div className="title-bar__drag-region" data-testid="title-bar-drag-region" data-tauri-drag-region>
        <div id="canvas-command-menu" />
      </div>
      <div className="title-bar__window-actions" aria-label="Window controls">
        {canFloat ? (
          <button type="button" className="title-bar__action" aria-pressed={floating} data-floating={floating}
            aria-label={floating ? 'Stop floating' : 'Float on top'} title={floating ? 'Stop keeping Layers above other windows' : 'Keep Layers above other windows'} onClick={() => void toggleFloating()}>
            {floating ? <PinOff aria-hidden="true" size={15} /> : <Pin aria-hidden="true" size={15} />}
          </button>
        ) : null}
        <button type="button" className="title-bar__action" aria-label="Minimize window" onClick={() => invoke(onMinimize, nativeWindowService.minimize)}>
          <Minimize2 aria-hidden="true" size={16} />
        </button>
        <button type="button" className="title-bar__action" aria-label={maximized ? 'Restore window' : 'Maximize window'} title={maximized ? 'Restore window' : 'Maximize window'} onClick={async () => {
          if (onToggleMaximize) onToggleMaximize();
          else await nativeWindowService.toggleMaximize();
          if (isMaximized === undefined) setUncontrolledMaximized(!maximized);
        }}>
          <Maximize2 aria-hidden="true" size={15} />
        </button>
        <button type="button" className="title-bar__action title-bar__action--close" aria-label="Close window" onClick={() => invoke(onClose, nativeWindowService.close)}>
          <X aria-hidden="true" size={17} />
        </button>
      </div>
    </header>
  );
}
