# Radium Panel Lab Studio: Production Plan

> **For agentic workers (Lovable, Claude Code, Codex):** Work one phase at a time, in order. Each phase ends with acceptance checks; do not start the next phase until they pass. Keep every rule in **Global Constraints**. The wire protocol (§4) and the data model (§5) are shared contracts between the Lovable web app and the local bridge. Change them only by editing this file first.

**Goal:** Turn Radium Panel Lab (one HTML file that edits a mock of one Radium screen) into a full visual editor. It loads any app you are building, lets you grab and visually change anything in it, records every change, and compiles the changes into a **production list** that a coding agent implements in the real source code.

**Architecture:** The editor is a React web app built on the **Ember Studio Foundation** shell (title bar, navigation, internal windows, design tokens, typed services). It shows the **real running app** in iframes on a pan-and-zoom canvas. A small **bridge script** inside the target app reports elements, their source location and their styles, and applies *preview-only* changes. The editor never rewrites the target's HTML into code. It records structured **change records** (what, where in the source, before, after). It compiles them into a production list in Markdown and JSON. Agents read that list from the repo, from the clipboard, or through an MCP server, then mark items done.

**Tech stack:** React 19, TypeScript, Vite, Tailwind, lucide-react (from Ember). Lovable Cloud (Supabase) for auth, Postgres, storage, realtime and edge functions. A local Node package `radium-bridge` (Vite plugin, bridge client and MCP server), built outside Lovable. Tauri 2 (Ember's `src-tauri`) for the desktop build later.

**Sources:**
- Your repos: [walladanger/radium-panel-lab](https://github.com/walladanger/radium-panel-lab) (its `HANDOFF.md` and `README.md`) and [walladanger/ember-studio-foundation](https://github.com/walladanger/ember-studio-foundation) (its README, `docs/architecture/backend-boundary.md` and the foundation design spec).
- Reference editors: [onlook-dev/onlook](https://github.com/onlook-dev/onlook), [plasmicapp/plasmic](https://github.com/plasmicapp/plasmic), [facebook/astryx](https://github.com/facebook/astryx) and [nexu-io/open-design](https://github.com/nexu-io/open-design).

---

## 1. The key decision: run the real app, record intent, let an agent write the code

You asked whether to (a) run the real app inside the editor, or (b) render a page as HTML, edit the HTML, then convert it back to code. **Do (a), and record changes instead of converting HTML.**

| Approach | Verdict | Why |
| --- | --- | --- |
| Render a static HTML copy, edit it, convert the HTML back to React | ❌ | The conversion loses components, props, state, loops, Tailwind classes and conditional rendering. Every reference editor avoids it. |
| Run the real app in an iframe, edit the code directly with AST rewrites (Onlook) | Later, for safe edits only | Precise, but fragile across frameworks. Worth having for text and Tailwind class edits (Phase 12). |
| **Run the real app in an iframe, preview the edits live, record structured change records, and hand an agent a production list** | ✅ **Core** | It works on any framework the bridge can see. Changes are non-destructive and reviewable. It matches your goal of a list for an agent. Radium Panel Lab already works this way: edits are CSS overrides, never DOM changes. |

How the editor knows where an element lives in the code (this idea comes from Onlook's `data-oid` and Plasmic's canvas host):
- In dev builds, a Vite plugin adds `data-rid="src/components/OllamaPanel.tsx:142:8"` and `data-rcomp="OllamaPanel"` to every JSX element.
- Unlike Onlook's opaque ids, the location is in plain sight, so the production list can say **file:line** directly and an agent needs no lookup table.
- Apps without the plugin still work. The editor falls back to the stable selectors already in Radium (`pathOf`, preferring `data-testid`, `data-k` and `id`), plus a text snippet and a screenshot.

---

## 2. Best ideas taken from each reference, and where they land

| From | Idea | Lands in |
| --- | --- | --- |
| **Radium Panel Lab** (yours) | Grab tool (nearest block, click again to go inside, Alt+click for the exact element), move, 8-handle resize, corner dot, squircle `corner-shape`, reorder, delete or restore, undo and redo, inspector with 12 quick looks, copy and paste style, pinned comments with replies, 10 motion effects, Style Lab with 15 presets, saved looks, Reset to original, "Copy for Claude", queued writes | Phases 5–9, ported almost 1:1 |
| **Ember Studio** (yours) | Shell, internal and external windows, colour profiles, typed service contracts, settings, notifications, dialogs, tooltips, Tauri boundary | Phases 0–1, the base of everything |
| **Onlook** | Live app in an iframe, a preload script injected into the target, instrumented JSX mapping DOM to code, a canvas of multiple frames, a layers panel, a Tailwind style panel, branches and checkpoints, a code view beside the design, right-click "open in code", drawing in new divs, AI chat with code access | Phases 3, 4, 6, 11, 12 |
| **Plasmic** | A canvas host inside the user's own app, a component registry with props, variants and states (hover, focus, disabled), responsive breakpoints as artboards, design tokens, branching, a content-creator mode with guardrails | Phases 4, 5, 8, 11 |
| **Astryx** | Theme as a set of CSS custom property overrides, strong naming conventions, docs and CLI built for agents and people alike, "swizzle" (eject the source of a component) | Phase 8 (tokens), Phase 9 (agent-readable output), §5 naming |
| **OpenDesign** | `DESIGN.md` as the brand contract read by every agent, separate **Edit / Comment / Tweaks / Draw** modes, a tweaks manifest, an MCP server agents install with one command, skills and plugins as portable folders, BYOK model proxy | Phases 7, 8, 10, local track L2 |

---

## 3. System overview

```
┌──────────────────────────── Radium Panel Lab Studio (web app, Lovable) ─────────────────────────────┐
│ Ember shell: title bar · nav rail · internal windows · status bar · colour profiles                   │
│ ┌ Layers ┐ ┌──────────── Canvas (pan/zoom) ─────────────┐ ┌ Inspector / Comments / Production ┐     │
│ │ tree   │ │ Frame: /settings @1440   Frame: /settings @390│ │ style · tokens · motion · list    │     │
│ │        │ │ ┌ iframe: target app + bridge ┐  ┌ iframe ┐  │ │                                   │     │
│ └────────┘ │ └─────────────────────────────┘  └────────┘  │ └───────────────────────────────────┘     │
│            │ Editor overlay: hover box, selection, handles, comment pins, drawings                  │
│            └────────────────────────────────────────────────────────────────────────────────────────┘
│ Services (typed adapters): ProjectService · BridgeService · ChangeService · ProductionService ...    │
└────────────┬───────────────────────────────────────────────────────────────┬───────────────────────────┘
             │ postMessage (radium v1 protocol, §4)                           │ Supabase client
┌────────────▼──────────────┐                                  ┌──────────────▼──────────────────────────┐
│ Target app (localhost dev) │                                  │ Lovable Cloud: Postgres + RLS, Storage  │
│ radium-bridge client       │                                  │ (screenshots), Realtime, Edge functions │
│ vite plugin → data-rid     │                                  │ compile-production-list · agent-api     │
└────────────────────────────┘                                  └──────────────▲──────────────────────────┘
                                                                               │ HTTPS + agent token
                                         ┌─────────────────────────────────────┴──────────────┐
                                         │ radium-bridge CLI (local): MCP server for Claude    │
                                         │ Code / Codex, writes .radium/production/*.md|json   │
                                         └────────────────────────────────────────────────────┘
```

Three ways to load a target:
1. **Live:** the dev server URL, for example `http://localhost:5173`, with the bridge loaded by the Vite plugin or a `<script>` tag. This gives full source mapping.
2. **Demo:** the existing Radium Ollama mock (`radium-panel-lab/index.html`), served from `public/targets/radium-mock.html` with the bridge included. The app works with zero setup and is the test fixture.
3. **Snapshot:** a URL or HTML file loaded into a sandboxed `srcdoc` iframe with the bridge injected. There is no source map, so the editor uses selectors, text and screenshots.

---

## 4. Contract A: the bridge wire protocol (`radium` v1)

Every message uses the envelope `{ ns: "radium", v: 1, id: string, type: string, payload: object }`. A reply reuses `id` and has `type` + `.ok` or `type` + `.err` (with `{ code, message }`).

**Security:**
- The editor accepts messages only from the frame's origin.
- The bridge accepts commands only from origins in its allowlist. That is `?radium-editor=<origin>` on first load, stored in sessionStorage, plus the default `http://localhost:*` and the Lovable app origin.
- Preview changes are never persisted inside the target.

| Type (editor → bridge) | Payload | Reply payload |
| --- | --- | --- |
| `hello` | `{ editorVersion }` | `{ bridgeVersion, url, title, framework: "react"\|"unknown", hasSourceMap: boolean }` |
| `tree.get` | `{ rootNid?, depth? }` | `{ nodes: RNode[] }` |
| `hit.test` | `{ x, y, mode: "block"\|"exact" }` | `{ nid } \| { nid: null }` |
| `rect.watch` | `{ nids: string[] }` | stream of `rect.update` events `{ rects: Record<nid, Rect> }` (rAF-throttled) |
| `style.get` | `{ nid }` | `{ computed: Record<string,string>, inline: Record<string,string>, classList: string[] }` (curated subset, §5 `STYLE_PROPS`) |
| `preview.style` | `{ nid, scope: "instance"\|"all", props: Record<string,string> }` | `{}`. Applied through a `<style id="radium-preview">` rule keyed by `[data-rnid]` or `[data-rid]` |
| `preview.text` | `{ nid, text }` | `{}` |
| `preview.order` | `{ parentNid, orderedNids }` | `{}` (CSS `order` on a flex column, as Radium does now) |
| `preview.hide` | `{ nid, hidden }` | `{}` |
| `preview.clear` | `{ nid? }` | `{}` |
| `state.force` | `{ nid, state: "hover"\|"focus"\|"active"\|"disabled"\|null }` | `{}` |
| `screenshot` | `{ nid?, padding? }` | `{ dataUrl }` (PNG, via `modern-screenshot`) |
| `tokens.get` | `{}` | `{ vars: Record<string,string> }` (custom properties on `:root`) |
| `nav.go` | `{ path }` | `{}` |

| Event (bridge → editor) | Payload |
| --- | --- |
| `ready` | same as the `hello` reply |
| `route.changed` | `{ url }` |
| `dom.changed` | `{ reason: "hmr"\|"mutation" }` (debounced 150 ms; the editor re-resolves its selection) |

`RNode = { nid, rid?: "path:line:col", comp?: string, tag, label, text?, childNids: string[], instanceIndex: number, instanceCount: number, selector: string }`. `nid` is per page load. `rid` survives reloads. `selector` is the fallback Radium `pathOf()` builds.

---

## 5. Contract B: data model (Lovable Cloud / Postgres)

All tables have `id uuid pk`, `created_at` and `updated_at`. Row-level security is on everywhere: a row is visible to the project owner and the project's members.

| Table | Key columns |
| --- | --- |
| `projects` | `owner_id`, `name`, `target_url`, `target_mode` (`live\|demo\|snapshot`), `repo_url`, `framework`, `design_md text` |
| `project_members` | `project_id`, `user_id`, `role` (`owner\|editor\|commenter`) |
| `frames` | `project_id`, `route`, `label`, `width`, `height`, `canvas_x`, `canvas_y`, `breakpoint` (`desktop\|tablet\|mobile\|custom`) |
| `sessions` | `project_id`, `name`, `status` (`open\|compiled\|archived`), `parent_session_id` (for branching), `base_commit` |
| `change_records` | `session_id`, `frame_id`, `kind` (`style\|text\|move\|resize\|reorder\|hide\|delete\|insert\|token\|motion\|state-style\|note`), `target jsonb` (`{rid, comp, selector, label, textSnippet, instanceScope, breakpoint}`), `before jsonb`, `after jsonb`, `css text`, `tailwind_hint text`, `screenshot_before`, `screenshot_after`, `superseded_by uuid` |
| `comments` | `project_id`, `session_id`, `frame_id`, `target jsonb`, `px`, `py`, `text`, `status` (`open\|done`), `author_kind` (`user\|agent`) |
| `comment_replies` | `comment_id`, `author_kind`, `author_id`, `text` |
| `annotations` | `comment_id?`, `frame_id`, `shapes jsonb` (pen, arrow, rect and ellipse in frame coordinates), `color` |
| `production_lists` | `session_id`, `version int`, `markdown text`, `json jsonb`, `status` (`draft\|handed-off\|done`) |
| `production_items` | `list_id`, `seq int`, `title`, `file`, `line`, `component`, `instructions text`, `acceptance text[]`, `change_record_ids uuid[]`, `priority` (`p1\|p2\|p3`), `status` (`queued\|in-progress\|done\|rejected\|needs-info`), `agent`, `agent_note`, `pr_url` |
| `design_tokens` | `project_id`, `name` (`--radius-md`), `value`, `group` (`color\|radius\|space\|shadow\|font\|motion`), `source` (`imported\|edited`) |
| `looks` | `project_id`, `name`, `style jsonb`, `edits jsonb` (Radium's saved looks) |
| `agent_tokens` | `project_id`, `label`, `token_hash`, `last_used_at`, `revoked_at` (the plaintext is shown once on creation) |

Storage bucket: `screenshots/{project_id}/{change_record_id}-{before|after}.png`.

**Production list JSON** (`radium-production.json`, schema v1). Agents rely on this, so keep it stable:

```json
{ "schema": "radium-production/v1", "project": "Radium", "session": "Runtimes polish", "version": 3,
  "designMd": "DESIGN.md", "generatedAt": "2026-10-09T12:00:00Z",
  "items": [{ "id": "RPL-012", "title": "Round model rows to 12px and add a soft glow",
    "file": "web-app/src/containers/runtimes/OllamaPanel.tsx", "line": 142, "component": "ModelRow",
    "scope": "all-instances", "breakpoint": "all",
    "changes": [{ "kind": "style", "property": "border-radius", "before": "8px", "after": "12px", "token": "--radius-lg" }],
    "css": "border-radius: 12px; box-shadow: 0 0 18px rgb(56 189 248 / .35);",
    "tailwindHint": "rounded-xl shadow-[0_0_18px_rgb(56_189_248/.35)]",
    "instructions": "…", "acceptance": ["All model rows render 12px corners", "…"],
    "screenshots": { "before": "…", "after": "…" }, "comments": ["…"], "status": "queued" }] }
```

`STYLE_PROPS`, the curated set the inspector edits, comes from Radium's `STYLE_KEYS`: position (`translate`, `width`, `height`, `rotate`, `scale`, `z-index`), box (`padding*`, `margin*`, `gap`, `display`, `flex-direction`, `justify-content`, `align-items`, `grid-template-columns`), shape (`border-*-radius`, `corner-shape`), edge (`border-width`, `border-style`, `border-color`), fill (`background`, gradients), text (`color`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-shadow`), effects (`box-shadow`, `backdrop-filter`, `opacity`).

---

## Global Constraints

- **Base:** Ember Studio Foundation's structure, conventions and look. Reusable infrastructure goes in its shared folders. Editor features go in `src/features/<feature>`. Components call typed services in `src/services`, never Supabase or `postMessage` directly. Keep the smoky-black surface and blue accents, with glass only for secondary panels.
- **Stack:** React 19 + TypeScript + Vite + Tailwind + lucide-react. Do not switch to Next.js. Keep `src-tauri/` untouched and building; the browser build must not import `@tauri-apps/*` outside existing adapters.
- **Non-destructive editing:** the editor never writes into the target app's files from the browser in Phases 1–11. Every visual change is a preview plus a change record.
- **Local-first resilience:** every write goes through a queued writer (Radium's `queued` and `flushEdits` pattern). A failed network write keeps the edit locally and retries. The user never loses an edit.
- **Browsers:** Chrome and Edge 139+ for full fidelity (`corner-shape`). Other browsers get plain rounded corners and everything else.
- **Keyboard map (keep Radium's):** `V` grab · `C` comment · `D` draw · `M` motion · `N` notes · `I` inspector · `Del` delete · `R` reset item · `Alt+↑/↓` parent and child · arrows nudge 1 px, `Shift`+arrow 10 px · `Ctrl+Z` / `Ctrl+Shift+Z` · `Esc` step back · `Space`+drag pan · `Ctrl+wheel` zoom · `P` production list.
- **Copy style:** plain, short, sentence-case labels; no jargon in the UI.
- **Tests:** Vitest + Testing Library for units and components, and Playwright for the canvas against the demo target. Each phase adds tests. `npm test` and `npm run build` must pass at the end of each phase.

## Review Focus (cases nobody asked for that will bite first)

1. **Target without the bridge, or that refuses to be framed** (`X-Frame-Options`, CSP `frame-ancestors`). Show a clear "Connect your app" card with the one-line install, and offer Snapshot mode. Never show a silent blank frame. *Test: Phase 3, `FrameHost shows connect card when no ready event within 3 s`.*
2. **Hot reload or a re-render while something is selected.** On `dom.changed`, re-resolve the selection by `rid` + `instanceIndex`, then by `selector`. If both fail, keep the change records and mark the selection "lost" without crashing. *Test: Phase 4.*
3. **Repeated elements** (a list of model rows sharing one `rid`). The first style edit asks "This one / All N", and the choice is recorded as `instanceScope`. *Test: Phase 5.*
4. **The same property edited many times.** The compiler collapses it to one change (first `before`, last `after`) and drops changes that end where they started. *Test: Phase 9.*
5. **Offline or a Supabase error mid-session.** Edits keep working and queue, a status-bar badge shows "N unsynced", and they replay in order on reconnect. *Test: Phase 2.*

---

## Phases

Phases 0–12 run in **Lovable** unless marked **[Local]** (Claude Code on your PC). Each Lovable phase is one prompt: "Implement Phase N of `docs/production-plan.md`."

### Phase 0: Set up the repo (you and Claude Code) [Local]
Lovable cannot import an existing GitHub repo; it can only create one. So:
- [ ] In Lovable, create an empty project named **Radium Panel Lab Studio**. Connect it to GitHub (Lovable creates `walladanger/radium-panel-lab-studio`).
- [ ] Claude Code clones that repo, replaces its contents with `ember-studio-foundation` (keeping Lovable's added files if any), and copies `radium-panel-lab/index.html` to `public/targets/radium-mock.html`. It also copies Radium's `tests/full.mjs` to `legacy/radium-full.mjs` for reference, and this plan to `docs/production-plan.md`.
- [ ] Make it build in Lovable's preview: Vite dev server on port `8080`, host `::`, and Lovable's `lovable-tagger` component tagger in dev if Lovable asks for it. `npm test` and `npm run build` pass locally. Push to `main`.
- **Accept:** the Lovable preview shows the Ember shell, and Lovable's file tree shows `docs/production-plan.md`.
- **Repo flow (decided 2026-10-09):**
  - Lovable builds in `walladanger/radium-lab-studio`, the repo it created, on `main`.
  - **`walladanger/radium-panel-lab` stays the official home.** After each finished phase, Claude Code copies the result into a `studio/phase-N` branch there and merges it. The original single-file editor moves to `legacy/` in that repo on the first sync.
  - Lovable's TanStack Start template was replaced with Ember's plain Vite setup. Lovable's `AGENTS.md` and `.lovable/project.json` were kept.

### Phase 1: Rebrand the shell and lay out the editor
- Rename the product to **Radium Panel Lab Studio**, with the Ember flame mark kept as a replaceable component.
- Navigation registry: `Projects`, `Canvas`, `Production`, `Comments`, `Design system`, `Agents`, `Settings`, `About`.
- Window registry: add the dockable internal windows `layers`, `inspector`, `comments`, `production`, `style-lab`, `motion`, `code` (placeholders for now). Use Ember's window manager. Add a "Reset layout" action.
- Canvas page layout: left rail (layers), centre (canvas), right rail (tabbed inspector, comments and production), top tool bar (Grab, Comment, Draw, Insert, Hand, zoom %), and a status bar (bridge status, unsynced count, session name).
- **Tests:** the nav renders 8 items; each window id opens and closes; the layout persists through the settings service.
- **Accept:** clicking each nav item routes; the canvas page shows all regions with empty states.

### Phase 2: Backend, auth and services
- Enable Lovable Cloud. Add email and Google auth. Create every table in §5 with RLS, plus the storage bucket.
- Typed services in `src/services/`: `ProjectService`, `SessionService`, `ChangeService`, `CommentService`, `ProductionService`, `TokenService`, `LookService`. Each has a Supabase adapter and an in-memory adapter for tests, following Ember's `PersistenceAdapter` pattern.
- `QueuedWriter`: an ordered write queue persisted to IndexedDB, with retry and backoff, exposing `pendingCount`.
- Projects page: create a project (name, mode, target URL), list, rename, delete (with an Ember confirm dialog). Seed a **Demo: Radium Ollama** project on first sign-in.
- **Tests:** RLS denies another user's rows; `QueuedWriter` replays in order after a simulated outage (Review Focus 5); in-memory adapters satisfy the same service test suite.

### Phase 3: Canvas and frames
- An infinite canvas with pan (Space+drag, middle mouse) and zoom (Ctrl+wheel, 10–400%, "fit"). Frames are absolutely placed cards, each holding an `<iframe>` of `target_url + route`.
- Frame toolbar: route input, breakpoint presets (1440, 1024, 768, 390), custom size, reload, duplicate, delete. Frames persist in `frames`.
- `FrameHost` handles each iframe's lifecycle. It waits for the bridge `ready` event; after 3 s with none it shows the "Connect your app" card (install snippet for the Vite plugin, plus a `<script src=".../radium-bridge.js">` line) and offers Snapshot mode (Review Focus 1).
- The demo target loads `public/targets/radium-mock.html`, with the bridge included by a script tag.
- **Tests:** zoom clamps 10–400; a frame without a bridge shows the connect card; the demo frame reaches `ready`.

### Phase 4: Bridge client, hover, select and layers
- `public/radium-bridge.js`: a dependency-free ES module implementing §4. Write it in `src/bridge-client/` (TypeScript) and build it to `public/` with a separate Vite lib entry, so L2 can publish the same file.
- `BridgeService` on the editor side: a promise-based request and reply with timeouts, event subscriptions, and an origin check.
- **Editor overlay** (drawn in the editor over the iframe, not inside it, as Onlook does): hover box with label chip (`comp · tag · file:line`), selection box, multi-select (Shift), and parent and child stepping (Alt+↑/↓).
- Port Radium's block-picking rules into the bridge's `hit.test`: nearest whole block in `block` mode; Alt+click gives `exact`.
- **Layers panel:** a tree from `tree.get`, kept in sync with selection both ways. It shows the component name and `rid` file name, and hides or locks per layer.
- Right-click menu: Copy file:line, Open in VS Code (`vscode://file/<abs>:<line>` when the project has a local root path), Comment here, Add to production list.
- **Tests:** the bridge rejects a message from an unlisted origin; after a simulated `dom.changed` the selection re-resolves by `rid` + `instanceIndex` (Review Focus 2); the layers tree and canvas selection agree.

### Phase 5: Direct manipulation and the inspector (port Radium's grab tool)
- Move (translate) with a 4 px snap (Alt skips it), 8 resize handles (Shift keeps the ratio on corners, double-click a handle resets), the corner-radius dot, reorder mode (drag onto siblings, giving CSS `order`), hide or delete with restore, and nudge keys. Undo and redo is a command stack over change records.
- Inspector sections (all of Radium's fields plus Onlook and Plasmic additions):
  - **Layout:** display, flex and grid, direction, gap, align and justify.
  - **Spacing:** a visual box-model widget.
  - **Size:** W, H, min and max.
  - **Position:** dx, dy, rotate, scale, z.
  - **Corners:** linked or per corner, plus the **corner curve** (superellipse with keyword fallback).
  - **Edge, Fill** (solid or gradient), **Text**, and **Effects** (glow, shadow, inner light and shadow, glass blur, opacity).
  - **Classes:** a read-only Tailwind class list plus a suggested class diff.
  - **States:** hover, focus, active and disabled toggles through `state.force`, so edits can be recorded per state.
  - **Breakpoint:** edits are tagged with the frame's breakpoint.
- 12 quick looks and copy and paste style, from Radium's `APRESETS`.
- Scope prompt "This one / All N" on repeated elements (Review Focus 3).
- Sliders preview on `input` and record on `change`, as in Radium, so a drag makes one record.
- **Tests:** one slider drag produces exactly one change record; resizing west moves `translate` and `width` together; undo restores the preview and supersedes the record; "All N" sets `instanceScope: "all"`.

### Phase 6: Change recorder, sessions and history
- Every edit becomes a `change_record` with a before and after screenshot (bridge `screenshot`, uploaded to storage through the queue).
- **Sessions** (Onlook branches): New session, Branch from session, Rename, Archive. The status bar shows the active session. Changes belong to the active session.
- **History panel:** a timeline grouped by element. Click to select the element; per-record revert; a before and after image slider.
- **Notes drawer (N):** every comment and change, as in Radium, plus "Copy for Claude" (plain-text export).
- **Tests:** a branch copies its parent's open records by reference; reverting a record removes its preview and marks it superseded.

### Phase 7: Comments, annotations and draw mode
- Comment mode (C): click to pin a comment to an element and an offset (`target` + `px`/`py`). Threads with replies, done and reopen, filter by status. Agent replies show with an agent badge.
- **Draw mode (D)** (from OpenDesign): pen, arrow, rectangle and ellipse with a colour, drawn on the overlay in frame coordinates, saved as `annotations` and attached to a comment. Drawing never changes the target.
- "Turn into production item" on any comment.
- Realtime: comments and replies update live for everyone in the project.
- **Tests:** a pin follows its element after a scroll and a re-render; an annotation scales correctly with canvas zoom.

### Phase 8: Design system, Style Lab and Motion Lab
- **Design system page:**
  - Import tokens from the target (`tokens.get`) into `design_tokens`, grouped by type.
  - Edit `DESIGN.md` (markdown editor with preview). This is the brand contract every production list links to, as in OpenDesign.
  - A theme is a set of CSS custom property overrides (as in Astryx), previewed live by `preview.style` on `:root`.
- **Style Lab** (port Radium's): every `KNOBS` section, 15 presets, per-section Reset, background gradient modes, status greens with glow, the page-change burst, saved looks (save, apply, update, delete) and Reset to original (which auto-saves first). Token edits record `kind: "token"` change records.
- **Motion Lab** (port Radium's 10 effects: edge chase, glow pulse, warp, ripple, shimmer, pop, shake, float, border draw, blur-in) with target, trigger (click, hover, repeat, page) and sliders. Each saved effect records `kind: "motion"` with its CSS keyframes in `css`. Effects play only in Use mode.
- **Snap-to-token:** when an edited value is within 2 px or ΔE 3 of a token, the inspector offers the token, and the record stores it.
- **Tests:** token import round-trips; snap-to-token picks `--radius-lg` for 11.5 px when `--radius-lg: 12px`; a motion record carries valid `@keyframes`.

### Phase 9: The production list compiler and board
- `compileProductionList(sessionId)` is a **deterministic** pure function in `src/features/production/compile.ts`, unit-tested without the network:
  1. Drop superseded records.
  2. Collapse repeated edits per `(rid or selector, property, state, breakpoint)` to the first `before` and last `after`. Drop changes that end where they started (Review Focus 4).
  3. Group by `file` → `component` → element into items, and number them `RPL-001…`.
  4. For each item, write the title, the CSS, the Tailwind hint (map `STYLE_PROPS` to Tailwind; fall back to arbitrary values), any token, plain-English instructions, acceptance checks (one per change, such as "Model rows render 12px corners at all breakpoints"), screenshots, and linked comments.
  5. Emit Markdown (template below) and JSON (§5 schema).
- **"Polish with AI"** (optional): the `compile-production-list` edge function, using Lovable AI, rewrites `instructions` into clearer prose. It must keep `file`, `line`, `changes` and `acceptance` unchanged, and the result is validated against the schema before saving.
- **Production board:** columns Queued, In progress, Needs info, Done and Rejected. Drag to reorder priority. Edit any item. Version history of lists.
- **Handoff actions:** Copy as Markdown, Copy agent prompt (per item or the whole list), Download `.md` + `.json`, and **Save to repo**. Save to repo uses the File System Access API in Chrome or Edge: the user picks the repo folder once, and the app writes `.radium/production/<yyyy-mm-dd>-<session-slug>.md` and `.json`, plus `.radium/DESIGN.md`.
- Markdown template:

```markdown
# Production list: <session> (v<version>)
Project: <project> · Generated <date> · Brand contract: .radium/DESIGN.md
Implement items in order. After each item, run the app and check its acceptance lines. Mark items done in Radium (MCP tool `mark_item_status`) or tick them here.

## RPL-012 · Round model rows to 12px and add a soft glow  (p2)
- **Where:** `web-app/src/containers/runtimes/OllamaPanel.tsx:142` · `<ModelRow>` · all instances · all breakpoints
- **Change:** border-radius 8px → 12px (token `--radius-lg`); box-shadow none → `0 0 18px rgb(56 189 248 / .35)`
- **Tailwind hint:** `rounded-xl shadow-[0_0_18px_rgb(56_189_248/.35)]`
- **Why (comment):** "Rows feel too sharp next to the cards"
- **Accept:**
  - [ ] Every model row shows 12px corners
  - [ ] The glow is visible on the dark theme and does not clip
- Screenshots: before · after
```

- **Tests:** collapse and no-op removal; grouping order is stable; JSON validates against the schema; AI polish that changes `file` is rejected.

### Phase 10: Agent API and live status
- `agent-api` edge function (REST, bearer `agent_token`, hashed with SHA-256, scoped to one project):
  - `GET /lists/latest`
  - `GET /items?status=`
  - `GET /items/:id` (with signed screenshot URLs)
  - `PATCH /items/:id {status, agent, agent_note, pr_url}`
  - `POST /comments/:id/replies {text}`
- **Agents page:** create, label and revoke tokens (plaintext shown once). Show the copy-paste MCP config for Claude Code (`claude mcp add radium -- npx radium-bridge mcp --project <id> --token <token>`) and for Codex. Show last-used times.
- The board updates in realtime when an agent changes an item.
- **Tests:** a revoked token gets 401; a token from project A cannot read project B; a PATCH with an unknown status gets 422.

### Phase 11: Components, insert, text and code view
- **Components panel:** lists `comp` names seen in the tree, with instance counts. Click to highlight every instance.
- **Insert mode** (Onlook's draw-in div): drag a box onto a frame to propose a new element (box, text, image, button, or one of the listed components). It is previewed as an overlay ghost and recorded as `kind: "insert"`, with the parent `rid`, position among siblings, and the intended styles.
- **Text editing:** double-click text to edit it in place (`preview.text`), recorded as `kind: "text"`.
- **Code view window:** given a project local root (File System Access), show the source around `rid` line ±20, read-only, with the line highlighted.
- **Tests:** an insert record has a parent `rid` and an index; a text edit with no net change records nothing.

### Phase 12: Polish, onboarding and quality
- First-run tour (5 steps on the demo project), empty states, a keyboard cheat sheet (`?`), accessibility pass (focus order, labels, contrast in every colour profile), and performance (overlay redraws on rAF only; `tree.get` paged above 3,000 nodes).
- Playwright end-to-end on the demo target: grab → restyle → comment → draw → compile → export. This replaces `legacy/radium-full.mjs` coverage feature by feature.
- **Accept:** the whole flow runs in under 2 minutes from a cold start, with no console errors.

---

## Local track (Claude Code on your PC; Lovable cannot run these)

### L1: Phase 0 repo setup (above)

### L2: The `radium-bridge` package (new repo `walladanger/radium-bridge`)
- `radium-bridge/vite`: a Vite plugin, dev only, which uses Babel to add `data-rid="<posix relative path>:<line>:<col>"` and `data-rcomp` to JSX elements. It skips fragments, and skips elements that already have `data-rid`. It also injects the bridge client script. Options: `{ include, exclude, editorOrigins }`.
- `radium-bridge/client`: the same source as `src/bridge-client/` in the studio repo, published as ESM.
- `radium-bridge` CLI:
  - `mcp --project <id> --token <t>`: a stdio MCP server with the tools `list_production_items(status?)`, `get_production_item(id)`, `mark_item_status(id, status, note?, pr_url?)`, `reply_to_comment(id, text)`, `get_design_md()`, and `pull_list()`, which writes `.radium/production/*`.
  - `pull`: the same as `pull_list`, run from the shell.
- **Tests:** Babel fixture tests (input and expected TSX, as in Onlook's `packages/parser/test/data/ids`); MCP tools against a mocked agent-api.

### L3: Hook up Radium itself
- Add the plugin to Radium's `web-app` Vite config in dev mode only, with a **Settings > Developer > Open in Radium Panel Lab** toggle.
- In the Lovable editor, check that the Ollama panel's elements report `rid`s in `OllamaPanel.tsx`.
- Close the HANDOFF "open work 1" item: the overlay now works on every Radium screen, chat included.

### L4: Desktop build (after Phase 12)
- Use Ember's `src-tauri` to package the studio as a Windows app.
- Add a native "Choose repo folder" command (a native dialog plus an opaque token, per Ember's backend-boundary rule) that replaces File System Access. Add a native file watcher for `.radium/`.

### L5 (optional): Direct apply for safe edits
- `radium-bridge apply <item>` applies text changes and Tailwind class changes with an AST codemod (recast or Babel). It refuses anything else and leaves it for the agent. It always writes on a new git branch.

---

## Open questions for Warwick (sensible defaults are already in the plan)
1. **`walladanger/ui-lab`.** HANDOFF says to ask before merging ideas from your other overlay editor. *Default: not used.*
2. **Hosting the bridge script.** *Default: served from the studio app's own URL, then from npm once L2 is published.*
3. **Team use.** *Default: single user first. `project_members` exists so collaborators can be added later.*
