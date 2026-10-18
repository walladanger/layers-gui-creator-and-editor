import { BridgeService, bridgeOrigin, connectionSnippet } from './bridgeService';

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
