import { defineConfig } from 'vitest/config';

// Pruebas automáticas de la web: sólo lógica (cálculos SRI, cobros, clientes).
// Corren sin red ni base de datos: db, Supabase y Firebase se reemplazan en cada archivo.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
