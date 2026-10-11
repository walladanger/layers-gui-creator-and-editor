import { analyzeSources, createGitHubSource, createMemorySource, isCandidate, parseGitHubRepo, scanProject } from './projectSource';

const files = [
  { path: 'web-app/src/App.tsx', content: `export default function App(){ return <Routes><Route path="/runtimes/ollama" element={<OllamaPanel />} /></Routes> }` },
  { path: 'web-app/src/containers/runtimes/OllamaPanel.tsx', content: 'export function OllamaPanel(){ return null }' },
  { path: 'web-app/src/pages/settings/index.tsx', content: 'export default function SettingsPage(){ return null }' },
  { path: 'web-app/src/utils.ts', content: 'export const x = 1' },
  { path: 'web-app/src/Button.test.tsx', content: 'export function Button(){}' },
  { path: 'node_modules/lib/Thing.tsx', content: 'export function Thing(){}' },
];

test('lists only editable UI files, skipping tests and dependencies', () => {
  expect(isCandidate('a/OllamaPanel.tsx')).toBe(true);
  expect(isCandidate('a/Button.test.tsx')).toBe(false);
  expect(isCandidate('node_modules/x/A.tsx')).toBe(false);
  expect(isCandidate('a/utils.ts')).toBe(false);
});

test('finds the Ollama panel with the route declared for it', async () => {
  const { screens } = await scanProject(createMemorySource('repo', files));
  const panel = screens.find((s) => s.name === 'OllamaPanel');
  expect(panel).toMatchObject({ kind: 'panel', route: '/runtimes/ollama', filePath: 'web-app/src/containers/runtimes/OllamaPanel.tsx' });
  expect(screens.find((s) => s.name === 'SettingsPage')).toMatchObject({ kind: 'page', route: '/settings' });
  expect(screens.map((s) => s.name)).not.toContain('Thing');
});

test('html pages are listed by title', () => {
  expect(analyzeSources([{ path: 'public/targets/mock.html', content: '<title>Mock</title>' }])[0]).toMatchObject({ name: 'Mock', route: '/targets/mock.html' });
});

test('parses GitHub repo inputs', () => {
  expect(parseGitHubRepo('https://github.com/walladanger/radium-panel-lab')).toEqual({ owner: 'walladanger', repo: 'radium-panel-lab', ref: undefined });
  expect(parseGitHubRepo('a/b@dev')).toEqual({ owner: 'a', repo: 'b', ref: 'dev' });
  expect(parseGitHubRepo('nope')).toBeNull();
});

test('GitHub source reads the tree and raw files', async () => {
  const fetcher = (async (url: string) => {
    if (url.endsWith('/repos/a/b')) return new Response(JSON.stringify({ default_branch: 'main' }));
    if (url.includes('/git/trees/main')) return new Response(JSON.stringify({ tree: [{ path: 'src/HomePage.tsx', type: 'blob' }, { path: 'src', type: 'tree' }] }));
    if (url.includes('raw.githubusercontent.com/a/b/main/src/HomePage.tsx')) return new Response('export function HomePage(){}');
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const { screens } = await scanProject(createGitHubSource('a/b', fetcher));
  expect(screens).toEqual([expect.objectContaining({ name: 'HomePage', kind: 'page' })]);
});
