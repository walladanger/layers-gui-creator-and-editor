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
//   workBranches({base})           -> { base, branches: [{ name, tip, ahead, current }] }  (local branches vs base)
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

/* ------------------------------ lane graph ------------------------------- */
// A git-style branch graph. layoutGraph() assigns every commit a lane (column) and works out the lines
// that enter, pass through and leave its row; renderGraphRow() draws one row as an SVG string. Both are
// pure and host-neutral, so ClaudeDesktopClient and layers draw identical graphs.
// Commits must be in topological order, newest first (the runner source asks git for --topo-order).

export const GRAPH_COLORS = ["#e8743b", "#4f9fe8", "#4fb286", "#c9a14a", "#b07be0", "#e5645a", "#3cc0c8", "#d9739f"];

export function layoutGraph(commits) {
  let lanes = []; // lane index -> { sha: commit that lane is waiting for, color } | null
  let nextColor = 0;
  const rows = [];
  let maxLane = 0;
  const free = () => { const i = lanes.indexOf(null); return i < 0 ? lanes.length : i; };
  for (const c of commits) {
    const before = lanes.map((l) => (l ? { ...l } : null));
    const hits = [];
    lanes.forEach((l, i) => { if (l && l.sha === c.sha) hits.push(i); });
    let lane;
    if (hits.length) lane = hits[0];
    else { lane = free(); lanes[lane] = { sha: c.sha, color: nextColor++ % GRAPH_COLORS.length }; }
    const color = lanes[lane].color;
    const ins = hits.map((i) => ({ lane: i, color: before[i].color }));
    const through = [];
    before.forEach((l, i) => { if (l && !hits.includes(i)) through.push({ lane: i, color: l.color }); });
    for (const i of hits) lanes[i] = null;
    const outs = [];
    const [first, ...rest] = c.parents || [];
    if (first) {
      const at = lanes.findIndex((l) => l && l.sha === first);
      if (at >= 0) outs.push({ lane: at, color: lanes[at].color });
      else { lanes[lane] = { sha: first, color }; outs.push({ lane, color }); }
    }
    for (const p of rest) {
      const at = lanes.findIndex((l) => l && l.sha === p);
      if (at >= 0) outs.push({ lane: at, color: lanes[at].color });
      else { const s = free(); const col = nextColor++ % GRAPH_COLORS.length; lanes[s] = { sha: p, color: col }; outs.push({ lane: s, color: col }); }
    }
    if (lanes[lane] && lanes[lane].sha === c.sha) lanes[lane] = null; // tip whose parent already has a lane: its own lane ends here
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
    for (const l of [lane, ...ins.map((x) => x.lane), ...through.map((x) => x.lane), ...outs.map((x) => x.lane)]) maxLane = Math.max(maxLane, l);
    rows.push({ sha: c.sha, lane, color, merge: (c.parents || []).length > 1, ins, through, outs });
  }
  return { rows, lanes: maxLane + 1 };
}

const GRAPH_DEFAULTS = { laneWidth: 14, height: 48, radius: 4.5 };

/** One row of the graph as an SVG string (numbers and fixed colours only, safe to inject). */
export function renderGraphRow(row, lanes, opts = {}) {
  const { laneWidth: W, height: H, radius: R } = { ...GRAPH_DEFAULTS, ...opts };
  const x = (l) => l * W + W / 2, mid = H / 2, nx = x(row.lane), col = (c) => GRAPH_COLORS[c % GRAPH_COLORS.length];
  const line = (x1, y1, x2, y2, c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col(c)}"/>`;
  const curve = (d, c) => `<path d="${d}" fill="none" stroke="${col(c)}"/>`;
  let body = "";
  for (const t of row.through) body += line(x(t.lane), 0, x(t.lane), H, t.color);
  for (const i of row.ins) body += i.lane === row.lane ? line(nx, 0, nx, mid, i.color) : curve(`M${x(i.lane)} 0 C${x(i.lane)} ${mid} ${nx} ${H * 0.25} ${nx} ${mid}`, i.color);
  for (const o of row.outs) body += o.lane === row.lane ? line(nx, mid, nx, H, o.color) : curve(`M${nx} ${mid} C${nx} ${H * 0.75} ${x(o.lane)} ${mid} ${x(o.lane)} ${H}`, o.color);
  body += row.merge
    ? `<circle cx="${nx}" cy="${mid}" r="${R - 0.5}" fill="#15110f" stroke="${col(row.color)}" stroke-width="2"/>`
    : `<circle cx="${nx}" cy="${mid}" r="${R}" fill="${col(row.color)}"/>`;
  const w = Math.max(1, lanes) * W;
  return `<svg width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" aria-hidden="true" style="flex:none;display:block;overflow:visible" stroke-width="2" stroke-linecap="round">${body}</svg>`;
}

