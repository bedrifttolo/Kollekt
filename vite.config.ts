import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  if (mode === 'mobile') {
    const env = loadEnv(mode, '.', 'VITE_');
    const isPlaceholder = (value: string) => /replace-with|placeholder|your-domain|(^|\.)example\.|(^|\.)invalid$/i.test(value);
    for (const key of ['VITE_API_URL'] as const) {
      let url: URL;
      try {
        url = new URL(env[key]);
      } catch {
        throw new Error(`${key} must be an absolute HTTPS URL in .env.mobile`);
      }
      if (url.protocol !== 'https:' || isPlaceholder(url.hostname)) {
        throw new Error(`${key} must point to a deployed HTTPS service, not a placeholder`);
      }
    }
    for (const key of ['VITE_GOOGLE_CLIENT_ID', 'VITE_GOOGLE_IOS_CLIENT_ID', 'VITE_APPLE_CLIENT_ID'] as const) {
      if (env[key] && isPlaceholder(env[key])) throw new Error(`${key} contains a placeholder value in .env.mobile`);
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:8080',
      },
    },
  };
});
