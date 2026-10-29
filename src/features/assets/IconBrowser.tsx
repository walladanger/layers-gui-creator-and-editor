// Loaded on demand: importing every Lucide icon is large, so the studio's main bundle stays small.
import { useMemo, useRef, useState } from 'react';
import { icons } from 'lucide-react';
import { SquarePlus } from 'lucide-react';
import { assetInsertService } from '../../services/assetInsertService';
import { lucideAsset } from './catalog';
import { svgToTree } from './snapshot';
import { AssetCode } from './AssetsWindow';

const NAMES = Object.keys(icons);
const PAGE = 240;
const words = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

export function iconUsage(name: string, size: number, stroke: number, color: string | null) {
  return `<${name} size={${size}}${stroke !== 2 ? ` strokeWidth={${stroke}}` : ''}${color ? ` color="${color}"` : ''} />`;
}

export default function IconBrowser({ query }: { query: string }) {
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? NAMES.filter((n) => n.toLowerCase().includes(q.replace(/\s+/g, '')) || words(n).includes(q)) : NAMES), [q]);
  const [shown, setShown] = useState(PAGE);
  const [name, setName] = useState('Rocket');
  const [size, setSize] = useState(24);
  const [stroke, setStroke] = useState(2);
  const [useTextColour, setUseTextColour] = useState(true);
  const [color, setColor] = useState('#2563eb');
  const preview = useRef<HTMLSpanElement>(null);
  const Icon = icons[name as keyof typeof icons] ?? icons.Rocket;
  const asset = lucideAsset(name);
  const usage = iconUsage(name, size, stroke, useTextColour ? null : color);

  const insert = () => {
    const svg = preview.current?.querySelector('svg');
    const tree = svg ? svgToTree(svg) : null;
    if (tree) assetInsertService.arm(asset, tree, usage);
  };

  return <div className="assets-browser assets-browser--icons">
    <div className="assets-icons">
      <ul className="assets-icon-grid" aria-label="Icons">
        {matches.slice(0, shown).map((n) => {
          const I = icons[n as keyof typeof icons];
          return <li key={n}><button type="button" title={n} aria-label={n} aria-current={n === name} onClick={() => setName(n)}><I size={18} aria-hidden="true" /></button></li>;
        })}
      </ul>
      {!matches.length && <p className="assets-empty">No icons match.</p>}
      {matches.length > shown && <button type="button" className="assets-chip assets-more" onClick={() => setShown((s) => s + PAGE)}>Show more ({matches.length - shown} left)</button>}
    </div>
    <section className="assets-detail" aria-label={`${name} icon`}>
      <header className="assets-detail__head">
        <div><h3>{name}</h3><p>Lucide icon · {matches.length} match{matches.length === 1 ? '' : 'es'}</p></div>
        <div className="assets-detail__actions">
          <button type="button" className="assets-primary" onClick={insert}><SquarePlus size={14} /> Insert into app</button>
        </div>
      </header>
      <div className="assets-icon-preview">
        <span ref={preview} style={{ color: useTextColour ? undefined : color }}><Icon size={size} strokeWidth={stroke} {...(useTextColour ? {} : { color })} aria-hidden="true" /></span>
      </div>
      <div className="assets-icon-controls">
        <label>Size <input type="range" min={12} max={96} value={size} onChange={(e) => setSize(Number(e.target.value))} /> <output>{size}px</output></label>
        <label>Stroke <input type="range" min={0.5} max={3} step={0.25} value={stroke} onChange={(e) => setStroke(Number(e.target.value))} /> <output>{stroke}</output></label>
        <label><input type="checkbox" checked={useTextColour} onChange={(e) => setUseTextColour(e.target.checked)} /> Use the app’s text colour</label>
        {!useTextColour && <label>Colour <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>}
      </div>
      <AssetCode asset={asset} usage={usage} />
    </section>
  </div>;
}
