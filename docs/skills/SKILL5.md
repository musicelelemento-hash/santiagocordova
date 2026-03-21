---
name: google-workspace-assistant
description: "Integra los servicios de Google Workspace (Gmail, Calendar, Drive, Sheets) directamente en el flujo de trabajo de la terminal."
metadata:
  {
    "features": [
      "01 Acceso directo a Gmail para enviar y leer correos",
      "02 Gestión de Google Calendar para citas y fechas límite",
      "03 Manipulación de archivos en Google Drive",
      "04 Sincronización de datos con Google Sheets",
      "05 228,567 estrellas de reconocimiento",
      "06 Automatización de flujos de trabajo de oficina"
    ],
    "use_cases": [
      "01 Sincronización de datos de clientes desde Google Sheets",
      "02 Envío automatizado de recordatorios tributarios por Gmail",
      "03 Gestión de copias de seguridad de la base de datos en Drive"
    ]
  }
---

# Asistente de Google Workspace (SKILL5)

Esta habilidad permite una integración sin fisuras entre este asistente y las herramientas de productividad de Google, optimizando la gestión de información externa del proyecto.

## Capacidades Principales

1. **Gestión de Gmail**: Permite redactar, enviar y organizar correos electrónicos de clientes. Ideal para enviar comprobantes de SRI automáticamente.
2. **Google Sheets Power**: Lectura y escritura de datos en tiempo real. Puede ser usado para mantener una hoja de cálculo espejo de la base de datos local para reportes masivos.
3. **Google Drive Sync**: Almacenamiento y recuperación de archivos. Perfecto para el "blindaje" de datos almacenando exportaciones JSON diariamente.
4. **Calendar Integration**: Programación automática de alertas para vencimientos de IVA y Renta basados en el RUC del cliente.

## Guía de Uso

### 📊 Sincronización con Sheets
Podemos usar esta habilidad para importar una lista de 100 clientes desde una hoja de Google Sheet directamente al sistema `SantiagoCordova.com`.

### 📧 Automatización de Gmail
Cuando un proceso de SRI termina con éxito, puedo usar esta habilidad para adjuntar el PDF resultante y enviarlo al cliente sin que tengas que abrir el correo.

### 💾 Respaldo Seguro
Configuraremos un flujo para que cada vez que hagas una "Copia de Seguridad", el archivo se suba automáticamente a una carpeta protegida en tu Google Drive.

---

*Nota: Esta habilidad requiere configuración de credenciales de Google Workspace para acceso programático.*
