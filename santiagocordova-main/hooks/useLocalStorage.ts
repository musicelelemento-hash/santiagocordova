
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';

// Claves que se almacenarán en IndexedDB debido a su potencial tamaño
const IDB_KEYS = ['clients', 'tasks', 'webOrders', 'sriCredentials'];

export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const isIDB = IDB_KEYS.includes(key);
  const isMounted = useRef(false);

  // Initialize state
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (isIDB) return initialValue; // Para DB, iniciamos con default y cargamos después
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Effect para cargar datos asíncronos desde IndexedDB
  useEffect(() => {
    if (!isIDB) return;
    isMounted.current = true;

    const loadData = async () => {
      try {
        // 1. Verificar Migración: Si existe en LocalStorage pero no en DB, moverlo.
        const localData = window.localStorage.getItem(key);
        if (localData) {
            console.log(`[Migration] Moviendo ${key} de LocalStorage a IndexedDB...`);
            const parsed = JSON.parse(localData);
            await db.set(key, parsed); // Guardar en DB
            if(isMounted.current) setStoredValue(parsed);    // Actualizar estado
            window.localStorage.removeItem(key); // Limpiar LocalStorage
            return;
        }

        // 2. Carga Normal desde DB
        const dbData = await db.get<T>(key);
        if (dbData !== undefined && dbData !== null && isMounted.current) {
            setStoredValue(dbData);
        }
      } catch (error) {
        console.error(`Error cargando ${key} desde base de datos:`, error);
      }
    };

    loadData();

    return () => { isMounted.current = false; };
  }, [key, isIDB]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // 1. Actualizar estado de React (UI inmediata)
      setStoredValue(valueToStore);
      
      // 2. Persistir datos (Asíncrono para IDB, Síncrono para LocalStorage)
      if (isIDB) {
          // Fire and forget, no bloquea la UI
          db.set(key, valueToStore).catch(err => console.error(`Error guardando ${key} en DB:`, err));
      } else {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error estableciendo valor para ${key}`, error);
    }
  };

  return [storedValue, setValue];
}
