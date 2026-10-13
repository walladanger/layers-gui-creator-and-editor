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
