
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Soluciones Contables Pro - Sistema de Gestión

Esta aplicación es una plataforma de gestión tributaria moderna construida con React, Vite y Tailwind CSS. Utiliza Google Gemini para inteligencia artificial y Google Apps Script (Sheets/Drive) como base de datos en la nube (Backend Serverless).

Ver aplicación desplegada: https://ai.studio/apps/drive/1nJkX29kDW9eXlb6de9byjdVwjtoZCDsU

## 🚀 Instalación Local

**Prerequisitos:** Node.js instalado.

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Crear archivo `.env.local` en la raíz y agregar tus claves:
   ```env
   VITE_GEMINI_API_KEY=Tu_Clave_De_Gemini_AI
   VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/AKfycbwFApmOIDGorJYz61LlJprB6uQj-YnsxEfg7iHAGsCpSGFGvqp01P46Aew0bbQ_yAqr/exec
   ```

3. Iniciar entorno de desarrollo:
   ```bash
   npm run dev
   ```

## ☁️ Configuración del Backend (Google Apps Script)

Para que la sincronización en la nube funcione, debes configurar el script de Google:

1. Ve a [script.google.com](https://script.google.com/) y crea un nuevo proyecto.
2. Pega el código del backend (proporcionado por separado) en el editor.
3. Haz clic en **Implementar** > **Nueva implementación**.
4. Tipo: **Aplicación web**.
5. Ejecutar como: **Yo** (tu cuenta de Google).
6. Quién tiene acceso: **Cualquiera** (Importante para que la App pueda conectarse).
7. Usa la URL generada en tus variables de entorno.

## 📦 Despliegue en Vercel

1. Importa este repositorio en Vercel.
2. En la configuración del proyecto (**Settings > Environment Variables**), agrega:
   * `VITE_GEMINI_API_KEY`: Tu clave de API de IA.
   * `VITE_GOOGLE_SCRIPT_URL`: `https://script.google.com/macros/s/AKfycbwFApmOIDGorJYz61LlJprB6uQj-YnsxEfg7iHAGsCpSGFGvqp01P46Aew0bbQ_yAqr/exec`
3. ¡Despliega!
