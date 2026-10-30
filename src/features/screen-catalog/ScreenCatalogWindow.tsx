import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FolderOpen, GitBranch as Github, Play, Save, Search } from 'lucide-react';
import {
  createGitHubSource, createMemorySource, demoSourceFiles, pickLocalSource, scanProject, supportsLocalFolders,
  type ProjectSourceAdapter, type ScreenEntry, type ScreenKind,
} from '../../services/projectSource';
import { consumePendingProject, onOpenProjectScreens, openScreen } from './catalogBus';
import { getScreenSnapshots, screenSnapshotKey, subscribeScreenSnapshots } from '../../services/screenSnapshots';
import { useOptionalServices } from '../../services/ServicesProvider';
import type { Project } from '../../services/types';
import { classifyNativeProject, cloneGitHubProject, createNativeProjectSource, nativeImportAvailable, selectNativeFolder, startNativeProjectPreview, type NativeProjectScan } from '../../services/nativeProjectImport';
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
  const [showGitHub, setShowGitHub] = useState(false);
  const [nativeScan, setNativeScan] = useState<NativeProjectScan | null>(null);
  const [starting, setStarting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const importedProject = useRef<Project | null>(null);
  const [query, setQuery] = useState('');
  const [savedProject, setSavedProject] = useState<string | null>(null);
  const [folderPrompt, setFolderPrompt] = useState<string | null>(null);
  const activeAdapter = useRef<ProjectSourceAdapter | null>(null);
  const snapshots = useSyncExternalStore(subscribeScreenSnapshots, getScreenSnapshots);

  const run = async (adapter: ProjectSourceAdapter | null) => {
    if (!adapter) return;
    setStatus('scanning'); setError(''); setSource(adapter.label); setSavedProject(null); setFolderPrompt(null); setPreviewUrl(null);
    activeAdapter.current = adapter;
    try {
      const result = await scanProject(adapter);
      setScreens(result.screens); setFileCount(result.paths.length); setStatus('done');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus('error'); }
  };
  const guard = (fn: () => Promise<ProjectSourceAdapter | null> | ProjectSourceAdapter | null) => async () => {
    try { await run(await fn()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus('error'); }
  };

  const importNative = async (mode: 'folder' | 'github') => {
    setStatus('scanning'); setError(''); setNativeScan(null); setPreviewUrl(null);
    try {
      const scan = mode === 'folder' ? await selectNativeFolder() : await cloneGitHubProject(repo.trim());
      if (!scan) { setStatus('idle'); return; }
      const adapter = createNativeProjectSource(scan, mode, mode === 'github' ? repo.trim() : undefined);
      await run(adapter);
      setNativeScan(scan);
      if (services) {
        const project = await services.runtime.services.projects.createFromSource({
          name: adapter.savedSource!.label, source: adapter.savedSource!,
        });
        importedProject.current = project;
        openProjectScreens(project);
        setSavedProject(project.name);
      }
    } catch (cause) {
      setError(typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : 'Could not import this project.');
      setStatus('error');
    }
  };

  const openFolder = async () => {
    if (nativeImportAvailable()) { await importNative('folder'); return; }
    await guard(pickLocalSource)();
  };
  const openGitHub = async () => {
    if (!repo.trim()) { setError('Paste the GitHub repository URL or owner/repo.'); return; }
    if (nativeImportAvailable()) { await importNative('github'); return; }
    await guard(() => createGitHubSource(repo))();
  };

  const startPreview = async () => {
    if (!nativeScan || !services) return;
    const kind = classifyNativeProject(nativeScan);
    if (!kind.canPreview) return;
    setStarting(true); setError('');
    try {
      const url = await startNativeProjectPreview(nativeScan.root, kind.entry);
      const project = importedProject.current;
      if (!project) throw new Error('The project was not saved. Import it again before previewing.');
      await services.runtime.services.projects.update(project.id, { target_mode: 'live', target_url: url });
      const updated: Project = { ...project, target_mode: 'live', target_url: url };
      importedProject.current = updated;
      setPreviewUrl(url);
      openProjectScreens(updated);
    } catch (cause) {
      setError(typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : 'Could not start this project.');
    } finally { setStarting(false); }
  };

  // A project opened from the Projects page reloads its source here.
  useEffect(() => {
    const openProject = (project: Project) => {
      // Activating the project we just imported must not reset its preview state.
      if (importedProject.current?.id === project.id) return;
      if (project.framework === 'github' && project.repo_url) {
        importedProject.current = project;
        if (nativeImportAvailable()) {
          setRepo(project.repo_url);
          void cloneGitHubProject(project.repo_url).then(scan => {
            setNativeScan(scan);
            void run(createNativeProjectSource(scan, 'github', project.repo_url!));
          }).catch(cause => { setError(String(cause)); setStatus('error'); });
        } else void guard(() => createGitHubSource(project.repo_url!))();
      } else if (project.framework === 'folder') {
        setStatus('idle'); setScreens([]); setError('');
        setFolderPrompt(project.name);
      } else {
        void guard(() => initialSource ?? createMemorySource('Demo', demoSourceFiles))();
      }
    };
    if (initialSource) void run(initialSource);
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

  const canSave = !!services && status === 'done' && !!activeAdapter.current?.savedSource && activeAdapter.current.savedSource.kind !== 'demo' && !savedProject;
  const nativeKind = nativeScan ? classifyNativeProject(nativeScan) : null;

  return (
    <div className="screen-catalog">
      <h3 className="screen-catalog__title">Add Application</h3>
      <p className="screen-catalog__note">Choose the project folder on this PC, or import a GitHub repository. No server address required.</p>
      <div className="screen-catalog__sources screen-catalog__sources--primary">
        <button type="button" onClick={() => void openFolder()}
          disabled={status === 'scanning' || (!nativeImportAvailable() && !supportsLocalFolders())}>
          <FolderOpen aria-hidden="true" size={17} /> Select Folder
        </button>
        <button type="button" aria-expanded={showGitHub} onClick={() => setShowGitHub(value => !value)}>
          <Github aria-hidden="true" size={17} /> GitHub Project
        </button>
      </div>
      {showGitHub ? (
        <form className="screen-catalog__github" onSubmit={e => { e.preventDefault(); void openGitHub(); }}>
          <label htmlFor="screen-catalog-repo">GitHub repository URL</label>
          <input id="screen-catalog-repo" aria-label="GitHub repository" placeholder="https://github.com/owner/repo"
            value={repo} onChange={event => setRepo(event.target.value)} />
          <button type="submit" disabled={!repo.trim() || status === 'scanning'}>
            {nativeImportAvailable() ? 'Clone and Import' : 'Scan Repository'}
          </button>
          <small>{nativeImportAvailable()
            ? 'Layers clones public repositories into its local app-data/projects folder. Existing clones are reused.'
            : 'The web version can scan public GitHub source. Automatic local cloning and preview require the Windows desktop app.'}</small>
        </form>
      ) : null}
      {nativeKind && status === 'done' ? (
        <div className="screen-catalog__preview">
          <strong>{nativeScan?.name}</strong>
          <span>{nativeKind.explanation}</span>
          {nativeKind.canPreview && !previewUrl ? (
            <button type="button" disabled={starting} onClick={() => void startPreview()}>
              <Play size={14} aria-hidden="true" /> {starting ? 'Starting preview…' : nativeKind.kind === 'vite' ? 'Start App Preview' : 'Open HTML Preview'}
            </button>
          ) : null}
          {previewUrl ? <p role="status">Application preview started on the canvas. Select a screen below to focus it.</p> : null}
          {nativeKind.kind === 'vite' ? <small>Starting runs the imported project's dev script. Only start projects you trust.</small> : null}
        </div>
      ) : null}
      {canSave ? <button type="button" className="screen-catalog__save" onClick={() => void saveAsProject()}>
        <Save size={14} aria-hidden="true" /> Save source as project
      </button> : null}

      {savedProject ? <p className="screen-catalog__note" role="status">Saved as the project “{savedProject}” — find it on the Projects page.</p> : null}
      {folderPrompt ? <p className="screen-catalog__note">“{folderPrompt}” came from a folder on this computer. Press <strong>Open folder</strong> and choose it again to reload its screens.</p> : null}
      {status === 'idle' && !folderPrompt ? <p className="screen-catalog__note">Select a project folder or import a GitHub repository to list its screens.</p> : null}
      {status === 'scanning' ? <p className="screen-catalog__note" role="status">Importing and scanning project…</p> : null}
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
                <button type="button" className="screen-card" onClick={() => { if (nativeScan && !previewUrl) { setError("Start the preview before opening this screen on the canvas."); return; } openScreen(s, source ?? ''); }} aria-label={`Open ${s.name}`}>
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
