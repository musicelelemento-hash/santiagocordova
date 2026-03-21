import { google } from 'googleapis';
import { getServiceAccount } from './firebase-admin-init';

/**
 * Initializes Google OAuth2/Service Account for Sheets and Drive
 */
async function getGoogleAuth() {
    const credentials = getServiceAccount();
    if (!credentials) throw new Error("No Google credentials found for sync.");

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file'
        ],
    });
    return auth;
}

/**
 * Syncs Firestore client data to a Google Sheet backup
 */
export async function syncToSheets(clients: any[]) {
    try {
        const auth = await getGoogleAuth();
        const bAuth = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: bAuth as any });

        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        if (!spreadsheetId) {
            console.warn("⚠️ GOOGLE_SHEETS_ID not set. Skipping Sheets sync.");
            return;
        }

        // Prepare data rows
        const rows = clients.map(c => [
            c.ruc,
            c.name,
            c.regime || 'General',
            c.annualRentaStatus || 'Pendiente',
            c.notes || ''
        ]);

        // Add header
        rows.unshift(['RUC', 'NOMBRE', 'RÉGIMEN', 'RENTA 2025', 'NOTAS']);

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'RAW',
            requestBody: { values: rows },
        });

        console.log("✅ Google Sheets backup updated.");
    } catch (error: any) {
        console.error("❌ Error syncing to Sheets:", error.message);
    }
}

/**
 * Uploads a file to a specific folder in Google Drive
 */
export async function uploadToDrive(fileName: string, buffer: Buffer, folderName: string) {
    try {
        const auth = await getGoogleAuth();
        const bAuth = await auth.getClient();
        const drive = google.drive({ version: 'v3', auth: bAuth as any });

        // 1. Find or create folder
        let folderId = await findFolder(drive, folderName);
        if (!folderId) {
            folderId = await createFolder(drive, folderName);
        }

        // 2. Upload file
        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };
        const media = {
            mimeType: 'application/pdf',
            body: require('stream').Readable.from(buffer),
        };

        const res = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
        });

        return res.data;
    } catch (error: any) {
        console.error("❌ Drive Upload Error:", error.message);
        throw error;
    }
}

async function findFolder(drive: any, name: string) {
    const res = await drive.files.list({
        q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
    });
    return res.data.files[0]?.id;
}

async function createFolder(drive: any, name: string) {
    const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
    };
    const res = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
    });
    return res.data.id;
}
