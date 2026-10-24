# Turn comments into Production tasks

Every comment you pin on the canvas is a to-do for the app. This turns them into Production tasks automatically, keeps the link back to the spot you commented on, and lets you hand the whole list to a coding agent (or me).

## What you'll get

1. **Every comment becomes a task.** When you add a comment with the Comment tool, a matching task appears in the Production list straight away. The comment's kind (Bug, Change, Idea) shows as a coloured tag on the task.
   - **Review by AI Agent** menu on each task (and for the whole list). The AI only suggests; nothing changes until you press **Accept** on a suggestion, and you can **Dismiss** it instead. Starting options:
     - **Rewrite clearly**: turns your comment into a clear task title and steps
     - **Suggest sub-tasks**: breaks a big task into smaller steps
     - **Suggest priority and kind**: proposes Bug/Improvement and High/Normal/Low, with a reason
     - **Write the done-check**: proposes how to confirm it's finished
     - **Find duplicates** (whole list): points out tasks that look like the same request
     - **Ask me questions**: lists what's unclear before anyone builds it
   - Suggestions use the built-in AI (no key needed) and are shown side by side with your original text.
2. **Tasks remember where they came from.** Each task shows the element it's about (for example `button "Save" in Settings panel`) and the screen it was on. Clicking **Show on canvas** opens that screen and highlights the element.
3. **Bring in comments you already made.** A one-time **Import existing comments** button collects the comments already on the page (including the ones in the demo app's own comment panel) and turns each into a task. Comments already imported are skipped, so it's safe to press twice.
4. **Two-way status.** Ticking a task marks its comment done, and resolving a comment ticks its task.
5. **A richer Production list.** Each task gets:
   - Kind: Bug, Improvement, Change, Idea
   - Priority: High, Normal, Low
   - Status: To do, In progress, Done
   - Notes: what "done" looks like (filled from your comment text, editable)
   - Filters at the top: by kind, priority and status
6. **Copy plan for agent.** One button copies all open tasks as a step-by-step plan (where it is, what to do, how to check it's done). Paste it to me in chat and I'll work through it.

## Converting your current comments in chat

Once the import button exists, press it, then press **Copy plan for agent** and paste the result here. I'll turn that into a build plan and work through it with you, one group at a time.

## Technical details

- Comments live in two places: the Canvas comment layer (`CommentService`) and the demo app's own comment panel (read through `OriginalMenuService`). The database currently has no comment rows, so the import must read the demo panel too; guest mode keeps data on this computer.
- Extend `TaskNode` with optional `kind`, `priority`, `status`, `notes`, `source: { commentId, frameRoute, target }`; bump the storage key to v4 and migrate v3 trees (old `done` becomes `status`).
- New `commentTasks.ts` sync: subscribe to comment creation/status changes, create/tick tasks keyed by `commentId` (dedupe), and update comment status when a linked task is ticked.
- "Show on canvas" goes through a small bus like `catalogBus` so the Production window stays decoupled from the canvas; the bridge highlights by `rid`/selector.
- `exportAgentPlan(tasks)` builds markdown, copied via the host clipboard.
- No changes to the §4 bridge protocol or §5 tables, `legacy/`, `src-tauri/`, or target files.

## Tests

- New comment creates exactly one task with the right kind and location; import twice creates no duplicates.
- Ticking a task resolves its comment, and the other way round.
- v3 saved lists load correctly after the upgrade.
- Agent plan includes location, instructions and the done-check for each open task.
- Browser check: add a Bug comment on the demo, see the task appear, tick it, reload.
