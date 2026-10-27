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

export interface WorkBranch { name: string; tip: string; /** commits not yet in the base branch */ ahead: number; current: boolean }
export interface WorkBranches { base: string | null; branches: WorkBranch[] }

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
  /** Local branches other than the base (default main/master/current) and how far each is ahead of it. */
  workBranches(opts?: { base?: string }): Promise<WorkBranches>;
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

export interface GraphLine { lane: number; color: number }
export interface GraphRow { sha: string; lane: number; color: number; merge: boolean; ins: GraphLine[]; through: GraphLine[]; outs: GraphLine[] }
export interface GraphLayout { rows: GraphRow[]; lanes: number }
export interface GraphOptions { laneWidth?: number; height?: number; radius?: number }
export const GRAPH_COLORS: string[];
/** Commits must be topologically ordered, newest first. */
export function layoutGraph(commits: Commit[]): GraphLayout;
export function renderGraphRow(row: GraphRow, lanes: number, opts?: GraphOptions): string;
export function renderGraphGutter(row: GraphRow, lanes: number, opts?: GraphOptions): string;

/** `svg` is the whole picture; `pillsSvg` (lane names, `left` px wide) and `graphSvg` (the history) are the same picture in two parts. */
export interface HorizontalGraph { svg: string; pillsSvg: string; graphSvg: string; width: number; height: number; left: number }
export interface HorizontalGraphOptions { step?: number; laneHeight?: number; radius?: number; left?: number; top?: number; curve?: number; selected?: string | null }
/** The branch graph drawn on its side: a lane per branch, oldest left, newest right. Dots carry data-sha. */
export function renderGraphHorizontal(commits: Commit[], opts?: HorizontalGraphOptions): HorizontalGraph;
export interface BranchLanes { rows: Array<{ lane: number; color: number; merge: boolean }>; lanes: Array<{ name: string; color: number }> }
/** Lanes by branch ownership: main on top, other branches below ordered by where they leave their parent. */
export function layoutBranchLanes(commits: Commit[]): BranchLanes;
