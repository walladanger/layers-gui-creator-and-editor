import { BridgeService, bridgeOrigin, bridgeSupports, connectionSnippet, parseRid } from './bridgeService';

test('only the expected source and origin can resolve a bridge request', async () => {
  const postMessage = vi.fn(); const target = { postMessage } as unknown as Window;
  const client = new BridgeService(() => target, 'https://my-app.example');
  const promise = client.request('style.get', { nid: 'n1' });
  const request = postMessage.mock.calls[0][0];
  expect(postMessage.mock.calls[0][1]).toBe('https://my-app.example');
  const payload = { computed: { color: 'red' } };
  const message = { ...request, type: 'style.get.ok', payload };
  let resolved = false; void promise.then(() => { resolved = true; });
  window.dispatchEvent(new MessageEvent('message', { source: target, origin: 'https://other.example', data: message }));
  await Promise.resolve(); expect(resolved).toBe(false);
  window.dispatchEvent(new MessageEvent('message', { source: window, origin: client.origin, data: message }));
  await Promise.resolve(); expect(resolved).toBe(false);
  window.dispatchEvent(new MessageEvent('message', { source: target, origin: client.origin, data: message }));
  expect(await promise).toEqual(payload); client.dispose();
});
test('connection script points at the studio and unsafe target schemes are rejected', () => {
  expect(connectionSnippet('https://layers.example')).toBe('<script src="https://layers.example/radium-bridge.js"></script>');
  expect(bridgeOrigin('javascript:alert(1)')).toBeNull();
  expect(bridgeOrigin('http://localhost:5173/settings')).toBe('http://localhost:5173');
});
test('pending requests reject on timeout and disposal', async () => {
  vi.useFakeTimers();
  const client = new BridgeService(() => ({ postMessage() {} }) as unknown as Window, 'http://localhost:5173');
  const pending = client.request('hello'); const check = expect(pending).rejects.toThrow('did not answer');
  await vi.advanceTimersByTimeAsync(3000); await check;
  const next = client.request('hello'); const disposed = expect(next).rejects.toThrow('disconnected'); client.dispose(); await disposed;
  vi.useRealTimers();
});
test('source ids split into file, line and column', () => {
  expect(parseRid('src/components/Card.tsx:42:7')).toEqual({ file: 'src/components/Card.tsx', line: 42, column: 7 });
  expect(parseRid('C:/app/src/A.tsx:3:1')).toEqual({ file: 'C:/app/src/A.tsx', line: 3, column: 1 });
  expect(parseRid(undefined)).toBeNull();
  expect(parseRid('no-line')).toBeNull();
});
test('older bridges are assumed to have only the original commands', () => {
  expect(bridgeSupports(null, 'style.get')).toBe(true);
  expect(bridgeSupports(null, 'screenshot')).toBe(false);
  expect(bridgeSupports({ commands: ['hello', 'screenshot'] }, 'screenshot')).toBe(true);
  expect(bridgeSupports({ commands: ['hello'] }, 'style.get')).toBe(false);
});
test('ready and hello replies record what the app says about itself; screenshots wait for a capable bridge', async () => {
  const postMessage = vi.fn(); const target = { postMessage } as unknown as Window;
  const client = new BridgeService(() => target, 'http://localhost:5173');
  expect(await client.screenshot('n1')).toBeNull();
  expect(postMessage).not.toHaveBeenCalled();
  const info = { bridgeVersion: '0.6.0', hasSourceMap: true, commands: ['hello', 'screenshot'] };
  window.dispatchEvent(new MessageEvent('message', { source: target, origin: client.origin, data: { ns: 'radium', v: 1, id: 'x', type: 'ready', payload: info } }));
  expect(client.info).toEqual(info);
  const shot = client.screenshot('n1');
  const request = postMessage.mock.calls[0][0];
  expect(request).toMatchObject({ type: 'screenshot', payload: { nid: 'n1', padding: 16 } });
  window.dispatchEvent(new MessageEvent('message', { source: target, origin: client.origin, data: { ...request, type: 'screenshot.ok', payload: { dataUrl: 'data:image/jpeg;base64,AAAA', viewDataUrl: 'data:image/jpeg;base64,BBBB' } } }));
  expect(await shot).toMatchObject({ dataUrl: 'data:image/jpeg;base64,AAAA', viewDataUrl: 'data:image/jpeg;base64,BBBB' });
  client.dispose();
});
