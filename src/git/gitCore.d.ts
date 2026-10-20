// Types for gitCore.js (git-tracker-core). Keep this file next to gitCore.js.

export type RefKind = "head" | "branch" | "remote" | "tag";
export interface GitRef { kind: RefKind; name: string }

export interface Commit {
  sha: string;
  short: string;
  author: string;
  email: string;
  /** ISO 8601 author date */
  date: string;
  parents: string[];
  refs: GitRef[];
  subject: string;
  body: string;
  /** conventional-commit type ("fix", "feat", ...) or null */
  type: string | null;
}

export interface ChangedFile { path: string; oldPath: string | null; additions: number; deletions: number; binary: boolean }
export interface CommitDetail { commit: Commit; files: ChangedFile[]; additions: number; deletions: number }

export interface WorkingFile { path: string; staged: boolean; state: string; code: string }
export interface GitStatus {
  available: boolean;
  error?: string;
  branch?: string | null;
  upstream?: string | null;
  ahead: number;
  behind: number;
  detached?: boolean;
  files: WorkingFile[];
}

export interface Branches { current: string | null; local: string[]; remote: string[]; tags: string[] }

export interface LogOptions { limit?: number; skip?: number; ref?: string; search?: string; path?: string }

/** The adapter contract every host/UI talks to. Read-only. */
export interface GitSource {
  readonly label: string;
  readonly kind: "local" | "github" | "memory";
  /** Cheap change detector for auto-refresh. */
  head(): Promise<string>;
  status(): Promise<GitStatus>;
  log(opts?: LogOptions): Promise<Commit[]>;
  show(sha: string): Promise<CommitDetail>;
  diff(sha: string, path?: string): Promise<string>;
  branches(): Promise<Branches>;
}

/** Executes `git <args>` in the chosen repo and resolves with stdout; rejects on a non-zero exit. */
export type GitRunner = (args: string[]) => Promise<string>;

export const LOG_FORMAT: string;
export function parseRefs(decoration: string): GitRef[];
export function commitType(subject: string): string | null;
export function parseLog(raw: string): Commit[];
export function parseNumstat(raw: string): ChangedFile[];
export function parseStatus(raw: string): GitStatus;
export function parseBranches(raw: string, currentBranch?: string | null): Branches;
export function groupByDay(commits: Commit[]): { day: string; commits: Commit[] }[];
export function relativeTime(iso: string, now?: number): string;
export function commitsToMarkdown(commits: Commit[], title?: string): string;
export function createRunnerSource(run: GitRunner, opts?: { label?: string }): GitSource;
export function parseGitHubRepo(input: string): { owner: string; repo: string; ref?: string } | null;
export function createGitHubSource(input: string, fetcher?: typeof fetch): GitSource;
export function createMemorySource(
  commits: Commit[],
  opts?: { label?: string; details?: Record<string, { files: ChangedFile[]; diff?: string }>; status?: GitStatus },
): GitSource;
