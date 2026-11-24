# Variables de entorno de la web

Solo nombres, nunca valores. En la PC van en `.env.local`; en la nube (claude.ai/code)
se cargan como variables del entorno. `.env.local` no va a git.

> **Ojo:** todo lo que empieza con `VITE_` queda dentro del JavaScript público de la web.
> Una clave secreta con `VITE_` la puede leer cualquiera que abra la página.

## Públicas (no pasa nada si se ven)
`VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_APP_VERSION` · `VITE_BOT_URL` ·
`VITE_SRI_PROXY_URL` · `VITE_GEMINI_PROXY_URL` · `VITE_R2_WORKER_URL` · `VITE_R2_PUBLIC_URL` ·
`VITE_R2_ACCOUNT_ID` · `VITE_R2_BUCKET_NAME` · `VITE_FACTURACION_API_URL` · `VITE_GOOGLE_SCRIPT_URL` ·
`VITE_FIREBASE_API_KEY` · `VITE_FIREBASE_APP_ID` · `VITE_FIREBASE_AUTH_DOMAIN` ·
`VITE_FIREBASE_MESSAGING_SENDER_ID` · `VITE_FIREBASE_PROJECT_ID` · `VITE_FIREBASE_STORAGE_BUCKET`

## Secretas (hoy quedan expuestas por llevar `VITE_`; deberían ir detrás de un proxy)
`VITE_R2_ACCESS_KEY_ID` · `VITE_R2_SECRET_ACCESS_KEY` · `VITE_GEMINI_API_KEY` ·
`VITE_GEMINI_PROXY_ACCESS_KEY` · `VITE_FACTURACION_API_TOKEN` · `VITE_CORS_PROXY_KEY`

Para la nube alcanza con las públicas para que `npm run build` y la mayoría de las pantallas anden.
