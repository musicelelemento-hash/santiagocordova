import {
    getFirestore, doc, setDoc, deleteDoc, getDoc, collection,
    onSnapshot, getDocs, writeBatch, query, limit, orderBy
} from "firebase/firestore";
import { firestoreDb } from './firebase';
import { supabase } from './supabase';
import { SupabaseService } from './supabaseClientService';

const DB_NAME = 'SC_Pro_Database';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

const USE_SUPABASE = true; // El Gran Salto a Postgres

export const db = {
    dbPromise: null as Promise<IDBDatabase> | null,

    getDB: function () {
        if (!this.dbPromise) {
            this.dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return this.dbPromise;
    },

    getLocal: async function (key: string): Promise<any> {
        try {
            const idb = await this.getDB();
            return new Promise((resolve, reject) => {
                const tx = idb.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (error) {
            console.error('Error reading from local DB:', error);
            return undefined;
        }
    },

    setLocal: async function (key: string, value: any): Promise<void> {
        try {
            const idb = await this.getDB();
            return new Promise((resolve, reject) => {
                const tx = idb.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(value, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (error) {
            console.error('Error writing to local DB:', error);
        }
    },

    get: async function <T>(key: string): Promise<T | undefined> {
        try {
            const docRef = doc(firestoreDb, "sc_pro_backup", key);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const fbData = docSnap.data().data;
                const localData = await this.getLocal(key);

                // SEGURIDAD: Solo sobreescribir si la nube tiene datos o si local está vacío
                // Si la nube tiene [] pero local tiene [81 clientes], mantenemos el local.
                const isFbDataEmpty = !fbData || (Array.isArray(fbData) && fbData.length === 0);
                const localHasContent = localData && (Array.isArray(localData) && localData.length > 0);

                if (isFbDataEmpty && localHasContent) {
                    console.warn(`Sincronización rechazada para ${key}: La nube está vacía pero tienes datos locales. Protegiendo local.`);
                    // Intentar subir el local a la nube para reparar el backup
                    try { await setDoc(docRef, { data: localData }); } catch (e) { }
                    return localData as T;
                }

                await this.setLocal(key, fbData);
                return fbData as T;
            } else {
                const localData = await this.getLocal(key);
                if (localData !== undefined) {
                    try {
                        await setDoc(docRef, { data: localData });
                    } catch (e) {
                        console.warn("Could not migrate to Firebase:", e);
                    }
                }
                return localData as T | undefined;
            }
        } catch (firebaseErr: any) {
            console.warn(`Firebase fetch failed for ${key}, falling back to local DB:`, firebaseErr.message);
            const fallbackData = await this.getLocal(key);
            return fallbackData as T | undefined;
        }
    },

    set: async function (key: string, value: any): Promise<void> {
        await this.setLocal(key, value);
        try {
            // STRATEGY: Split large content before sending to backup
            const safeValue = await this.splitLargeFiles("sc_pro_backup", key, value);
            const docRef = doc(firestoreDb, "sc_pro_backup", key);
            await setDoc(docRef, { data: safeValue });
        } catch (firebaseErr: any) {
            console.warn(`Firebase sync queued/failed for ${key}:`, firebaseErr.message);
        }
    },

    // --- Elite 500k: Granular Collection Support ---

    isLargeContent: function (value: any): boolean {
        return typeof value === 'string' && value.length > 100000; // ~100KB
    },

    splitLargeFiles: async function (collectionName: string, docId: string, obj: any): Promise<any> {
        if (!obj || typeof obj !== 'object') return obj;

        const newObj = JSON.parse(JSON.stringify(obj));
        const filesToSave: { id: string, content: string }[] = [];
        const isLargeContent = this.isLargeContent;

        const walk = (current: any, path: string) => {
            if (!current || typeof current !== 'object') return;

            for (const key in current) {
                const value = current[key];
                if (key === 'content' && isLargeContent(value)) {
                    const fileId = `${collectionName}_${docId}_${path}_${key}`.replace(/\//g, '_');
                    filesToSave.push({ id: fileId, content: value });
                    current[key] = `__SPLIT__:${fileId}`;
                } else if (value && typeof value === 'object') {
                    walk(value, `${path}_${key}`);
                }
            }
        };

        walk(newObj, '');

        if (filesToSave.length > 0) {
            for (const file of filesToSave) {
                try {
                    // Save to Supabase if active
                    if (USE_SUPABASE) {
                        await SupabaseService.upsertFile(file.id, file.content);
                    }
                    
                    // Always try Firestore as backup for now
                    const fileRef = doc(firestoreDb, "sc_pro_files", file.id);
                    await setDoc(fileRef, { content: file.content });
                } catch (e) {
                    console.error("Error saving split file:", e);
                }
            }
        }
        return newObj;
    },

    rejoinLargeFiles: async function (obj: any): Promise<any> {
        if (!obj || typeof obj !== 'object') return obj;

        const walk = async (current: any) => {
            for (const key in current) {
                const value = current[key];
                if (typeof value === 'string' && value.startsWith('__SPLIT__:')) {
                    const fileId = value.replace('__SPLIT__:', '');
                    try {
                        let content = null;
                        
                        // Try Supabase first
                        if (USE_SUPABASE) {
                            content = await SupabaseService.getFile(fileId);
                        }
                        
                        // Fallback to Firestore
                        if (!content) {
                            const fileRef = doc(firestoreDb, "sc_pro_files", fileId);
                            const fileSnap = await getDoc(fileRef);
                            if (fileSnap.exists()) {
                                content = fileSnap.data().content;
                            }
                        }
                        
                        if (content) {
                            current[key] = content;
                        }
                    } catch (e) {
                        console.error("Error rejoining split file:", e);
                    }
                } else if (value && typeof value === 'object') {
                    await walk(value);
                }
            }
        };

        await walk(obj);
        return obj;
    },

    updateRecord: async function (collectionName: string, id: string, value: any): Promise<void> {
        console.log(`📡 Cloud Sync [Supabase=${USE_SUPABASE}]: Updating ${collectionName}/${id}...`);
        try {
            const safeValue = await this.splitLargeFiles(collectionName, id, value);
            
            if (USE_SUPABASE) {
                if (collectionName === 'sc_pro_clients') {
                    await SupabaseService.upsertClient(safeValue);
                } else if (collectionName === 'sc_pro_tasks') {
                    await SupabaseService.upsertTask(safeValue);
                }
            }
            
            const docRef = doc(firestoreDb, collectionName, id);
            await setDoc(docRef, safeValue, { merge: true });
            
            console.log(`✅ Cloud Sync Success: ${collectionName}/${id}`);
        } catch (err) {
            console.error(`❌ Cloud Sync Error in ${collectionName}/${id}:`, err);
            throw err;
        }
    },

    deleteRecord: async function (collectionName: string, id: string): Promise<void> {
        console.log(`📡 Cloud Sync [Supabase=${USE_SUPABASE}]: Deleting ${collectionName}/${id}...`);
        try {
            if (USE_SUPABASE && collectionName === 'sc_pro_clients') {
                await SupabaseService.deleteClient(id);
            }
            
            const docRef = doc(firestoreDb, collectionName, id);
            await deleteDoc(docRef);
            
            console.log(`✅ Cloud Sync Delete Success: ${collectionName}/${id}`);
        } catch (err) {
            console.error(`❌ Cloud Sync Delete Error in ${collectionName}/${id}:`, err);
            throw err;
        }
    },

    syncCollection: function (collectionName: string, onUpdate: (changes: { type: 'added' | 'modified' | 'removed', data: any }[]) => void) {
        if (USE_SUPABASE && collectionName === 'sc_pro_clients') {
            console.log("🔥 Subscribing to Supabase Realtime for clients...");
            const subscription = SupabaseService.subscribeToChanges('clients', async (payload) => {
                const typeMap: Record<string, 'added' | 'modified' | 'removed'> = {
                    'INSERT': 'added',
                    'UPDATE': 'modified',
                    'DELETE': 'removed'
                };
                let data = SupabaseService.mapClientFromDb(payload.new || payload.old);
                // JOIN: Realtime updates will be lazy loaded by the UI when needed
                // data = await this.rejoinLargeFiles(data);
                
                const change = {
                    type: typeMap[payload.eventType] || 'modified',
                    data
                };
                onUpdate([change]);
            });
            return () => {
              supabase.removeChannel(subscription);
            };
        }

        const colRef = collection(firestoreDb, collectionName);
        return onSnapshot(colRef, async (snapshot) => {
            const changes = await Promise.all(snapshot.docChanges().map(async change => {
                let data = { id: change.doc.id, ...change.doc.data() };
                // REJOIN: Split files will be lazy loaded by the UI when needed
                // data = await this.rejoinLargeFiles(data);
                return {
                    type: change.type as 'added' | 'modified' | 'removed',
                    data
                };
            }));
            onUpdate(changes);
        }, (error) => {
            console.error(`Sync error in ${collectionName}:`, error);
        });
    },

    bulkUpdate: async function (collectionName: string, records: any[]): Promise<void> {
        if (!records || records.length === 0) return;

        if (USE_SUPABASE) {
            try {
                const safeRecords = await Promise.all(records.map(r => this.splitLargeFiles(collectionName, r.id, r)));
                if (collectionName === 'sc_pro_clients') {
                    await SupabaseService.bulkUpsertClients(safeRecords);
                } else if (collectionName === 'sc_pro_tasks') {
                    // Requires bulkUpsertTasks in SupabaseService
                    for (const task of safeRecords) {
                        await SupabaseService.upsertTask(task);
                    }
                }
                console.log(`📡 Supabase Bulk Sync Success: ${records.length} records for ${collectionName}.`);
            } catch (err) {
                console.error(`Supabase bulk update failed for ${collectionName}:`, err);
            }
        }

        // Keep Firestore sync for legacy/backup during transition
        const chunks = [];
        for (let i = 0; i < records.length; i += 500) {
            chunks.push(records.slice(i, i + 500));
        }

        for (const chunk of chunks) {
            const batch = writeBatch(firestoreDb);
            for (const record of chunk) {
                const safeRecord = await this.splitLargeFiles(collectionName, record.id, record);
                const docRef = doc(firestoreDb, collectionName, record.id);
                batch.set(docRef, safeRecord, { merge: true });
            }
            await batch.commit();
            console.log(`📡 Batch committed with Split support: ${chunk.length} records to ${collectionName}.`);
        }
    },

    getAll: async function (collectionName: string): Promise<any[]> {
        let sbResults: any[] = [];
        let fsResults: any[] = [];
        let sbLoaded = false;

        // 1. Try Supabase first (Primary Source of Truth)
        if (USE_SUPABASE && (collectionName === 'sc_pro_clients' || collectionName === 'sc_pro_tasks')) {
            try {
                // Timeout promise to not wait forever for Supabase
                const sbPromise = collectionName === 'sc_pro_tasks'
                    ? SupabaseService.getTasks()
                    : SupabaseService.getClients();
                sbResults = await sbPromise;
                sbLoaded = true;
                console.log(`📡 Supabase Loaded: ${sbResults.length} records.`);
            } catch (err) {
                console.error("Supabase getAll failed, falling back to Firestore:", err);
            }
        }

        // 2. Fetch from Firestore only if Supabase failed or as a background safety check
        // If we already have results from Supabase, we can fetch from Firestore in the background
        // to check for missing records, but for initial load speed, we prioritize Supabase.
        if (!sbLoaded || (collectionName !== 'sc_pro_clients' && collectionName !== 'sc_pro_tasks')) {
            try {
                const colRef = collection(firestoreDb, collectionName);
                const snapshot = await getDocs(colRef);
                fsResults = await Promise.all(snapshot.docs.map(async doc => {
                    let data = { id: doc.id, ...doc.data() };
                    // Optimization: rejoinLargeFiles can be slow if it does network requests.
                    // Split files will be lazy loaded by the UI when needed.
                    // if (JSON.stringify(data).includes('__SPLIT__:')) {
                    //     data = await this.rejoinLargeFiles(data);
                    // }
                    return data;
                }));
                console.log(`📡 Firestore Loaded: ${fsResults.length} records.`);
            } catch (err) {
                console.error(`Error fetching from Firestore (${collectionName}):`, err);
            }
        }

        // 3. Merge and Deduplicate by ID
        const mergedMap = new Map();
        
        // Add Firestore results
        fsResults.forEach(item => mergedMap.set(item.id, item));
        
        // Overwrite with Supabase results (Primary)
        sbResults.forEach(item => mergedMap.set(item.id, item));

        return Array.from(mergedMap.values());
    },

    // -----------------------------------------------

    del: async function (key: string): Promise<void> {
        try {
            const idb = await this.getDB();
            await new Promise<void>((resolve, reject) => {
                const tx = idb.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });

            try {
                const docRef = doc(firestoreDb, "sc_pro_backup", key);
                await deleteDoc(docRef);
            } catch (fbErr) {
                console.warn("Failed to delete from firebase", fbErr);
            }
        } catch (error) {
            console.error('Error deleting from DB:', error);
        }
    },

    clear: async function (): Promise<void> {
        try {
            const idb = await this.getDB();
            return new Promise((resolve, reject) => {
                const tx = idb.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (error) {
            console.error('Error clearing DB:', error);
        }
    },

    keys: async function (): Promise<IDBValidKey[]> {
        try {
            const idb = await this.getDB();
            return new Promise((resolve, reject) => {
                const tx = idb.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAllKeys();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (error) {
            console.error('Error getting keys:', error);
            return [];
        }
    },

    exportData: async function (): Promise<Record<string, any>> {
        try {
            const allKeys = await this.keys();
            const data: Record<string, any> = {};
            for (const key of allKeys) {
                const value = await this.getLocal(key as string);
                data[key as string] = value;
            }
            return data;
        } catch (error) {
            console.error('Error exporting data:', error);
            return {};
        }
    },

    hardReset: async function (): Promise<void> {
        try {
            // Close the database connection if it exists
            if (this.dbPromise) {
                const idb = await this.dbPromise;
                idb.close();
                this.dbPromise = null;
            }

            return new Promise((resolve, reject) => {
                const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
                deleteRequest.onsuccess = () => {
                    console.log("Local database deleted successfully.");
                    resolve();
                };
                deleteRequest.onerror = () => {
                    console.error("Error deleting local database:", deleteRequest.error);
                    reject(deleteRequest.error);
                };
                deleteRequest.onblocked = () => {
                    console.warn("Database deletion blocked. Please close all tabs and try again.");
                    // Still resolve or handle as needed, but warn
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error during hard reset:', error);
        }
    }
};
