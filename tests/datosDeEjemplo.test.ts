import { describe, it, expect } from 'vitest';
import { sinLeadsDeEjemplo, sinCotizacionesDeEjemplo, sinCajaDeEjemplo } from '../services/datosDeEjemplo';

describe('Datos de ejemplo guardados como reales', () => {
  it('saca los 3 prospectos de ejemplo y deja los reales', () => {
    expect(sinLeadsDeEjemplo([{ id: 'LEAD-001' }, { id: 'LEAD-170000' }, { id: 'LEAD-003' }]).map(l => l.id)).toEqual(['LEAD-170000']);
  });
  it('saca la cotización de ejemplo', () => {
    expect(sinCotizacionesDeEjemplo([{ id: 'COT-1001' }, { id: 'COT-2' }]).map(c => c.id)).toEqual(['COT-2']);
  });
  it('saca la sesión de caja de ejemplo, no una real', () => {
    const ejemplo = { id: 'CAJA-x', movimientos: [
      { id: 'm1', concepto: 'Cobro de Honorarios Contables - Enero 2026' },
      { id: 'm2', concepto: 'Emisión e Instalación Firma .p12' },
      { id: 'm3', concepto: 'Compra de Papel Bond y Toners de Imprenta' },
    ] };
    const real = { id: 'CAJA-y', movimientos: [{ id: 'm1', concepto: 'Cobro a Pérez' }] };
    const vacia = { id: 'CAJA-z', movimientos: [] };
    expect(sinCajaDeEjemplo([ejemplo, real, vacia]).map(s => s.id)).toEqual(['CAJA-y', 'CAJA-z']);
  });
  it('una sesión con un movimiento real además de los de ejemplo se conserva', () => {
    const mezcla = { id: 'CAJA-m', movimientos: [
      { id: 'm1', concepto: 'Cobro de Honorarios Contables - Enero 2026' },
      { id: 'mov-9', concepto: 'Cobro a Gómez' },
    ] };
    expect(sinCajaDeEjemplo([mezcla])).toHaveLength(1);
  });
});
