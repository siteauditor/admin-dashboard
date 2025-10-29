import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src',
  envDir: '../',
  envPrefix: 'VITE_',
  base: '/admin/',
  plugins: [react()],
  server: {
    port: 3001,
  },
  optimizeDeps: {
    exclude: ['@base-org/account'], // prevent pre-bundling that causes crash
  },
  ssr: {
    noExternal: ['@base-org/account'], // skip parsing for SSR too
  },
});
