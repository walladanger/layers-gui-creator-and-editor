import type { Plugin } from 'vite';

export interface RadiumBridgeOptions {
  /** Files to tag with `data-rid`. Default: `.jsx` and `.tsx` files. */
  include?: RegExp | string | Array<RegExp | string>;
  /** Files to leave alone. Default: anything in `node_modules`. */
  exclude?: RegExp | string | Array<RegExp | string>;
  /** Set to false to load the bridge without tagging elements with their file and line. */
  sourceIds?: boolean;
}

export declare const BRIDGE_PATH: string;
export declare const SCREENSHOT_PATH: string;
export declare function bridgeAssetFiles(): Record<'radium-bridge.js' | 'radium-screenshot.js', string>;
/** Connect middleware serving the bridge files under `base`. */
export declare function bridgeAssetMiddleware(base?: string): (req: unknown, res: unknown, next: () => void) => void;
/** For the studio: serves the bridge files at the site root in dev and adds them to the build. */
export declare function bridgeAssets(): Plugin;
export declare function tagJsx(code: string, file: string): { code: string; map: unknown } | null;
export declare function radiumBridge(options?: RadiumBridgeOptions): Plugin;
export default radiumBridge;
