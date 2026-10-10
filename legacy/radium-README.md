# Radium Panel Lab

A visual editor for trying out the look of [Radium](https://github.com/walladanger/Radium)'s screens before building them. It is one HTML file with nothing to install: open `index.html` in Chrome or Edge.

Right now it holds a working mock of Radium's **Settings > Runtimes** page, with the Ollama panel and sample data. Nothing in it talks to a real Ollama.

## What you can do

| Tool | How |
| --- | --- |
| Try layouts | **Rows**, **Tiles**, **Split** and **Tabs** in the top bar. **No menu** hides the settings menu. |
| Grab and edit anything | Press **V**, or pick **Grab** in the bottom toolbar. A click takes the nearest whole block (a card, a model row, a setting). Click again to go inside it. **Alt**+click takes exactly what is under the pointer. |
| Move | Drag. **Snap** keeps to a 4 px grid (hold **Alt** to skip it). Arrow keys nudge 1 px, **Shift**+arrow 10 px. |
| Resize | Drag any of the eight handles. **Shift** on a corner keeps the shape. Double-click a handle to undo that size. |
| Round the corners | Drag the dot inside the top-left corner. |
| Style one item | **I**, or the sliders button. It covers position, size, rotation, scale and layer. For corners, set one radius or each corner on its own, plus a continuous **corner curve** (squircle, bevel, scoop, notch and anything between). For edges, set thickness, style, colour and strength. Also: glow, shadow, inner light, inner shadow, glass blur, fill (solid or gradient), text colour, size, weight and glow, padding and opacity. It also has 12 quick looks, plus copy and paste style between items. |
| Reorder | Pick **Reorder**, then drag an item onto its neighbours. |
| Delete | **Del**. Bring things back with **Ctrl+Z** or from **Notes**. |
| Comment | Press **C**, then click anything. Comments pin to the spot, have replies, and can be marked done. **N** lists every comment and change. |
| Motion and effects | Press **M**. There are 10 effects: edge chase, glow pulse, warp, ripple, shimmer, pop, shake, float, border draw and blur-in entrance. Each one has its own colour and sliders, what it plays on and when (click, hover, repeat or page change). |
| Whole-page style | Use the **Style lab** on the right. It covers corners and edges, depth and glow, spacing, colour, both status greens with glow, the background gradient (blobs, aurora, swirl, mesh), and the page-change burst. It has 15 presets, and every section has its own **Reset**. |
| Save a look | **Saved looks** stores colours, effects, motion, layout and everything you grabbed and changed. You can save, apply, update and delete. |
| Start over | **Reset to original** puts everything back to the first design. It saves your current look first. |
| Runtime settings | Settings profiles (built in, or save your own) and **settings for each model**: context, temperature, top P/K, min P, repeat penalty, longest reply, GPU layers, keep loaded, thinking and system prompt. Model profiles work across models, and **Copy as Modelfile** exports them. |

## Where your work is saved

- **Opened from this repository:** in your browser's storage for this file. Clearing site data clears it.
- **Opened as the published Claude artifact:** in the page's own store. Claude can read your comments, changes, looks and settings there, and reply to comments.

Either way, **Notes > Copy for Claude** copies everything as text you can paste into a chat, and **Your settings as CSS** in the Style lab copies the style as CSS variables.

## Keyboard

`V` grab · `C` comment · `M` motion · `N` notes · `I` style the grabbed item · `Del` delete · `R` reset item · `Alt+↑` parent · `Alt+↓` child · arrows nudge · `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo · `Esc` step back.

## Browser support

Chrome or Edge 139+ for the corner curve (`corner-shape`). Radium on Windows runs in WebView2, which gets it with Edge updates. Other browsers show plain round corners; everything else works.

## Next

- Run the editor as an overlay inside Radium itself, so it works on every screen (chat included) and saves edits and comments to a file in the Radium repository.
- Add the KoboldCpp, ComfyUI and TabbyAPI panels once the Ollama design is settled.
