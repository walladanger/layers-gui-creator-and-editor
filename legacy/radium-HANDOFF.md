# Handoff: Radium Panel Lab (graphical editor)

Everything a new session needs to keep building the editor without the chat it came from. Read this first, then `README.md` for the user-facing features.

## Where things live

| What | Where |
| --- | --- |
| This repository (the editor as one file) | `C:\Users\Warwick\source\repos\radium-panel-lab` on Warwick's PC, branch `main` |
| GitHub | https://github.com/walladanger/radium-panel-lab (`main` pushed). From a cloud session, push through the linked computer (GitKraken `git_push`), because cloud sessions have no GitHub credentials for this account. |
| Published artifact (same page, with a shared store) | https://claude.ai/artifact/5rUaAv58eTNLpkK8T5YvKy. It is titled "Radium Panel Lab" and declares the `db` capability. To update it from a new session, pass this URL as `url` to the Artifact tool after reading it. |
| Radium itself | `C:\Users\Warwick\source\repos\Radium` (walladanger/Radium, fork of Atomic-Chat/Jan; Tauri 2 + Rust + React/Vite). The real Ollama panel is `web-app/src/containers/runtimes/OllamaPanel.tsx` on branch `feat/runtime-adapter-layer`. |

`index.html` in this repo and the artifact are the same code. The artifact is published from a copy without the `<!doctype>`/`<head>` wrapper (the Artifact tool adds its own); `index.html` has the wrapper so it opens straight from disk.

## What it is

A visual editor for Radium's look and feel. It holds a working mock of **Settings > Runtimes > Ollama**, with sample data and no real Ollama calls. On top of the mock sit:

1. **Layouts:** Rows, Tiles, Split and Tabs, plus a menu collapse toggle.
2. **Grab tool:** select, move, resize from 8 handles, round corners with the corner dot, reorder, delete/restore, undo/redo, and an inspector for per-item styling.
3. **Comments:** pinned to elements, with replies and done/reopen. Claude can read and reply through the page store.
4. **Motion:** 10 effects, each with a target, a trigger and sliders.
5. **Style lab:** global tokens, 15 presets, saved looks, and Reset to original (which auto-saves the current look first).
6. **Runtime settings:** server settings profiles, plus per-model Ollama options with reusable model profiles and Copy as Modelfile.

## Code map (`index.html`, one `<script>` IIFE, in this order)

Order matters: later sections use `const`s from earlier ones at call time only, and the start-up calls at the very end run after everything is declared.

1. **Icons, sample data** (`QUANTS`, `MODELS`, `LIBRARY`, `GPUS`, `KEEP`, `DEFAULTS`, `LOGS`).
2. **`store`**: localStorage under `panel-lab:*`, wrapped in try/catch. `set()` calls `onStore(k)`, which mirrors runtime profiles to the page store.
3. **State `S`**: layout, menu, drafts, models, the combobox, dialog, toast, server `profiles`/`profileId`/`naming`, per-model `mcfg`/`mdraft`/`mprofiles`/`mnaming`.
4. **Controls**: `sw`, `stepper`, `text`, `seg`, and `combo` (combobox with auto-highlight and keyboard support).
5. **`GROUPS`**: Ollama settings as data (Memory, GPUs, Server), with `settingRow`, `groupBlock` and `settingsFooter`.
6. **Blocks**: `header`, `modelDetail` (Good at, quantization scale, `modelCfgHtml`), `modelItem`, `downloader`, `section`.
7. **Runtime profiles**: `SRV_PRESETS`, `profileBar`, `pickProfile`, `saveProfile`; `MFIELDS`, `MPRESETS`, `modelCfgHtml`, `modelfile`.
8. **`LAYOUTS`**: rows, tiles, split, tabs. Each renders the page. `render()` calls the `afterRender` hook.
9. **Layer**: dialogs (`ask()`, an AlertDialog) and toasts. Then the actions: one delegated `click`/`input`/`change`/`keydown` handler keyed on `data-act`.
10. **Editor** (`// ---------- edit tools`):
    - `ED` state; `pathOf`/`find` (stable selectors); `labelOf`; `pick`/`grabTarget`.
    - `assetDecls`/`buildCss` (turn edits into CSS in `<style id="ed-css">`), `mv`, `tidy`, `describeMove`, `APRESETS`.
    - Undo; saving (`queued` writes, `persistEdits`/`flushEdits`, `syncLab`, `onStore`).
    - Pointer ops: drag, resize, radius, reorder.
    - Comments; HTML builders (`barHtml`, `chipHtml`, `inspHtml`, `popHtml`, `drawerHtml`); `renderEd`; the `tick` rAF loop that positions boxes and pins; handlers; the keyboard.
    - The db connect IIFE.
