import { getCurrentWindow } from '@tauri-apps/api/window';

export interface NativeWindowService {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  startDragging(): Promise<void>;
}

export interface CurrentNativeWindowAdapter {
  minimize(): Promise<void>;
  isMaximized(): Promise<boolean>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  close(): Promise<void>;
  startDragging(): Promise<void>;
}

export function createBrowserNativeWindowService(): NativeWindowService {
  const noOp = async () => undefined;
  return {
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
    minimize: () => adapter.minimize(),
    async toggleMaximize() {
      if (await adapter.isMaximized()) await adapter.unmaximize();
      else await adapter.maximize();
    },
    close: () => adapter.close(),
    startDragging: () => adapter.startDragging(),
  };
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function getNativeWindowService(): NativeWindowService {
  return isTauriRuntime() ? createNativeWindowService(getCurrentWindow()) : createBrowserNativeWindowService();
}
