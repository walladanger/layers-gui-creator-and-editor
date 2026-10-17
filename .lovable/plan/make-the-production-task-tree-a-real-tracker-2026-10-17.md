# Make the Production task tree a real tracker

Turn the static git-style diagram in the Production list window into an editable, persistent tracker — same look, but you can tick, add, rename and remove tasks.

## What you'll be able to do

- **Tick / untick a task** by clicking its green circle. Unticked tasks show as an empty circle (the styling for this already exists).
- **Add a task** — a small "+" on each row adds a child under it; an "Add task" button at the bottom adds a top-level item.
- **Rename a task** — double-click the label to edit it in place (Enter saves, Escape cancels).
- **Delete a task** — a small "×" appears on hover; deleting a parent also removes its children (with a confirm).
- **Everything is remembered** — your changes survive reloads, in both guest mode and signed-in mode.

## What stays the same

- The exact visual look: purple panel, green check circles, curved git-style branch lines.
- The current task list becomes the built-in starting point, so the first time you open it, it looks exactly like today.
- It stays in the floating Production list window and on the Production page.

## Technical details

- New service `src/services/taskTracker.ts` following the existing patterns:
  - State held in a store with subscribe/getSnapshot (like `originalMenuService`).
  - Persistence via the existing settings service under `extensionSettings['layers.productionTasks']` — validated and versioned, same approach as `radium.canvasLayout`. This avoids adding a database table (production plan §5 is a fixed contract) and works for guests.
  - Task nodes get stable ids (client-generated) so edits and toggles target the right node; the seed data is the current `productionTasks` list.
- `TaskTree.tsx` gains interactive row controls (toggle, add-child, rename, delete) while keeping the current markup and CSS classes; `taskTree.css` gets styles for the open (unticked) circle state, hover controls and the inline rename input.
- No changes to the shell, navigation, bridge protocol, `src-tauri/`, `legacy/` or `public/targets/`.

## Tests

- Unit tests for the store: toggle done (including children staying consistent), add child/sibling, rename, delete subtree, persistence round-trip, and loading the seed on first run.
- Component test: clicking a circle toggles the check; rename and delete flows work.
- Browser check in the preview: tick a task, add one, reload, confirm everything is still there.
- `npm test` and `npm run build` must pass.
