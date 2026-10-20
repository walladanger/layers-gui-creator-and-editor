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