/** The lines that keep running down through an expanded commit's detail area. */
export function renderGraphGutter(row, lanes, opts = {}) {
  const { laneWidth: W } = { ...GRAPH_DEFAULTS, ...opts };
  const seen = new Set();
  let body = "";
  for (const t of [...row.through, ...row.outs]) {
    if (seen.has(t.lane)) continue; seen.add(t.lane);
    const x = t.lane * W + W / 2;
    body += `<line x1="${x}" y1="0" x2="${x}" y2="100%" stroke="${GRAPH_COLORS[t.color % GRAPH_COLORS.length]}"/>`;
  }
  const w = Math.max(1, lanes) * W;
  return `<svg width="${w}" height="100%" aria-hidden="true" style="flex:none;display:block" stroke-width="2" stroke-linecap="round">${body}</svg>`;
}

/* --------------------- horizontal ("rotated") branch graph ------------------- */

/**
 * Lanes by branch ownership (what the rotated view draws): main/master is the top lane, every other branch gets its
 * own lane below, ordered by where it leaves its parent. A branch owns the commits on its first-parent chain that no
 * older-claiming branch already owns; commits no branch name reaches get an unnamed lane. Commits newest first.
 * @returns {{ rows: Array<{lane:number,color:number,merge:boolean}>, lanes: Array<{name:string,color:number}> }}
 */
