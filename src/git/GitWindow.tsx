import { ChevronDown, ChevronRight, FolderOpen, GitBranch, GitCommitHorizontal, Globe, RefreshCw, RotateCw, Search, Waypoints } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  commitsToMarkdown, createGitHubSource, groupByDay, layoutGraph, relativeTime, renderGraphGutter, renderGraphHorizontal, renderGraphRow,
  type Commit, type CommitDetail, type GitSource, type GitStatus,
} from './gitCore';
import { createLocalGitSource, isDesktopRuntime, resolveRepoRoot, tauriInvoke, type TauriInvoke } from './gitHost';
import './git.css';

const PAGE = 50;
const store = (key: string) => ({
  get() { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } },
  set(value: string) { try { localStorage.setItem(key, value); } catch { /* storage may be unavailable */ } },
});
const repoStore = store('layers.git.repo');
const githubStore = store('layers.git.github');
const graphStore = store('layers.git.graph');
const orientStore = store('layers.git.orient');

function DiffView({ text }: { text: string }) {
  const lines = text.split('\n');
  const shown = lines.slice(0, 600);
  return (
    <pre className="git-diff" aria-label="Diff">
      {shown.map((line, index) => {
        const kind = line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : line.startsWith('@@') ? 'hunk' : 'ctx';
        return <div key={index} data-kind={kind}>{line || ' '}</div>;
      })}
      {lines.length > shown.length ? <div data-kind="ctx">… {lines.length - shown.length} more lines</div> : null}
    </pre>
  );
}

