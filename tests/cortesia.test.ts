import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/db', () => ({ db: {} }));
vi.mock('../services/fileService', () => ({ signPublicStorageUrl: async (u: string) => u }));

import { isCourtesyClient } from '../services/clientService';

// 22-nov-2026: una nota no puede esconder a un cliente de Cobranza.
describe('Cliente de cortesía', () => {
  it('el interruptor de la ficha manda', () => {
    expect(isCourtesyClient({ isCourtesy: true } as any)).toBe(true);
  });
  it('honorario personalizado en 0 es cortesía', () => {
    expect(isCourtesyClient({ customServiceFee: 0 } as any)).toBe(true);
  });
  it('categoría o alias «Cortesía», «Trueque» o «Familia» cuentan', () => {
    expect(isCourtesyClient({ taxProfile: { alias: 'Cortesía' } } as any)).toBe(true);
    expect(isCourtesyClient({ taxProfile: { category: 'trueque' } } as any)).toBe(true);
  });
  it('las notas ya no esconden a nadie', () => {
    expect(isCourtesyClient({ notes: 'saldo cero en caja' } as any)).toBe(false);
    expect(isCourtesyClient({ notes: 'es de la familia de Juan' } as any)).toBe(false);
  });
  it('«cero» en el alias ya no cuenta', () => {
    expect(isCourtesyClient({ taxProfile: { alias: 'Ferretería Cero' } } as any)).toBe(false);
  });
  it('un cliente normal no es cortesía', () => {
    expect(isCourtesyClient({ customServiceFee: 25 } as any)).toBe(false);
  });
});
