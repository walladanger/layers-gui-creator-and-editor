import { renderHook, act } from '@testing-library/react';
import {
  readCanvasLayout,
  useCanvasLayout,
  defaultCanvasLayout,
  CANVAS_LAYOUT_KEY,
  type CanvasLayout
} from './canvasLayout';
import { SettingsProvider } from '../../settings/settingsStore';
import { defaultSettings } from '../../settings/settingsService';

describe('readCanvasLayout', () => {
  it('returns default layout if extensionSettings is undefined', () => {
    expect(readCanvasLayout(undefined)).toEqual(defaultCanvasLayout);
  });

  it('returns default layout if raw setting is not an object', () => {
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: 'string' })).toEqual(defaultCanvasLayout);
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: null })).toEqual(defaultCanvasLayout);
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: 42 })).toEqual(defaultCanvasLayout);
  });

  it('returns default layout if version is invalid', () => {
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: { version: 2, leftRailOpen: true, rightRailOpen: true, rightTab: 'inspector' } })).toEqual(defaultCanvasLayout);
  });

  it('returns default layout if booleans are invalid', () => {
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: { version: 1, leftRailOpen: 'true', rightRailOpen: true, rightTab: 'inspector' } })).toEqual(defaultCanvasLayout);
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: { version: 1, leftRailOpen: true, rightRailOpen: null, rightTab: 'inspector' } })).toEqual(defaultCanvasLayout);
  });

  it('returns default layout if rightTab is invalid', () => {
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: { version: 1, leftRailOpen: true, rightRailOpen: true, rightTab: 'invalid' } })).toEqual(defaultCanvasLayout);
  });

  it('returns default layout if the stored object is an array', () => {
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: [] })).toEqual(defaultCanvasLayout);
  });

  it('returns valid layout', () => {
    const valid: CanvasLayout = { version: 1, leftRailOpen: false, rightRailOpen: false, rightTab: 'comments' };
    expect(readCanvasLayout({ [CANVAS_LAYOUT_KEY]: valid })).toEqual(valid);
  });
});

describe('useCanvasLayout', () => {
  it('uses local state without SettingsProvider', () => {
    const { result } = renderHook(() => useCanvasLayout());

    expect(result.current.layout).toEqual(defaultCanvasLayout);

    act(() => {
      result.current.update({ leftRailOpen: false });
    });

    expect(result.current.layout).toEqual({ ...defaultCanvasLayout, leftRailOpen: false });

    act(() => {
      result.current.reset();
    });

    expect(result.current.layout).toEqual(defaultCanvasLayout);
  });

  it('uses SettingsProvider for persistence', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider initialSettings={defaultSettings}>
        {children}
      </SettingsProvider>
    );

    const { result } = renderHook(() => useCanvasLayout(), { wrapper });

    expect(result.current.layout).toEqual(defaultCanvasLayout);

    await act(async () => {
      result.current.update({ rightTab: 'production' });
    });

    expect(result.current.layout).toEqual({ ...defaultCanvasLayout, rightTab: 'production' });

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.layout).toEqual(defaultCanvasLayout);
  });
});
