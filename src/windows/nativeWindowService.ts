import { getCurrentWindow } from '@tauri-apps/api/window';

export interface NativeWindowService {
  /** False in a browser, where minimize and close are unavailable. */
  nativeControls?: boolean;
  observeMaximized?(listener: (maximized: boolean) => void): Promise<() => void>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  startDragging(): Promise<void>;
  /** Keeps the window above other apps (floating mode). Absent in the browser, which cannot do this. */
  setAlwaysOnTop?(on: boolean): Promise<void>;
}

export interface CurrentNativeWindowAdapter {
  onResized?(listener: () => void): Promise<() => void>;
  minimize(): Promise<void>;
  isMaximized(): Promise<boolean>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  close(): Promise<void>;
  startDragging(): Promise<void>;
  setAlwaysOnTop?(on: boolean): Promise<void>;
}

export function createBrowserNativeWindowService(): NativeWindowService {
  const noOp = async () => undefined;
  return {
    nativeControls: false,
    async observeMaximized(listener) {
      const update = () => listener(Boolean(document.fullscreenElement));
      document.addEventListener('fullscreenchange', update);
      update();
      return () => document.removeEventListener('fullscreenchange', update);
    },
    minimize: noOp,
    async toggleMaximize() {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      try {
        if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen unavailable');
        await document.documentElement.requestFullscreen();
      } catch {
        // Embedded previews may disallow fullscreen; a separate tab removes their outer frame.
        window.open(window.location.href, '_blank', 'noopener,noreferrer');
      }
    },
    close: noOp,
    startDragging: noOp,
  };
}

export function createNativeWindowService(adapter: CurrentNativeWindowAdapter): NativeWindowService {
  return {
    nativeControls: true,
    async observeMaximized(listener) {
      let disposed = false;
      let revision = 0;
      const update = async () => {
        const current = ++revision;
        try {
          const maximized = await adapter.isMaximized();
          if (!disposed && current === revision) listener(maximized);
        } catch { /* A window may close while its last resize is being delivered. */ }
      };
      const unlisten = await adapter.onResized?.(() => { void update(); });
      await update();
      return () => { disposed = true; unlisten?.(); };
    },
    minimize: () => adapter.minimize(),
    async toggleMaximize() {
      if (await adapter.isMaximized()) await adapter.unmaximize();
      else await adapter.maximize();
    },
    close: () => adapter.close(),
    startDragging: () => adapter.startDragging(),
    ...(adapter.setAlwaysOnTop ? { setAlwaysOnTop: (on: boolean) => adapter.setAlwaysOnTop!(on) } : {}),
  };
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function getNativeWindowService(): NativeWindowService {
  return isTauriRuntime() ? createNativeWindowService(getCurrentWindow()) : createBrowserNativeWindowService();
}
