import 'fake-indexeddb/auto';
import { assetInsertService } from './assetInsertService';
import type { BridgeMessage, BridgeNode, BridgeService } from './bridgeService';
import { flattenTasks, readStoredTasks } from './taskTracker';
import { SHADCN_ASSETS } from '../features/assets/catalog';

const anchor: BridgeNode = { nid: 'n4', tag: 'h3', label: 'h3.card__title', text: 'Fix the login timeout', rid: 'src/App.tsx:38:7', comp: 'TaskCard', selector: '#root h3', instanceIndex: 1, instanceCount: 6 };
const tree = { t: 'span', s: 'color:red', c: ['New'] };
const badge = SHADCN_ASSETS.find(a => a.name === 'Badge')!;

function fakeBridge(commands = ['preview.insert', 'node.find', 'screenshot']) {
  let emit: (m: BridgeMessage) => void = () => undefined;
  const request = vi.fn(async (type: string) => {
    if (type === 'preview.insert') return { node: { ...anchor, nid: 'n99', tag: 'span', label: 'span' } };
    if (type === 'node.find') return { node: { ...anchor, nid: 'n7' } };
    return {};
  });
  const bridge = {
    request, supports: (c: string) => commands.includes(c),
    screenshot: vi.fn(async () => null),
    subscribe: (l: typeof emit) => { emit = l; return () => undefined; },
  } as unknown as BridgeService;
  return { bridge, request, ready: () => emit({ ns: 'radium', v: 1, id: 'r', type: 'ready', payload: {} }) };
}

afterEach(() => { assetInsertService.cancel(); localStorage.clear(); });

test('nothing is placed until an asset is picked', async () => {
  const { bridge, request } = fakeBridge();
  expect(await assetInsertService.place(bridge, { frameId: 'f1', projectId: 'p1', route: '/', anchor, position: 'after', px: 1, py: 2 })).toMatch(/Pick a component/);
  expect(request).not.toHaveBeenCalled();
});

test('placing previews the asset next to the element and records a task the agent can follow', async () => {
  const { bridge, request } = fakeBridge();
  const detach = assetInsertService.attach('f1', bridge);
  const seen = vi.fn(); const stop = assetInsertService.subscribe(seen);
  assetInsertService.arm(badge, tree);
  expect(assetInsertService.getPending()?.asset.name).toBe('Badge');
  expect(await assetInsertService.place(bridge, { frameId: 'f1', projectId: 'p1', route: '/', anchor, position: 'after', px: 10, py: 20 })).toBeNull();
  expect(request).toHaveBeenCalledWith('preview.insert', expect.objectContaining({ anchorNid: 'n4', position: 'after', tree }));
  expect(assetInsertService.getPending()).toBeNull();
  expect(seen).toHaveBeenCalled();
  const task = flattenTasks(readStoredTasks() ?? []).find(t => t.source?.insert)!;
  expect(task.label).toBe('Add the shadcn/ui Badge after h3.card__title “Fix the login timeout”.');
  expect(task.source).toMatchObject({ projectId: 'p1', element: { rid: 'src/App.tsx:38:7', comp: 'TaskCard' }, insert: { name: 'Badge', position: 'after', install: 'npx shadcn@latest add badge' } });
  stop(); detach();
});

test('after the app reloads, placed assets are found by their anchor and put back', async () => {
  const { bridge, request, ready } = fakeBridge();
  const detach = assetInsertService.attach('f2', bridge);
  assetInsertService.arm(badge, tree);
  await assetInsertService.place(bridge, { frameId: 'f2', projectId: 'p1', route: '/', anchor, position: 'append', px: 0, py: 0 });
  request.mockClear();
  ready();
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('preview.insert', expect.objectContaining({ anchorNid: 'n7', position: 'append', tree })));
  expect(request).toHaveBeenCalledWith('node.find', { rid: 'src/App.tsx:38:7', instanceIndex: 1, selector: '#root h3' });
  detach();
});

test('an older bridge without inserts gets a clear message', async () => {
  const { bridge } = fakeBridge(['screenshot']);
  assetInsertService.arm(badge, tree);
  expect(await assetInsertService.place(bridge, { frameId: 'f3', projectId: 'p1', route: '/', anchor, position: 'after', px: 0, py: 0 })).toMatch(/too old/);
});
