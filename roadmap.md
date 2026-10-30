# Roadmap

- [x] Workspace layout: navigation pages dock on the left with separate edges and move/resize/dock controls; canvas remains on right
- [x] Feature windows: standard 440px left dock, drag to detach, resize, re-dock and switch via dock tabs
- [x] Blank default workspace: no auto-opened Radium/Ollama page; Load Page, Connect App and Assets actions
- [x] Retain multiple distinct loaded screens as frames aligned to the right editing area


- [x] Live bridge 0.6: screenshots, file:line source ids (Vite plugin), route tracking, previews kept through reloads, wheel scrolling in Grab/Comment
- [x] Comments keep a marked screen image and an element image; full-size copies saved for the agent
- [x] Save for agent: `.radium/production/plan.md`, `plan.json` and screenshots written into the app's folder
- [x] Floating mode: keep the desktop app above other windows
- [x] Assets window: shadcn/ui components (live) and Lucide icons, insert into the connected app as a preview plus an agent task
- [ ] More libraries in Assets (other icon sets via Iconify, the app's own components)
- [ ] Publish `radium-bridge` to npm so apps can install it without the Layers folder
- [ ] Inspector controls for the new bridge previews (text, hide, reorder, hover/focus states)
- [ ] MCP server so agents can read the list and mark items done

- [ ] Optional account and per-user GitHub connection for scanning private repositories (awaiting GitHub OAuth client setup)

- [x] Fix Comment box visibility and verify saving, replying, persistence and clipboard copy

- [x] Display every original HTML editing and motion section in the scrollable left panel with unique icons and consistent buttons
- [x] Connect original same-origin demo controls to their existing runtime, including Status greens, saved looks, resets, CSS copy and ten motion effects
- [x] Browser-check all seven style groups and ten motion effects, saved look creation, CSS export and left-panel scrolling
- [x] Build Live App Bridge: connect, select, preview styles, save change records, undo/redo and copy CSS
- [ ] Extend demo-specific presets and ten motion effects to arbitrary apps (needs a reusable effect implementation; live apps now have element styling)
- [x] Verify original actions: presets, selected-item editing, saved-look save/delete/persistence, motion play, confirm boxes

- [x] Arrange Page edit into the eight requested expandable sections in order

- [x] Make Production a clickable parent with Canvas, Comments, and Design system nested underneath

- [x] Enable whole-workspace browser maximize and verify fullscreen/restore
- [x] Test Top/Left effects and correct cramped controls or unnecessary spacing
- [x] Explain the preview's screen-size limits and ways to enlarge the working area
- [x] Compact ribbon demo: title-bar menus, compact dropdown strip, Top/Left selected controls, no empty right inspector

- [x] Restore original Ember Studio look from the foundation screenshots
- [x] Rename the product to Layers Production Studio
- [x] Project scanner (local folder, GitHub repo, demo) that lists editable screens
- [x] Opened folders and repos save as projects that persist across sessions (guest data in localStorage)
- [x] Screens window: cards with drawn previews; clicking one opens it in the canvas
- [x] Real snapshot thumbnails captured from opened screens
- [x] Test snapshot capture and selecting Screens thumbnails
- [x] Remove the login page
- [x] Windows installer build (GitHub Actions)
- [ ] Folder tree browser (option 2)
- [x] Floating Agent connection window with streamed OpenAI-compatible local/remote model chat, current element and production-comment context (opt-in sharing)
- [ ] Direct agent canvas actions: inspect/highlight tool calls, reviewable change proposals, user approval, undo/redo and audit trail
- [ ] Agent-runtime adapters for Claude Code, Codex and MCP, plus model discovery and saved conversations
- [x] Floating tool pill (Use, Grab, Comment, Pins, Notes) and click-to-comment saved to the notes list
- [x] Motion and effects panel (Edge chase, Glow pulse, Warp…) ported from the Radium Panel Lab file
- [x] Style panel with the 15 presets and Corners/Depth/Spacing/Colour sections ported from the Radium Panel Lab file
- [x] Finish and verify Undo / Redo for presets, global style controls and selected-item edits
- [x] Comments become Production tasks with full element record, Copy plan for agent, AI review (suggest-only)