function CommitDetailView({ source, commit }: { source: GitSource; commit: Commit }) {
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [error, setError] = useState('');
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [diff, setDiff] = useState('');
  useEffect(() => {
    let live = true;
    setDetail(null); setError(''); setOpenFile(null);
    source.show(commit.sha).then((result) => { if (live) setDetail(result); }, (e: unknown) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [source, commit.sha]);

  const toggleFile = async (path: string) => {
    if (openFile === path) { setOpenFile(null); return; }
    setOpenFile(path); setDiff('Loading…');
    try { setDiff((await source.diff(commit.sha, path)) || '(no textual diff)'); } catch (e) { setDiff(e instanceof Error ? e.message : String(e)); }
  };

  if (error) return <p className="git-note git-note--error" role="alert">{error}</p>;
  if (!detail) return <p className="git-note">Loading…</p>;
  return (
    <div className="git-detail">
      {commit.body ? <p className="git-detail__body">{commit.body}</p> : null}
      <p className="git-detail__meta">
        <code>{commit.sha}</code>
        <span>{detail.files.length} file{detail.files.length === 1 ? '' : 's'}</span>
        <span className="git-add">+{detail.additions}</span>
        <span className="git-del">−{detail.deletions}</span>
      </p>
      <ul className="git-files">
        {detail.files.map((file) => (
          <li key={file.path}>
            <button type="button" aria-expanded={openFile === file.path} onClick={() => void toggleFile(file.path)}>
              <code title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>{file.path}</code>
              {file.binary ? <span>binary</span> : <><span className="git-add">+{file.additions}</span><span className="git-del">−{file.deletions}</span></>}
            </button>
            {openFile === file.path ? <DiffView text={diff} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The branch graph on its side: a lane per branch, oldest at the left, newest at the right. Click a dot to open that commit. */
function HorizontalGraph({ commits, selected, onSelect }: { commits: Commit[]; selected: string | null; onSelect: (sha: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const prev = useRef<{ w: number; first: string | undefined }>({ w: 0, first: undefined });
  const drawn = useMemo(() => renderGraphHorizontal(commits, { selected }), [commits, selected]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const last = prev.current;
    const first = commits[commits.length - 1]?.sha;
    // First draw shows the newest commits (right edge); older commits loaded later appear on the left without moving the view.
    el.scrollLeft = last.w && last.first !== first ? el.scrollLeft + (el.scrollWidth - last.w) : last.w ? el.scrollLeft : el.scrollWidth;
    prev.current = { w: el.scrollWidth, first };
  }, [drawn, commits]);
  return (
    <div className="git-hgraph" role="group" aria-label="Horizontal branch graph">
      <div className="git-hgraph__names" dangerouslySetInnerHTML={{ __html: drawn.pillsSvg }} />
      <div
        ref={box}
        className="git-hgraph__scroll"
        onClick={(e) => { const g = (e.target as Element).closest?.('[data-sha]') as HTMLElement | null; if (g?.dataset.sha) onSelect(g.dataset.sha); }}
        dangerouslySetInnerHTML={{ __html: drawn.graphSvg }}
      />
    </div>
  );
}

export interface GitWindowProps {
  /** Supplied by tests/previews; otherwise the window builds its own source. */
  initialSource?: GitSource;
}

/**
 * Git commit tracking. All git logic is the shared `gitCore` (identical in ClaudeDesktopClient);
 * this window only supplies a source: a local repo through the desktop app's read-only
 * `git_run` command, or a public GitHub repo. Read-only: it never changes a repository.
 */
export function GitWindow({ initialSource }: GitWindowProps = {}) {
  const desktop = isDesktopRuntime();
  const [mode, setMode] = useState<'local' | 'github'>(desktop ? 'local' : 'github');
  const invoke: TauriInvoke | null = desktop ? tauriInvoke : null;
  const [repoInput, setRepoInput] = useState(repoStore.get);
  const [githubInput, setGithubInput] = useState(githubStore.get);
  const [source, setSource] = useState<GitSource | null>(initialSource ?? null);
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [ref, setRef] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [graphOn, setGraphOn] = useState(() => graphStore.get() !== '0');
  const [horizontalOn, setHorizontalOn] = useState(() => orientStore.get() === 'h');
  const headRef = useRef('');
  const commitsRef = useRef<Commit[]>([]);
  commitsRef.current = commits ?? [];

  const load = useCallback(async (append = false) => {
    if (!source) { setCommits(null); return; }
    setError('');
    try {
      const skip = append ? commitsRef.current.length : 0;
      const list = await source.log({ limit: PAGE, skip, ref: ref || undefined, search: search || undefined });
      setCommits(append ? [...commitsRef.current, ...list] : list);
      setMore(list.length === PAGE);
      if (!append) {
        headRef.current = await source.head().catch(() => '');
        setStatus(await source.status());
        setBranches((await source.branches().catch(() => null))?.local ?? []);
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setCommits([]); }
  }, [source, ref, search]);

  useEffect(() => {
    setExpanded(null);
    const timer = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // Cheap auto-refresh for a local repo: reload the list only when HEAD moved.
  useEffect(() => {
    if (!source || source.kind !== 'local') return undefined;
    const timer = setInterval(() => {
      void source.head().then((head) => { if (head && head !== headRef.current) void load(); else void source.status().then(setStatus, () => undefined); }, () => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, [source, load]);

  const connectLocal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invoke || !repoInput.trim()) return;
    try {
      const root = await resolveRepoRoot(repoInput.trim(), invoke);
      repoStore.set(root); setRepoInput(root); setRef(''); setSource(createLocalGitSource(root, invoke));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const connectGitHub = (event: React.FormEvent) => {
    event.preventDefault();
    try { setSource(createGitHubSource(githubInput.trim())); githubStore.set(githubInput.trim()); setRef(''); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const copyMarkdown = () => {
    if (!commits?.length || !source) return;
    void navigator.clipboard?.writeText(commitsToMarkdown(commits, `${source.label} commits`));
  };

  // Reconnect the saved local repo once Tauri's invoke is ready.
  useEffect(() => {
    if (initialSource || !invoke || mode !== 'local' || source || !repoInput) return;
    void resolveRepoRoot(repoInput, invoke).then((root) => setSource(createLocalGitSource(root, invoke)), () => undefined);
  }, [invoke, mode, source, repoInput, initialSource]);

  const groups = useMemo(() => groupByDay(commits ?? []), [commits]);
  // The branch graph needs an unbroken history, so it is off while a message search narrows the list.
  const graph = useMemo(() => (graphOn && !search && commits?.length ? layoutGraph(commits) : null), [graphOn, search, commits]);
  const rowOf = useMemo(() => new Map((graph?.rows ?? []).map((row) => [row.sha, row])), [graph]);
  const toggleGraph = () => setGraphOn((on) => { graphStore.set(on ? '0' : '1'); return !on; });
  const rotateGraph = () => setHorizontalOn((on) => { orientStore.set(on ? 'v' : 'h'); return !on; });
  const horizontal = Boolean(graph) && horizontalOn;
  const picked = horizontal ? (commits ?? []).find((c) => c.sha === expanded) ?? null : null;
  const dirty = status?.files.length ?? 0;

  const renderCommit = (commit: Commit) => {
    const open = expanded === commit.sha;
    const row = rowOf.get(commit.sha);
    return (
      <div key={commit.sha} className="git-commit" data-commit={commit.short} data-graph={row ? 'on' : 'off'}>
        <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : commit.sha)}>
          {row && graph ? <span className="git-graph" dangerouslySetInnerHTML={{ __html: renderGraphRow(row, graph.lanes) }} /> : (
            <>
              {open ? <ChevronDown aria-hidden="true" size={14} /> : <ChevronRight aria-hidden="true" size={14} />}
              <GitCommitHorizontal aria-hidden="true" size={14} />
            </>
          )}
          <span className="git-commit__body">
            <span className="git-commit__line">
              <span className="git-commit__subject">{commit.subject}</span>
              {commit.refs.filter((r) => r.kind !== 'head').slice(0, 4).map((r) => <span key={r.kind + r.name} className="git-ref" data-kind={r.kind}>{r.name}</span>)}
            </span>
            <span className="git-commit__meta"><code>{commit.short}</code> {commit.author} · {row ? commit.date.slice(0, 10) : relativeTime(commit.date)}{commit.parents.length > 1 ? ' · merge' : ''}</span>
          </span>
        </button>
        {open && source ? (
          row && graph ? (
            <div className="git-gutter-row"><span className="git-graph" dangerouslySetInnerHTML={{ __html: renderGraphGutter(row, graph.lanes) }} /><div><CommitDetailView source={source} commit={commit} /></div></div>
          ) : <CommitDetailView source={source} commit={commit} />
        ) : null}
      </div>
    );
  };

  return (
    <div className="git-window">
      <div className="git-window__bar">
        {desktop ? (
          <div className="git-seg" role="group" aria-label="Source">
            <button type="button" aria-pressed={mode === 'local'} onClick={() => { setMode('local'); setSource(null); }}>Local</button>
            <button type="button" aria-pressed={mode === 'github'} onClick={() => { setMode('github'); setSource(null); }}>GitHub</button>
          </div>
        ) : null}
        {mode === 'local' ? (
          <form onSubmit={(e) => void connectLocal(e)}>
            <FolderOpen aria-hidden="true" size={15} />
            <input aria-label="Repository folder" placeholder="Path to a git repository" value={repoInput} onChange={(e) => setRepoInput(e.target.value)} />
            <button type="submit">Open</button>
          </form>
        ) : (
          <form onSubmit={connectGitHub}>
            <Globe aria-hidden="true" size={15} />
            <input aria-label="GitHub repository" placeholder="owner/repo" value={githubInput} onChange={(e) => setGithubInput(e.target.value)} />
            <button type="submit">Load</button>
          </form>
        )}
        <button type="button" aria-label="Refresh" onClick={() => void load()} disabled={!source}><RefreshCw aria-hidden="true" size={15} /></button>
        <button type="button" aria-label="Branch graph" aria-pressed={graphOn} onClick={toggleGraph}><Waypoints aria-hidden="true" size={15} /></button>
        {graphOn ? <button type="button" aria-label="Rotate graph" aria-pressed={horizontalOn} title={horizontalOn ? 'Rotate graph to vertical' : 'Rotate graph to horizontal'} onClick={rotateGraph}><RotateCw aria-hidden="true" size={15} /></button> : null}
        <button type="button" aria-label="Copy as markdown" onClick={copyMarkdown} disabled={!commits?.length}>Copy</button>
      </div>

      <div className="git-window__filters">
        {status?.available ? (
          <>
            <span className="git-chip"><GitBranch aria-hidden="true" size={13} />{status.branch || 'detached'}</span>
            {status.ahead > 0 ? <span title="Commits not pushed">↑{status.ahead}</span> : null}
            {status.behind > 0 ? <span title="Commits to pull">↓{status.behind}</span> : null}
            <span className={dirty ? 'git-dirty' : ''}>{dirty ? `${dirty} uncommitted change${dirty === 1 ? '' : 's'}` : 'clean'}</span>
          </>
        ) : null}
        <span className="git-spacer" />
        {branches.length ? (
          <select aria-label="Branch" value={ref} onChange={(e) => setRef(e.target.value)}>
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
        ) : null}
        <label className="git-search"><Search aria-hidden="true" size={14} /><input aria-label="Search messages" placeholder="Search messages" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      </div>

      <div className="git-window__list">
        {!source ? <p className="git-note">{mode === 'local' ? 'Enter a git repository folder to track its commits.' : 'Enter a public repository, e.g. walladanger/layers-gui-creator-and-editor.'}</p> : null}
        {error ? <p className="git-note git-note--error" role="alert">{error}</p> : null}
        {source && commits === null && !error ? <p className="git-note" role="status">Loading…</p> : null}
        {commits && !commits.length && !error ? <p className="git-note">No commits{search ? ' match' : ' yet'}.</p> : null}
        {horizontal ? (
          <>
            <HorizontalGraph commits={commits ?? []} selected={expanded} onSelect={(sha) => setExpanded((v) => (v === sha ? null : sha))} />
            {picked && source
              ? <div aria-label="Selected commit" role="region"><p className="git-detail__title">{picked.subject} <code>{picked.short}</code></p><CommitDetailView source={source} commit={picked} /></div>
              : <p className="git-note">Click a dot to see that commit.</p>}
          </>
        ) : null}
        {horizontal ? null : graph
          ? (commits ?? []).map(renderCommit)
          : groups.map((group) => (
            <section key={group.day}>
              <h3 className="git-day">{group.day}</h3>
              {group.commits.map(renderCommit)}
            </section>
          ))}
        {commits && more && commits.length ? <button type="button" className="git-more" onClick={() => void load(true)}>Load more</button> : null}
      </div>
    </div>
  );
}
