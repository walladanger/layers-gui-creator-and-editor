import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ProjectSourceAdapter, SavedSourceKind, SourceFile } from './projectSource';

export interface NativeProjectScan {
  root: string;
  name: string;
  files: SourceFile[];
  packageJson: string | null;
  hasNodeModules: boolean;
}

export interface NativeProjectKind {
  kind: 'vite' | 'static' | 'unsupported';
  canPreview: boolean;
  entry?: string;
  explanation: string;
}

export function classifyNativeProject(scan: NativeProjectScan): NativeProjectKind {
  let pkg: { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> } = {};
  try { pkg = JSON.parse(scan.packageJson ?? '{}') as typeof pkg; } catch { /* ignore */ }
  const vite = Boolean(pkg.scripts?.dev && /(?:^|[\s/&|])vite(?:\s|$)/.test(pkg.scripts.dev));
  if (vite) return {
    kind: 'vite',
    canPreview: Boolean(scan.hasNodeModules),
    explanation: scan.hasNodeModules
      ? 'Vite web application detected. Preview starts only after you approve running its dev script.'
      : 'Vite detected. Dependencies must be installed before preview. The project has been imported and can be inspected now.',
  };
  const html = scan.files.find(file => file.path === 'index.html') ??
    scan.files.find(file => file.path === 'public/index.html') ??
    scan.files.find(file => file.path.endsWith('.html'));
  if (html && !pkg.scripts?.dev) {
    const entry = html.path.startsWith('public/') ? html.path.slice(7) : html.path;
    return { kind: 'static', canPreview: true, entry: `/${entry}`, explanation: 'Static HTML page detected. Preview can open without installing a framework or entering an address.' };
  }
  return {
    kind: 'unsupported', canPreview: false,
    explanation: 'Files can be browsed, but this project needs a runtime integration before live visual editing. Native .exe programs cannot be rendered as web pages.',
  };
}

export function nativeImportAvailable(): boolean {
  return isTauri();
}

export async function selectNativeFolder(): Promise<NativeProjectScan | null> {
  return invoke<NativeProjectScan | null>('select_project_folder');
}

export async function cloneGitHubProject(repo: string): Promise<NativeProjectScan> {
  return invoke<NativeProjectScan>('clone_github_project', { repo });
}

export async function startNativeProjectPreview(root: string, entry?: string): Promise<string> {
  return invoke<string>('start_project_preview', { root, entry: entry ?? null });
}

export function createNativeProjectSource(scan: NativeProjectScan, kind: SavedSourceKind, repo?: string): ProjectSourceAdapter {
  const files = scan.files;
  return {
    label: scan.name,
    savedSource: { kind, label: scan.name, ...(repo ? { repo } : {}) },
    async listPaths() { return files.map(file => file.path); },
    async readCandidates(paths) { return files.filter(file => paths.includes(file.path)); },
  };
}
