import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemorySource } from '../../services/projectSource';
import { saveScreenSnapshot } from '../../services/screenSnapshots';
import { consumePendingProject, onOpenScreen, openProjectScreens } from './catalogBus';
import type { Project } from '../../services/types';
import { ScreenCatalogWindow } from './ScreenCatalogWindow';

test('selecting real snapshot thumbnails opens the matching screen and route', async () => {
  const source = createMemorySource('thumbnail-test', [
    { path: 'public/one.html', content: '<title>One</title>' },
    { path: 'public/two.html', content: '<title>Two</title>' },
  ]);
  const listener = vi.fn();
  const detach = onOpenScreen(listener);
  const user = userEvent.setup();
  render(<ScreenCatalogWindow initialSource={source} />);
  await user.click(screen.getByRole('button', { name: 'Demo' }));
  await screen.findByRole('button', { name: 'Open One' });
  act(() => {
    saveScreenSnapshot('thumbnail-test', 'public/one.html', 'data:image/png;base64,b25l');
    saveScreenSnapshot('thumbnail-test', 'public/two.html', 'data:image/png;base64,dHdv');
  });
  await user.click(screen.getByRole('img', { name: 'Two snapshot' }));
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
    sourceKey: 'thumbnail-test', screen: expect.objectContaining({ id: 'public/two.html', route: '/two.html' }),
  }));
  await user.click(screen.getByRole('img', { name: 'One snapshot' }));
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
    screen: expect.objectContaining({ id: 'public/one.html', route: '/one.html' }),
  }));
  detach();
});

test('browses folders, filters ordinary files and opens a detected screen with its source', async () => {
  const source = createMemorySource('folder-test', [
    { path: 'src/pages/HomePage.tsx', content: 'export function HomePage() { return <main />; }' },
    { path: 'src/settings.json', content: '{}' },
    { path: 'README.md', content: 'Project instructions' },
    { path: 'node_modules/hidden.tsx', content: 'export function Hidden() {}' },
  ]);
  const listener = vi.fn();
  const detach = onOpenScreen(listener);
  const user = userEvent.setup();
  render(<ScreenCatalogWindow initialSource={source} />);
  await user.click(screen.getByRole('button', { name: 'Demo' }));
  await user.click(await screen.findByRole('button', { name: 'Files and folders' }));
  expect(screen.getByText('README.md')).toBeVisible();
  expect(screen.getByText('settings.json')).toBeVisible();
  expect(screen.queryByText('hidden.tsx')).not.toBeInTheDocument();
  await user.click(screen.getByText('pages', { selector: 'summary' }));
  await user.click(screen.getByRole('button', { name: 'Open HomePage from src/pages/HomePage.tsx' }));
  expect(listener).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'folder-test', screen: expect.objectContaining({ name: 'HomePage' }) }));
  const filter = screen.getByRole('textbox', { name: 'Filter project files' });
  await user.type(filter, 'settings');
  expect(screen.getByText('settings.json')).toBeVisible();
  expect(screen.queryByText('README.md')).not.toBeInTheDocument();
  await user.clear(filter);
  await user.type(filter, 'HomePage');
  expect(screen.getByRole('button', { name: 'Open HomePage from src/pages/HomePage.tsx' })).toBeVisible();
  await user.clear(filter);
  await user.type(filter, 'missing-file');
  expect(screen.getByText('No files match your filter.')).toBeVisible();
  detach();
});

test('lists project files even when no screens are detected', async () => {
  const user = userEvent.setup();
  render(<ScreenCatalogWindow initialSource={createMemorySource('docs', [{ path: 'README.md', content: 'Hello' }])} />);
  await user.click(screen.getByRole('button', { name: 'Demo' }));
  expect(await screen.findByText(/No screens detected/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Files and folders' }));
  expect(screen.getByText('README.md')).toBeVisible();
});

test('an old scan cannot replace a newly opened folder project', async () => {
  let resolvePaths!: (paths: string[]) => void;
  const pending = new Promise<string[]>((resolve) => { resolvePaths = resolve; });
  const source = { label: 'Old project', listPaths: () => pending, readCandidates: async () => [{ path: 'old.html', content: '<title>Old screen</title>' }] };
  const user = userEvent.setup();
  render(<ScreenCatalogWindow initialSource={source} />);
  await user.click(screen.getByRole('button', { name: 'Demo' }));
  act(() => openProjectScreens({ framework: 'folder', name: 'New folder' } as Project));
  await act(async () => { resolvePaths(['old.html']); await pending; });
  expect(screen.getByText(/New folder.*came from a folder/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Open Old screen' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Files and folders' })).not.toBeInTheDocument();
  consumePendingProject();
});

test('an older scan cannot overwrite a newer repository error', async () => {
  let resolvePaths!: (paths: string[]) => void;
  const pending = new Promise<string[]>((resolve) => { resolvePaths = resolve; });
  const source = { label: 'Old project', listPaths: () => pending, readCandidates: async () => [{ path: 'old.html', content: '<title>Old screen</title>' }] };
  const user = userEvent.setup();
  render(<ScreenCatalogWindow initialSource={source} />);
  await user.click(screen.getByRole('button', { name: 'Demo' }));
  await user.type(screen.getByRole('textbox', { name: 'GitHub repository' }), 'invalid');
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Use the form owner/repo');
  await act(async () => { resolvePaths(['old.html']); await pending; });
  expect(screen.getByRole('alert')).toHaveTextContent('Use the form owner/repo');
  expect(screen.queryByRole('button', { name: 'Open Old screen' })).not.toBeInTheDocument();
});
