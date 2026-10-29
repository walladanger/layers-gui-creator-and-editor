// Vite plugin for apps you want to edit in Layers (dev server only; production builds are untouched).
//   import radiumBridge from 'radium-bridge/vite';
//   export default defineConfig({ plugins: [radiumBridge(), react()] });
// It adds the bridge script to index.html, serves the bridge's helpers from your own dev server,
// tags JSX elements with their file:line, and tells the studio about hot updates.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tagJsx } from './tag-jsx.js';

const require = createRequire(import.meta.url);
export const BRIDGE_PATH = '/@radium/radium-bridge.js';
export const SCREENSHOT_PATH = '/@radium/radium-screenshot.js';

/** The files the bridge needs at run time, by the name it loads them under. */
export function bridgeAssetFiles() {
  return {
    'radium-bridge.js': fileURLToPath(new URL('./client/radium-bridge.js', import.meta.url)),
    'radium-screenshot.js': require.resolve('modern-screenshot/dist/index.js'),
  };
}

/** Connect-style middleware serving the bridge files under `base` (for example `/` or `/@radium/`). */
export function bridgeAssetMiddleware(base = '/') {
  const files = bridgeAssetFiles();
  return (req, res, next) => {
    const url = (req.url ?? '').split('?')[0];
    const name = url.startsWith(base) ? url.slice(base.length) : '';
    if (!Object.hasOwn(files, name)) { next(); return; }
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(readFileSync(files[name]));
  };
}

/** For the studio itself: serves the bridge files at the site root in dev and ships them with the build. */
export function bridgeAssets() {
  return {
    name: 'radium-bridge-assets',
    configureServer(server) { server.middlewares.use(bridgeAssetMiddleware('/')); },
    generateBundle() {
      for (const [fileName, file] of Object.entries(bridgeAssetFiles())) this.emitFile({ type: 'asset', fileName, source: readFileSync(file) });
    },
  };
}

const HMR_SNIPPET = "if (import.meta.hot) import.meta.hot.on('vite:afterUpdate', () => window.dispatchEvent(new Event('radium:hmr')));";
const matches = (pattern, file) => (Array.isArray(pattern) ? pattern : [pattern]).some((p) => (p instanceof RegExp ? p.test(file) : file.includes(p)));

/**
 * @param {{ include?: RegExp | string | Array<RegExp | string>, exclude?: RegExp | string | Array<RegExp | string>, sourceIds?: boolean }} [options]
 */
export default function radiumBridge(options = {}) {
  const include = options.include ?? /\.[jt]sx$/;
  const exclude = options.exclude ?? /[\\/]node_modules[\\/]/;
  let root = process.cwd();
  return {
    name: 'radium-bridge',
    apply: 'serve',
    enforce: 'pre',
    configResolved(config) { root = config.root; },
    configureServer(server) { server.middlewares.use(bridgeAssetMiddleware('/@radium/')); },
    transformIndexHtml() {
      return [
        { tag: 'script', attrs: { src: BRIDGE_PATH }, injectTo: 'head-prepend' },
        { tag: 'script', attrs: { type: 'module' }, children: HMR_SNIPPET, injectTo: 'head' },
      ];
    },
    transform(code, id) {
      if (options.sourceIds === false) return null;
      const file = id.split('?')[0];
      if (file.startsWith('\0') || !matches(include, file) || matches(exclude, file)) return null;
      const rel = path.relative(root, file).split(path.sep).join('/');
      return tagJsx(code, rel.startsWith('..') ? file.split(path.sep).join('/') : rel);
    },
  };
}

export { radiumBridge, tagJsx };
