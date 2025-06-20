import react from '@vitejs/plugin-react';
import path from 'path';

export default {
  plugins: [react()],
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
    host: '0.0.0.0',
    port: 3121,
    proxy: {
      '/api': {
        target: 'http://localhost:3123',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://localhost:3123',
        changeOrigin: true,
      },
      '/pxv': {
        target: 'http://localhost:3123',
        changeOrigin: true,
      },
      '/proxy': {
        target: 'http://localhost:3123',
        changeOrigin: true,
      }
    },
  },
}; 