import { OriginalMenuService } from './originalMenuService';

function fixture() {
  const doc = document.implementation.createHTMLDocument('Original controls');
  doc.body.innerHTML = `<div id="panel"><details class="lab-sec" data-psec="looks"><summary><span>Saved looks</span></summary><div class="lab-body"><input id="lookName"><div class="presets"><button data-preset="Soft">Soft</button></div></div></details><details class="lab-sec" data-psec="greens"><summary><span>Status greens</span><button data-greset="greens">Reset</button></summary><div class="lab-body"><label for="green">Green</label><input id="green" type="color" value="#3ddc97"></div></details></div><div id="ed"><div id="ed-motion"><details class="fx" data-fxsec="chase"><summary><span class="fx-name">Edge chase</span><button data-ed="fx-play">Play</button></summary><div class="fx-body"><button data-ed="fx-target">Cards</button></div></details></div></div>`;
  return doc;
}

test('Status greens and motion are separate sections with their original actions', () => {
  const service = new OriginalMenuService();
  service.attach('demo', fixture());
  const sections = service.getSnapshot().sections;
  expect(sections.find(s => s.id === 'greens')?.actions[0].children?.[0].text).toBe('Reset');
  expect(sections.find(s => s.id === 'fx-chase')?.controls[0].children?.[0].text).toBe('Cards');
  service.detach('demo');
});

test('presets delegate to the existing original action, never a sample preview', () => {
  const service = new OriginalMenuService();
  const doc = fixture();
  // Use a document with its own window for delegated browser events.
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const target = iframe.contentDocument;
  if (!target) throw new Error('Missing test frame');
  target.body.innerHTML = doc.body.innerHTML;
  let applied = '';
  target.querySelector<HTMLButtonElement>('[data-preset]')?.addEventListener('click', () => { applied = 'Soft'; });
  service.attach('demo', target);
  const preset = service.getSnapshot().sections.find(s => s.id === 'presets')?.controls[0];
  if (!preset) throw new Error('Missing original preset');
  service.activate(preset.key);
  expect(applied).toBe('Soft');
  service.detach('demo');
  iframe.remove();
});
test('the original confirm box is mirrored and answered through its own buttons', async () => {
  const service = new OriginalMenuService();
  const doc = fixture();
  const layer = doc.createElement('div'); layer.id = 'layer';
  layer.innerHTML = '<div class="dialog"><h3>Delete “A”?</h3><p>Only the look.</p><button id="dlg-cancel">Cancel</button><button id="dlg-ok" class="danger">Delete</button></div>';
  doc.body.appendChild(layer);
  let ok = false;
  doc.getElementById('dlg-ok')?.addEventListener('click', () => { ok = true; });
  service.attach('demo', doc);
  expect(service.getSnapshot().dialog).toEqual({ title: 'Delete “A”?', text: 'Only the look.', ok: 'Delete', danger: true });
  service.answerDialog(true);
  expect(ok).toBe(true);
  service.detach('demo');
});

test('Comment composer and reply controls are mirrored outside the scaled frame', () => {
  const service = new OriginalMenuService();
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) throw new Error('Missing test frame');
  doc.body.innerHTML = fixture().body.innerHTML;
  doc.getElementById('ed')?.insertAdjacentHTML('beforeend', '<div id="ed-pop" aria-label="New comment"><textarea id="ed-text" aria-label="Comment"></textarea><button data-ed="save-note">Comment</button></div>');
  let saved = '';
  doc.getElementById('ed-text')?.addEventListener('input', event => { saved = (event.target as HTMLTextAreaElement).value; });
  service.attach('demo', doc);
  const composer = service.getSnapshot().commentBox;
  expect(composer?.label).toBe('New comment');
  const input = composer?.controls.find(c => c.tag === 'textarea');
  if (!input) throw new Error('Missing comment input');
  service.activate(input.key, 'Make this larger');
  expect(saved).toBe('Make this larger');
  expect(doc.getElementById('layers-demo-chrome')?.textContent).toContain('#ed-pop');
  service.detach('demo');
  iframe.remove();
});

test('original comment export copies through the host clipboard and restores the frame navigator', async () => {
  const service = new OriginalMenuService();
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const view = iframe.contentWindow;
  if (!doc || !view) throw new Error('Missing test frame');
  doc.body.innerHTML = fixture().body.innerHTML;
  doc.getElementById('ed')?.insertAdjacentHTML('beforeend', '<div id="ed-drawer"><button data-ed="copy-brief">Copy for Claude</button></div>');
  const hostCopy = vi.fn().mockResolvedValue(undefined);
  const oldHost = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const oldFrame = view.navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: hostCopy } });
  doc.querySelector('[data-ed="copy-brief"]')?.addEventListener('click', () => { void view.navigator.clipboard.writeText('Comment: Make larger\nReply: Agreed'); });
  service.attach('demo', doc);
  const action = service.getSnapshot().sections.find(s => s.id === 'notes')?.controls[0];
  if (!action) throw new Error('Missing copy action');
  service.activate(action.key);
  expect(hostCopy).toHaveBeenCalledWith('Comment: Make larger\nReply: Agreed');
  expect(view.navigator.clipboard).toBe(oldFrame);
  service.detach('demo');
  iframe.remove();
  if (oldHost) Object.defineProperty(navigator, 'clipboard', oldHost);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

