import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { bridgeAssets } from './packages/radium-bridge/vite.js';

export default defineConfig({
  // bridgeAssets serves /radium-bridge.js and its screenshot helper, and ships them with the build.
  plugins: [react(), bridgeAssets()],
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
