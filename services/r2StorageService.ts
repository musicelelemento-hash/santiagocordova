/**
 * Cloudflare R2 Storage Service
 * Provides ultra-cheap / free object storage (10GB free tier, $0 egress).
 * Compatible with AWS S3 protocol and REST API signature v4.
 */

export interface R2Config {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
}

function getR2Config(): R2Config | null {
    const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
    const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
    const bucketName = import.meta.env.VITE_R2_BUCKET_NAME || 'santiagocordova-files';
    const publicUrl = import.meta.env.VITE_R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        return null;
    }

    return {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicUrl: publicUrl || `https://${bucketName}.${accountId}.r2.cloudflarestorage.com`
    };
}

export const R2StorageService = {
    isConfigured(): boolean {
        return getR2Config() !== null;
    },

    /**
     * Uploads a file (Blob or DataURL) to Cloudflare R2.
     * Falls back gracefully if credentials are not set.
     */
    async uploadFile(path: string, fileData: Blob | string, contentType: string = 'application/octet-stream'): Promise<{ url: string; path: string } | null> {
        const config = getR2Config();
        if (!config) {
            console.warn('[R2 Storage] R2 credentials missing in environment variables. Falling back to secondary storage.');
            return null;
        }

        try {
            let blob: Blob;
            if (typeof fileData === 'string') {
                const response = await fetch(fileData);
                blob = await response.blob();
            } else {
                blob = fileData;
            }

            const cleanPath = path.startsWith('/') ? path.slice(1) : path;
            const targetUrl = `${config.publicUrl}/${cleanPath}`;

            // Upload via direct PUT to custom endpoint or worker relay
            const uploadResponse = await fetch(targetUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': contentType,
                    'x-amz-acl': 'public-read'
                },
                body: blob
            });

            if (!uploadResponse.ok) {
                throw new Error(`R2 upload HTTP status ${uploadResponse.status}`);
            }

            console.log(`✅ [R2 Storage] File uploaded successfully to R2: ${targetUrl}`);
            return {
                url: targetUrl,
                path: cleanPath
            };
        } catch (err: any) {
            console.error('[R2 Storage Error] Failed to upload file to R2:', err);
            return null;
        }
    }
};
