import type { ScreenEntry } from '../../services/projectSource';
import type { ScreenSelection } from '../../services/screenSnapshots';
import type { Project } from '../../services/types';

/** Hands a picked screen from the catalog window to the canvas. */
type Listener = (selection: ScreenSelection) => void;
const listeners = new Set<Listener>();
let revision = 0;

export function openScreen(screen: ScreenEntry, sourceKey = '') { listeners.forEach((l) => l({ screen, sourceKey, revision: ++revision })); }
export function onOpenScreen(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** Asks the Screens window to reload a saved project's source, and the canvas to switch to that project. */
type ProjectListener = (project: Project) => void;
const projectListeners = new Set<ProjectListener>();
let pendingProject: Project | null = null;

export function openProjectScreens(project: Project) {
  pendingProject = project;
  projectListeners.forEach((l) => l(project));
}
export function onOpenProjectScreens(listener: ProjectListener) {
  projectListeners.add(listener);
  return () => { projectListeners.delete(listener); };
}
/** The Screens window calls this on mount in case it was opened after the request was made. */
export function consumePendingProject() { const project = pendingProject; pendingProject = null; return project; }


/** Import intent survives a lazily mounted Screens window. */
export type ImportIntent = 'folder' | 'github';
const importListeners = new Set<(intent: ImportIntent) => void>();
let pendingImport: ImportIntent | null = null;

export function requestProjectImport(intent: ImportIntent) {
  pendingImport = intent;
  for (const listener of importListeners) {
    listener(intent);
    pendingImport = null;
  }
}
export function onProjectImport(listener: (intent: ImportIntent) => void) {
  importListeners.add(listener);
  return () => { importListeners.delete(listener); };
}
export function consumeProjectImport() {
  const intent = pendingImport;
  pendingImport = null;
  return intent;
}
