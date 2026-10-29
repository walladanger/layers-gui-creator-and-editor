import { Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, ClipboardCopy, Moon, Search, SquarePlus, Sun, X } from 'lucide-react';
import { assetInsertService } from '../../services/assetInsertService';
import { SHADCN_ASSETS, searchAssets, type AssetEntry } from './catalog';
import { snapshotElement } from './snapshot';
import './assets.css';

const IconBrowser = lazy(() => import('./IconBrowser'));
/** Component sources, loaded only when their code is opened. */
const SOURCES = import.meta.glob('../../asset-stage/ui/*.tsx', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const sourceLoader = (asset: AssetEntry) => SOURCES[`../../asset-stage/ui/${asset.id.split(':')[1]}.tsx`];

export const STAGE_URL = '/asset-stage.html';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="assets-chip" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); window.setTimeout(() => setDone(false), 1500); }
    catch { window.prompt('Copy this:', text); }
  }}>{done ? <Check size={12} /> : <ClipboardCopy size={12} />} {done ? 'Copied' : label}</button>;
}

/** Install, import and usage for an asset, each copyable. */
export function AssetCode({ asset, usage = asset.usage, source }: { asset: AssetEntry; usage?: string; source?: () => Promise<string> }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => { setCode(null); }, [asset.id]);
  return <div className="assets-code">
    {asset.install && <div><div className="assets-code__head"><span>Install</span><CopyButton text={asset.install} /></div><pre>{asset.install}</pre></div>}
    <div><div className="assets-code__head"><span>Import</span><CopyButton text={asset.importLine} /></div><pre>{asset.importLine}</pre></div>
    <div><div className="assets-code__head"><span>Use</span><CopyButton text={usage} /></div><pre>{usage}</pre></div>
    {source && (code === null
      ? <button type="button" className="assets-chip" onClick={() => void source().then(setCode)}>Show component source</button>
      : <div><div className="assets-code__head"><span>Component source</span><CopyButton text={code} /></div><pre className="assets-code__source">{code}</pre></div>)}
  </div>;
}

function ComponentBrowser({ query }: { query: string }) {
  const list = searchAssets(SHADCN_ASSETS, query);
  const [id, setId] = useState(SHADCN_ASSETS[0].id);
  const [dark, setDark] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const asset = SHADCN_ASSETS.find((a) => a.id === id) ?? SHADCN_ASSETS[0];
  const sendTheme = () => frame.current?.contentWindow?.postMessage({ type: 'asset-stage.theme', dark }, window.location.origin);
  useEffect(sendTheme, [dark]); // eslint-disable-line react-hooks/exhaustive-deps

  const insert = () => {
    setError('');
    const root = frame.current?.contentDocument?.querySelector('[data-asset-root]')?.firstElementChild;
    const tree = root ? snapshotElement(root) : null;
    if (!tree) { setError('The preview is still loading. Try again in a moment.'); return; }
    assetInsertService.arm(asset, tree);
  };

  return <div className="assets-browser">
    <ul className="assets-list" aria-label="Components">
      {list.map((a) => <li key={a.id}>
        <button type="button" aria-current={a.id === asset.id} onClick={() => { setId(a.id); setError(''); }}>
          <span>{a.name}</span><small>{a.category}</small>
        </button>
      </li>)}
      {!list.length && <li className="assets-empty">No components match.</li>}
    </ul>
    <section className="assets-detail" aria-label={asset.name}>
      <header className="assets-detail__head">
        <div><h3>{asset.name}</h3><p>{asset.description}</p></div>
        <div className="assets-detail__actions">
          <button type="button" className="assets-chip" aria-pressed={dark} aria-label={dark ? 'Light preview' : 'Dark preview'} onClick={() => setDark((d) => !d)}>{dark ? <Sun size={12} /> : <Moon size={12} />}</button>
          <button type="button" className="assets-chip" aria-pressed={showCode} onClick={() => setShowCode((v) => !v)}>Code</button>
          <button type="button" className="assets-primary" onClick={insert}><SquarePlus size={14} /> Insert into app</button>
        </div>
      </header>
      {error && <p className="assets-error" role="alert">{error}</p>}
      <iframe ref={frame} className="assets-stage" title={`${asset.name} live preview`} src={`${STAGE_URL}#${encodeURIComponent(asset.id)}`} onLoad={sendTheme} />
      {showCode && <AssetCode asset={asset} source={sourceLoader(asset)} />}
    </section>
  </div>;
}

/** Browse shadcn/ui components and Lucide icons, try them live, and place them in the connected app. */
export function AssetsWindow() {
  const [tab, setTab] = useState<'components' | 'icons'>('components');
  const [query, setQuery] = useState('');
  const pending = useSyncExternalStore(assetInsertService.subscribe, assetInsertService.getPending);
  return <div className="assets-window" data-window-id="assets">
    <div className="assets-window__head">
      <div className="assets-tabs" role="tablist" aria-label="Libraries">
        <button type="button" role="tab" aria-selected={tab === 'components'} onClick={() => setTab('components')}>Components</button>
        <button type="button" role="tab" aria-selected={tab === 'icons'} onClick={() => setTab('icons')}>Icons</button>
      </div>
      <label className="assets-search"><Search size={13} aria-hidden="true" />
        <input aria-label={`Search ${tab}`} placeholder={tab === 'components' ? 'Search components' : 'Search 1,800+ icons'} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
    </div>
    {pending && <p className="assets-pending" role="status">
      Click where the {pending.asset.name} should go in your app. Top or bottom edge: before or after; middle: inside. Hold Alt for small items.
      <button type="button" className="assets-chip" onClick={() => assetInsertService.cancel()}><X size={12} /> Cancel</button>
    </p>}
    {tab === 'components'
      ? <ComponentBrowser query={query} />
      : <Suspense fallback={<p className="assets-empty">Loading icons…</p>}><IconBrowser query={query} /></Suspense>}
  </div>;
}

export default AssetsWindow;