11. **Motion** (`// ---------- motion and effects`): `FX` definitions, `MOTION_DEFAULT`, `fxCfg`, `follow` (an overlay that tracks an element by path), the `RUN` effect implementations, triggers (click capture then play after re-render, hover, loop timers via `fxRestart`, and page via `fxEvent('page')`), and the motion panel.
12. **Style lab** (`// ---------- style lab`):
    - `oklchHex`, `cssHex`, `curveCss` (`corner-shape: superellipse(k)`, falling back to keywords).
    - `KNOBS` (range/color/chips), `PRESETS`, `ORIGINAL()`, `style`, `applyStyle` (CSS vars on `:root` plus `data-gmode`/`data-bmode` and so on), `exportCss`.
    - Saved looks (`LOOKS`, `saveLook`, `applyLook`, `replaceEdits`, `resetToOriginal`), and `renderPanel` using `labSection`. Do not name it `section`: the app already has a `section()`.
13. **Start-up**: `applyStyle(); renderPanel(); render();`.

### Key conventions

- **Stable anchors.** Blocks carry `data-k` (`set:<key>`, `group:<id>`, `model:<name>`, `card:<name>`, `stat:<name>`, `sec:<id>`, `mcfg:<name>`, `rail`, `menu`, `profiles`, and so on). `pathOf()` builds `[data-k="…"] > div:nth-of-type(n) …`, so edits survive re-renders. Add `data-k` to any new block you want to be grabbable by name.
- **Edits are CSS overrides, never DOM changes.** They are per layout: `ED.edits[layout] = { moves: {selector: fields}, orders: {parentSelector: {kids, labels, label, flex}} }`. Moving uses the CSS `translate` property, which does not fight `transform` animations. Reordering uses `order`, turning block parents into flex columns.
- **Per-item fields** (`STYLE_KEYS` plus position): `dx dy w h hidden rot scl z pad opacity radius rlink rtl rtr rbr rbl curve shape bw bstyle bcol balpha fill f1 f2 fang falpha tcol tall tsize tweight tglow salpha sy sblur sspread scol galpha gsize gcol inner ishadow gblur label`.
- **Redraw on release.** Sliders update state on `input` and redraw on `change`, so a drag never stops halfway. `renderEd` keeps panel scroll positions.
- **Effects play only in Use mode.** Edit modes capture pointer and click events inside `#frame`.

## Data (the page store for the artifact; localStorage otherwise)

| Path | Contents |
| --- | --- |
| `notes/<id>` | `{text, kind, path, px, py, layout, label, status, createdAt, replies:[{by:'you'|'claude', text, at}]}`. Claude replies by appending `{by:'claude'}` to `replies`. |
| `edits/<layout>` | `{layout, moves, orders, updatedAt}` |
| `looks/<id>` | `{name, style, layout, menu, edits, createdAt, updatedAt}` |
| `lab/style` | `{style, css, layout, menu, updatedAt}`, written on the first user change, never on load |
| `lab/runtime` | `{profiles, profileId, modelSettings, modelProfiles, updatedAt}` |

