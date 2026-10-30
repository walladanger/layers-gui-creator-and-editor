import { Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, ClipboardCopy, Moon, Search, SquarePlus, Sun, X } from 'lucide-react';
import { assetInsertService } from '../../services/assetInsertService';
import { searchAssets, type AssetEntry } from './catalog';
import { COMPONENT_CATALOG, previewableCount } from './officialCatalog';
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
  const list = searchAssets(COMPONENT_CATALOG, query);
  const [id, setId] = useState('shadcn:accordion');
  const [dark, setDark] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const asset = COMPONENT_CATALOG.find((a) => a.id === id) ?? COMPONENT_CATALOG[0];
  const previewAvailable = asset.previewAvailable !== false;
  const sendTheme = () => frame.current?.contentWindow?.postMessage({ type: 'asset-stage.theme', dark }, window.location.origin);
  useEffect(sendTheme, [dark]); // eslint-disable-line react-hooks/exhaustive-deps

  const insert = () => {
    setError('');
    if (!previewAvailable) return;
    const root = frame.current?.contentDocument?.querySelector('[data-asset-root]')?.firstElementChild;
    const tree = root ? snapshotElement(root) : null;
    if (!tree) { setError('The preview is still loading. Try again in a moment.'); return; }
    assetInsertService.arm(asset, tree);
  };

  return <div className="assets-browser">
    <ul className="assets-list" aria-label="Components">
      {list.map((a) => <li key={a.id}>
        <button type="button" aria-current={a.id === asset.id} onClick={() => { setId(a.id); setError(''); }}>
          <span>{a.name}</span><small>{a.previewAvailable === false ? 'Docs' : a.category}</small>
        </button>
      </li>)}
      {!list.length && <li className="assets-empty">No components match.</li>}
    </ul>
    <section className="assets-detail" aria-label={asset.name}>
      <header className="assets-detail__head">
        <div><h3>{asset.name}</h3><p>{asset.description}</p></div>
        <div className="assets-detail__actions">
          {previewAvailable && <button type="button" className="assets-chip" aria-pressed={dark} aria-label={dark ? 'Light preview' : 'Dark preview'} onClick={() => setDark((d) => !d)}>{dark ? <Sun size={12} /> : <Moon size={12} />}</button>}
          {previewAvailable && <button type="button" className="assets-chip" aria-pressed={showCode} onClick={() => setShowCode((v) => !v)}>Code</button>}
          <button type="button" className="assets-primary" disabled={!previewAvailable} title={previewAvailable ? undefined : 'This component does not yet have a local preview'} onClick={insert}><SquarePlus size={14} /> Insert into app</button>
        </div>
      </header>
      {error && <p className="assets-error" role="alert">{error}</p>}
      {previewAvailable ? <>
        <div className="assets-showcase">
          <div className="assets-showcase__head">
            <strong>Live preview</strong>
            <span>Try the component below</span>
          </div>
          <iframe ref={frame} className="assets-stage" title={`${asset.name} live preview`} src={`${STAGE_URL}?theme=dark#${encodeURIComponent(asset.id)}`} onLoad={sendTheme} />
        </div>
        <section className="assets-example" aria-label="Example code">
          <header className="assets-example__head">
            <h4>Example code</h4>
            <CopyButton text={asset.usage} label="Copy example" />
          </header>
          <pre><code>{asset.usage}</code></pre>
        </section>
        {showCode && <AssetCode asset={asset} source={sourceLoader(asset)} />}
      </> : <div className="assets-unavailable">
        <strong>Official shadcn/ui component</strong>
        <p>{asset.name} is listed in the official library, but is not yet bundled as a live, insertable preview in Layers.</p>
        {asset.docsUrl && <a href={asset.docsUrl} target="_blank" rel="noopener noreferrer">View {asset.name} documentation</a>}
      </div>}
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
      <span className="assets-coverage" title="Interactive local previews / official catalog">{previewableCount} / {COMPONENT_CATALOG.length} live</span>
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
