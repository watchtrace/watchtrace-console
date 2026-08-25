import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.WATCHTRACE_DEV_API_URL ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 4173 },
  build: {
    sourcemap: true,
    target: 'es2022',
    chunkSizeWarningLimit: 650,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: { reporter: ['text', 'html'] },
  },
});
