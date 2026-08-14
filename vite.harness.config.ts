import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Throwaway config that mounts real pages in isolation, with the data/native layers mocked, so a
 * screen behind the login wall can be rendered and measured without a backend.
 *
 * Entry point: src/harness/main.tsx. See its header for the query params.
 *
 * Modules are swapped by *resolved file path*, not by import specifier. The previous version aliased
 * the literal strings '../lib/api' and '../context/UserContext', which matched src/pages/*.tsx but
 * silently missed src/pages/chat/* and src/pages/social/* (they write '../../lib/api'), so those
 * pages quietly hit the real network. There are four spellings of the api import in the tree; this
 * catches all of them and anything added later.
 */
function swapModule(realPath: string, mockPath: string): Plugin {
  const real = path.resolve(__dirname, realPath);
  const mock = path.resolve(__dirname, mockPath);
  return {
    name: `harness-swap:${path.basename(realPath)}`,
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || source.startsWith('\0')) return null;
      // Let the mock import the real module for its types without swapping itself out.
      if (importer.split('?')[0] === mock) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      return resolved.id.split('?')[0] === real ? mock : null;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    swapModule('src/lib/api.ts', 'src/harness/mockApi.ts'),
    swapModule('src/context/UserContext.tsx', 'src/harness/mockUserContext.tsx'),
    swapModule('src/lib/realtime.ts', 'src/harness/mockRealtime.ts'),
    swapModule('src/lib/purchases.ts', 'src/harness/mockPurchases.ts'),
  ],
  // HMR off on purpose. Its WebSocket never closes, and headless Chrome's --virtual-time-budget
  // only advances once the page goes network-idle — with HMR on, `--dump-dom` hangs forever instead
  // of returning, which is what scripts/harness-audit.sh drives. Edit-and-reload by hand instead.
  server: { port: 5183, hmr: false },
});
