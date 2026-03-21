import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let firebaseAdminApp: admin.app.App;

/**
 * Robustly retrieves the service account credentials from:
 * 1. FIREBASE_SERVICE_ACCOUNT (JSON string)
 * 2. Individual env vars (FIREBASE_PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)
 * 3. Local serviceAccountKey.json file
 */
export function getServiceAccount(): any | null {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountVar) {
        try {
            return JSON.parse(serviceAccountVar);
        } catch (e) {
            console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT:", e);
        }
    }

    const individualConfig = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    if (individualConfig.projectId && individualConfig.clientEmail && individualConfig.privateKey) {
        return {
            ...individualConfig,
            project_id: individualConfig.projectId,
            client_email: individualConfig.clientEmail,
            private_key: individualConfig.privateKey,
        };
    }

    const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
        return require(serviceAccountPath);
    }

    return null;
}

export function getFirebaseAdmin() {
    if (firebaseAdminApp) return firebaseAdminApp;

    try {
        const serviceAccount = getServiceAccount();

        if (serviceAccount) {
            console.log("🚀 Initializing Firebase with provided credentials...");
            firebaseAdminApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else {
            console.warn("⚠️ No Firebase credentials found. Using default initialization.");
            firebaseAdminApp = admin.initializeApp();
        }

        console.log("✅ Firebase Admin Initialized Successfully");
        return firebaseAdminApp;
    } catch (error) {
        console.error("❌ Firebase Admin Initialization Error:", error);
        // Return the first app if already initialized
        if (admin.apps.length) {
            firebaseAdminApp = admin.apps[0]!;
            return firebaseAdminApp;
        }
        throw error;
    }
}

export const getFirestore = () => getFirebaseAdmin().firestore();
