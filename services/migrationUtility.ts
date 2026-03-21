import { db } from './db';
import { SupabaseService } from './supabaseClientService';

/**
 * Utility to migrate data from Firestore to Supabase.
 */
export const MigrationUtility = {
  async migrateClients() {
    console.log("🚀 Starting Client Migration: Firestore -> Supabase");
    
    try {
      // 1. Fetch all clients from Firestore (via the existing getAll method)
      const firestoreClients = await db.getAll('sc_pro_clients');
      console.log(`📦 Fetched ${firestoreClients.length} clients from Firestore.`);
      
      if (firestoreClients.length === 0) {
        console.warn("⚠️ No clients found in Firestore to migrate.");
        return { success: false, message: "No data found in source." };
      }

      // 2. Push to Supabase
      await SupabaseService.bulkUpsertClients(firestoreClients);
      console.log("✅ Migration Successful: All clients pushed to Supabase.");
      
      return { success: true, count: firestoreClients.length };
    } catch (error: any) {
      console.error("❌ Client Migration Failed:", error);
      return { success: false, error: error.message };
    }
  },

  async migrateTasks() {
    console.log("🚀 Starting Task Migration: Firestore -> Supabase");
    try {
      const firestoreTasks = await db.getAll('sc_pro_tasks');
      console.log(`📦 Fetched ${firestoreTasks.length} tasks from Firestore.`);
      
      if (firestoreTasks.length === 0) {
        console.warn("⚠️ No tasks found in Firestore to migrate.");
        return { success: false, message: "No data found in source." };
      }

      for (const task of firestoreTasks) {
        await SupabaseService.upsertTask(task);
      }
      
      console.log("✅ Migration Successful: All tasks pushed to Supabase.");
      return { success: true, count: firestoreTasks.length };
    } catch (error: any) {
      console.error("❌ Task Migration Failed:", error);
      return { success: false, error: error.message };
    }
  },

  async migrateAll() {
    const clientsResult = await this.migrateClients();
    const tasksResult = await this.migrateTasks();
    return {
      clients: clientsResult,
      tasks: tasksResult
    };
  }
};
