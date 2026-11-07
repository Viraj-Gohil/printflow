import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname || process.cwd(), 'index.html')
    }
  },
  server: {
    port: 5173
  }
});
