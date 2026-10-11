import { useMemo, useState } from 'react';
import { FolderOpen, Github, LayoutTemplate, Search } from 'lucide-react';
import {
  createGitHubSource, createMemorySource, demoSourceFiles, pickLocalSource, scanProject, supportsLocalFolders,
  type ProjectSourceAdapter, type ScreenEntry, type ScreenKind,
} from '../../services/projectSource';
import { openScreen } from './catalogBus';
import './screenCatalog.css';

const kindLabel: Record<ScreenKind, string> = { page: 'Page', panel: 'Panel', view: 'View', component: 'Component', html: 'HTML page' };

/** Drawn preview of the screen's shape; replaced by a real snapshot once the screen has been opened. */
export function ScreenThumb({ kind }: { kind: ScreenKind }) {
  return (
    <div className="screen-thumb" data-kind={kind} aria-hidden="true">
      <span className="screen-thumb__bar" />
      <span className="screen-thumb__side" />
      <span className="screen-thumb__block" />
      <span className="screen-thumb__block screen-thumb__block--b" />
    </div>
  );
}

export interface ScreenCatalogProps { initialSource?: ProjectSourceAdapter }

export function ScreenCatalogWindow({ initialSource }: ScreenCatalogProps = {}) {
  const [source, setSource] = useState<string | null>(null);
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [repo, setRepo] = useState('');
  const [query, setQuery] = useState('');

  const run = async (adapter: ProjectSourceAdapter | null) => {
    if (!adapter) return;
    setStatus('scanning'); setError(''); setSource(adapter.label);
    try {
      const result = await scanProject(adapter);
      setScreens(result.screens); setFileCount(result.paths.length); setStatus('done');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus('error'); }
  };
  const guard = (fn: () => Promise<ProjectSourceAdapter | null> | ProjectSourceAdapter | null) => async () => {
    try { await run(await fn()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus('error'); }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? screens.filter((s) => `${s.name} ${s.filePath}`.toLowerCase().includes(q)) : screens;
  }, [screens, query]);

  return (
    <div className="screen-catalog">
      <div className="screen-catalog__sources">
        <button type="button" onClick={guard(pickLocalSource)} disabled={!supportsLocalFolders()}
          title={supportsLocalFolders() ? 'Open a project folder on this computer' : 'Needs Chrome, Edge or the desktop app'}>
          <FolderOpen aria-hidden="true" size={14} /> Open folder
        </button>
        <form onSubmit={(e) => { e.preventDefault(); void guard(() => createGitHubSource(repo))(); }}>
          <Github aria-hidden="true" size={14} />
          <input aria-label="GitHub repository" placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
          <button type="submit" disabled={!repo.trim()}>Scan</button>
        </form>
        <button type="button" onClick={guard(() => initialSource ?? createMemorySource('Demo', demoSourceFiles))}>
          <LayoutTemplate aria-hidden="true" size={14} /> Demo
        </button>
      </div>

      {status === 'idle' ? <p className="screen-catalog__note">Open a project folder or a GitHub repo to list its screens.</p> : null}
      {status === 'scanning' ? <p className="screen-catalog__note" role="status">Scanning {source}…</p> : null}
      {status === 'error' ? <p className="screen-catalog__note screen-catalog__note--error" role="alert">{error}</p> : null}
      {status === 'done' ? (
        <>
          <div className="screen-catalog__head">
            <span>{source}: {screens.length} screens in {fileCount} files</span>
            <label><Search aria-hidden="true" size={14} /><input aria-label="Filter screens" placeholder="Filter" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          </div>
          <ul className="screen-catalog__grid" aria-label="Screens">
            {shown.map((s) => (
              <li key={s.id}>
                <button type="button" className="screen-card" onClick={() => openScreen(s)} aria-label={`Open ${s.name}`}>
                  <ScreenThumb kind={s.kind} />
                  <span className="screen-card__name">{s.name}</span>
                  <span className="screen-card__path" title={s.filePath}>{s.filePath}</span>
                  <span className="screen-card__meta">{kindLabel[s.kind]}{s.route ? ` · ${s.route}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
