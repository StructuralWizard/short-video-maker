import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/components',
  build: {
    outDir: path.resolve(__dirname, 'dist/components'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        root: path.resolve(__dirname, 'src/components/root/index.ts'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}); 