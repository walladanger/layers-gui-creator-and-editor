import { Suspense, lazy, type ComponentType } from 'react';
import type { FeatureDescriptor } from '../../windows/windowTypes';
import { TaskTree } from '../production/TaskTree';

const AssetsWindow = lazy(() => import('../assets/AssetsWindow'));
const AgentWindow = lazy(() => import('../agent/AgentWindow'));

export const editorWindowIds = ['layers', 'inspector', 'comments', 'production', 'assets', 'style-lab', 'motion', 'code', 'agent'] as const;
export type EditorWindowId = (typeof editorWindowIds)[number];

const definitions: Record<EditorWindowId, { title: string; empty: string }> = {
  layers: { title: 'Layers', empty: 'Connect an app to see its layers.' },
  inspector: { title: 'Inspector', empty: 'Select something on the canvas to edit its style.' },
  comments: { title: 'Comments', empty: 'No comments yet.' },
  production: { title: 'Production list', empty: 'Your changes will be listed here.' },
  assets: { title: 'Assets', empty: 'Loading components and icons…' },
  'style-lab': { title: 'Style Lab', empty: 'Style presets arrive in a later update.' },
  motion: { title: 'Motion', empty: 'Motion effects arrive in a later update.' },
  code: { title: 'Code', empty: 'Code view arrives in a later update.' },
  agent: { title: 'Agent connection', empty: 'Connecting to the agent…' },
};

function createPlaceholder(id: EditorWindowId): ComponentType {
  const { title, empty } = definitions[id];
  function EditorWindowPlaceholder() {
    if (id === 'assets') {
      return <Suspense fallback={<div className="editor-window-placeholder"><p className="editor-empty__text">{empty}</p></div>}><AssetsWindow /></Suspense>;
    }
    if (id === 'agent') {
      return <Suspense fallback={<div className="editor-window-placeholder">Loading agent chat…</div>}><AgentWindow /></Suspense>;
    }
    if (id === 'production') {
      return (
        <div className="editor-window-placeholder" data-window-id={id}>
          <TaskTree />
        </div>
      );
    }
    return (
      <div className="editor-window-placeholder" data-window-id={id}>
        <p className="editor-empty__title">{title}</p>
        <p className="editor-empty__text">{empty}</p>
      </div>
    );
  }
  EditorWindowPlaceholder.displayName = `EditorWindow(${id})`;
  return EditorWindowPlaceholder;
}

export const editorWindowRegistry: Readonly<Record<EditorWindowId, FeatureDescriptor>> = Object.fromEntries(
  editorWindowIds.map((id) => [id, {
    id,
    title: definitions[id].title,
    presentation: 'internal',
    initialBounds: { x: 12, y: 12, width: 440, height: 600 },
    minimum: id === 'assets' ? { width: 560, height: 380 } : id === 'agent' ? { width: 360, height: 380 } : { width: 260, height: 180 },
    preserveState: true,
    defaultDock: true,
    InternalContent: createPlaceholder(id),
  } satisfies FeatureDescriptor]),
) as Record<EditorWindowId, FeatureDescriptor>;
