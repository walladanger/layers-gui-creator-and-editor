import { editorWindowRegistry } from '../features/editor-windows/editorWindows';
import { ScreenCatalogWindow } from '../features/screen-catalog/ScreenCatalogWindow';
import { DataExplorerWindow } from './DataExplorerWindow';
import type { FeatureDescriptor } from './windowTypes';

export const windowRegistry: Readonly<Record<string, FeatureDescriptor>> = {
  ...editorWindowRegistry,
  'screen-catalog': {
    id: 'screen-catalog',
    title: 'Screens',
    presentation: 'internal',
    initialBounds: { x: 12, y: 12, width: 440, height: 600 },
    minimum: { width: 320, height: 240 },
    preserveState: true,
    defaultDock: true,
    InternalContent: ScreenCatalogWindow,
  },
  'data-explorer': {
    id: 'data-explorer',
    title: 'Data Explorer',
    presentation: 'dual',
    initialBounds: { x: 12, y: 12, width: 440, height: 600 },
    minimum: { width: 360, height: 240 },
    preserveState: true,
    defaultDock: true,
    InternalContent: DataExplorerWindow,
  },
};
