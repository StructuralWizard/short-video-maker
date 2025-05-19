import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs-extra';

// Plugin to copy Python scripts to dist
const copyPythonScripts = () => ({
  name: 'copy-python-scripts',
  closeBundle: async () => {
    const srcScript = path.resolve(__dirname, 'src/short-creator/libraries/generate_speech.py');
    const destScript = path.resolve(__dirname, 'dist/short-creator/libraries/generate_speech.py');
    await fs.ensureDir(path.dirname(destScript));
    await fs.copy(srcScript, destScript);
  },
});

export default defineConfig({
  plugins: [react(), copyPythonScripts()],
  root: 'src/ui',
  build: {
    outDir: path.resolve(__dirname, 'dist/ui'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/ui/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/ui'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3123',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://localhost:3123',
        changeOrigin: true,
      },
    },
  },
}); 