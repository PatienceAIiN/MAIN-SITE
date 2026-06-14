import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT || 3000}`,
        changeOrigin: true
      },
      '/ws': {
        target: `ws://localhost:${process.env.PORT || 3000}`,
        ws: true
      }
    }
  },
  preview: {
    allowedHosts: ['patienceai.onrender.com'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own cacheable chunks so the
        // main app bundle stays small and first paint is faster.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('echarts') || id.includes('zrender')) return 'echarts';
          if (id.includes('framer-motion')) return 'framer';
          if (/react-icons|lucide/.test(id)) return 'icons';
          if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return 'react-vendor';
        },
      },
    },
  },
});
