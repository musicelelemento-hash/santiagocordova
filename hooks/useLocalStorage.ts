
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';

// Claves que se almacenarán en IndexedDB debido a su potencial tamaño
const IDB_KEYS = ['clients', 'tasks', 'webOrders', 'sriCredentials'];

export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const isIDB = IDB_KEYS.includes(key);

  // Initialize state
  // Para IDB, iniciamos con initialValue y luego cargamos asíncronamente
  // Para LocalStorage, intentamos leer síncronamente para evitar parpadeos en UI (ej: tema)
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (isIDB) return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const [isReady, setIsReady] = useState(!isIDB);
  const wasUpdatedManually = useRef(false);

  // Effect para cargar datos asíncronos desde IndexedDB
  useEffect(() => {
    if (!isIDB || isReady) return;

    const loadData = async () => {
      try {
        // 1. Verificar Migración: Si existe en LocalStorage pero no en DB, moverlo.
        const localData = window.localStorage.getItem(key);
        if (localData) {
          console.log(`[Migration] Moviendo ${key} de LocalStorage a IndexedDB...`);
          const parsed = JSON.parse(localData);
          await db.set(key, parsed); // Guardar en DB
          if (!wasUpdatedManually.current) setStoredValue(parsed);
          window.localStorage.removeItem(key); // Limpiar LocalStorage
          setIsReady(true);
          return;
        }

        // 2. Carga Normal desde DB
        const dbData = await db.get<T>(key);
        if (dbData !== undefined && dbData !== null) {
          if (!wasUpdatedManually.current) {
            setStoredValue(dbData);
          }
        }
        setIsReady(true);
      } catch (error) {
        console.error(`Error cargando ${key} desde base de datos:`, error);
        setIsReady(true); // Evitar bloqueo infinito en caso de error
      }
    };

    loadData();
  }, [key, isIDB]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // 1. Actualizar estado de React (UI inmediata)
      wasUpdatedManually.current = true;
      setStoredValue(valueToStore);

      // 2. Persistir datos (Asíncrono para IDB, Síncrono para LocalStorage)
      if (isIDB) {
        db.set(key, valueToStore).catch(err => console.error(`Error guardando ${key} en DB:`, err));
      } else {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue, isReady];
}
