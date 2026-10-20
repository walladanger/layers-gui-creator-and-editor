import { editorWindowRegistry } from '../features/editor-windows/editorWindows';
import { ScreenCatalogWindow } from '../features/screen-catalog/ScreenCatalogWindow';
import { BoardWindow } from '../git/BoardWindow';
import { GitWindow } from '../git/GitWindow';
import { DataExplorerWindow } from './DataExplorerWindow';
import type { FeatureDescriptor } from './windowTypes';

export const windowRegistry: Readonly<Record<string, FeatureDescriptor>> = {
  ...editorWindowRegistry,
  'screen-catalog': {
    id: 'screen-catalog',
    title: 'Screens',
    presentation: 'internal',
    initialBounds: { x: 120, y: 64, width: 560, height: 460 },
    minimum: { width: 320, height: 240 },
    preserveState: true,
    InternalContent: ScreenCatalogWindow,
  },
  git: {
    id: 'git',
    title: 'Git',
    presentation: 'dual',
    initialBounds: { x: 140, y: 80, width: 560, height: 480 },
    minimum: { width: 340, height: 260 },
    preserveState: true,
    InternalContent: GitWindow,
  },
  board: {
    id: 'board',
    title: 'Board',
    presentation: 'dual',
    initialBounds: { x: 160, y: 96, width: 760, height: 520 },
    minimum: { width: 360, height: 260 },
    preserveState: true,
    InternalContent: BoardWindow,
  },
  'data-explorer': {
    id: 'data-explorer',
    title: 'Data Explorer',
    presentation: 'dual',
    initialBounds: { x: 80, y: 56, width: 720, height: 480 },
    minimum: { width: 360, height: 240 },
    preserveState: true,
    InternalContent: DataExplorerWindow,
  },
};
