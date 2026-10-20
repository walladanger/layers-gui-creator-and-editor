# git-tracker-core (shared between ClaudeDesktopClient and layers-gui-creator-and-editor)

`gitCore.js` + `gitCore.d.ts` are one portable module. Copy both files, unchanged, into any host.

It has no dependencies and uses no Node, Electron, React or Tauri APIs. A host supplies exactly one thing:

    run(args: string[]) => Promise<string>   // executes `git <args>` in the repo, resolves stdout

and then gets a `GitSource` (see `gitCore.d.ts`): `status`, `log`, `show`, `diff`, `branches`, `head`.
Sources are interchangeable behind that contract:

| Source | Use | `run` / transport |
| --- | --- | --- |
| `createRunnerSource(run)` | a local repo | Electron: `execFile` in main (`electron/gitrun.js`). Tauri: shell plugin `Command`. |
| `createGitHubSource("owner/repo")` | a public GitHub repo | `fetch` |
| `createMemorySource(commits)` | tests, demos | none |

The host's `run` should refuse anything but read-only commands (`log show status rev-parse for-each-ref diff rev-list describe`)
and the flags `--output`, `--ext-diff`, `--textconv`, `-c`, `--git-dir`, `--work-tree`. `electron/gitrun.js` shows the allowlist.

In layers this slots in beside `ProjectSourceAdapter` in `src/services`: components get a `GitSource` from `ServicesProvider`,
never a runner. `test-git.js` (Node, real temp repo) is the reference test for the contract.

## Board (`boardCore.js` + `boardCore.d.ts`)

Second shared module, same rules: copy both files unchanged. `buildBoard({ items, work })` turns items
(`{ id, status: open|plan|doing|done, branch }`) plus `source.workBranches()` into columns
**Open | Plan | (Doing) | one column per working branch | Done**; `moveTo(column)` returns the patch to save;
`finishable(board)` lists cards on branches already merged. Open = identified, Plan = the fix is being planned
(the card carries a plan document), a branch column = work started on that branch.

In layers the cards are the production tasks (`taskTracker.ts`: optional `status`, `branch`, `plan`, `planHistory`; a plan
save appends a revision, nothing is overwritten). The Start button on a branch card dispatches `layers:start-coding`
(`{ id, label, branch, plan }`) for the agent harness to pick up.
