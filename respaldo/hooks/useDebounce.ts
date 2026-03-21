
import { useState, useEffect } from 'react';

/**
 * Hook para retrasar la actualización de un valor hasta que el usuario deje de escribir.
 * Esencial para optimizar búsquedas en listas grandes (>100 items).
 * 
 * @param value El valor a observar (ej: texto de búsqueda)
 * @param delay Tiempo de espera en ms (default: 300ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Establecer un timer para actualizar el valor después del delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpiar el timer si el valor cambia antes de que termine el delay
    // (ej: si el usuario sigue escribiendo)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
