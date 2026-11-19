import { defineConfig } from 'vite';
const runtimeProcess = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process;
const devHost = runtimeProcess?.env?.TAURI_DEV_HOST;

export default defineConfig({
  server: {
    host: devHost || '127.0.0.1',
    port: 1420,
    strictPort: true,
    hmr: devHost ? { protocol: 'ws', host: devHost, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
});
