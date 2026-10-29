import { compileProductionList, productionTasks } from './compile';
import type { TaskNode, TaskSource } from '../../services/taskTracker';
import type { LiveStyleChange } from '../../services/liveStyleService';

const source = (commentId: string, extra: Partial<TaskSource> = {}): TaskSource => ({
  commentId, origin: 'canvas', createdAt: 0, text: 'Make the owner text darker', kind: 'Change', projectId: 'p1',
  element: { label: 'p.card__meta', selector: '#root p', rid: 'src/App.tsx:39:7', comp: 'TaskCard', text: 'Owner: Sam' },
  location: { route: '/', px: 10, py: 20 }, viewport: { width: 1440, height: 900 },
  screenshot: 'data:image/jpeg;base64,VEhVTUI=', elementShot: 'data:image/jpeg;base64,RUxFTQ==', ...extra,
});
const task = (id: string, extra: Partial<TaskNode> = {}): TaskNode => ({ id, label: `Task ${id}`, done: false, children: [], ...extra });

test('only open tasks from comments on this project become items; their sub-tasks become steps', () => {
  const tasks = [
    task('roadmap', { children: [task('note')] }),
    task('a', { source: source('c1'), children: [task('a1', { label: 'Add an avatar' })] }),
    task('b', { source: source('c2'), done: true }),
    task('c', { source: source('c3', { projectId: 'p2' }) }),
  ];
  expect(productionTasks(tasks, 'p1').map(t => t.id)).toEqual(['a']);
  const list = compileProductionList({ project: 'Orbit', projectId: 'p1', tasks, now: new Date('2026-10-29T00:00:00Z') });
  expect(list.json.items).toHaveLength(1);
  expect(list.json.items[0]).toMatchObject({ id: 'RPL-001', file: 'src/App.tsx', line: 39, column: 7, component: 'TaskCard', steps: ['Add an avatar'], comment: 'Make the owner text darker' });
});

test('screenshots prefer full-size images and are named after the item', () => {
  const list = compileProductionList({
    project: 'Orbit', tasks: [task('a', { source: source('c1', { fullShots: true }) })],
    images: { c1: { view: 'data:image/png;base64,RlVMTA==' } },
  });
  expect(list.shots).toEqual([
    { path: 'shots/RPL-001-view.png', dataUrl: 'data:image/png;base64,RlVMTA==' },
    { path: 'shots/RPL-001-element.jpg', dataUrl: 'data:image/jpeg;base64,RUxFTQ==' },
  ]);
  expect(list.json.items[0].screenshots).toEqual({ view: 'shots/RPL-001-view.png', element: 'shots/RPL-001-element.jpg' });
  expect(list.markdown).toContain('![RPL-001 screen](shots/RPL-001-view.png)');
  expect(list.markdown).toContain('`src/App.tsx:39` · `<TaskCard>`');
});

test('style edits group by element into one item with every changed property', () => {
  const node = { nid: 'n1', tag: 'article', label: 'article.card', rid: 'src/App.tsx:37:5', comp: 'TaskCard', selector: '#root article', instanceIndex: 0, instanceCount: 6 };
  const change = (property: string, before: string, after: string): LiveStyleChange => ({ node, scope: 'all', property, before, after, route: '/', breakpoint: 'desktop' });
  const list = compileProductionList({ project: 'Orbit', tasks: [], styleChanges: [change('border-radius', '8px', '18px'), change('background-color', 'rgb(255, 255, 255)', '#fff7e6')] });
  expect(list.json.items).toEqual([expect.objectContaining({
    id: 'RPL-001', kind: 'Style', file: 'src/App.tsx', line: 37, scope: 'all-instances',
    changes: [{ kind: 'style', property: 'border-radius', before: '8px', after: '18px' }, { kind: 'style', property: 'background-color', before: 'rgb(255, 255, 255)', after: '#fff7e6' }],
    css: 'border-radius: 18px; background-color: #fff7e6;',
  })]);
  expect(list.markdown).toContain('`border-radius`: `8px` → `18px`');
});

test('the same input always compiles to the same output', () => {
  const input = { project: 'Orbit', tasks: [task('a', { source: source('c1') })], now: new Date('2026-10-29T00:00:00Z') };
  expect(compileProductionList(input)).toEqual(compileProductionList(input));
  expect(compileProductionList(input).json).toMatchObject({ schema: 'radium-production/v1', generatedAt: '2026-10-29T00:00:00.000Z' });
});

test('inserted assets become Insert items with the install command, import and code to add', () => {
  const list = compileProductionList({ project: 'Orbit', tasks: [task('i', { label: 'Add the shadcn/ui Badge after h3', source: source('insert:x', {
    insert: { library: 'shadcn', name: 'Badge', position: 'after', install: 'npx shadcn@latest add badge', importLine: 'import { Badge } from "@/components/ui/badge"', usage: '<Badge variant="secondary">New</Badge>' },
  }) })] });
  expect(list.json.items[0]).toMatchObject({ kind: 'Insert', insert: { name: 'Badge', position: 'after' }, file: 'src/App.tsx', line: 39 });
  expect(list.markdown).toContain('- **Add:** shadcn/ui `Badge` just after the element above');
  expect(list.markdown).toContain('- **Install:** `npx shadcn@latest add badge`');
  expect(list.markdown).toContain('  <Badge variant="secondary">New</Badge>');
  expect(list.markdown).not.toContain('**Comment:**');
});
