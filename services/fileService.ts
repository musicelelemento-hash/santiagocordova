import { StoredFile } from '../types/client';
import { db } from './db';

const notify = {
  info: (msg: string, toast?: any) => { toast?.info ? toast.info(msg) : console.log(`[INFO] ${msg}`); },
  error: (msg: string, toast?: any) => { toast?.error ? toast.error(msg) : console.error(`[ERROR] ${msg}`); },
  success: (msg: string, toast?: any) => { toast?.success ? toast.success(msg) : console.log(`[SUCCESS] ${msg}`); }
};

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

  if (!fileToDownload.content || fileToDownload.content.startsWith('__SPLIT__:')) {
    notify.error("No se pudo recuperar el archivo desde la nube.");
    return false;
  }

  try {
    let downloadUrl = fileToDownload.content;
    let isBlobCreated = false;

    let base64Str = fileToDownload.content;
    let mimeType = (fileToDownload.type === 'p12' || fileToDownload.name?.endsWith('.p12') || fileToDownload.name?.endsWith('.pfx'))
      ? 'application/x-pkcs12'
      : 'application/pdf';

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

  if (!fileToOpen.content || fileToOpen.content.startsWith('__SPLIT__:')) {
    notify.error("No se pudo recuperar el archivo desde la nube.");
    return false;
  }

  try {
    let openUrl = fileToOpen.content;
    if (fileToOpen.content.startsWith('data:')) {
      const parts = fileToOpen.content.split(',');
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

    window.open(openUrl, '_blank');
    return true;
  } catch (err) {
    console.error("Error al abrir el archivo:", err);
    notify.error("Error al abrir el archivo en nueva pestaña.");
    return false;
  }
}
