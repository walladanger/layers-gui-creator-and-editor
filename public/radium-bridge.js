// Radium bridge (protocol radium v1, docs/production-plan.md §4).
// Phase 3 scope: announce `ready` and answer `hello`. The full command set arrives in Phase 4.
(() => {
  if (window.__radiumBridge || window.parent === window) return;
  window.__radiumBridge = true;
  const VERSION = '0.3.0';
  const KEY = 'radium-editor-origin';
  const fromQuery = new URLSearchParams(location.search).get('radium-editor');
  if (fromQuery) sessionStorage.setItem(KEY, fromQuery);
  const allowed = (origin) => /^http:\/\/localhost(:\d+)?$/.test(origin)
    || /\.lovable\.app$/.test(new URL(origin).hostname)
    || origin === location.origin
    || origin === sessionStorage.getItem(KEY);
  const info = () => ({
    bridgeVersion: VERSION, url: location.href, title: document.title,
    framework: window.React || document.querySelector('[data-reactroot],#root') ? 'react' : 'unknown',
    hasSourceMap: !!document.querySelector('[data-rid]'),
  });
  const send = (target, msg) => window.parent.postMessage({ ns: 'radium', v: 1, ...msg }, target);
  const id = () => Math.random().toString(36).slice(2);
  window.addEventListener('message', (event) => {
    const m = event.data;
    if (!m || m.ns !== 'radium' || m.v !== 1 || event.source !== window.parent) return;
    let ok = false; try { ok = allowed(event.origin); } catch { ok = false; }
    if (!ok) return;
    if (m.type === 'hello') send(event.origin, { id: m.id, type: 'hello.ok', payload: info() });
    else if (m.type === 'nav.go' && typeof m.payload?.path === 'string') {
      const target = new URL(m.payload.path, location.href);
      if (target.origin !== location.origin) { send(event.origin, { id: m.id, type: 'nav.go.err', payload: { code: 'bad-path', message: 'Path must stay on this app.' } }); return; }
      if (target.pathname + target.search + target.hash !== location.pathname + location.search + location.hash) {
        history.pushState(null, '', target.pathname + target.search + target.hash);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      send(event.origin, { id: m.id, type: 'nav.go.ok', payload: {} });
      send(event.origin, { id: id(), type: 'route.changed', payload: { url: location.href } });
    }
    else send(event.origin, { id: m.id, type: `${m.type}.err`, payload: { code: 'unsupported', message: 'Not available yet.' } });
  });
  const announce = () => send('*', { id: id(), type: 'ready', payload: info() });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announce); else announce();
})();
