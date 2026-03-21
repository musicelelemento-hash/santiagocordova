
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Soluciones Contables Pro - Sistema de Gestión

Esta aplicación es una plataforma de gestión tributaria moderna construida con React, Vite y Tailwind CSS. Utiliza Google Gemini para inteligencia artificial y Google Apps Script (Sheets/Drive) como base de datos en la nube (Backend Serverless).

Ver aplicación desplegada: https://ai.studio/apps/drive/1nJkX29kDW9eXlb6de9byjdVwjtoZCDsU

## 🚀 Instalación Local y Restauración

Si descargaste este proyecto desde GitHub, es posible que la sincronización con la nube (Google Sheets) no funcione inmediatamente porque **las claves de seguridad no se guardan en GitHub**.

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Crear archivo `.env.local` en la raíz (opcional pero recomendado):
   ```env
   VITE_GEMINI_API_KEY=Tu_Clave_De_Gemini_AI
   # Si tienes la URL de tu script, ponla aquí. Si no, usa el paso 4.
   VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/...
   ```

3. Iniciar entorno de desarrollo:
   ```bash
   npm run dev
   ```

4. **IMPORTANTE: Restaurar Conexión a la Nube**
   * Abre la aplicación en el navegador.
   * Ve a la sección **Ajustes (Settings)**.
   * Busca el panel **"Conexión a la Nube"**.
   * Pega la URL de tu Web App de Google Apps Script (la que termina en `/exec`).
   * Guarda y recarga. ¡Tus datos volverán a sincronizarse!

## ☁️ Configuración del Backend (Google Apps Script)

Para que la sincronización en la nube funcione, debes configurar el script de Google:

1. Ve a [script.google.com](https://script.google.com/) y crea un nuevo proyecto.
2. Pega el código del backend (proporcionado por separado) en el editor.
3. Haz clic en **Implementar** > **Nueva implementación**.
4. Tipo: **Aplicación web**.
5. Ejecutar como: **Yo** (tu cuenta de Google).
6. Quién tiene acceso: **Cualquiera** (Importante para que la App pueda conectarse).
7. Copia la URL generada y pégala en los Ajustes de la App.

## 📦 Despliegue en Vercel

1. Importa este repositorio en Vercel.
2. En la configuración del proyecto (**Settings > Environment Variables**), agrega:
   * `VITE_GEMINI_API_KEY`: Tu clave de API de IA.
   * `VITE_GOOGLE_SCRIPT_URL`: La URL de tu script de Google.
3. ¡Despliega!
