# radium-bridge

Connects an app you are building to **Layers** so you can click any part of it, comment on it with screenshots, preview style changes, and hand a production list to a coding agent.

The bridge runs inside your app only while it is open in Layers. Everything it changes is a preview: it never writes your files, and a reload of your app clears it.

## Vite apps (recommended)

1. In your app's folder, install the package from your Layers folder:

   ```bash
   npm i -D --install-links C:/Users/<you>/source/repos/layers-gui-creator-and-editor/packages/radium-bridge
   ```

   `--install-links` copies the package and installs its dependencies, so your app does not depend on the Layers folder afterwards.

2. Add the plugin to `vite.config.ts`, **before** the React plugin:

   ```ts
   import radiumBridge from 'radium-bridge/vite';

   export default defineConfig({
     plugins: [radiumBridge(), react()],
   });
   ```

3. Restart your dev server, then in Layers choose **Connect app** and enter its address (for example `http://localhost:5173`).

The plugin only runs with the dev server (`vite`), never in `vite build`. It:

- adds the bridge script to `index.html` and serves it from your own dev server (`/@radium/…`), so nothing loads from another site;
- tags every HTML element in your `.jsx`/`.tsx` files with `data-rid="src/components/Card.tsx:42:7"` and `data-rcomp="Card"`, so comments and changes point at the exact file and line;
- tells Layers about hot updates, so selections and previews survive them.

Options: `radiumBridge({ include, exclude, sourceIds })`. `include`/`exclude` take regular expressions or strings (default: `.jsx`/`.tsx`, skipping `node_modules`). `sourceIds: false` loads the bridge without tagging elements.

## Any other web app

Add one line before `</body>` (while developing only):

```html
<script src="http://localhost:8080/radium-bridge.js"></script>
```

Use the address Layers runs at. If your app's content security policy blocks other sites, copy `client/radium-bridge.js` and `radium-screenshot.js` (from `modern-screenshot/dist/index.js`) into your public folder and use `<script src="/radium-bridge.js"></script>`.

Without the Vite plugin, elements have no file and line, so Layers falls back to CSS selectors and element text.

## What the bridge can do

The wire protocol is `radium` v1, described in `docs/production-plan.md` §4 of the Layers repo: picking (`hit.test`, `tree.get`, `node.find`), outlines (`rect.watch`), styles (`style.get`, `preview.style`, `preview.clear`), text, hiding and order previews, forced hover/focus states, screenshots of an element and the whole view, scrolling, design tokens, and navigation. It answers only Layers on `localhost`, the desktop app, or the origin given in `?radium-editor=`.
