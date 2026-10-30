import { describe, expect, it } from 'vitest';
import { classifyNativeProject, createNativeProjectSource, type NativeProjectScan } from './nativeProjectImport';
import { scanProject } from './projectSource';

const scan: NativeProjectScan = {
  root: 'C:\\Projects\\Example', name: 'Example', files: [
    { path: 'src/App.tsx', content: 'export function App() { return null; }' },
    { path: 'src/pages/SettingsPage.tsx', content: 'export function SettingsPage() { return null; }' },
  ],
  packageJson: '{"scripts":{"dev":"vite --host"},"devDependencies":{"vite":"8.0.0"}}',
  hasNodeModules: true,
};

describe('native project import', () => {
  it('identifies local Vite projects without requiring the user to enter a server URL', () => {
    expect(classifyNativeProject(scan)).toEqual(expect.objectContaining({ kind: 'vite', canPreview: true }));
  });
  it('does not claim to run arbitrary React or native desktop applications', () => {
    expect(classifyNativeProject({ ...scan, packageJson: '{"scripts":{"dev":"next dev"}}' }).canPreview).toBe(false);
    expect(classifyNativeProject({ ...scan, packageJson: null, files: [] }).kind).toBe('unsupported');
  });
  it('offers HTML-only projects a static preview', () => {
    const result = classifyNativeProject({ ...scan, packageJson: null, files: [{ path: 'index.html', content: '<title>Local</title>' }] });
    expect(result).toMatchObject({ kind: 'static', canPreview: true, entry: '/index.html' });
  });
  it('lists native-cloned files using the same scanner as local folders', async () => {
    const adapter = createNativeProjectSource(scan, 'github', 'owner/example');
    expect(adapter.savedSource).toMatchObject({ kind: 'github', label: 'Example', repo: 'owner/example' });
    const result = await scanProject(adapter);
    expect(result.screens.map(s => s.name)).toContain('SettingsPage');
  });
});
