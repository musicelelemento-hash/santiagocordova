
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, path.resolve('.'), '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GOOGLE_SHEET_SCRIPT_URL': JSON.stringify(env.VITE_GOOGLE_SCRIPT_URL || env.GOOGLE_SHEET_SCRIPT_URL)
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      },
      optimizeDeps: {
        include: ['pdfjs-dist'],
      },
      build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('pdfjs-dist')) {
                        return 'pdfjs';
                    }
                    if (id.includes('node_modules')) {
                        if (id.includes('react') || id.includes('recharts') || id.includes('date-fns') || id.includes('lucide-react')) {
                            return 'vendor';
                        }
                    }
                }
            },
        },
      },
      worker: {
        format: 'es',
        plugins: () => [react()],
      },
    };
});