export function layoutBranchLanes(commits) {
  const index = new Map(commits.map((c, i) => [c.sha, i]));
  const tips = new Map(); // branch name -> commit index
  const localNames = new Set();
  commits.forEach((c) => (c.refs || []).forEach((r) => { if (r.kind === "branch") localNames.add(r.name); }));
  commits.forEach((c, i) => (c.refs || []).forEach((r) => {
    if (r.kind === "branch" || (r.kind === "remote" && !localNames.has(String(r.name).replace(/^[^/]+\//, "")))) { if (!tips.has(r.name)) tips.set(r.name, i); }
  }));
  const isBase = (n) => /^(?:[^/]+\/)?(main|master)$/.test(n);
  const order = [...tips.keys()].sort((a, b) => (isBase(b) - isBase(a)) || (tips.get(b) - tips.get(a)) || a.localeCompare(b)); // base first, then oldest tip first
  const owner = new Array(commits.length).fill(-1);
  const groups = []; // { name, members: [indices] }
  const claim = (name, from) => {
    const members = [];
    for (let i = from; i !== undefined && owner[i] === -1; i = index.get((commits[i].parents || [])[0])) { owner[i] = groups.length; members.push(i); }
    if (members.length) groups.push({ name, members });
  };
  for (const name of order) claim(name, tips.get(name));
  for (let i = 0; i < commits.length; i++) if (owner[i] === -1) claim("", i);
  // Lane order: the base on top, the rest by where they start (earliest first).
  const ranked = groups.map((g, gi) => ({ gi, g, start: Math.max(...g.members), base: isBase(g.name) }))
    .sort((a, b) => (b.base - a.base) || (b.start - a.start) || a.g.name.localeCompare(b.g.name));
  const laneOf = new Map(ranked.map((r, lane) => [r.gi, lane]));
  const rows = commits.map((c, i) => { const lane = laneOf.get(owner[i]); return { lane, color: lane % GRAPH_COLORS.length, merge: (c.parents || []).length > 1 }; });
  return { rows, lanes: ranked.map((r, lane) => ({ name: r.g.name, color: lane % GRAPH_COLORS.length })) };
}

const H_DEFAULTS = { step: 96, laneHeight: 44, radius: 7, left: 118, top: 30, curve: 14, selected: null };
const xmlEsc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const clip = (t, n) => { t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

/**
 * The same history drawn on its side: one horizontal lane per branch (name pill on the left, main on top),
 * oldest commit at the left and newest at the right, branches leaving and rejoining in rounded curves.
 * Returns { svg, width, height } - the svg holds only numbers, fixed colours and escaped text, so it is safe to inject.
 * Each commit dot carries data-sha so a host can make it clickable.
 * @param {Array} commits newest first, topo-ordered (the same list layoutGraph takes)
 */
export function renderGraphHorizontal(commits, opts = {}) {
  const o = { ...H_DEFAULTS, ...opts };
  const { rows, lanes } = layoutBranchLanes(commits);
  const n = commits.length, laneCount = Math.max(1, lanes.length);
  const col = (c) => GRAPH_COLORS[c % GRAPH_COLORS.length];
  const X = (i) => o.left + (n - 1 - i) * o.step + o.step / 2;
  const Y = (lane) => o.top + lane * o.laneHeight;
  const index = new Map(commits.map((c, i) => [c.sha, i]));
  const r = o.curve;

  const width = o.left + n * o.step + 24;
  const height = o.top + (laneCount - 1) * o.laneHeight + 105;
  let guides = "", edges = "", dots = "", labels = "", pills = "";

  lanes.forEach((nm, l) => {
    guides += `<line x1="${o.left}" y1="${Y(l)}" x2="${width - 12}" y2="${Y(l)}" stroke="#6b6460" stroke-width="1" stroke-dasharray="2 5" opacity=".55"/>`;
    const text = clip(nm.name || `lane ${l + 1}`, 14);
    const w = Math.round(text.length * 7 + 18);
    pills += `<rect x="6" y="${Y(l) - 11}" width="${w}" height="22" rx="7" fill="${col(nm.color)}"/>` +
      `<text x="${6 + w / 2}" y="${Y(l) + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#15110f">${xmlEsc(text)}</text>`;
  });

  rows.forEach((row, i) => {
    const c = commits[i], cx = X(i), cy = Y(row.lane);
    (c.parents || []).forEach((psha, k) => {
      const pi = index.get(psha);
      if (pi === undefined) return;
      const prow = rows[pi], px = X(pi), py = Y(prow.lane);
      const color = col(k === 0 ? row.color : prow.color);
      let d;
      if (prow.lane === row.lane) d = `M${px} ${py} L${cx} ${cy}`;
      else {
        const dir = Math.sign(cy - py) || 1;
        d = k === 0
          ? `M${px} ${py} L${px} ${cy - dir * r} Q${px} ${cy} ${px + r} ${cy} L${cx} ${cy}` // a branch leaves its parent, then runs along its own lane
          : `M${px} ${py} L${cx - r} ${py} Q${cx} ${py} ${cx} ${py + dir * r} L${cx} ${cy}`; // a branch tip joins a merge commit
      }
      edges += `<path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
  });

  rows.forEach((row, i) => {
    const c = commits[i], cx = X(i), cy = Y(row.lane), color = col(row.color);
    const sel = o.selected && o.selected === c.sha;
    const hex = /^[0-9a-f]{4,64}$/i.test(c.sha) ? c.sha : "";
    dots += `<g data-sha="${hex}" style="cursor:pointer"><title>${xmlEsc(`${c.short || String(c.sha).slice(0, 7)} ${c.subject || ""}`)}</title>` +
      (sel ? `<circle cx="${cx}" cy="${cy}" r="${o.radius + 5}" fill="none" stroke="${color}" stroke-width="2" opacity=".6"/>` : "") +
      (row.merge
        ? `<circle cx="${cx}" cy="${cy}" r="${o.radius - 1}" fill="#15110f" stroke="${color}" stroke-width="3.5"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${o.radius}" fill="${color}"/>`) +
      `<circle cx="${cx}" cy="${cy}" r="${o.radius + 7}" fill="transparent"/></g>`;
    const text = xmlEsc(clip(c.subject || c.short, 17));
    labels += `<g transform="rotate(32 ${cx - 6} ${cy + 20})"><rect x="${cx - 8}" y="${cy + 11}" width="${Math.round(text.length * 5.6 + 8)}" height="14" rx="3" fill="#2c2623" opacity=".92"/>` +
      `<text x="${cx - 4}" y="${cy + 21.5}" font-size="10" fill="#cfc7c1">${text}</text></g>`;
  });

  const wrap = (w, vx, inner, label) => `<svg width="${w}" height="${height}" viewBox="${vx} 0 ${w} ${height}"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'} ` +
    `style="display:block;flex:none;font-family:system-ui,sans-serif">${inner}</svg>`;
  const svg = wrap(width, 0, guides + edges + dots + labels + pills, "Branch graph, horizontal");
  // The same picture in two parts, so a host can keep the lane names pinned while the history scrolls.
  const pillsSvg = wrap(o.left, 0, pills);
  const graphSvg = wrap(width - o.left, o.left, guides + edges + dots + labels, "Branch graph, horizontal");
  return { svg, pillsSvg, graphSvg, width, height, left: o.left };
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
      const args = ["log", "--topo-order", `--max-count=${clampInt(limit, 1, 500, 50)}`, `--skip=${clampInt(skip, 0, 1e6, 0)}`, `--format=${LOG_FORMAT}`, "--decorate=short"];
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
    /** Local branches other than `base` (default main/master/current) with how many commits each is ahead of it. */
    async workBranches({ base } = {}) {
      const raw = await run(["for-each-ref", "--format=%(refname:short) %(objectname:short)", "refs/heads"]).catch(() => "");
      const all = raw.split("\n").map((l) => l.trim().split(" ")).filter((x) => x[0] && SAFE_REF.test(x[0])).map(([name, tip]) => ({ name, tip }));
      const names = all.map((b) => b.name);
      const cur = (await this.status()).branch || null;
      const baseName = base && names.includes(base) ? base : names.includes("main") ? "main" : names.includes("master") ? "master" : cur;
      const branches = await Promise.all(all.filter((b) => b.name !== baseName).map(async (b) => {
        const n = baseName ? +(await run(["rev-list", "--count", `${baseName}..${b.name}`]).catch(() => "0")).trim() : 0;
        return { name: b.name, tip: b.tip, ahead: n || 0, current: b.name === cur };
      }));
      return { base: baseName || null, branches };
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
    async workBranches() { return { base: parsed.ref || null, branches: [] }; },
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
    async workBranches() { return { base: "main", branches: [] }; },
    async branches() { return { current: "main", local: ["main"], remote: [], tags: [] }; },
  };
}
