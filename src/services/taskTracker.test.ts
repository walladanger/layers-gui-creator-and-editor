import { describe, expect, it } from 'vitest';
import {
  addTask, deleteTask, renameTask, seedTasks, toggleTask, validateTaskTree, type TaskNode,
} from './taskTracker';

const node = (id: string, label: string, done = false, children: TaskNode[] = []): TaskNode =>
  ({ id, label, done, children });

describe('seedTasks', () => {
  it('starts with the four focused Layers tasks', () => {
    expect(seedTasks().map(t => t.label)).toEqual(['Live App Bridge', 'Folder Tree Browser', 'Mermaid whiteboard']);
  });
});

describe('validateTaskTree', () => {
  it('rejects non-arrays and malformed nodes', () => {
    expect(validateTaskTree(null)).toBeNull();
    expect(validateTaskTree({})).toBeNull();
    expect(validateTaskTree([{ id: 'a', label: 'x', done: true }])).toBeNull();
    expect(validateTaskTree([node('a', 'x', true, [{ id: 1 } as unknown as TaskNode])])).toBeNull();
  });
});

describe('toggleTask', () => {
  it('flips done on the target node only', () => {
    const tree = [node('a', 'A', true, [node('b', 'B')]), node('c', 'C')];
    const next = toggleTask(tree, 'b');
    expect(next[0].children[0].done).toBe(true);
    expect(next[0].done).toBe(true);
    expect(next[1].done).toBe(false);
    expect(tree[0].children[0].done).toBe(false); // immutable
  });
});

describe('addTask', () => {
  it('adds a top-level task when parentId is null', () => {
    const { nodes, newId } = addTask([node('a', 'A')], null, 'New', 'n1');
    expect(nodes).toHaveLength(2);
    expect(nodes[1]).toEqual({ id: 'n1', label: 'New', done: false, children: [] });
    expect(newId).toBe('n1');
  });

  it('adds a child under the given parent', () => {
    const { nodes } = addTask([node('a', 'A')], 'a', 'Child', 'n2');
    expect(nodes[0].children).toEqual([{ id: 'n2', label: 'Child', done: false, children: [] }]);
  });
});

describe('renameTask', () => {
  it('trims and sets the label', () => {
    const next = renameTask([node('a', 'Old')], 'a', '  New name  ');
    expect(next[0].label).toBe('New name');
  });

  it('ignores empty labels', () => {
    const tree = [node('a', 'Keep')];
    expect(renameTask(tree, 'a', '   ')).toBe(tree);
  });
});

describe('deleteTask', () => {
  it('removes the node and its whole subtree', () => {
    const tree = [node('a', 'A', false, [node('b', 'B', false, [node('c', 'C')])]), node('d', 'D')];
    const next = deleteTask(tree, 'a');
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('d');
  });

  it('removes nested nodes', () => {
    const tree = [node('a', 'A', false, [node('b', 'B'), node('c', 'C')])];
    const next = deleteTask(tree, 'b');
    expect(next[0].children.map(n => n.id)).toEqual(['c']);
  });
});
