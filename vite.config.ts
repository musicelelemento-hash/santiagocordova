
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Carga las variables de entorno desde .env (local) o del sistema (Vercel)
    const env = loadEnv(mode, (process as any).cwd(), '');
    
    // Generamos un Timestamp único para este Build específico
    const BUILD_TIMESTAMP = new Date().getTime().toString();

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Mapeo inteligente: Prioriza las variables especificadas por el usuario en Vercel
        // API Key de Google (Gemini)
        'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
        
        // URL del Script de Google (Backend)
        'process.env.GOOGLE_SHEET_SCRIPT_URL': JSON.stringify(env.VITE_GOOGLE_SCRIPT_URL || env.VITE_GOOGLE_SHEET_SCRIPT_URL || env.GOOGLE_SHEET_SCRIPT_URL),
        
        // Inyectamos la versión del build para control de caché en App.tsx
        'process.env.VITE_APP_BUILD_TIME': JSON.stringify(BUILD_TIMESTAMP)
      },
      resolve: {
        alias: {
          '@': path.resolve('./'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1000,
        // Forzamos nombres de archivo con HASH para romper la caché del navegador
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]',
                manualChunks: {
                    vendor: ['react', 'react-dom', 'recharts', 'date-fns', 'lucide-react'],
                },
            },
        },
      }
    };
});
