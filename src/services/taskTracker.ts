import { useCallback, useMemo, useState } from 'react';
import { useOptionalSettings } from '../settings/settingsStore';

export interface TaskNode { id: string; label: string; done: boolean; children: TaskNode[] }

/** Key inside `AppSettings.extensionSettings` where the production task tree lives. */
export const TASK_TREE_KEY = 'layers.productionTasks.v2';
/** localStorage fallback key for guest mode (no settings service). */
const LOCAL_KEY = TASK_TREE_KEY;

let idCounter = 0;
export function newTaskId(): string {
  idCounter += 1;
  return `t${Date.now().toString(36)}-${idCounter}`;
}

const seed = (label: string, children?: TaskNode[]): TaskNode =>
  ({ id: newTaskId(), label, done: false, children: children ?? [] });

/** Starting list: the focused Layers GUI Creator and Editor roadmap. */
export function seedTasks(): TaskNode[] {
  return [
    seed('Live App Bridge', [
      seed('Connect your own running app to the canvas'),
      seed('Make the left-menu style and motion controls work on connected apps'),
    ]),
    seed('Folder Tree Browser', [
      seed('Browse local and GitHub project folders as a tree'),
      seed('Open any file or screen straight onto the canvas'),
    ]),
    seed('Design system page', [
      seed('Show colours, corners, spacing and motion of your app'),
      seed('Manage saved looks and presets in one place'),
    ]),
    seed('Mermaid whiteboard', [
      seed('Draw diagrams on a whiteboard page'),
      seed('Import and export designs for another agent to use'),
    ]),
  ];
}

function isNode(raw: unknown): raw is TaskNode {
  if (!raw || typeof raw !== 'object') return false;
  const n = raw as Partial<TaskNode>;
  return typeof n.id === 'string' && typeof n.label === 'string'
    && typeof n.done === 'boolean' && Array.isArray(n.children) && n.children.every(isNode);
}

/** Parse a stored value into a task tree, or null when the shape is wrong. */
export function validateTaskTree(raw: unknown): TaskNode[] | null {
  if (!Array.isArray(raw) || !raw.every(isNode)) return null;
  return raw as TaskNode[];
}

function mapNodes(nodes: TaskNode[], id: string, fn: (n: TaskNode) => TaskNode): TaskNode[] {
  return nodes.map(n => (n.id === id ? fn(n) : { ...n, children: mapNodes(n.children, id, fn) }));
}

export function toggleTask(nodes: TaskNode[], id: string): TaskNode[] {
  return mapNodes(nodes, id, n => ({ ...n, done: !n.done }));
}

export function renameTask(nodes: TaskNode[], id: string, label: string): TaskNode[] {
  const trimmed = label.trim();
  if (!trimmed) return nodes;
  return mapNodes(nodes, id, n => ({ ...n, label: trimmed }));
}

/** Add a new task; parentId null adds at the top level. Returns the new tree and the new node's id. */
export function addTask(nodes: TaskNode[], parentId: string | null, label: string, id: string = newTaskId()): { nodes: TaskNode[]; newId: string } {
  const node: TaskNode = { id, label, done: false, children: [] };
  if (parentId === null) return { nodes: [...nodes, node], newId: id };
  return { nodes: mapNodes(nodes, parentId, n => ({ ...n, children: [...n.children, node] })), newId: id };
}

export function deleteTask(nodes: TaskNode[], id: string): TaskNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => ({ ...n, children: deleteTask(n.children, id) }));
}

function readLocal(): TaskNode[] | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? validateTaskTree(JSON.parse(raw)) : null;
  } catch { return null; }
}

function writeLocal(tasks: TaskNode[]): void {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(tasks)); } catch { /* storage full/blocked */ }
}

/**
 * Task-tree state. Signed-in users persist through the settings service
 * (`extensionSettings['layers.productionTasks']`); guests fall back to localStorage.
 */
export function useTaskTracker() {
  const appSettings = useOptionalSettings();
  const [local, setLocal] = useState<TaskNode[]>(() => readLocal() ?? seedTasks());

  const tasks = useMemo<TaskNode[]>(() => {
    if (!appSettings) return local;
    return validateTaskTree(appSettings.settings.extensionSettings?.[TASK_TREE_KEY]) ?? readLocal() ?? seedTasks();
  }, [appSettings, local]);

  const save = useCallback((next: TaskNode[]) => {
    // Always mirror to localStorage: guest mode uses an in-memory settings
    // service that vanishes on reload, so the mirror is the durable copy.
    setLocal(next);
    writeLocal(next);
    if (!appSettings) return;
    void appSettings.update({
      extensionSettings: { ...appSettings.settings.extensionSettings, [TASK_TREE_KEY]: next },
    });
  }, [appSettings]);

  const toggle = useCallback((id: string) => save(toggleTask(tasks, id)), [tasks, save]);
  const rename = useCallback((id: string, label: string) => save(renameTask(tasks, id, label)), [tasks, save]);
  const remove = useCallback((id: string) => save(deleteTask(tasks, id)), [tasks, save]);
  const add = useCallback((parentId: string | null, label: string): string => {
    const { nodes, newId } = addTask(tasks, parentId, label);
    save(nodes);
    return newId;
  }, [tasks, save]);

  return { tasks, toggle, rename, remove, add };
}
