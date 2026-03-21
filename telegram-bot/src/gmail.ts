import { google } from 'googleapis';
import { saveGmailToken, loadGmailToken } from './database';

// Google OAuth2 setup
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = 'http://localhost'; // Fixed to standard localhost redirect

let oauth2Client: any = null;

function getClient() {
    if (!oauth2Client) {
        oauth2Client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI
        );
    }
    return oauth2Client;
}

export function getAuthUrl(): string {
    const client = getClient();
    return client.generateAuthUrl({
        access_type: 'offline', // Requests a refresh token
        scope: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send'
        ],
    });
}

export async function setTokenFromCode(chatId: string, code: string): Promise<void> {
    const client = getClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Save token to Firebase against this user's chatId
    await saveGmailToken(chatId, tokens);
}

async function loadToken(chatId: string) {
    const tokens = await loadGmailToken(chatId);
    if (tokens) {
        const client = getClient();
        client.setCredentials(tokens);
        // Optionally update tokens back to db if they refresh
        client.on('tokens', (newTokens: any) => {
            if (newTokens.refresh_token) {
                saveGmailToken(chatId, newTokens);
            }
        });
        return client;
    }
    throw new Error(`Gmail no está autorizado para este chat. Usa /authgmail`);
}

export async function getUnreadEmails(chatId: string, maxResults = 5): Promise<string> {
    try {
        const auth = await loadToken(chatId);
        const gmail = google.gmail({ version: 'v1', auth });

        const res = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
            maxResults
        });

        const messages = res.data.messages;
        if (!messages || messages.length === 0) {
            return "No tienes correos nuevos sin leer.";
        }

        let emailSummaries = "Tus correos sin leer:\n\n";

        for (const msg of messages) {
            if (msg.id) {
                const mail = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Subject', 'Date']
                });

                const headers = mail.data.payload?.headers || [];
                const from = headers.find((h: any) => h.name === 'From')?.value || 'Desconocido';
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'Sin asunto';

                emailSummaries += `- De: ${from}\n  Asunto: ${subject}\n\n`;
            }
        }

        return emailSummaries;
    } catch (e: any) {
        if (e.message.includes("no está autorizado")) return e.message;
        return `Hubo un error accediendo a Gmail: ${e.message}`;
    }
}

export async function sendEmail(chatId: string, to: string, subject: string, body: string): Promise<string> {
    try {
        const auth = await loadToken(chatId);
        const gmail = google.gmail({ version: 'v1', auth });

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const emailLines = [
            `To: ${to}`,
            'Content-type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            body
        ];

        const email = emailLines.join('\r\n').trim();
        const base64EncodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: base64EncodedEmail,
            },
        });

        return `Correo enviado exitosamente a ${to}. (Message ID: ${res.data.id})`;
    } catch (e: any) {
        if (e.message.includes("no está autorizado") || e.message.includes("insufficient Permissions")) {
            return "No tienes permiso para enviar correos (necesitas reautorizar con /authgmail).";
        }
        return `Hubo un error enviando el correo a ${to}: ${e.message}`;
    }
}

export async function searchEmails(chatId: string, query: string, maxResults = 5): Promise<string> {
    try {
        const auth = await loadToken(chatId);
        const gmail = google.gmail({ version: 'v1', auth });

        const res = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults
        });

        const messages = res.data.messages;
        if (!messages || messages.length === 0) {
            return `No se encontraron correos para la búsqueda: "${query}"`;
        }

        let emailSummaries = `Resultados para "${query}":\n\n`;

        for (const msg of messages) {
            if (msg.id) {
                const mail = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Subject', 'Date', 'Snippet']
                });

                const headers = mail.data.payload?.headers || [];
                const from = headers.find((h: any) => h.name === 'From')?.value || 'Desconocido';
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'Sin asunto';
                const snippet = mail.data.snippet || '';

                emailSummaries += `- De: ${from}\n  Asunto: ${subject}\n  Resumen: ${snippet}\n\n`;
            }
        }

        return emailSummaries;
    } catch (e: any) {
        if (e.message.includes("no está autorizado")) return e.message;
        return `Error buscando correos: ${e.message}`;
    }
}
