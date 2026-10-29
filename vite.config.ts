import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { bridgeAssets } from './packages/radium-bridge/vite.js';

export default defineConfig({
  // bridgeAssets serves /radium-bridge.js and its screenshot helper, and ships them with the build.
  // Tailwind only processes CSS that imports it: the asset stage's shadcn/ui theme, not the studio.
  plugins: [react(), tailwindcss(), bridgeAssets()],
  build: {
    // asset-stage.html renders live shadcn/ui demos for the Assets window, isolated from the studio's CSS.
    rolldownOptions: { input: { main: 'index.html', 'asset-stage': 'asset-stage.html' } },
  },
  server: {
    host: '::',
    port: 8080,
    strictPort: true,
  },
  clearScreen: false,
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
