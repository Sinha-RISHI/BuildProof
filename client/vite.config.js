/**
 * vite.config.js
 *
 * What this file does:
 *   Configures the Vite development server and build tool for the
 *   BuildProof frontend.
 *
 * Key settings:
 *   - Tailwind CSS is loaded as a Vite plugin (no separate config file needed).
 *   - The dev server always runs on port 5173 (strictPort means it will fail
 *     clearly instead of silently picking another port).
 *   - The proxy forwards all /api requests to the backend on port 4000.
 *     This lets the browser call /api/health without cross-origin errors,
 *     because from the browser's perspective everything is on port 5173.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),  // Tailwind v4 runs as a Vite plugin — no tailwind.config.js needed
  ],

  server: {
    port: 5173,
    strictPort: true,  // fail loudly if 5173 is taken, instead of silently using another port

    proxy: {
      // Any request whose path starts with /api is forwarded to the backend
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,  // makes the backend see the request as coming from localhost:4000
      },
    },
  },
});