test('continuous overlay mutations do not postpone the comment box indefinitely', async () => {
  vi.useFakeTimers();
  const service = new OriginalMenuService();
  const doc = fixture();
  service.attach('demo', doc);
  const ed = doc.getElementById('ed');
  if (!ed) throw new Error('Missing editor layer');
  ed.insertAdjacentHTML('beforeend', '<div id="ed-pop" aria-label="New comment"><textarea aria-label="Comment"></textarea></div>');
  for (let i = 0; i < 8; i++) {
    ed.setAttribute('data-tick', String(i));
    await vi.advanceTimersByTimeAsync(16);
  }
  expect(service.getSnapshot().commentBox?.label).toBe('New comment');
  service.detach('demo');
  vi.clearAllTimers();
  vi.useRealTimers();
});

function historyFixture() {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const view = iframe.contentWindow;
  if (!doc || !view) throw new Error('Missing history frame');
  doc.body.innerHTML = fixture().body.innerHTML;
  doc.querySelector('[data-psec="greens"] .lab-body')?.insertAdjacentHTML('beforeend', '<input data-knob="radius" aria-label="Radius" type="range" min="0" max="40" value="10">');
  let state = { radius: 10, green: '#3ddc97' };
  const save = () => { view.localStorage.setItem('panel-lab:style', JSON.stringify(state)); doc.documentElement.style.setProperty('--radius', `${state.radius}px`); };
  save();
  doc.querySelector('[data-preset]')?.addEventListener('click', () => { state = { radius: 18, green: '#aaeecc' }; save(); });
  doc.getElementById('green')?.setAttribute('data-knob', 'green');
  doc.getElementById('panel')?.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.knob === 'radius') state.radius = Number(input.value);
    if (input.dataset.knob === 'green') state.green = input.value;
    save();
  });
  const service = new OriginalMenuService();
  service.attach('test-history', doc);
  const control = (selector: string) => {
    const key = doc.querySelector<HTMLElement>(selector)?.dataset.layersControl;
    if (!key) throw new Error(`Missing control: ${selector}`);
    return key;
  };
  return { service, doc, view, control, read: () => JSON.parse(view.localStorage.getItem('panel-lab:style') ?? '{}'), cleanup: () => { service.detach('test-history'); iframe.remove(); } };
}

test('preset undo and redo restore both saved values and rendered styles', () => {
  const f = historyFixture();
  expect(f.service.getSnapshot().canUndo).toBe(false);
  f.service.activate(f.control('[data-preset]'));
  expect(f.read()).toEqual({ radius: 18, green: '#aaeecc' });
  f.service.undo();
  expect(f.read()).toEqual({ radius: 10, green: '#3ddc97' });
  expect(f.doc.documentElement.style.getPropertyValue('--radius')).toBe('10px');
  expect(f.service.getSnapshot().canRedo).toBe(true);
  f.service.redo();
  expect(f.read()).toEqual({ radius: 18, green: '#aaeecc' });
  expect(f.doc.documentElement.style.getPropertyValue('--radius')).toBe('18px');
  f.cleanup();
});

test('continuous slider changes form one step and a new colour edit clears redo', () => {
  const f = historyFixture();
  f.service.activate(f.control('[data-knob="radius"]'), '20');
  f.service.activate(f.control('[data-knob="radius"]'), '30');
  f.service.undo();
  expect(f.read().radius).toBe(10);
  expect(f.service.getSnapshot().canUndo).toBe(false);
  f.service.redo();
  expect(f.read().radius).toBe(30);
  f.service.undo();
  f.service.activate(f.control('[data-knob="green"]'), '#ff0000');
  expect(f.service.getSnapshot().canRedo).toBe(false);
  f.service.redo();
  expect(f.read()).toEqual({ radius: 10, green: '#ff0000' });
  f.cleanup();
});

test('frame history is isolated and removed when a frame detaches', () => {
  const f = historyFixture();
  f.service.activate(f.control('[data-preset]'));
  f.service.detach('test-history');
  f.service.attach('test-history', f.doc);
  expect(f.service.getSnapshot().canUndo).toBe(false);
  expect(f.service.getSnapshot().canRedo).toBe(false);
  f.cleanup();
});
