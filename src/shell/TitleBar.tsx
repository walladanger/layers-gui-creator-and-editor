import { Maximize2, Minimize2, X } from 'lucide-react';
import { useState, type PointerEvent, type ReactNode } from 'react';
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
  const maximized = isMaximized ?? uncontrolledMaximized;
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
      <div className="title-bar__drag-region" aria-hidden="true" data-testid="title-bar-drag-region" data-tauri-drag-region />
      <div className="title-bar__window-actions" aria-label="Window controls">
        <button type="button" className="title-bar__action" aria-label="Minimize window" onClick={() => invoke(onMinimize, nativeWindowService.minimize)}>
          <Minimize2 aria-hidden="true" size={16} />
        </button>
        <button type="button" className="title-bar__action" aria-label={maximized ? 'Restore window' : 'Maximize window'} onClick={() => {
          invoke(onToggleMaximize, nativeWindowService.toggleMaximize);
          if (isMaximized === undefined) setUncontrolledMaximized((current) => !current);
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
