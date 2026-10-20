// git-tracker-core: host-neutral git commit tracking.
//
// One file, no dependencies, no Electron, no React, no Node APIs. The same file
// runs in ClaudeDesktopClient (Electron) and walladanger/layers-gui-creator-and-editor
// (Tauri). Only ONE thing is host-specific: a `run(args) => Promise<string>` that
// executes `git <args>` in the chosen repo (Electron: execFile in the main process,
// Tauri: the shell plugin). Everything else - command building, parsing, grouping,
// the GitHub and in-memory sources - lives here.
//
// A "source" is the adapter contract the UI talks to (see gitCore.d.ts):
//   status()                       -> { available, branch, upstream, ahead, behind, files[] }
//   log({limit,skip,ref,search,path}) -> Commit[]
//   show(sha)                      -> { commit, files[], additions, deletions }
//   diff(sha, path)                -> string (unified diff)
//   branches()                     -> { current, local[], remote[], tags[] }
//   head()                         -> sha   (cheap change detector for auto-refresh)
//
// Read-only by construction: nothing here writes to a repository.

const FS = "\x1f"; // field separator
const RS = "\x1e"; // record separator

/** `git log` format string - parseLog() is its inverse. */
export const LOG_FORMAT = ["%H", "%h", "%an", "%ae", "%aI", "%P", "%D", "%s", "%b"].join(FS) + RS;

/* --------------------------------- parsing -------------------------------- */

/** "HEAD -> main, origin/main, tag: v1.2" -> [{kind,name}] */
export function parseRefs(decoration) {
  const out = [];
  for (let part of String(decoration || "").split(",")) {
    part = part.trim();
    if (!part) continue;
    if (part.startsWith("HEAD -> ")) {
      out.push({ kind: "head", name: "HEAD" });
      out.push({ kind: "branch", name: part.slice(8) });
    } else if (part === "HEAD") out.push({ kind: "head", name: "HEAD" });
    else if (part.startsWith("tag: ")) out.push({ kind: "tag", name: part.slice(5) });
    else if (part.includes("/")) out.push({ kind: "remote", name: part });
    else out.push({ kind: "branch", name: part });
  }
  return out;
}

/** Conventional-commit type of a subject ("fix(ui): x" -> "fix"), or null. */
export function commitType(subject) {
  const m = /^(\w+)(\([^)]*\))?!?:\s/.exec(subject || "");
  return m ? m[1].toLowerCase() : null;
}

export function parseLog(raw) {
  const commits = [];
  for (const rec of String(raw || "").split(RS)) {
    const text = rec.replace(/^\n+/, "");
    if (!text.trim()) continue;
    const f = text.split(FS);
    if (f.length < 8) continue; // torn record
    commits.push({
      sha: f[0], short: f[1], author: f[2], email: f[3], date: f[4],
      parents: f[5] ? f[5].split(" ") : [],
      refs: parseRefs(f[6]),
      subject: f[7],
      body: (f[8] || "").trim(),
      type: commitType(f[7]),
    });
  }
  return commits;
}

/** `git show --numstat --format=` -> files with +/- counts. Handles renames and binaries. */
export function parseNumstat(raw) {
  const files = [];
  for (const line of String(raw || "").split("\n")) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (!m) continue;
    const binary = m[1] === "-";
    let path = m[3], oldPath = null;
    const brace = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(path);
    if (brace) { oldPath = (brace[1] + brace[2] + brace[4]).replace(/\/\//g, "/"); path = (brace[1] + brace[3] + brace[4]).replace(/\/\//g, "/"); }
    else if (path.includes(" => ")) { [oldPath, path] = path.split(" => "); }
    files.push({ path, oldPath, additions: binary ? 0 : +m[1], deletions: binary ? 0 : +m[2], binary });
  }
  return files;
}

const STATE = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "copied", U: "conflict", "?": "untracked", "!": "ignored", T: "typechange" };

/** `git status --porcelain=v1 -b` */
export function parseStatus(raw) {
  const lines = String(raw || "").split("\n").filter(Boolean);
  const res = { available: true, branch: null, upstream: null, ahead: 0, behind: 0, detached: false, files: [] };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      const head = line.slice(3);
      const m = /^(.*?)(?:\.\.\.(\S+))?(?: \[(.*)\])?$/.exec(head) || [];
      res.branch = (m[1] || head).replace(/^No commits yet on /, "");
      res.detached = /^HEAD \(no branch\)/.test(head);
      res.upstream = m[2] || null;
      const ab = m[3] || "";
      res.ahead = +(/ahead (\d+)/.exec(ab)?.[1] || 0);
      res.behind = +(/behind (\d+)/.exec(ab)?.[1] || 0);
      continue;
    }
    const x = line[0], y = line[1];
    let path = line.slice(3);
    if (path.includes(" -> ")) path = path.split(" -> ")[1];
    const staged = x !== " " && x !== "?" && x !== "!";
    const code = x === "?" ? "?" : (staged ? x : y);
    res.files.push({ path: path.replace(/^"|"$/g, ""), staged, state: STATE[code] || "modified", code: x + y });
  }
  return res;
}

