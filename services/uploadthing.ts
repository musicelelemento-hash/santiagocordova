import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "../telegram-bot/src/uploadthing";

// Exportamos los helpers para que puedan ser usados en toda la App
export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();

// Configuramos el endpoint que apunta al bot/backend
// Nota: En producción esto debería ser la URL del bot desplegado
export const UPLOADTHING_URL = "/api/uploadthing";
