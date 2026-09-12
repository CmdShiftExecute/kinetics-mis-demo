import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * The dev and preview servers proxy /api/ask to the Ask the MIS Unix socket the
 * way nginx does on the served site, so the panel round-trips locally against
 * the same service. When the service is not running the proxy answers 502 and
 * the panel shows its unavailable state, which is the behaviour being tested.
 */
const askSocket = join(dirname(fileURLToPath(import.meta.url)), 'run', 'ask.sock');
const askProxy = { '/api/ask': { target: { socketPath: askSocket, host: 'ask', port: 0 }, rewrite: () => '/ask' } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5180, strictPort: true, proxy: askProxy },
  preview: { host: '127.0.0.1', port: 4180, strictPort: true, proxy: askProxy },
  build: { target: 'es2022', sourcemap: false },
});
