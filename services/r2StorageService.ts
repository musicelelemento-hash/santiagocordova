/**
 * Cloudflare R2 Storage Service
 * Provides ultra-cheap / free object storage (10GB free tier, $0 egress).
 * Compatible with AWS S3 protocol and REST API signature v4.
 */

export interface R2Config {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    publicUrl: string;
    workerUrl?: string;
}

function getR2Config(): R2Config | null {
    const workerUrl = import.meta.env.VITE_R2_WORKER_URL || 'https://santiagocordova-r2-vault.workers.dev';
    const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
    const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
    const bucketName = import.meta.env.VITE_R2_BUCKET_NAME || 'santiagocordova-files';
    const publicUrl = import.meta.env.VITE_R2_PUBLIC_URL || `${workerUrl}/files`;

    // Si tenemos Worker URL configurado, está listo para operar en modo Edge Relay
    if (workerUrl && !workerUrl.includes('TU_')) {
        return {
            workerUrl,
            publicUrl,
            bucketName,
            accountId: accountId && !accountId.includes('TU_') ? accountId : undefined,
            accessKeyId: accessKeyId && !accessKeyId.includes('TU_') ? accessKeyId : undefined,
            secretAccessKey: secretAccessKey && !secretAccessKey.includes('TU_') ? secretAccessKey : undefined
        };
    }

    if (
        accountId &&
        accessKeyId &&
        secretAccessKey &&
        !accessKeyId.includes('TU_') &&
        !secretAccessKey.includes('TU_') &&
        !accountId.includes('TU_') &&
        accessKeyId !== 'dummy'
    ) {
        return {
            accountId,
            accessKeyId,
            secretAccessKey,
            bucketName,
            publicUrl: publicUrl || `https://${accountId}.r2.cloudflarestorage.com/${bucketName}`
        };
    }

    return null;
}

async function uploadToR2WithSigV4(
    config: R2Config,
    cleanPath: string,
    blob: Blob,
    contentType: string
): Promise<{ url: string; path: string } | null> {
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
        return null;
    }

    const host = `${config.accountId}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}/${config.bucketName}/${cleanPath}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const arrayBuffer = await blob.arrayBuffer();
    const payloadHashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const payloadHash = Array.from(new Uint8Array(payloadHashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const canonicalUri = `/${config.bucketName}/${cleanPath}`;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const encoder = new TextEncoder();
    const reqHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
    const reqHash = Array.from(new Uint8Array(reqHashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${reqHash}`;

    async function hmac(k: string | ArrayBuffer, str: string): Promise<ArrayBuffer> {
        const keyObj = await crypto.subtle.importKey(
            'raw',
            typeof k === 'string' ? encoder.encode(k) : k,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        return await crypto.subtle.sign('HMAC', keyObj, encoder.encode(str));
    }

    const kDate = await hmac('AWS4' + config.secretAccessKey, dateStamp);
    const kRegion = await hmac(kDate, 'auto');
    const kService = await hmac(kRegion, 's3');
    const kSigning = await hmac(kService, 'aws4_request');
    const signatureBuffer = await hmac(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
            Authorization: authHeader,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': payloadHash,
            'Content-Type': contentType
        },
        body: blob
    });

    if (res.ok) {
        const publicUrl = `${config.publicUrl}/${cleanPath}`;
        console.log(`✅ [R2 Storage] File uploaded successfully to R2: ${publicUrl}`);
        return {
            url: publicUrl,
            path: cleanPath
        };
    }
    throw new Error(`R2 HTTP ${res.status}`);
}

export const R2StorageService = {
    isConfigured(): boolean {
        return getR2Config() !== null;
    },

    /**
     * Uploads a file (Blob or DataURL) to Cloudflare R2.
     * Uses WebCrypto SigV4 / Worker Relay for zero egress storage.
     */
    async uploadFile(path: string, fileData: Blob | string, contentType: string = 'application/octet-stream'): Promise<{ url: string; path: string } | null> {
        const config = getR2Config();
        if (!config) {
            console.warn('[R2 Storage] R2 credentials/worker missing. Falling back to secondary storage.');
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

            // Opción 1: Subida con credenciales S3 (SigV4 WebCrypto Nativo)
            if (config.accessKeyId && config.secretAccessKey) {
                try {
                    const s3Result = await uploadToR2WithSigV4(config, cleanPath, blob, contentType);
                    if (s3Result) return s3Result;
                } catch (s3Err) {
                    console.warn('[R2 Storage] SigV4 upload failed, trying worker relay...', s3Err);
                }
            }

            // Opción 2: Subida vía Cloudflare Worker Vault
            if (config.workerUrl) {
                const workerUploadUrl = `${config.workerUrl}/upload/${cleanPath}`;
                const uploadResponse = await fetch(workerUploadUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': contentType
                    },
                    body: blob
                });

                if (uploadResponse.ok) {
                    const data = await uploadResponse.json();
                    const finalUrl = data.url || `${config.publicUrl}/${cleanPath}`;
                    console.log(`✅ [R2 Storage] File uploaded via Cloudflare Worker: ${finalUrl}`);
                    return {
                        url: finalUrl,
                        path: cleanPath
                    };
                }
            }

            return null;
        } catch (err: any) {
            console.error('[R2 Storage Error] Failed to upload file to R2:', err);
            return null;
        }
    }
};
