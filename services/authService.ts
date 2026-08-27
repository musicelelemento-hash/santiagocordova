/**
 * services/authService.ts
 * ---------------------------------------------------------------------
 * Autenticación REAL con Supabase Auth (email + contraseña).
 * Reemplaza el flag falso `sc_pro_admin_session` de localStorage.
 *
 * Requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local
 * (las mismas que usa services/supabase.ts).
 */

import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

export const authService = {
  /** Inicia sesión con email + contraseña. */
  async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  /** Cierra la sesión local y revoca el token. */
  async signOut() {
    return supabase.auth.signOut();
  },

  /** Devuelve la sesión activa (si existe). */
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /**
   * Se suscribe a cambios de sesión (login/logout/refresh).
   * Devuelve la suscripción para poder cancelarla con .unsubscribe().
   */
  onAuthStateChange(callback: (session: Session | null) => void) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return data.subscription;
  },
};
