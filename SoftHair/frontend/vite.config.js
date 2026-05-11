import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router-dom') || id.match(/node_modules\/(react|react-dom|scheduler)\//)) {
            return 'react-vendor';
          }
          if (id.includes('@tanstack')) return 'tanstack';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('axios')) return 'axios';
          if (id.includes('dexie')) return 'dexie';
        },
      },
    },
  },
});
