// A small app to try the live bridge on: `npm run sample-app`, then connect http://localhost:5173 in Layers.
// In your own app, install the package and import it as `radium-bridge/vite` instead of this path.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import radiumBridge from '../../packages/radium-bridge/vite.js';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [radiumBridge(), react()],
  server: { port: 5173, strictPort: true },
  clearScreen: false,
});
