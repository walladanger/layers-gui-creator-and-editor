// Project source scanning: reads a local folder or a GitHub repo and lists the editable screens in it.
// Pure analysis lives in `analyzeSources`; the adapters only fetch file text.

export interface SourceFile { path: string; content: string }

export type ScreenKind = 'page' | 'panel' | 'view' | 'component' | 'html';

export interface ScreenEntry {
  id: string;
  name: string;
  filePath: string;
  kind: ScreenKind;
  /** Route the screen is served at, when one was found. */
  route: string | null;
}

export interface ProjectSourceAdapter {
  readonly label: string;
  /** Every path in the source (used to show the folder tree). */
  listPaths(signal?: AbortSignal): Promise<string[]>;
  /** Text of the candidate UI files. */
  readCandidates(paths: string[], signal?: AbortSignal): Promise<SourceFile[]>;
}

const IGNORED = /(^|\/)(node_modules|dist|build|\.git|\.next|coverage|src-tauri|target|vendor)(\/|$)/;
const UI_FILE = /\.(tsx|jsx|vue|svelte|html)$/;
const TEST_FILE = /\.(test|spec|stories)\.[jt]sx?$/;

export function isCandidate(path: string) {
  return UI_FILE.test(path) && !IGNORED.test(path) && !TEST_FILE.test(path);
}

function kindFor(name: string, path: string): ScreenKind {
  if (path.endsWith('.html')) return 'html';
  if (/Page$|(^|\/)(pages|routes|app)\//.test(name + '|' + path) && /Page$/.test(name)) return 'page';
  if (/(^|\/)(pages|routes)\//.test(path)) return 'page';
  if (/Panel$/.test(name)) return 'panel';
  if (/(View|Screen|Window|Dialog)$/.test(name)) return 'view';
  return 'component';
}

/** Routes declared in the sources: `<Route path="/x" element={<Foo/>}>` and `{ path: '/x', element: <Foo/> }`. */
export function findRoutes(files: SourceFile[]): Map<string, string> {
  const routes = new Map<string, string>();
  const jsx = /<Route\b[^>]*?path=["'`]([^"'`]+)["'`][^>]*?(?:element=\{\s*<\s*([A-Z]\w*)|component=\{\s*([A-Z]\w*))/g;
  const obj = /path:\s*["'`]([^"'`]+)["'`][^}]*?(?:element:\s*<\s*([A-Z]\w*)|component:\s*([A-Z]\w*))/g;
  for (const { content } of files) {
    for (const re of [jsx, obj]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content))) {
        const comp = m[2] ?? m[3];
        if (comp && !routes.has(comp)) routes.set(comp, m[1].startsWith('/') ? m[1] : `/${m[1]}`);
      }
    }
  }
  return routes;
}

/** File-based routers: src/pages/foo/bar.tsx or src/routes/foo.tsx → /foo/bar */
function fileRoute(path: string): string | null {
  const m = path.match(/(?:^|\/)(?:pages|routes)\/(.+)\.(tsx|jsx|vue|svelte)$/);
  if (!m) return null;
  const r = m[1].replace(/(^|\/)(index|page|__root)$/, '').replace(/\[([^\]]+)\]|\$(\w+)/g, ':$1$2').replace(/\./g, '/');
  return `/${r}`.replace(/\/+$/, '') || '/';
}

function exportedComponents(content: string): string[] {
  const names = new Set<string>();
  const re = /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z]\w*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) names.add(m[1]);
  return [...names];
}

const base = (path: string) => path.split('/').pop()!.replace(/\.\w+$/, '');

export function analyzeSources(files: SourceFile[]): ScreenEntry[] {
  const routes = findRoutes(files);
  const out: ScreenEntry[] = [];
  for (const file of files) {
    if (!isCandidate(file.path)) continue;
    if (file.path.endsWith('.html')) {
      const title = file.content.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
      out.push({ id: file.path, name: title || base(file.path), filePath: file.path, kind: 'html', route: `/${file.path.replace(/^public\//, '')}` });
      continue;
    }
    const comps = exportedComponents(file.content);
    // Small helper components are noise; keep the file's main component (matching the file name) or the first one.
    const main = comps.find((c) => c === base(file.path)) ?? comps[0];
    if (!main) continue;
    out.push({ id: `${file.path}#${main}`, name: main, filePath: file.path, kind: kindFor(main, file.path), route: routes.get(main) ?? fileRoute(file.path) });
  }
  const rank: Record<ScreenKind, number> = { page: 0, panel: 1, view: 2, html: 3, component: 4 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name));
}

