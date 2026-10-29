import { liveStyleService } from './liveStyleService';
import type { BridgeService, BridgeNode } from './bridgeService';
import type { Frame } from './types';
import type { StudioServices } from './services';

const node: BridgeNode = { nid: 'n1', rid: 'src/Card.tsx:12:4', tag: 'div', label: 'Card', selector: '#card', instanceIndex: 0, instanceCount: 2 };
const frame = { id: 'f1', project_id: 'p1', breakpoint: 'desktop' } as Frame;
function setup() {
  let values: Record<string, string> = { 'border-radius': '8px', color: 'rgb(0, 0, 0)' };
  const request = vi.fn(async (type: string, payload: Record<string, unknown>) => {
    if (type === 'preview.style') values = { ...values, ...payload.props as Record<string, string> };
    return type === 'style.get' ? { computed: values, inline: {}, classList: [] } : {};
  });
  const bridge = { request, subscribe: () => () => undefined } as unknown as BridgeService;
  const record = vi.fn(async () => ({}));
  const services = { sessions: { list: async () => [], create: async () => ({ id: 's1' }) }, changes: { record } } as unknown as StudioServices;
  const detach = liveStyleService.attach(frame.id, bridge, frame, services);
  return { request, record, detach };
}
test('style previews record source, scope, breakpoint and concrete before/after values', async () => {
  const { request, record, detach } = setup();
  await liveStyleService.select(frame.id, node); liveStyleService.setScope('all');
  await liveStyleService.edit('border-radius', '24px');
  expect(request).toHaveBeenCalledWith('preview.style', { nid: 'n1', scope: 'all', props: { 'border-radius': '24px' } });
  expect(record).toHaveBeenCalledWith(expect.objectContaining({ session_id: 's1', frame_id: 'f1', kind: 'style', target: expect.objectContaining({ rid: 'src/Card.tsx:12:4', instanceScope: 'all', breakpoint: 'desktop' }), before: { 'border-radius': '8px' }, after: { 'border-radius': '24px' } }));
  expect(liveStyleService.getSnapshot().canUndo).toBe(true); detach();
});
test('undo and redo restore values; new edits clear the redo branch', async () => {
  const { detach } = setup(); await liveStyleService.select(frame.id, node);
  await liveStyleService.edit('border-radius', '24px'); await liveStyleService.undo();
  expect(liveStyleService.getSnapshot().values['border-radius']).toBe('8px');
  await liveStyleService.redo(); expect(liveStyleService.getSnapshot().values['border-radius']).toBe('24px');
  await liveStyleService.undo(); await liveStyleService.edit('border-radius', '16px');
  expect(liveStyleService.getSnapshot().canRedo).toBe(false);
  expect(liveStyleService.exportCss()).toContain('border-radius: 16px;'); detach();
});
test('unchanged and unsupported properties never create records', async () => {
  const { record, detach } = setup(); await liveStyleService.select(frame.id, node);
  await liveStyleService.edit('border-radius', '8px'); await liveStyleService.edit('behavior', 'unsafe');
  expect(record).not.toHaveBeenCalled(); detach();
});
test('changes collapse repeated edits to the first before and last after, and drop edits that end where they started', async () => {
  const { detach } = setup(); await liveStyleService.select(frame.id, node);
  await liveStyleService.edit('border-radius', '12px'); await liveStyleService.edit('border-radius', '24px');
  await liveStyleService.edit('color', 'rgb(255, 0, 0)'); await liveStyleService.edit('color', 'rgb(0, 0, 0)');
  expect(liveStyleService.changes()).toEqual([expect.objectContaining({ property: 'border-radius', before: '8px', after: '24px', node: expect.objectContaining({ rid: 'src/Card.tsx:12:4' }) })]);
  detach();
});
test('after the app reloads, previews are found again by source id and re-applied without new records', async () => {
  let emit: (m: { type: string; payload: Record<string, unknown> }) => void = () => undefined;
  const request = vi.fn(async (type: string) => type === 'node.find' ? { node: { ...node, nid: 'n9' } } : type === 'style.get' ? { computed: { 'border-radius': '8px' }, inline: {}, classList: [] } : {});
  const bridge = { request, supports: () => true, subscribe: (l: typeof emit) => { emit = l; return () => undefined; } } as unknown as BridgeService;
  const record = vi.fn(async () => ({}));
  const services = { sessions: { list: async () => [{ id: 's1', status: 'open' }] }, changes: { record } } as unknown as StudioServices;
  const detach = liveStyleService.attach(frame.id, bridge, frame, services);
  await liveStyleService.select(frame.id, node); await liveStyleService.edit('border-radius', '20px');
  request.mockClear(); record.mockClear();
  emit({ type: 'ready', payload: {} });
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('preview.style', { nid: 'n9', scope: 'instance', props: { 'border-radius': '20px' } }));
  expect(request).toHaveBeenCalledWith('node.find', { rid: 'src/Card.tsx:12:4', instanceIndex: 0, selector: '#card' });
  expect(record).not.toHaveBeenCalled();
  detach();
});
