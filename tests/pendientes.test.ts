import { describe, it, expect } from 'vitest';
import { venceEn, tieneHora, textoCuando, diasHastaViernes, ordenarAbiertos } from '../services/pendientes';
import { TaskStatus } from '../types';

// Misma regla que Baku (telegram-bot/src/pendientes.ts). Domingo 22-nov-2026, 10:00 de Ecuador.
const ahora = new Date('2026-11-22T15:00:00Z');

describe('Pendientes (mismo formato que Baku)', () => {
  it('sin hora = 23:59 de Ecuador', () => {
    expect(venceEn(1, undefined, ahora)).toBe('2026-11-24T04:59:00.000Z');
    expect(tieneHora(venceEn(1, undefined, ahora))).toBe(false);
  });
  it('con hora = esa hora de Ecuador', () => {
    expect(venceEn(1, '10:00', ahora)).toBe('2026-11-23T15:00:00.000Z');
    expect(tieneHora('2026-11-23T15:00:00.000Z')).toBe(true);
  });
  it('textos como los de Baku', () => {
    expect(textoCuando('2026-11-23T15:00:00.000Z', ahora)).toBe('mañana 10:00');
    expect(textoCuando('2026-11-23T04:59:00.000Z', ahora)).toBe('hoy');
    expect(textoCuando('2026-11-20T15:00:00.000Z', ahora).startsWith('vencido')).toBe(true);
  });
  it('«esta semana» = el viernes', () => {
    expect(diasHastaViernes(ahora)).toBe(5); // domingo → viernes 27
  });
  it('ordena abiertos por fecha y deja fuera los completados', () => {
    const base = { description: '', status: TaskStatus.Pendiente } as any;
    const r = ordenarAbiertos([
      { ...base, id: 'b', title: 'B', dueDate: '2026-11-25T15:00:00Z' },
      { ...base, id: 'x', title: 'X', dueDate: '2026-11-20T15:00:00Z', status: TaskStatus.Completada },
      { ...base, id: 'a', title: 'A', dueDate: '2026-11-23T15:00:00Z' },
      { ...base, id: 'c', title: 'C', dueDate: '' },
    ]);
    expect(r.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });
});