localStorage keys: `panel-lab:` + `style layout menu edits notes looks panel-open srv-profiles srv-profile model-cfg model-profiles`.

## Testing

`tests/full.mjs` drives every feature in headless Chromium through Playwright and prints one line per check plus `ERRORS []`. `tests/smoke.mjs` loads the page and cycles the layouts. From this folder:

```
npm i -D playwright   # or use a global install; the scripts use the Chromium Playwright finds
node tests/smoke.mjs
node tests/full.mjs
```

Set `CHROMIUM=/path/to/chrome` to use a specific browser (the cloud container has one at `/opt/pw-browsers/chromium`).

## What Warwick asked for (so nothing gets lost)

- Experiment with layouts to break up the all-horizontal look.
- An AlertDialog pop-up like shadcn's, and shadcn ideas: card spacing, card size sm, and a combobox with auto-highlight.
- Slight edits to edges and corners, and a code tester with sliders to play with look, feel and style.
- A slow colour-gradient shift that is barely noticeable, becoming pronounced on page close and other animations.
- Model rows with more info: what each model is good at, quant size and its effect.
- Grid tiles for settings, and a row of buttons at the bottom.
- A grab-and-move selector, plus comments.
- Pick an asset and move, delete, resize and reshape it.
- More control over colour and the gradient shift and its effect.
- A reset button back to what Claude originally gave, and a save feature for looks and styling.
- Runtime settings that can be saved, including per model.
- Pick an asset and fine-tune it: colour, effects, and edges beyond presets (shadow, glow, edge colour and thickness). More presets and more sliders.
- Clickable glow with strength on the green highlights; a second green; colour pickers for both.
- A motion and transitions panel with 10 effects (warps, stronger edge glow, a glow chasing round the edge of the action you just started), each editable with sliders.
- Save the editor for future use in its own repository.
- Use the editor on every Radium page, such as the main chat window. Not done yet; see below.

Preferences: terse and direct; show working outputs rather than descriptions; single-file or point-and-click solutions; local-first; verbose technical depth with build-test cycles.

## Open work

1. **Run the editor on every Radium screen.** Extract the editor, motion and style-lab code into `panel-lab-overlay.js` (no dependence on the mock's `S`, `render` or `LAYOUTS`). Load it in Radium's web-app in dev builds behind a shortcut (for example Ctrl+Shift+E) or a Settings > Developer toggle. Save edits, comments and looks to a JSON file in the Radium repo through a small Tauri command (for example `docs/ui-notes/*.json`), so Claude or Codex can read them and turn them into real code. `pathOf` should prefer `data-testid`/`data-k`/`id`, because Radium's React DOM is deep.
2. **Relationship to `walladanger/ui-lab`.** That is Warwick's own, more advanced visual editor concept (an in-situ overlay with element inspectors). Ask him before merging or duplicating ideas.

## Known limits

- A moved item leaves its original space empty (translate). Reorder keeps flow.
- Selectors built with `nth-of-type` below a `data-k` anchor can drift if the structure under that anchor changes (for example a model is deleted).
- `corner-shape` (the curve) needs Chrome or Edge 139+. `superellipse()` is used where supported, keywords otherwise.
- Effects that transform an element (warp, pop, shake, float, enter) are lost if that exact element re-renders mid-animation. Overlay effects (chase, pulse, ripple, shimmer, draw) follow the element by path, so they survive re-renders.

## Starter prompt for a new session

> Continue the Radium Panel Lab graphical editor. Read `HANDOFF.md` and `README.md` in `C:\Users\Warwick\source\repos\radium-panel-lab` (link my computer), and read the artifact https://claude.ai/artifact/5rUaAv58eTNLpkK8T5YvKy and its store (collections `notes`, `edits`, `looks`, `lab`). Then start the overlay so the editor runs on every Radium screen.
