import { SHADCN_ASSETS, assetLabel, lucideAsset, searchAssets } from './catalog';
import { countNodes, snapshotElement, svgToTree } from './snapshot';
import { insertZone } from '../canvas/FrameOverlay';

const SOURCES = import.meta.glob('../../asset-stage/ui/*.tsx');

test('every listed shadcn/ui component has its source vendored and an install command', () => {
  for (const asset of SHADCN_ASSETS) {
    const file = asset.id.split(':')[1];
    expect(SOURCES[`../../asset-stage/ui/${file}.tsx`], asset.id).toBeTypeOf('function');
    expect(asset.install).toBe(`npx shadcn@latest add ${file}`);
    expect(asset.importLine).toContain(`@/components/ui/${file}`);
  }
});

test('search matches names, categories and keywords, ignoring case', () => {
  expect(searchAssets(SHADCN_ASSETS, 'MODAL').map(a => a.name)).toEqual(['Dialog']);
  expect(searchAssets(SHADCN_ASSETS, 'forms').length).toBeGreaterThan(5);
  expect(searchAssets(SHADCN_ASSETS, '  ')).toHaveLength(SHADCN_ASSETS.length);
});

test('Lucide entries import from lucide-react and read well in task titles', () => {
  const bell = lucideAsset('BellRing');
  expect(bell).toMatchObject({ id: 'lucide:BellRing', importLine: 'import { BellRing } from "lucide-react"', usage: '<BellRing className="size-4" />' });
  expect(assetLabel(bell)).toBe('Lucide BellRing icon');
  expect(assetLabel(SHADCN_ASSETS[0])).toBe('shadcn/ui Button');
});

test('icons keep their attributes, so currentColor still follows the app’s text colour', () => {
  const holder = document.createElement('div');
  holder.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="x()"><path d="M1 1h4"/><foreignObject></foreignObject></svg>';
  const tree = svgToTree(holder.firstElementChild!)!;
  expect(tree.t).toBe('svg');
  expect(tree.a).toMatchObject({ viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' });
  expect(tree.a).not.toHaveProperty('onclick');
  expect(tree.c).toEqual([{ t: 'path', a: { d: 'M1 1h4' } }]);
});

test('a component snapshot keeps its text and allowed attributes and leaves out hidden or unknown elements', () => {
  const root = document.createElement('div');
  root.innerHTML = '<button type="button" aria-label="Save" onclick="steal()">  Save   now </button><span style="display:none">gone</span><img src="x.png"><script>bad()</script>';
  document.body.appendChild(root);
  const tree = snapshotElement(root)!;
  expect(tree.t).toBe('div');
  const button = tree.c?.[0] as { t: string; a: Record<string, string>; c: string[] };
  expect(button).toMatchObject({ t: 'button', a: { type: 'button', 'aria-label': 'Save' }, c: [' Save now '] });
  expect(button.a).not.toHaveProperty('onclick');
  expect(countNodes(tree)).toBe(2);
  root.remove();
});

test('pointer near the top or bottom edge inserts before or after; the middle inserts inside', () => {
  const rect = { x: 0, y: 100, width: 200, height: 100 };
  expect(insertZone(rect, 110)).toBe('before');
  expect(insertZone(rect, 150)).toBe('append');
  expect(insertZone(rect, 190)).toBe('after');
});
