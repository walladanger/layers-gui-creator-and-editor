import { useCallback, useEffect, useState } from 'react';
import { useOptionalSettings } from '../settings/settingsStore';

export type TaskKind = 'Bug' | 'Improvement' | 'Change' | 'Idea' | 'Question';
export type TaskPriority = 'high' | 'normal' | 'low';
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export const TASK_KINDS: TaskKind[] = ['Bug', 'Improvement', 'Change', 'Idea', 'Question'];
export const TASK_PRIORITIES: TaskPriority[] = ['high', 'normal', 'low'];
export const TASK_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

/** Everything recorded at the moment a comment was made on an exact element. */
export interface TaskSource {
  commentId: string;
  origin: 'demo' | 'canvas';
  createdAt: number;
  text: string;
  kind: string;
  element: { label: string; selector?: string; rid?: string; comp?: string; tag?: string; text?: string };
  location: { route?: string; layout?: string; px?: number; py?: number; rect?: { x: number; y: number; width: number; height: number } };
  viewport?: { width: number; height: number };
  styles?: Record<string, string>;
  edits?: unknown;
  /** Small view of the screen with the element outlined. */
  screenshot?: string;
  /** Small image of just the element. */
  elementShot?: string;
  /** True when full-size images are kept in the screenshot store under `commentId`. */
  fullShots?: boolean;
  projectId?: string;
  frameId?: string;
}

export interface TaskNode {
  id: string; label: string; done: boolean; children: TaskNode[];
  kind?: TaskKind; priority?: TaskPriority; status?: TaskStatus; notes?: string; source?: TaskSource;
}

/** Key inside `AppSettings.extensionSettings` where the production task tree lives. */
export const TASK_TREE_KEY = 'layers.productionTasks.v4';
const LEGACY_KEY = 'layers.productionTasks.v3';
const LOCAL_KEY = TASK_TREE_KEY;
const CHANGE_EVENT = 'layers:tasks-changed';

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

/** Older (v3) lists only had `done`; give every node a status. */
export function migrateTaskTree(nodes: TaskNode[]): TaskNode[] {
  return nodes.map(n => ({ ...n, status: n.status ?? (n.done ? 'done' : 'todo'), children: migrateTaskTree(n.children) }));
}

function mapNodes(nodes: TaskNode[], id: string, fn: (n: TaskNode) => TaskNode): TaskNode[] {
  return nodes.map(n => (n.id === id ? fn(n) : { ...n, children: mapNodes(n.children, id, fn) }));
}

export function toggleTask(nodes: TaskNode[], id: string): TaskNode[] {
  return mapNodes(nodes, id, n => ({ ...n, done: !n.done, status: n.done ? 'todo' : 'done' }));
}

export function renameTask(nodes: TaskNode[], id: string, label: string): TaskNode[] {
  const trimmed = label.trim();
  if (!trimmed) return nodes;
  return mapNodes(nodes, id, n => ({ ...n, label: trimmed }));
}

export type TaskFields = Partial<Pick<TaskNode, 'kind' | 'priority' | 'status' | 'notes'>>;
export function updateTask(nodes: TaskNode[], id: string, fields: TaskFields): TaskNode[] {
  return mapNodes(nodes, id, n => {
    const next = { ...n, ...fields };
    if (fields.status) next.done = fields.status === 'done';
    return next;
  });
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

export function flattenTasks(nodes: TaskNode[]): TaskNode[] {
  return nodes.flatMap(n => [n, ...flattenTasks(n.children)]);
}

export function readStoredTasks(): TaskNode[] | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) return validateTaskTree(JSON.parse(raw));
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    const old = legacy ? validateTaskTree(JSON.parse(legacy)) : null;
    return old ? migrateTaskTree(old) : null;
  } catch { return null; }
}

function writeLocal(tasks: TaskNode[]): void {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(tasks)); } catch { /* storage full/blocked */ }
}

/** Write the task list from outside React (for example when a comment is made) and tell open lists. */
export function writeTasksExternally(tasks: TaskNode[]): void {
  writeLocal(tasks);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Task-tree state. The local copy is the durable store (guest services are in-memory);
 * signed-in users also persist through the settings service.
 */
export function useTaskTracker() {
  const appSettings = useOptionalSettings();
  const [tasks, setLocal] = useState<TaskNode[]>(() => readStoredTasks()
    ?? validateTaskTree(appSettings?.settings.extensionSettings?.[TASK_TREE_KEY])
    ?? seedTasks());

  const save = useCallback((next: TaskNode[]) => {
    setLocal(next);
    writeLocal(next);
    if (!appSettings) return;
    void appSettings.update({
      extensionSettings: { ...appSettings.settings.extensionSettings, [TASK_TREE_KEY]: next },
    });
  }, [appSettings]);

  useEffect(() => {
    const reload = () => { const next = readStoredTasks(); if (next) save(next); };
    window.addEventListener(CHANGE_EVENT, reload);
    return () => window.removeEventListener(CHANGE_EVENT, reload);
  }, [save]);

  const toggle = useCallback((id: string) => save(toggleTask(tasks, id)), [tasks, save]);
  const rename = useCallback((id: string, label: string) => save(renameTask(tasks, id, label)), [tasks, save]);
  const remove = useCallback((id: string) => save(deleteTask(tasks, id)), [tasks, save]);
  const update = useCallback((id: string, fields: TaskFields) => save(updateTask(tasks, id, fields)), [tasks, save]);
  const add = useCallback((parentId: string | null, label: string): string => {
    const { nodes, newId } = addTask(tasks, parentId, label);
    save(nodes);
    return newId;
  }, [tasks, save]);
  const addMany = useCallback((parentId: string, labels: string[]) => {
    let nodes = tasks;
    for (const l of labels) nodes = addTask(nodes, parentId, l).nodes;
    save(nodes);
  }, [tasks, save]);

  return { tasks, toggle, rename, remove, add, addMany, update };
}