export async function scanProject(adapter: ProjectSourceAdapter, signal?: AbortSignal) {
  const paths = (await adapter.listPaths(signal)).filter((p) => !IGNORED.test(p));
  const candidates = paths.filter(isCandidate).slice(0, 400);
  const files = await adapter.readCandidates(candidates, signal);
  return { paths, screens: analyzeSources(files) };
}

// ---- Adapters ----

export function createMemorySource(label: string, files: SourceFile[]): ProjectSourceAdapter {
  return {
    label,
    async listPaths() { return files.map((f) => f.path); },
    async readCandidates(paths) { return files.filter((f) => paths.includes(f.path)); },
  };
}

/** Parses `owner/repo`, `owner/repo@branch` or a github.com URL. */
export function parseGitHubRepo(input: string): { owner: string; repo: string; ref?: string } | null {
  const s = input.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  const m = s.match(/^([\w.-]+)\/([\w.-]+)(?:(?:@|\/tree\/)([\w./-]+))?$/);
  return m ? { owner: m[1], repo: m[2], ref: m[3] } : null;
}

export function createGitHubSource(input: string, fetcher: typeof fetch = fetch.bind(globalThis)): ProjectSourceAdapter {
  const parsed = parseGitHubRepo(input);
  if (!parsed) throw new Error('Use the form owner/repo or a github.com link.');
  const { owner, repo } = parsed;
  let ref = parsed.ref;
  const json = async (url: string, signal?: AbortSignal) => {
    const res = await fetcher(url, { signal, headers: { Accept: 'application/vnd.github+json' } });
    if (res.status === 404) throw new Error('Repository not found. Private repos are not supported yet.');
    if (res.status === 403) throw new Error('GitHub rate limit reached. Try again in a few minutes.');
    if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
    return res.json();
  };
  return {
    label: `${owner}/${repo}`,
    async listPaths(signal) {
      if (!ref) ref = (await json(`https://api.github.com/repos/${owner}/${repo}`, signal)).default_branch;
      const tree = await json(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`, signal);
      return (tree.tree as { path: string; type: string }[]).filter((t) => t.type === 'blob').map((t) => t.path);
    },
    async readCandidates(paths, signal) {
      const out: SourceFile[] = [];
      for (let i = 0; i < paths.length; i += 8) {
        const batch = await Promise.all(paths.slice(i, i + 8).map(async (path) => {
          const res = await fetcher(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`, { signal });
          return res.ok ? { path, content: await res.text() } : null;
        }));
        out.push(...batch.filter((f): f is SourceFile => !!f));
      }
      return out;
    },
  };
}

interface DirHandle { name: string; kind: 'directory'; entries(): AsyncIterable<[string, DirHandle | FileHandle]> }
interface FileHandle { name: string; kind: 'file'; getFile(): Promise<File> }

export function supportsLocalFolders() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickLocalSource(): Promise<ProjectSourceAdapter | null> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirHandle> }).showDirectoryPicker;
  if (!picker) throw new Error('This browser cannot open folders. Use Chrome or Edge, or the desktop app.');
  let root: DirHandle;
  try { root = await picker(); } catch { return null; }
  return createLocalSource(root);
}

export function createLocalSource(root: DirHandle): ProjectSourceAdapter {
  const handles = new Map<string, FileHandle>();
  const walk = async (dir: DirHandle, prefix: string) => {
    for await (const [name, handle] of dir.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (IGNORED.test(path) || name.startsWith('.')) continue;
      if (handle.kind === 'directory') await walk(handle, path); else handles.set(path, handle);
    }
  };
  return {
    label: root.name,
    async listPaths() { handles.clear(); await walk(root, ''); return [...handles.keys()].sort(); },
    async readCandidates(paths) {
      return Promise.all(paths.filter((p) => handles.has(p)).map(async (path) => ({ path, content: await (await handles.get(path)!.getFile()).text() })));
    },
  };
}

/** Built-in sample so the catalog works before any folder is opened. */
export const demoSourceFiles: SourceFile[] = [
  { path: 'public/targets/radium-mock.html', content: '<title>Radium Ollama panel</title>' },
];
