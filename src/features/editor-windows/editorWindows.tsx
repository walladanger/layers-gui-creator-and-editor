import type { ComponentType } from 'react';
import type { FeatureDescriptor } from '../../windows/windowTypes';

export const editorWindowIds = ['layers', 'inspector', 'comments', 'production', 'style-lab', 'motion', 'code'] as const;
export type EditorWindowId = (typeof editorWindowIds)[number];

const definitions: Record<EditorWindowId, { title: string; empty: string }> = {
  layers: { title: 'Layers', empty: 'Connect an app to see its layers.' },
  inspector: { title: 'Inspector', empty: 'Select something on the canvas to edit its style.' },
  comments: { title: 'Comments', empty: 'No comments yet.' },
  production: { title: 'Production list', empty: 'Your changes will be listed here.' },
  'style-lab': { title: 'Style Lab', empty: 'Style presets arrive in a later update.' },
  motion: { title: 'Motion', empty: 'Motion effects arrive in a later update.' },
  code: { title: 'Code', empty: 'Code view arrives in a later update.' },
};

function createPlaceholder(id: EditorWindowId): ComponentType {
  const { title, empty } = definitions[id];
  function EditorWindowPlaceholder() {
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
  editorWindowIds.map((id, index) => [id, {
    id,
    title: definitions[id].title,
    presentation: 'internal',
    initialBounds: { x: 96 + index * 28, y: 72 + index * 24, width: 360, height: 300 },
    minimum: { width: 260, height: 180 },
    preserveState: true,
    InternalContent: createPlaceholder(id),
  } satisfies FeatureDescriptor]),
) as Record<EditorWindowId, FeatureDescriptor>;
