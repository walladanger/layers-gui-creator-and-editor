import { useCallback, useState } from 'react';
import { useOptionalSettings } from '../../settings/settingsStore';

export type RightRailTab = 'inspector' | 'comments' | 'production';

export interface CanvasLayout {
  version: 1;
  leftRailOpen: boolean;
  rightRailOpen: boolean;
  rightTab: RightRailTab;
}

/** Key inside `AppSettings.extensionSettings` where the canvas layout lives. */
export const CANVAS_LAYOUT_KEY = 'radium.canvasLayout';

export const defaultCanvasLayout: CanvasLayout = { version: 1, leftRailOpen: true, rightRailOpen: true, rightTab: 'inspector' };

const tabs: readonly RightRailTab[] = ['inspector', 'comments', 'production'];

export function readCanvasLayout(extensionSettings: Readonly<Record<string, unknown>> | undefined): CanvasLayout {
  const raw = extensionSettings?.[CANVAS_LAYOUT_KEY];
  if (!raw || typeof raw !== 'object') return defaultCanvasLayout;
  const value = raw as Partial<CanvasLayout>;
  if (value.version !== 1
    || typeof value.leftRailOpen !== 'boolean'
    || typeof value.rightRailOpen !== 'boolean'
    || !tabs.includes(value.rightTab as RightRailTab)) return defaultCanvasLayout;
  return { version: 1, leftRailOpen: value.leftRailOpen, rightRailOpen: value.rightRailOpen, rightTab: value.rightTab as RightRailTab };
}

export function useCanvasLayout() {
  const appSettings = useOptionalSettings();
  const [localLayout, setLocalLayout] = useState(defaultCanvasLayout);
  const layout = appSettings ? readCanvasLayout(appSettings.settings.extensionSettings) : localLayout;

  const save = useCallback((next: CanvasLayout) => {
    if (!appSettings) { setLocalLayout(next); return; }
    void appSettings.update({
      extensionSettings: { ...appSettings.settings.extensionSettings, [CANVAS_LAYOUT_KEY]: next },
    });
  }, [appSettings]);

  const update = useCallback((patch: Partial<Omit<CanvasLayout, 'version'>>) => save({ ...layout, ...patch }), [layout, save]);
  const reset = useCallback(() => save(defaultCanvasLayout), [save]);

  return { layout, update, reset };
}
