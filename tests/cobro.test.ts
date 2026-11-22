import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/db', () => ({ db: {} }));
vi.mock('../services/fileService', () => ({ signPublicStorageUrl: async (u: string) => u }));
vi.mock('../services/clientService', () => ({ isCourtesyClient: () => false, getClientServiceFee: () => 0 }));

import { isDeclared, estadoAlCobrar, isPaid } from '../services/complianceEngine';
import { DeclarationStatus } from '../types';

// Regla del 21-nov-2026: cobrar no es declarar.
describe('Regla de cobro', () => {
  it('una declaración Pendiente cobrada sigue Pendiente', () => {
    expect(estadoAlCobrar({ period: '2026-10', status: DeclarationStatus.Pendiente } as any)).toBe(DeclarationStatus.Pendiente);
  });
  it('un período sin fila, cobrado por adelantado, queda Pendiente', () => {
    expect(estadoAlCobrar(undefined)).toBe(DeclarationStatus.Pendiente);
  });
  it('una Vencida cobrada sigue Vencida', () => {
    expect(estadoAlCobrar({ status: DeclarationStatus.Vencida } as any)).toBe(DeclarationStatus.Vencida);
  });
  it('una Enviada cobrada pasa a Pagada', () => {
    expect(estadoAlCobrar({ status: DeclarationStatus.Enviada } as any)).toBe(DeclarationStatus.Pagada);
  });
  it('con comprobante cuenta como declarada aunque el estado diga Pendiente', () => {
    const d = { status: DeclarationStatus.Pendiente, proof_file: 'x.pdf' } as any;
    expect(isDeclared(d)).toBe(true);
    expect(estadoAlCobrar(d)).toBe(DeclarationStatus.Pagada);
  });
  it('cobrado se lee de is_paid, sin tocar el estado', () => {
    expect(isPaid({ status: DeclarationStatus.Pendiente, is_paid: true } as any)).toBe(true);
    expect(isPaid({ status: DeclarationStatus.Pendiente } as any)).toBe(false);
    expect(isDeclared({ status: DeclarationStatus.Pendiente, is_paid: true } as any)).toBe(false);
  });
});
