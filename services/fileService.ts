import { StoredFile } from '../types/client';
import { db } from './db';
import { supabase } from './supabase';

const notify = {
  info: (msg: string, toast?: any) => { toast?.info ? toast.info(msg) : console.log(`[INFO] ${msg}`); },
  error: (msg: string, toast?: any) => { toast?.error ? toast.error(msg) : console.error(`[ERROR] ${msg}`); },
  success: (msg: string, toast?: any) => { toast?.success ? toast.success(msg) : console.log(`[SUCCESS] ${msg}`); }
};

const SUPABASE_PUBLIC_URL_RE = /\/storage\/v1\/object\/public\/([^/?]+)\/(.+)$/;

/**
 * Convierte una URL pública de Supabase Storage en una URL FIRMADA
 * (necesaria cuando el bucket es privado). Si la URL no es de Supabase
 * o no se puede firmar, devuelve la URL original.
 */
export async function signPublicStorageUrl(url: string): Promise<string> {
  if (!url || !url.includes('/storage/v1/object/public/')) return url;
  const m = url.match(SUPABASE_PUBLIC_URL_RE);
  if (!m) return url;
  const bucket = m[1];
  const path = m[2];
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data?.signedUrl || url;
  } catch (err) {
    console.warn('[Storage] No se pudo generar URL firmada, usando la original:', err);
    return url;
  }
}

/**
 * Resolves a StoredFile, checking if its content is split (__SPLIT__:)
 * and fetching the real content from Supabase/Firestore if needed.
 */
export async function resolveStoredFile(file: StoredFile | null | undefined): Promise<StoredFile | null> {
  if (!file || !file.content) return file || null;

  if (file.content.startsWith('__SPLIT__:') || file.content.startsWith('__SPLIT__Solid')) {
    try {
      const resolved = await db.rejoinLargeFiles({ content: file.content });
      if (resolved && resolved.content && !resolved.content.startsWith('__SPLIT__:')) {
        return {
          ...file,
          content: resolved.content
        };
      }
    } catch (err) {
      console.error("Error resolviendo archivo desde la nube:", err);
    }
  }

  return file;
}

/**
 * Resolves and triggers a bulletproof download of a StoredFile across all browsers (Desktop, Mobile).
 */
export async function downloadStoredFile(file: StoredFile | null | undefined): Promise<boolean> {
  if (!file) return false;

  let fileToDownload = file;
  if (file.content && (file.content.startsWith('__SPLIT__:') || file.content.startsWith('__SPLIT__Solid'))) {
    notify.info("Descargando archivo desde la nube...");
    fileToDownload = (await resolveStoredFile(file)) || file;
  }

  if (!fileToDownload.content && !fileToDownload.url) {
    notify.error("No se pudo recuperar el archivo desde la nube.");
    return false;
  }

  try {
    let downloadUrl = '';
    let isBlobCreated = false;

    let mimeType = (fileToDownload.type === 'p12' || fileToDownload.name?.endsWith('.p12') || fileToDownload.name?.endsWith('.pfx'))
      ? 'application/x-pkcs12'
      : 'application/pdf';

    if (fileToDownload.url) {
      // Buckets privados: firmar la URL pública antes de descargar
      const resolvedUrl = await signPublicStorageUrl(fileToDownload.url);
      const response = await fetch(resolvedUrl);
      if (!response.ok) {
        throw new Error(`No se pudo descargar el archivo (HTTP ${response.status})`);
      }
      const blob = await response.blob();
      downloadUrl = URL.createObjectURL(blob);
      isBlobCreated = true;
    } else {
      let base64Str = fileToDownload.content || '';
      if (base64Str.startsWith('data:')) {
        const parts = base64Str.split(',');
        if (parts.length === 2) {
          const mimeMatch = parts[0].match(/:(.*?);/);
          if (mimeMatch) mimeType = mimeMatch[1];
          base64Str = parts[1];
        }
      }

      if (!base64Str.startsWith('http://') && !base64Str.startsWith('https://') && !base64Str.startsWith('blob:')) {
        const cleanB64 = base64Str.replace(/\s/g, '');
        const byteCharacters = atob(cleanB64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        downloadUrl = URL.createObjectURL(blob);
        isBlobCreated = true;
      } else {
        downloadUrl = base64Str;
      }
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileToDownload.name || (mimeType === 'application/x-pkcs12' ? 'firma.p12' : 'documento.pdf');
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      if (isBlobCreated) {
        URL.revokeObjectURL(downloadUrl);
      }
    }, 1500);

    notify.success("Descarga iniciada.");
    return true;
  } catch (err) {
    console.error("Error al descargar el archivo:", err);
    notify.error("Error al procesar el archivo para descarga.");
    return false;
  }
}

/**
 * Resolves and opens a StoredFile in a new browser tab.
 */
export async function openStoredFileInNewTab(file: StoredFile | null | undefined): Promise<boolean> {
  if (!file) return false;

  let fileToOpen = file;
  if (file.content && (file.content.startsWith('__SPLIT__:') || file.content.startsWith('__SPLIT__Solid'))) {
    notify.info("Cargando archivo desde la nube...");
    fileToOpen = (await resolveStoredFile(file)) || file;
  }

  if (!fileToOpen.content && !fileToOpen.url) {
    notify.error("No se pudo recuperar el archivo desde la nube.");
    return false;
  }

  try {
    let openUrl = '';
    if (fileToOpen.url) {
      // Buckets privados: firmar la URL pública antes de abrir
      openUrl = await signPublicStorageUrl(fileToOpen.url);
    } else {
      openUrl = fileToOpen.content || '';
      if (openUrl.startsWith('data:')) {
        const parts = openUrl.split(',');
        if (parts.length === 2) {
          const mimeMatch = parts[0].match(/:(.*?);/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
          const base64Data = parts[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          openUrl = URL.createObjectURL(blob);
        }
      }
    }

    window.open(openUrl, '_blank');
    return true;
  } catch (err) {
    console.error("Error al abrir el archivo:", err);
    notify.error("Error al abrir el archivo en nueva pestaña.");
    return false;
  }
}
