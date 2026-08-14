
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Fix: Use path.resolve('.') which corresponds to process.cwd() to avoid type errors with Process interface
  const env = loadEnv(mode, path.resolve('.'), '');

  // Generamos un Timestamp único para este Build
  const BUILD_TIMESTAMP = new Date().toISOString();

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.VITE_GOOGLE_API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.VITE_GOOGLE_API_KEY || env.GEMINI_API_KEY),
      'process.env.GOOGLE_SHEET_SCRIPT_URL': JSON.stringify(env.VITE_GOOGLE_SCRIPT_URL || env.GOOGLE_SHEET_SCRIPT_URL),
      'process.env.VITE_APP_VERSION': JSON.stringify(BUILD_TIMESTAMP)
    },
    resolve: {
      alias: {
        // Fix: Replace __dirname with path.resolve('.') for ES Module compatibility
        '@': path.resolve('.'),
        'lucide-react': path.resolve('./node_modules/lucide-react/dist/esm/lucide-react.js')
      }
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name].${Date.now()}.js`,
          chunkFileNames: `assets/[name].${Date.now()}.js`,
          assetFileNames: `assets/[name].${Date.now()}.[ext]`,
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three') || id.includes('@react-three')) {
                return 'vendor-three';
              }
              if (id.includes('pdfjs-dist') || id.includes('html2pdf.js') || id.includes('xlsx') || id.includes('docxtemplater') || id.includes('pizzip') || id.includes('jszip') || id.includes('node-forge') || id.includes('crypto-js')) {
                return 'vendor-office';
              }
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              if (id.includes('firebase') || id.includes('@supabase')) {
                return 'vendor-db';
              }
              if (id.includes('framer-motion') || id.includes('gsap')) {
                return 'vendor-animation';
              }
            }
          }
        },
      },
    }
  };
});
