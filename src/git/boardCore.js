// board-core: host-neutral kanban logic for production items.
//
// Columns:  Open | Plan | (Doing) | one "in progress" column per working branch | Done
// A working branch is a local git branch with commits not yet in the base branch (see gitCore workBranches).
// With three branches - main plus two being worked on - the board has two in-progress columns.
//
// Pure functions, no dependencies, no UI and no storage: a host hands in its items (anything with
// { id, status: "open" | "plan" | "doing" | "done", branch?: string | null }) and the git branch info, draws the columns,
// and writes back the patch that move() returns. Used identically by ClaudeDesktopClient (Notes) and
// layers-gui-creator-and-editor (production tasks).

/**
 * @param {{ items: Array<{id:string,status:string,branch?:string|null}>,
 *           work?: { base: string|null, branches: Array<{name:string, ahead:number, current?:boolean}> } }} input
 */
export function buildBoard({ items, work }) {
  const branches = (work && work.branches) || [];
  const byName = new Map(branches.map((b) => [b.name, b]));
  const doingOn = new Set(items.filter((i) => i.status === "doing" && i.branch).map((i) => i.branch));

  // Open = identified (a bug or idea, no fix worked out yet). Plan = the fix is being planned; the card carries the plan document.
  const open = { id: "open", kind: "open", title: "Open", items: [] };
  const plan = { id: "plan", kind: "plan", title: "Plan", items: [] };
  const columns = [open, plan];
  const generic = { id: "doing", kind: "doing", title: "Doing", items: [] };

  // Branch columns: every branch with work ahead of base, plus any branch that still has cards on it.
  const shown = new Map();
  for (const b of branches) if (b.ahead > 0 || doingOn.has(b.name)) shown.set(b.name, b);
  for (const name of doingOn) if (!shown.has(name)) shown.set(name, { name, ahead: 0, missing: true });
  const branchCols = [...shown.values()]
    .sort((a, b) => Number(!!b.current) - Number(!!a.current) || a.name.localeCompare(b.name))
    .map((b) => ({
      id: "branch:" + b.name, kind: "branch", title: b.name, branch: b.name, ahead: b.ahead || 0, current: !!b.current,
      // idle = nothing ahead of base: merged, or not started. The host can offer to finish these cards.
      idle: !b.ahead, missing: !!b.missing, items: [],
    }));
  const colById = new Map(branchCols.map((c) => [c.id, c]));
  const done = { id: "done", kind: "done", title: "Done", items: [] };

  for (const item of items) {
    if (item.status === "done") done.items.push(item);
    else if (item.status === "doing") {
      const col = item.branch && colById.get("branch:" + item.branch);
      (col || generic).items.push(item);
    } else if (item.status === "plan") plan.items.push(item);
    else open.items.push(item);
  }

  // The plain Doing column is always there for a main-only workflow, and otherwise only when something is in it.
  if (!branchCols.length || generic.items.length) columns.push(generic);
  columns.push(...branchCols, done);
  return { base: (work && work.base) || null, columns, known: new Set(byName.keys()) };
}

/** The patch to write when an item is dropped on `column`. Nothing is deleted: a host appends it as an update event. */
export function moveTo(column) {
  switch (column.kind) {
    case "open": return { status: "open", branch: null };
    case "plan": return { status: "plan", branch: null };
    case "doing": return { status: "doing", branch: null };
    case "branch": return { status: "doing", branch: column.branch };
    case "done": return { status: "done" }; // keeps the branch it was done on
    default: throw new Error("Unknown column");
  }
}

/** Ids of cards sitting on branches with nothing ahead of base - i.e. probably merged - ready to move to Done. */
export function finishable(board) {
  return board.columns.filter((c) => c.kind === "branch" && c.idle && !c.missing).flatMap((c) => c.items.map((i) => i.id));
}

export function columnOf(board, id) {
  return board.columns.find((c) => c.items.some((i) => i.id === id)) || null;
}
