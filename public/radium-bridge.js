// Radium bridge (protocol radium v1, docs/production-plan.md §4).
// Preview-only styling for running apps; no source files are modified.
(() => {
  if (window.__radiumBridge || window.parent === window) return;
  window.__radiumBridge = true;
  const VERSION = '0.5.0';
  const KEY = 'radium-editor-origin';
  const fromQuery = new URLSearchParams(location.search).get('radium-editor');
  try { if (fromQuery && /^https?:$/.test(new URL(fromQuery).protocol)) sessionStorage.setItem(KEY, new URL(fromQuery).origin); } catch { /* unavailable storage */ }
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

  // ---- nodes -------------------------------------------------------------
  let nextNid = 1;
  const byNid = new Map();
  const nidOf = (el) => {
    let nid = el.getAttribute('data-rnid');
    if (!nid) { nid = `n${nextNid++}`; el.setAttribute('data-rnid', nid); }
    byNid.set(nid, el);
    return nid;
  };
  const SKIP = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE']);
  const isBlock = (el) => {
    const d = getComputedStyle(el).display;
    const r = el.getBoundingClientRect();
    return /^(block|flex|grid|inline-block|inline-flex|list-item|table)$/.test(d) && r.width >= 24 && r.height >= 16;
  };
  const pathOf = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.body && parts.length < 6; n = n.parentElement) {
      for (const key of ['data-testid', 'data-k']) { if (n.hasAttribute(key)) return `[${key}="${CSS.escape(n.getAttribute(key))}"]` + (parts.length ? ' > ' + parts.join(' > ') : ''); }
      if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
      const parent = n.parentElement;
      const same = parent ? [...parent.children].filter((c) => c.tagName === n.tagName) : [];
      parts.unshift(same.length > 1 ? `${n.tagName.toLowerCase()}:nth-of-type(${same.indexOf(n) + 1})` : n.tagName.toLowerCase());
    }
    return parts.join(' > ');
  };
  const snippet = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const node = (el) => {
    const nid = nidOf(el);
    const cls = [...el.classList].filter((c) => !c.startsWith('radium')).slice(0, 2);
    const tag = el.tagName.toLowerCase();
    const ridEl = el.closest('[data-rid]');
    const compEl = el.closest('[data-rcomp]');
    const sel = pathOf(el);
    const rid = el.getAttribute('data-rid');
    const peers = rid ? document.querySelectorAll(`[data-rid="${CSS.escape(rid)}"]`) : cls[0] ? document.querySelectorAll(`${tag}.${CSS.escape(cls[0])}`) : [el];
    return {
      nid, tag, rid: ridEl?.getAttribute('data-rid') || undefined, comp: compEl?.getAttribute('data-rcomp') || undefined,
      label: tag + (cls.length ? `.${cls.join('.')}` : ''), text: snippet(el) || undefined,
      childNids: [...el.children].filter((c) => !SKIP.has(c.tagName)).map(nidOf),
      instanceIndex: Math.max(0, [...peers].indexOf(el)), instanceCount: peers.length, selector: sel,
    };
  };
  const hit = (x, y, mode) => {
    let el = document.elementFromPoint(x, y);
    if (!el || SKIP.has(el.tagName)) return null;
    if (mode !== 'exact') { while (el.parentElement && !SKIP.has(el.parentElement.tagName) && !isBlock(el)) el = el.parentElement; }
    return SKIP.has(el.tagName) ? null : el;
  };

  // ---- rect.watch ----------------------------------------------------------
  let watched = []; let watchTarget = null; let raf = 0;
  const pushRects = () => {
    raf = 0;
    if (!watchTarget || !watched.length) return;
    const rects = {};
    for (const nid of watched) {
      const el = byNid.get(nid);
      if (!el || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      rects[nid] = { x: r.left, y: r.top, width: r.width, height: r.height };
    }
    send(watchTarget, { id: id(), type: 'rect.update', payload: { rects } });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(pushRects); };
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);

  const STYLE_PROPS = new Set(['translate','width','height','rotate','scale','z-index','padding','padding-top','padding-right','padding-bottom','padding-left','margin','margin-top','margin-right','margin-bottom','margin-left','gap','display','flex-direction','justify-content','align-items','grid-template-columns','border-radius','border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius','corner-shape','border-width','border-style','border-color','background','background-color','background-image','color','font-size','font-weight','line-height','letter-spacing','text-shadow','box-shadow','backdrop-filter','opacity','order']);
  const overrides = new Map();
  let previewSheet = null;
  const renderPreview = () => {
    if (!previewSheet) { previewSheet = document.createElement('style'); previewSheet.id = 'radium-preview'; document.head.appendChild(previewSheet); }
    previewSheet.textContent = [...overrides].map(([selector, props]) => `${selector}{${Object.entries(props).map(([key,value]) => `${key}:${value} !important;`).join('')}}`).join('\n');
    schedule();
  };
  const selectorsFor = (el, scope) => scope === 'all' && el.hasAttribute('data-rid') ? [`[data-rid="${CSS.escape(el.getAttribute('data-rid'))}"]`] : scope === 'all' ? [...document.querySelectorAll(el.classList[0] ? `${el.tagName.toLowerCase()}.${CSS.escape(el.classList[0])}` : pathOf(el))].map(peer => `[data-rnid="${CSS.escape(nidOf(peer))}"]`) : [`[data-rnid="${CSS.escape(nidOf(el))}"]`];
  const readStyle = el => { const computed = {}, inline = {}; const css = getComputedStyle(el); for (const key of STYLE_PROPS) { computed[key] = css.getPropertyValue(key); inline[key] = el.style.getPropertyValue(key); } return { computed, inline, classList: [...el.classList] }; };
  let domTimer = 0;
  new MutationObserver(records => {
    if (!records.some(r => r.type === 'childList' && r.target !== previewSheet && [...r.addedNodes, ...r.removedNodes].some(n => n !== previewSheet) || r.type === 'attributes' && !['data-rnid'].includes(r.attributeName))) return;
    clearTimeout(domTimer); domTimer = setTimeout(() => { if (watchTarget) send(watchTarget, { id: id(), type: 'dom.changed', payload: { reason: 'mutation' } }); schedule(); }, 150);
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true });

  window.addEventListener('message', (event) => {
    const m = event.data;
    if (!m || m.ns !== 'radium' || m.v !== 1 || typeof m.id !== 'string' || typeof m.type !== 'string' || event.source !== window.parent) return;
    let ok = false; try { ok = allowed(event.origin); } catch { ok = false; }
    if (!ok) return;
    const reply = (payload) => send(event.origin, { id: m.id, type: `${m.type}.ok`, payload });
    const fail = (code, message) => send(event.origin, { id: m.id, type: `${m.type}.err`, payload: { code, message } });
    const p = m.payload || {};
    if (m.type === 'hello') send(event.origin, { id: m.id, type: 'hello.ok', payload: info() });
    else if (m.type === 'nav.go' && typeof p.path === 'string') {
      const target = new URL(p.path, location.href);
      if (target.origin !== location.origin) { fail('bad-path', 'Path must stay on this app.'); return; }
      if (target.pathname + target.search + target.hash !== location.pathname + location.search + location.hash) {
        history.pushState(null, '', target.pathname + target.search + target.hash);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      reply({});
      send(event.origin, { id: id(), type: 'route.changed', payload: { url: location.href } });
    }
    else if (m.type === 'hit.test') {
      const el = hit(Number(p.x), Number(p.y), p.mode);
      reply({ nid: el ? nidOf(el) : null });
    }
    else if (m.type === 'tree.get') {
      const root = p.rootNid ? byNid.get(p.rootNid) : document.body;
      if (!root) { fail('not-found', 'That element is gone.'); return; }
      const depth = Number.isFinite(p.depth) ? Math.max(0, Math.min(20, p.depth)) : 1;
      const nodes = [];
      const walk = (el, d) => { if (nodes.length >= 3000) return; nodes.push(node(el)); if (d > 0) for (const c of el.children) if (!SKIP.has(c.tagName)) walk(c, d - 1); };
      walk(root, depth);
      reply({ nodes });
    }
    else if (m.type === 'rect.watch') {
      watched = Array.isArray(p.nids) ? p.nids.filter((n) => typeof n === 'string') : [];
      watchTarget = event.origin;
      reply({});
      schedule();
    }
    else if (m.type === 'style.get') {
      const el = byNid.get(p.nid); if (!el?.isConnected) { fail('not-found', 'That item is no longer on the page.'); return; }
      reply(readStyle(el));
    }
    else if (m.type === 'preview.style') {
      const el = byNid.get(p.nid); if (!el?.isConnected) { fail('not-found', 'That item is no longer on the page.'); return; }
      if (!['instance','all'].includes(p.scope) || !p.props || typeof p.props !== 'object' || Array.isArray(p.props)) { fail('invalid', 'Invalid style change.'); return; }
      const entries = Object.entries(p.props);
      if (!entries.length || entries.some(([key,value]) => !STYLE_PROPS.has(key) || typeof value !== 'string' || value.length > 1000 || /[{};<>]|url\s*\(|expression\s*\(|@import/i.test(value))) { fail('invalid', 'That style value is not allowed.'); return; }
      for (const selector of selectorsFor(el, p.scope)) overrides.set(selector, { ...overrides.get(selector), ...p.props });
      renderPreview(); reply({});
    }
    else if (m.type === 'preview.clear') {
      if (p.nid) { const el = byNid.get(p.nid); if (!el) { fail('not-found', 'That item is gone.'); return; } for (const sel of [...selectorsFor(el, 'instance'), ...selectorsFor(el, 'all')]) overrides.delete(sel); }
      else overrides.clear();
      renderPreview(); reply({});
    }
    else if (m.type === 'tokens.get') {
      const vars = {}; const css = getComputedStyle(document.documentElement);
      for (const key of css) if (key.startsWith('--')) vars[key] = css.getPropertyValue(key).trim();
      reply({ vars });
    }
    else fail('unsupported', 'This command is not supported by this bridge.');
  });
  const announce = () => send('*', { id: id(), type: 'ready', payload: info() });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announce); else announce();
})();
