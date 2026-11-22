import { describe, it, expect, vi } from 'vitest';

// El store importa la base y servicios con red: se reemplazan por vacíos.
vi.mock('../services/db', () => ({ db: { setLocal: () => {}, getLocal: async () => undefined, bulkUpdate: async () => {} } }));
vi.mock('../services/sheetApi', () => ({ loadDataFromSheet: async () => null }));
vi.mock('../services/supabaseClientService', () => ({ SupabaseService: {} }));
vi.mock('../services/extensionBridge', () => ({ sendFullClientsMatrixToExtension: () => {} }));
vi.mock('../services/sriContacts', () => ({ esNombrePlaceholder: () => false, guardarContactos: () => {} }));
vi.mock('../services/fileService', () => ({ signPublicStorageUrl: async (u: string) => u }));

import { sanitizeClients } from '../store/useAppStore';

const base = { ruc: '1712345678001', name: 'Cliente', regime: 'General', declarations: [] };

// Desempate de RUC repetidos (21-nov-2026): un cliente activo no puede
// «desaparecer» detrás de una ficha borrada con el mismo RUC.
describe('Clientes con el mismo RUC', () => {
  it('gana la ficha que no está en la papelera, aunque tenga menos historial', () => {
    const borrada = { ...base, id: 'a', isDeleted: true, isActive: true, declarations: [{ period: '2026-01' }, { period: '2026-02' }] };
    const viva = { ...base, id: 'b', isDeleted: false, isActive: true };
    const r = sanitizeClients([borrada, viva]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('b');
  });
  it('entre dos vivas gana la activa', () => {
    const r = sanitizeClients([{ ...base, id: 'a', isActive: false }, { ...base, id: 'b', isActive: true }]);
    expect(r[0].id).toBe('b');
  });
  it('misma ficha en dos copias: gana la más reciente (una copia vieja no resucita a un borrado)', () => {
    const vieja = { ...base, id: 'x', isDeleted: false, updatedAt: '2026-11-01T00:00:00Z' };
    const nueva = { ...base, id: 'x', isDeleted: true, updatedAt: '2026-11-20T00:00:00Z' };
    expect(sanitizeClients([vieja, nueva])[0].isDeleted).toBe(true);
    expect(sanitizeClients([nueva, vieja])[0].isDeleted).toBe(true);
  });
  it('RUC distintos no se mezclan', () => {
    expect(sanitizeClients([{ ...base, id: 'a' }, { ...base, id: 'b', ruc: '0912345678001' }])).toHaveLength(2);
  });
  it('lo que no es lista devuelve lista vacía', () => {
    expect(sanitizeClients(null as any)).toEqual([]);
  });
});
