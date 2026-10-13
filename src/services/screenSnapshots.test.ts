import { captureScreenSnapshot, getScreenSnapshots, saveScreenSnapshot, screenSnapshotKey } from './screenSnapshots';

test('snapshots are isolated by project source even when file IDs match', () => {
  saveScreenSnapshot('repo-a', 'public/index.html', 'data:image/png;base64,YQ==');
  saveScreenSnapshot('repo-b', 'public/index.html', 'data:image/png;base64,Yg==');
  expect(getScreenSnapshots()[screenSnapshotKey('repo-a', 'public/index.html')]).toBe('data:image/png;base64,YQ==');
  expect(getScreenSnapshots()[screenSnapshotKey('repo-b', 'public/index.html')]).toBe('data:image/png;base64,Yg==');
});

test('external capture validates reply origin and frame before accepting a screenshot', async () => {
  const iframe = document.createElement('iframe');
  iframe.src = 'https://target.example/page';
  document.body.appendChild(iframe);
  const target = iframe.contentWindow;
  if (!target) throw new Error('Missing iframe window');
  const post = vi.spyOn(target, 'postMessage').mockImplementation(() => undefined);
  const result = captureScreenSnapshot(iframe);
  const command = post.mock.calls[0]?.[0];
  expect(command).toMatchObject({ ns: 'radium', v: 1, type: 'screenshot', payload: {} });
  expect(post.mock.calls[0]?.[1]).toBe('https://target.example');
  let resolved = false;
  void result.then(() => { resolved = true; });
  window.dispatchEvent(new MessageEvent('message', { source: target, origin: 'https://wrong.example', data: { ...command, type: 'screenshot.ok', payload: { dataUrl: 'data:image/png;base64,d3Jvbmc=' } } }));
  await Promise.resolve();
  expect(resolved).toBe(false);
  window.dispatchEvent(new MessageEvent('message', { source: target, origin: 'https://target.example', data: { ...command, type: 'screenshot.ok', payload: { dataUrl: 'data:image/png;base64,b2s=' } } }));
  await expect(result).resolves.toBe('data:image/png;base64,b2s=');
  iframe.remove();
});