export function parseBranches(raw, currentBranch) {
  const out = { current: currentBranch || null, local: [], remote: [], tags: [] };
  for (const line of String(raw || "").split("\n")) {
    const [ref, name] = line.trim().split(" ");
    if (!ref || !name) continue;
    if (ref === "refs/heads") out.local.push(name);
    else if (ref === "refs/remotes" && !name.endsWith("/HEAD")) out.remote.push(name);
    else if (ref === "refs/tags") out.tags.push(name);
  }
  return out;
}

/* --------------------------------- helpers -------------------------------- */

/** Group commits (newest first) under their local calendar day. */
export function groupByDay(commits) {
  const groups = [];
  for (const c of commits) {
    const day = String(c.date).slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.commits.push(c);
    else groups.push({ day, commits: [c] });
  }
  return groups;
}

export function relativeTime(iso, now = Date.now()) {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (!isFinite(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return String(iso).slice(0, 10);
}

/** Markdown changelog for a list of commits (for pasting into a production list). */
export function commitsToMarkdown(commits, title = "Commits") {
  const lines = [`# ${title}`, ""];
  for (const g of groupByDay(commits)) {
    lines.push(`## ${g.day}`, "");
    for (const c of g.commits) lines.push(`- \`${c.short}\` ${c.subject} - ${c.author}`);
    lines.push("");
  }
  return lines.join("\n");
}

/* ------------------------- source: any git runner -------------------------- */

const clampInt = (n, lo, hi, dflt) => { n = Math.floor(+n); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const SAFE_REF = /^[\w][\w./@^~-]{0,200}$/; // no leading "-" so a ref can never be read as an option
const SAFE_SHA = /^[0-9a-f]{4,40}$/i;

/**
 * Source backed by a real repository. `run(args)` must execute `git <args>`
 * in the repo and resolve with stdout (reject on non-zero exit).
 */
export function createRunnerSource(run, { label = "local" } = {}) {
  const sha = (s) => { if (!SAFE_SHA.test(s || "")) throw new Error("Bad commit id"); return s; };
  return {
    label,
    kind: "local",
    async head() { return (await run(["rev-parse", "HEAD"])).trim(); },
    async status() {
      try { return parseStatus(await run(["status", "--porcelain=v1", "-b"])); }
      catch (e) { return { available: false, error: String(e.message || e), files: [], ahead: 0, behind: 0 }; }
    },
    async log({ limit = 50, skip = 0, ref, search, path } = {}) {
      const args = ["log", `--max-count=${clampInt(limit, 1, 500, 50)}`, `--skip=${clampInt(skip, 0, 1e6, 0)}`, `--format=${LOG_FORMAT}`, "--decorate=short"];
      if (search) args.push("-i", "--fixed-strings", `--grep=${String(search).slice(0, 200)}`);
      if (ref) { if (!SAFE_REF.test(ref)) throw new Error("Bad ref"); args.push(ref); }
      else args.push("--all");
      if (path) args.push("--", String(path));
      try { return parseLog(await run(args)); }
      catch (e) { if (/does not have any commits|unknown revision/i.test(String(e.message))) return []; throw e; }
    },
    async show(id) {
      id = sha(id);
      const [meta, nums] = await Promise.all([
        run(["show", "-s", `--format=${LOG_FORMAT}`, "--decorate=short", id]),
        run(["show", "--numstat", "--format=", "-M", id]),
      ]);
      const files = parseNumstat(nums);
      return { commit: parseLog(meta)[0], files, additions: files.reduce((a, f) => a + f.additions, 0), deletions: files.reduce((a, f) => a + f.deletions, 0) };
    },
    async diff(id, path) {
      id = sha(id);
      const args = ["show", "--format=", "--no-color", "--no-ext-diff", "-M", id];
      if (path) args.push("--", String(path));
      return run(args);
    },
    async branches() {
      const [st, refs] = await Promise.all([
        this.status(),
        run(["for-each-ref", "--format=%(refname:rstrip=-2) %(refname:short)", "refs/heads", "refs/remotes", "refs/tags"]).catch(() => ""),
      ]);
      return parseBranches(refs, st.branch);
    },
  };
}

/* ---------------------------- source: GitHub API --------------------------- */

/** Parses `owner/repo`, `owner/repo@branch` or a github.com URL. */
export function parseGitHubRepo(input) {
  const s = String(input || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  const m = s.match(/^([\w.-]+)\/([\w.-]+)(?:(?:@|\/tree\/)([\w./-]+))?$/);
  return m ? { owner: m[1], repo: m[2], ref: m[3] } : null;
}

function fromGitHub(c) {
  const msg = c.commit?.message || "";
  const nl = msg.indexOf("\n");
  const subject = nl < 0 ? msg : msg.slice(0, nl);
  return {
    sha: c.sha, short: c.sha.slice(0, 7),
    author: c.commit?.author?.name || c.author?.login || "", email: c.commit?.author?.email || "",
    date: c.commit?.author?.date || "", parents: (c.parents || []).map((p) => p.sha), refs: [],
    subject, body: nl < 0 ? "" : msg.slice(nl + 1).trim(), type: commitType(subject),
  };
}

/** Read-only commit history of a public GitHub repo (no working tree, so no status). */
export function createGitHubSource(input, fetcher = (...a) => fetch(...a)) {
  const parsed = parseGitHubRepo(input);
  if (!parsed) throw new Error("Use the form owner/repo or a github.com link.");
  const { owner, repo } = parsed;
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const json = async (url) => {
    const res = await fetcher(url, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) throw new Error("Repository not found. Private repos are not supported.");
    if (res.status === 403) throw new Error("GitHub rate limit reached. Try again in a few minutes.");
    if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
    return res.json();
  };
  return {
    label: `${owner}/${repo}`,
    kind: "github",
    async head() { return (await json(`${api}/commits?per_page=1${parsed.ref ? `&sha=${encodeURIComponent(parsed.ref)}` : ""}`))[0]?.sha || ""; },
    async status() { return { available: false, error: "GitHub sources have no working tree.", files: [], ahead: 0, behind: 0 }; },
    async log({ limit = 50, skip = 0, ref, search, path } = {}) {
      limit = clampInt(limit, 1, 100, 50);
      const page = Math.floor(clampInt(skip, 0, 1e6, 0) / limit) + 1;
      const q = new URLSearchParams({ per_page: String(limit), page: String(page) });
      if (ref || parsed.ref) q.set("sha", ref || parsed.ref);
      if (path) q.set("path", path);
      const list = (await json(`${api}/commits?${q}`)).map(fromGitHub);
      return search ? list.filter((c) => (c.subject + " " + c.body).toLowerCase().includes(String(search).toLowerCase())) : list;
    },
    async show(id) {
      const c = await json(`${api}/commits/${encodeURIComponent(id)}`);
      const files = (c.files || []).map((f) => ({ path: f.filename, oldPath: f.previous_filename || null, additions: f.additions, deletions: f.deletions, binary: !f.patch && f.changes === 0 && f.status !== "renamed" }));
      return { commit: fromGitHub(c), files, additions: c.stats?.additions ?? 0, deletions: c.stats?.deletions ?? 0 };
    },
    async diff(id, path) {
      const c = await json(`${api}/commits/${encodeURIComponent(id)}`);
      return (c.files || []).filter((f) => !path || f.filename === path).map((f) => `--- a/${f.previous_filename || f.filename}\n+++ b/${f.filename}\n${f.patch || "(no textual diff)"}`).join("\n");
    },
    async branches() {
      const list = await json(`${api}/branches?per_page=100`);
      return { current: parsed.ref || null, local: list.map((b) => b.name), remote: [], tags: [] };
    },
  };
}

/* ----------------------------- source: in memory --------------------------- */

/** Fixed data - for tests, demos and previews. `details[sha]` = { files, diff }. */
export function createMemorySource(commits, { label = "memory", details = {}, status } = {}) {
  return {
    label, kind: "memory",
    async head() { return commits[0]?.sha || ""; },
    async status() { return status || { available: false, error: "No working tree.", files: [], ahead: 0, behind: 0 }; },
    async log({ limit = 50, skip = 0, search } = {}) {
      const q = String(search || "").toLowerCase();
      return commits.filter((c) => !q || c.subject.toLowerCase().includes(q)).slice(skip, skip + limit);
    },
    async show(id) {
      const commit = commits.find((c) => c.sha.startsWith(id));
      if (!commit) throw new Error("Unknown commit");
      const files = details[commit.sha]?.files || [];
      return { commit, files, additions: files.reduce((a, f) => a + f.additions, 0), deletions: files.reduce((a, f) => a + f.deletions, 0) };
    },
    async diff(id) { const c = commits.find((x) => x.sha.startsWith(id)); return (c && details[c.sha]?.diff) || ""; },
    async branches() { return { current: "main", local: ["main"], remote: [], tags: [] }; },
  };
}
