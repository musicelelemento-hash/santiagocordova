
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
      // Nota: las claves de API (Gemini) ya NO se inyectan aquí para evitar
      // exponerlas en el bundle. Usa el proxy serverless (supabase/functions/
      // gemini-proxy) o VITE_GEMINI_API_KEY solo para desarrollo local.
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
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Nombres con hash de contenido (cacheable) en lugar de Date.now()
          // que invalidaba toda la caché del navegador en cada build.
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three') || id.includes('@react-three')) {
                return 'vendor-three';
              }
              if (id.includes('pdfjs-dist') || id.includes('html2pdf.js')) {
                return 'vendor-pdf';
              }
              if (id.includes('xlsx')) {
                return 'vendor-excel';
              }
              if (id.includes('docxtemplater') || id.includes('pizzip') || id.includes('jszip')) {
                return 'vendor-docx';
              }
              if (id.includes('node-forge') || id.includes('crypto-js')) {
                return 'vendor-crypto';
              }
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('framer-motion') || id.includes('gsap')) {
                return 'vendor-animation';
              }
              if (id.includes('date-fns') || id.includes('lucide-react')) {
                return 'vendor-ui';
              }
            }
          }
        },
      },
    }
  };
});
