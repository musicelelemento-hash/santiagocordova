import { R2StorageService } from './r2StorageService';
import { SupabaseService } from './supabaseClientService';
import { StoredFile } from '../types/client';

export interface UploadResult {
    url: string;
    bucketPath: string;
    provider: 'cloudflare_r2' | 'supabase_storage' | 'base64_fallback';
}

/**
 * Unified Storage Service
 * Intelligently manages uploads across Cloudflare R2, Supabase Storage, and local fallbacks.
 */
export const UnifiedStorageService = {
    /**
     * Uploads any file (Blob, File, or Base64 string) to the optimal cloud storage.
     * Tier 1: Cloudflare R2 (10GB Free, $0 Egress)
     * Tier 2: Supabase Storage (1GB Free)
     * Tier 3: Base64 Fallback
     */
    async uploadFile(
        fileData: File | Blob | string,
        fileName: string,
        category: 'declaraciones' | 'firmas' | 'cedulas' | 'rucs' | 'comprobantes' | 'documentos' = 'comprobantes',
        metadata?: StoredFile['metadata']
    ): Promise<StoredFile> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${category}/${timestamp}_${cleanName}`;

        let mimeType = 'application/octet-stream';
        if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (fileName.endsWith('.p12') || fileName.endsWith('.pfx')) mimeType = 'application/x-pkcs12';
        else if (fileName.endsWith('.png')) mimeType = 'image/png';
        else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';

        let fileSize = 0;
        if (typeof fileData === 'string') {
            fileSize = Math.round((fileData.length * 3) / 4);
        } else {
            fileSize = fileData.size;
        }

        // Tier 1: Try Cloudflare R2
        if (R2StorageService.isConfigured()) {
            const r2Result = await R2StorageService.uploadFile(path, fileData, mimeType);
            if (r2Result) {
                return {
                    name: fileName,
                    type: fileName.endsWith('.p12') ? 'p12' : fileName.endsWith('.pdf') ? 'pdf' : 'other',
                    size: fileSize,
                    lastModified: Date.now(),
                    url: r2Result.url,
                    bucketPath: r2Result.path,
                    metadata: {
                        ...metadata,
                        uploadedAt: new Date().toISOString()
                    }
                };
            }
        }

        // Tier 2: Fallback to Supabase Storage
        try {
            let dataUrl = '';
            if (typeof fileData === 'string') {
                dataUrl = fileData.startsWith('data:') ? fileData : `data:${mimeType};base64,${fileData}`;
            } else {
                dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(fileData);
                });
            }

            const supabaseResult = await SupabaseService.uploadFileToStorage(category, path, dataUrl);
            if (supabaseResult && supabaseResult.url) {
                console.log(`✅ [Unified Storage] File uploaded to Supabase Storage: ${supabaseResult.url}`);
                return {
                    name: fileName,
                    type: fileName.endsWith('.p12') ? 'p12' : fileName.endsWith('.pdf') ? 'pdf' : 'other',
                    size: fileSize,
                    lastModified: Date.now(),
                    url: supabaseResult.url,
                    bucketPath: supabaseResult.path,
                    metadata: {
                        ...metadata,
                        uploadedAt: new Date().toISOString()
                    }
                };
            }
        } catch (supabaseErr) {
            console.warn('[Unified Storage] Supabase Storage upload failed:', supabaseErr);
        }

        // Tier 3: Base64 Fallback (Legacy)
        console.warn('[Unified Storage] Cloud storage unavailable, falling back to base64 encoding.');
        let base64Content: string | null = null;

        if (typeof fileData === 'string') {
            base64Content = fileData;
        } else {
            base64Content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(fileData);
            });
        }

        return {
            name: fileName,
            type: fileName.endsWith('.p12') ? 'p12' : fileName.endsWith('.pdf') ? 'pdf' : 'other',
            size: fileSize,
            lastModified: Date.now(),
            content: base64Content,
            metadata: {
                ...metadata,
                uploadedAt: new Date().toISOString()
            }
        };
    }
};
