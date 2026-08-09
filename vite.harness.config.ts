import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Throwaway config to mount the real ProfilePage in isolation with mocked data/api layers,
// to reproduce a suspected render crash without touching the real (prod) backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '../lib/api', replacement: path.resolve(__dirname, 'src/harness/mockApi.ts') },
      { find: '../context/UserContext', replacement: path.resolve(__dirname, 'src/harness/mockUserContext.tsx') },
    ],
  },
  server: { port: 5183 },
});
