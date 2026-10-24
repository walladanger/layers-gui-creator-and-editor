import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FolderOpen, GitBranch as Github, LayoutTemplate, Save, Search } from 'lucide-react';
import {
  createGitHubSource, createMemorySource, demoSourceFiles, pickLocalSource, scanProject, supportsLocalFolders,
  type ProjectSourceAdapter, type ScreenEntry, type ScreenKind,
} from '../../services/projectSource';
import { consumePendingProject, onOpenProjectScreens, openScreen } from './catalogBus';
import { getScreenSnapshots, screenSnapshotKey, subscribeScreenSnapshots } from '../../services/screenSnapshots';
import { useOptionalServices } from '../../services/ServicesProvider';
import type { Project } from '../../services/types';
import './screenCatalog.css';

const kindLabel: Record<ScreenKind, string> = { page: 'Page', panel: 'Panel', view: 'View', component: 'Component', html: 'HTML page' };

/** Drawn preview of the screen's shape; replaced by a real snapshot once the screen has been opened. */
export function ScreenThumb({ kind, snapshot, name }: { kind: ScreenKind; snapshot?: string; name?: string }) {
  if (snapshot) return <div className="screen-thumb"><img src={snapshot} alt={`${name ?? 'Screen'} snapshot`} /></div>;
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
  const services = useOptionalServices();
  const [source, setSource] = useState<string | null>(null);
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [repo, setRepo] = useState('');
  const [query, setQuery] = useState('');
  const [savedProject, setSavedProject] = useState<string | null>(null);
  const [folderPrompt, setFolderPrompt] = useState<string | null>(null);
  const activeAdapter = useRef<ProjectSourceAdapter | null>(null);
  const snapshots = useSyncExternalStore(subscribeScreenSnapshots, getScreenSnapshots);

  const run = async (adapter: ProjectSourceAdapter | null) => {
    if (!adapter) return;
    setStatus('scanning'); setError(''); setSource(adapter.label); setSavedProject(null); setFolderPrompt(null);
    activeAdapter.current = adapter;
    try {
      const result = await scanProject(adapter);
      setScreens(result.screens); setFileCount(result.paths.length); setStatus('done');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus('error'); }
  };
  const guard = (fn: () => Promise<ProjectSourceAdapter | null> | ProjectSourceAdapter | null) => async () => {
    try { await run(await fn()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus('error'); }
  };

  // A project opened from the Projects page reloads its source here.
  useEffect(() => {
    const openProject = (project: Project) => {
      if (project.framework === 'github' && project.repo_url) {
        void guard(() => createGitHubSource(project.repo_url!))();
      } else if (project.framework === 'folder') {
        setStatus('idle'); setScreens([]); setError('');
        setFolderPrompt(project.name);
      } else {
        void guard(() => initialSource ?? createMemorySource('Demo', demoSourceFiles))();
      }
    };
    const pending = consumePendingProject();
    if (pending) openProject(pending);
    return onOpenProjectScreens(openProject);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAsProject = async () => {
    const adapter = activeAdapter.current;
    if (!adapter?.savedSource || !services) return;
    const project = await services.runtime.services.projects.createFromSource({ name: adapter.savedSource.label, source: adapter.savedSource });
    setSavedProject(project.name);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? screens.filter((s) => `${s.name} ${s.filePath}`.toLowerCase().includes(q)) : screens;
  }, [screens, query]);

  const canSave = !!services && status === 'done' && !!activeAdapter.current?.savedSource && activeAdapter.current.savedSource.kind !== 'demo';

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
        {canSave && !savedProject ? (
          <button type="button" onClick={() => void saveAsProject()} title="Save this source as a project so it is waiting for you next time">
            <Save aria-hidden="true" size={14} /> Save as project
          </button>
        ) : null}
      </div>

      {savedProject ? <p className="screen-catalog__note" role="status">Saved as the project “{savedProject}” — find it on the Projects page.</p> : null}
      {folderPrompt ? <p className="screen-catalog__note">“{folderPrompt}” came from a folder on this computer. Press <strong>Open folder</strong> and choose it again to reload its screens.</p> : null}
      {status === 'idle' && !folderPrompt ? <p className="screen-catalog__note">Open a project folder or a GitHub repo to list its screens.</p> : null}
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
                <button type="button" className="screen-card" onClick={() => openScreen(s, source ?? '')} aria-label={`Open ${s.name}`}>
                  <ScreenThumb kind={s.kind} name={s.name} snapshot={snapshots[screenSnapshotKey(source ?? '', s.id)]} />
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
