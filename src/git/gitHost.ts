// Host adapter for the shared git core (gitCore.js). The ONLY host-specific part is the runner:
// in the desktop app it calls the read-only `git_run` Tauri command; everywhere else (browser preview)
// the Git window falls back to the public-GitHub source.
import { invoke } from '@tauri-apps/api/core';
import { createRunnerSource, type GitRunner, type GitSource } from './gitCore';

export type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** Tauri rejects with `{ code, message }`; turn that into a normal Error. */
function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) return new Error(String((error as { message: unknown }).message));
  return new Error(String(error));
}

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function createTauriGitRunner(repo: string, invoke: TauriInvoke): GitRunner {
  return (args) => invoke<string>('git_run', { repo, args }).catch((error) => { throw asError(error); });
}

export function createLocalGitSource(repo: string, invoke: TauriInvoke): GitSource {
  const label = repo.split(/[\\/]/).filter(Boolean).pop() || repo;
  return createRunnerSource(createTauriGitRunner(repo, invoke), { label });
}

/** Resolves a folder to the root of the repository that contains it (rejects if there is none). */
export function resolveRepoRoot(dir: string, invoke: TauriInvoke): Promise<string> {
  return invoke<string>('git_toplevel', { dir }).catch((error) => { throw asError(error); });
}

/** Tauri's `invoke` (a no-op import in the browser; only called inside the desktop app). */
export const tauriInvoke: TauriInvoke = (command, args) => invoke(command, args);
