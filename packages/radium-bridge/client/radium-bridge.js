// Radium bridge (protocol radium v1, docs/production-plan.md §4).
// Runs inside the app being edited. Preview-only: it never writes source files, and nothing it
// changes survives a reload of the app. Served by the studio at /radium-bridge.js and by the
// radium-bridge Vite plugin at /@radium/radium-bridge.js.
(() => {
  if (window.__radiumBridge || window.parent === window) return;
  window.__radiumBridge = true;
  const VERSION = '0.6.0';
  const COMMANDS = ['hello', 'tree.get', 'node.find', 'node.reveal', 'hit.test', 'rect.watch', 'style.get', 'preview.style', 'preview.text', 'preview.hide', 'preview.order', 'preview.clear', 'state.force', 'screenshot', 'scroll.by', 'tokens.get', 'nav.go'];
  const KEY = 'radium-editor-origin';
  // Helpers such as the screenshot library are loaded from wherever this script came from.
  const scriptBase = (() => { try { return document.currentScript?.src ? new URL('.', document.currentScript.src).href : null; } catch { return null; } })();
  const storage = { get() { try { return sessionStorage.getItem(KEY); } catch { return null; } }, set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* unavailable storage */ } } };
  const fromQuery = new URLSearchParams(location.search).get('radium-editor');
  try { if (fromQuery && /^https?:$/.test(new URL(fromQuery).protocol)) storage.set(new URL(fromQuery).origin); } catch { /* bad origin */ }
  const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[\w-]+\.localhost)(:\d+)?$/;
  const allowed = (origin) => LOCAL.test(origin)
    || origin === 'tauri://localhost'
    || /\.lovable\.app$/.test(new URL(origin).hostname)
    || origin === location.origin
    || origin === storage.get();
  const info = () => ({
    bridgeVersion: VERSION, url: location.href, title: document.title,
    framework: window.React || document.querySelector('[data-reactroot],#root') ? 'react' : 'unknown',
    hasSourceMap: !!document.querySelector('[data-rid]'), commands: COMMANDS,
  });
  const send = (target, msg) => window.parent.postMessage({ ns: 'radium', v: 1, ...msg }, target);
  const id = () => Math.random().toString(36).slice(2);
  let editor = null; // origin of the studio that last talked to this app; events go there

  // ---- nodes -------------------------------------------------------------
  let nextNid = 1;
  const byNid = new Map();
  const nidOf = (el) => {
    let nid = el.getAttribute('data-rnid');
    if (!nid) { nid = `n${nextNid++}`; el.setAttribute('data-rnid', nid); }
    byNid.set(nid, el);
    return nid;
  };
  const SKIP = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
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
  const peersOf = (el) => {
    const rid = el.getAttribute('data-rid');
    const cls = [...el.classList].filter((c) => !c.startsWith('radium'));
    return rid ? document.querySelectorAll(`[data-rid="${CSS.escape(rid)}"]`) : cls[0] ? document.querySelectorAll(`${el.tagName.toLowerCase()}.${CSS.escape(cls[0])}`) : [el];
  };
  const node = (el) => {
    const nid = nidOf(el);
    const cls = [...el.classList].filter((c) => !c.startsWith('radium')).slice(0, 2);
    const tag = el.tagName.toLowerCase();
    const ridEl = el.closest('[data-rid]');
    const compEl = el.closest('[data-rcomp]');
    const peers = [...peersOf(el)];
    return {
      nid, tag, rid: ridEl?.getAttribute('data-rid') || undefined, comp: compEl?.getAttribute('data-rcomp') || undefined,
      label: tag + (cls.length ? `.${cls.join('.')}` : ''), text: snippet(el) || undefined,
      childNids: [...el.children].filter((c) => !SKIP.has(c.tagName)).map(nidOf),
      instanceIndex: Math.max(0, peers.indexOf(el)), instanceCount: peers.length, selector: pathOf(el),
    };
  };
  const hit = (x, y, mode) => {
    let el = document.elementFromPoint(x, y);
    if (!el || SKIP.has(el.tagName)) return null;
    if (mode !== 'exact') { while (el.parentElement && !SKIP.has(el.parentElement.tagName) && !isBlock(el)) el = el.parentElement; }
    return SKIP.has(el.tagName) ? null : el;
  };
  /**
   * Finds an element again after a reload or re-render. With an instance index, the source id is
   * tried first (it survives reloads); without one, the selector is (it names the exact instance).
   */
  const findNode = ({ rid, instanceIndex, selector }) => {
    const byRid = () => {
      if (typeof rid !== 'string' || !rid) return null;
      const all = document.querySelectorAll(`[data-rid="${CSS.escape(rid)}"]`);
      return all[Number(instanceIndex) || 0] ?? (all.length === 1 ? all[0] : null);
    };
    const bySelector = () => { if (typeof selector !== 'string' || !selector) return null; try { return document.querySelector(selector); } catch { return null; } };
    return Number.isInteger(instanceIndex) ? byRid() ?? bySelector() : bySelector() ?? byRid();
  };
  /** Scrolls an element into view and outlines it briefly, without touching its styles. */
  const reveal = (el) => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const box = document.createElement('div');
    box.setAttribute('data-radium-reveal', '');
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:3px solid #ff3d7f;border-radius:4px;box-shadow:0 0 0 4px rgb(255 61 127 / .25);transition:opacity .4s';
    document.documentElement.appendChild(box);
    const end = performance.now() + 2400;
    const follow = () => {
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
      if (performance.now() < end) requestAnimationFrame(follow); else { box.style.opacity = '0'; setTimeout(() => box.remove(), 450); }
    };
    follow();
  };

  // ---- rect.watch ----------------------------------------------------------
  let watched = []; let watchTarget = null; let raf = 0;
  const pushRects = () => {
    raf = 0;
    if (!watchTarget || !watched.length) return;
    // Built from entries, never by writing editor-supplied names onto an object.
    const rects = Object.fromEntries(watched.flatMap((nid) => {
      const el = byNid.get(nid);
      if (!el || !el.isConnected) return [];
      const r = el.getBoundingClientRect();
      return [[nid, { x: r.left, y: r.top, width: r.width, height: r.height }]];
    }));
    send(watchTarget, { id: id(), type: 'rect.update', payload: { rects } });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(pushRects); };
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);

  // ---- previews ------------------------------------------------------------
  const STYLE_PROPS = new Set(['translate','width','height','rotate','scale','z-index','padding','padding-top','padding-right','padding-bottom','padding-left','margin','margin-top','margin-right','margin-bottom','margin-left','gap','display','flex-direction','justify-content','align-items','grid-template-columns','border-radius','border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius','corner-shape','border-width','border-style','border-color','background','background-color','background-image','color','font-size','font-weight','line-height','letter-spacing','text-shadow','box-shadow','backdrop-filter','opacity','order']);
  const overrides = new Map(); // selector -> props from preview.style
  const hidden = new Set();    // nids hidden by preview.hide
  const orders = new Map();    // parent nid -> ordered child nids
  const texts = new Map();     // nid -> original text, for preview.text
  let previewSheet = null;
  const rule = (selector, props) => `${selector}{${Object.entries(props).map(([key, value]) => `${key}:${value} !important;`).join('')}}`;
  const renderPreview = () => {
    if (!previewSheet || !previewSheet.isConnected) { previewSheet = document.createElement('style'); previewSheet.id = 'radium-preview'; document.head.appendChild(previewSheet); }
    const css = [...overrides].map(([selector, props]) => rule(selector, props));
    for (const nid of hidden) css.push(rule(`[data-rnid="${CSS.escape(nid)}"]`, { display: 'none' }));
    for (const [parent, kids] of orders) {
      const el = byNid.get(parent);
      const flex = el && /flex|grid/.test(getComputedStyle(el).display);
      if (!flex) css.push(rule(`[data-rnid="${CSS.escape(parent)}"]`, { display: 'flex', 'flex-direction': 'column' }));
      kids.forEach((kid, i) => css.push(rule(`[data-rnid="${CSS.escape(kid)}"]`, { order: String(i) })));
    }
    previewSheet.textContent = css.join('\n');
    schedule();
  };
  const selectorsFor = (el, scope) => scope === 'all' && el.hasAttribute('data-rid') ? [`[data-rid="${CSS.escape(el.getAttribute('data-rid'))}"]`] : scope === 'all' ? [...document.querySelectorAll(el.classList[0] ? `${el.tagName.toLowerCase()}.${CSS.escape(el.classList[0])}` : pathOf(el))].map(peer => `[data-rnid="${CSS.escape(nidOf(peer))}"]`) : [`[data-rnid="${CSS.escape(nidOf(el))}"]`];
  const readStyle = el => { const computed = {}, inline = {}; const css = getComputedStyle(el); for (const key of STYLE_PROPS) { computed[key] = css.getPropertyValue(key); inline[key] = el.style.getPropertyValue(key); } return { computed, inline, classList: [...el.classList] }; };
  const restoreText = (nid) => { const el = byNid.get(nid); if (el && texts.has(nid)) el.textContent = texts.get(nid); texts.delete(nid); };

  // ---- forced states (hover, focus, active, disabled) ------------------------
  // Pseudo-classes cannot be switched on from script, so readable rules are copied with the
  // pseudo-class swapped for an attribute the bridge can set.
  const STATES = ['hover', 'focus', 'active', 'disabled'];
  let stateSheet = null;
  const buildStateSheet = () => {
    if (stateSheet?.isConnected) return;
    const out = [];
    const walk = (rules) => { for (const r of rules) {
      if (r.selectorText && STATES.some((s) => r.selectorText.includes(`:${s}`))) {
        const sel = r.selectorText.replace(/:(hover|focus|active|disabled)\b/g, '[data-rstate~="$1"]');
        out.push(`${sel}{${r.style.cssText}}`);
      } else if (r.cssRules) walk(r.cssRules);
    } };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* cross-origin sheet */ } }
    stateSheet = document.createElement('style'); stateSheet.id = 'radium-states'; stateSheet.textContent = out.join('\n');
    document.head.appendChild(stateSheet);
  };

  // ---- screenshots -----------------------------------------------------------
  let shotLib = null;
  const loadShot = () => shotLib ??= new Promise((ok, fail) => {
    if (window.modernScreenshot?.domToCanvas) { ok(window.modernScreenshot); return; }
    const base = scriptBase || (editor ? `${editor}/` : null);
    if (!base) { shotLib = null; fail(new Error('Screenshot helper location is unknown.')); return; }
    const s = document.createElement('script');
    s.src = new URL('radium-screenshot.js', base).href;
    s.onload = () => window.modernScreenshot?.domToCanvas ? ok(window.modernScreenshot) : (shotLib = null, fail(new Error('Screenshot helper did not load.')));
    s.onerror = () => { shotLib = null; fail(new Error('This app blocked the screenshot helper.')); };
    document.head.appendChild(s);
  });
  const toUrl = (canvas, type, quality) => type === 'jpeg' ? canvas.toDataURL('image/jpeg', quality) : canvas.toDataURL('image/png');
  const fit = (src, x, y, w, h, maxW) => {
    const k = Math.min(1, maxW / Math.max(1, w));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
    return c;
  };
  /** One capture of what is visible; the element image is cropped from it so overlapping content looks right. */
  const screenshot = async (p) => {
    const lib = await loadShot();
    const el = p.nid ? byNid.get(p.nid) : null;
    if (p.nid && !el?.isConnected) throw Object.assign(new Error('That item is no longer on the page.'), { code: 'not-found' });
    const vw = document.documentElement.clientWidth || innerWidth; const vh = innerHeight;
    const scale = Math.min(2, Math.max(1, devicePixelRatio || 1), 2400 / Math.max(1, vw));
    const sx = scrollX, sy = scrollY;
    const bg = getComputedStyle(document.body).backgroundColor;
    const canvas = await lib.domToCanvas(document.documentElement, {
      width: vw, height: vh, scale,
      backgroundColor: !bg || bg === 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.documentElement).backgroundColor || '#fff' : bg,
      style: { transform: `translate(${-sx}px, ${-sy}px)`, transformOrigin: '0 0' },
    });
    const type = p.type === 'jpeg' ? 'jpeg' : 'png';
    const quality = Number.isFinite(p.quality) ? Math.max(0.3, Math.min(1, p.quality)) : 0.82;
    const view = fit(canvas, 0, 0, canvas.width, canvas.height, Number(p.maxWidth) || 1280);
    const out = { viewDataUrl: toUrl(view, type, quality), viewport: { width: vw, height: vh } };
    if (!el) return { ...out, dataUrl: out.viewDataUrl };
    const r = el.getBoundingClientRect(); const pad = Math.max(0, Math.min(200, Number(p.padding) || 0));
    const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
    const w = Math.max(1, Math.min(vw, r.right + pad) - x), h = Math.max(1, Math.min(vh, r.bottom + pad) - y);
    const crop = fit(canvas, x * scale, y * scale, w * scale, h * scale, Number(p.maxElementWidth) || 900);
    return { ...out, dataUrl: toUrl(crop, type, quality), rect: { x: r.left, y: r.top, width: r.width, height: r.height } };
  };

  // ---- scrolling for the editor overlay ----------------------------------------
  const scrollerAt = (x, y) => {
    for (let el = document.elementFromPoint(x, y); el && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll|overlay)/.test(cs.overflowY + cs.overflowX) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) return el;
    }
    return document.scrollingElement || document.documentElement;
  };

  // ---- watching the page -------------------------------------------------------
  const emit = (type, payload) => { if (editor) send(editor, { id: id(), type, payload }); };
  let domTimer = 0;
  const domChanged = (reason) => { clearTimeout(domTimer); domTimer = setTimeout(() => { emit('dom.changed', { reason }); schedule(); }, 150); };
  const ours = (n) => n === previewSheet || n === stateSheet || (n.nodeType === 1 && (n.hasAttribute('data-radium-reveal') || (n.tagName === 'SCRIPT' && /radium-screenshot/.test(n.src || ''))));
  new MutationObserver(records => {
    if (records.some(r => r.type === 'childList' && r.target !== previewSheet && r.target !== stateSheet && [...r.addedNodes, ...r.removedNodes].some(n => !ours(n)) || r.type === 'attributes' && !ours(r.target) && !/^data-r(nid|state)$/.test(r.attributeName))) domChanged('mutation');
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
  // The Vite plugin turns hot updates into this event.
  window.addEventListener('radium:hmr', () => domChanged('hmr'));
  let lastUrl = location.href;
  const routeCheck = () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    emit('route.changed', { url: location.href, title: document.title });
    schedule();
  };
  for (const k of ['pushState', 'replaceState']) {
    const original = history[k];
    history[k] = function (...args) { const r = original.apply(this, args); queueMicrotask(routeCheck); return r; };
  }
  window.addEventListener('popstate', routeCheck);
  window.addEventListener('hashchange', routeCheck);

  window.addEventListener('message', async (event) => {
    const m = event.data;
    if (!m || m.ns !== 'radium' || m.v !== 1 || typeof m.id !== 'string' || typeof m.type !== 'string' || event.source !== window.parent) return;
    let ok = false; try { ok = allowed(event.origin); } catch { ok = false; }
    if (!ok) return;
    editor = event.origin;
    const reply = (payload) => send(event.origin, { id: m.id, type: `${m.type}.ok`, payload });
    const fail = (code, message) => send(event.origin, { id: m.id, type: `${m.type}.err`, payload: { code, message } });
    const p = m.payload || {};
    const target = () => { const el = byNid.get(p.nid); if (!el?.isConnected) { fail('not-found', 'That item is no longer on the page.'); return null; } return el; };
    if (m.type === 'hello') reply(info());
    else if (m.type === 'nav.go' && typeof p.path === 'string') {
      const to = new URL(p.path, location.href);
      if (to.origin !== location.origin) { fail('bad-path', 'Path must stay on this app.'); return; }
      if (to.pathname + to.search + to.hash !== location.pathname + location.search + location.hash) {
        history.pushState(null, '', to.pathname + to.search + to.hash);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      reply({});
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
    else if (m.type === 'node.find') {
      const el = findNode(p);
      reply({ node: el ? node(el) : null });
    }
    else if (m.type === 'node.reveal') {
      const el = findNode(p);
      if (!el) { fail('not-found', 'That item is not on this screen.'); return; }
      reveal(el); reply({ node: node(el) });
    }
    else if (m.type === 'rect.watch') {
      // Only ids this bridge hands out (`n1`, `n2`, …) are watched.
      watched = Array.isArray(p.nids) ? p.nids.filter((n) => typeof n === 'string' && /^n\d{1,9}$/.test(n)) : [];
      watchTarget = event.origin;
      reply({});
      schedule();
    }
    else if (m.type === 'style.get') {
      const el = target(); if (el) reply(readStyle(el));
    }
    else if (m.type === 'preview.style') {
      const el = target(); if (!el) return;
      if (!['instance','all'].includes(p.scope) || !p.props || typeof p.props !== 'object' || Array.isArray(p.props)) { fail('invalid', 'Invalid style change.'); return; }
      const entries = Object.entries(p.props);
      if (!entries.length || entries.some(([key,value]) => !STYLE_PROPS.has(key) || typeof value !== 'string' || value.length > 1000 || /[{};<>]|url\s*\(|expression\s*\(|@import/i.test(value))) { fail('invalid', 'That style value is not allowed.'); return; }
      for (const selector of selectorsFor(el, p.scope)) overrides.set(selector, { ...overrides.get(selector), ...p.props });
      renderPreview(); reply({});
    }
    else if (m.type === 'preview.text') {
      const el = target(); if (!el) return;
      if (typeof p.text !== 'string' || p.text.length > 5000) { fail('invalid', 'Text must be under 5,000 characters.'); return; }
      if (el.children.length) { fail('not-text', 'Pick the text itself, not a box around it.'); return; }
      if (!texts.has(p.nid)) texts.set(p.nid, el.textContent);
      el.textContent = p.text; schedule(); reply({});
    }
    else if (m.type === 'preview.hide') {
      if (!target()) return;
      if (p.hidden) hidden.add(p.nid); else hidden.delete(p.nid);
      renderPreview(); reply({});
    }
    else if (m.type === 'preview.order') {
      const parent = byNid.get(p.parentNid);
      if (!parent?.isConnected) { fail('not-found', 'That item is no longer on the page.'); return; }
      const kids = Array.isArray(p.orderedNids) ? p.orderedNids.filter((n) => typeof n === 'string' && byNid.get(n)?.parentElement === parent) : [];
      if (kids.length) orders.set(p.parentNid, kids); else orders.delete(p.parentNid);
      renderPreview(); reply({});
    }
    else if (m.type === 'preview.clear') {
      if (p.nid) {
        const el = byNid.get(p.nid); if (!el) { fail('not-found', 'That item is gone.'); return; }
        for (const sel of [...selectorsFor(el, 'instance'), ...selectorsFor(el, 'all')]) overrides.delete(sel);
        hidden.delete(p.nid); orders.delete(p.nid); restoreText(p.nid);
      } else { overrides.clear(); hidden.clear(); orders.clear(); [...texts.keys()].forEach(restoreText); }
      renderPreview(); reply({});
    }
    else if (m.type === 'state.force') {
      const el = target(); if (!el) return;
      if (p.state !== null && !STATES.includes(p.state)) { fail('invalid', 'Unknown state.'); return; }
      buildStateSheet();
      if (p.state) el.setAttribute('data-rstate', p.state); else el.removeAttribute('data-rstate');
      schedule(); reply({});
    }
    else if (m.type === 'screenshot') {
      try { reply(await screenshot(p)); }
      catch (error) { fail(error?.code || 'screenshot-failed', error?.message || 'Could not take a screenshot.'); }
    }
    else if (m.type === 'scroll.by') {
      const el = scrollerAt(Number(p.x) || 0, Number(p.y) || 0);
      el.scrollBy({ left: Number(p.dx) || 0, top: Number(p.dy) || 0 });
      schedule(); reply({});
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
  window.addEventListener('pageshow', (e) => { if (e.persisted) announce(); });
})();
