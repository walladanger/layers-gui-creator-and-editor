import { REVEAL_EVENT, addCommentTasks, exportAgentPlan, showOnCanvas, sourceFromDemoNote, taskFromSource, type RevealRequest } from './commentTasks';
import { migrateTaskTree, type TaskSource } from './taskTracker';

const src = (id: string, kind = 'Bug', text = 'Slider is too small'): TaskSource => ({
  commentId: id, origin: 'demo', createdAt: 0, text, kind,
  element: { label: 'Setting · Context', selector: '[data-k="set:ctx"]' }, location: { route: '/targets/radium-mock.html' },
});

test('a new comment creates exactly one task with its kind and exact element', () => {
  const next = addCommentTasks([], [src('demo:n1')]);
  expect(next).toHaveLength(1);
  expect(next[0]).toMatchObject({ label: 'Slider is too small', kind: 'Bug', priority: 'high', status: 'todo' });
  expect(next[0].source?.element.selector).toBe('[data-k="set:ctx"]');
});

test('the same comment is never added twice', () => {
  const once = addCommentTasks([], [src('demo:n1')]);
  expect(addCommentTasks(once, [src('demo:n1'), src('demo:n1')])).toBe(once);
});

test('a demo note keeps its text, kind, path and time', () => {
  const s = sourceFromDemoNote({ id: 'n9', text: 'Make it blue', kind: 'Idea', path: '#page', createdAt: 42, layout: 'rows' }, null, { a: 1 });
  expect(s).toMatchObject({ commentId: 'demo:n9', kind: 'Idea', createdAt: 42, element: { selector: '#page' }, location: { layout: 'rows' }, edits: { a: 1 } });
});

test('older saved lists gain a status from done', () => {
  const [a] = migrateTaskTree([{ id: 'a', label: 'A', done: true, children: [] }]);
  expect(a.status).toBe('done');
});

test('agent plan lists only open tasks with where and what', () => {
  const open = taskFromSource(src('c1'), 'x');
  const done = { ...taskFromSource(src('c2', 'Change', 'Finished thing'), 'y'), done: true };
  const plan = exportAgentPlan([open, done]);
  expect(plan).toContain('Selector: `[data-k="set:ctx"]`');
  expect(plan).toContain('Original comment');
  expect(plan).not.toContain('Finished thing');
});

test('showing a connected-app task on the canvas asks the app to reveal the element on its screen', async () => {
  vi.useFakeTimers();
  const seen: RevealRequest[] = [];
  const on = (e: Event) => seen.push((e as CustomEvent<RevealRequest>).detail);
  window.addEventListener(REVEAL_EVENT, on);
  showOnCanvas({ commentId: 'c1', origin: 'canvas', createdAt: 0, text: 'x', kind: 'Change', element: { label: 'p', rid: 'src/App.tsx:39:7', selector: '#root p' }, location: { route: '/settings' } });
  await vi.advanceTimersByTimeAsync(300);
  expect(seen).toEqual([{ rid: 'src/App.tsx:39:7', selector: '#root p', route: '/settings' }]);
  window.removeEventListener(REVEAL_EVENT, on);
  vi.useRealTimers();
});
