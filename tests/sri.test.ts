import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/db', () => ({ db: {} }));
vi.mock('../services/fileService', () => ({ signPublicStorageUrl: async (u: string) => u }));

import {
  validateRuc, validateIdentifier, getNinthDigit, getIdentifierSortKey, esRucSociedad,
  getClientIvaFrequency, getPeriod, requiresIva, getNextPeriod, getDueDateForPeriod,
  getAnnualIncomeTaxDueDate, getPeriodEndDate, validateSriClaveAcceso, getAtsDueDate,
  formatPeriodForDisplay,
} from '../services/sri';
import { TaxRegime } from '../types';

const ymd = (d: Date | null) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// RUC de persona natural con el 9.º dígito que se pida.
const rucCon = (noveno: number) => `17123456${noveno}0001`;

describe('RUC y cédula', () => {
  it('acepta un RUC de 13 dígitos terminado en 001', () => {
    expect(validateRuc('1712345678001').isValid).toBe(true);
  });
  it('rechaza RUC corto, con letras o sin 001', () => {
    expect(validateRuc('171234567800').isValid).toBe(false);
    expect(validateRuc('17123456780A1').isValid).toBe(false);
    expect(validateRuc('1712345678002').isValid).toBe(false);
    expect(validateRuc('').isValid).toBe(false);
  });
  it('identificador: cédula de 10 o RUC de 13', () => {
    expect(validateIdentifier('1712345678').isValid).toBe(true);
    expect(validateIdentifier('1712345678001').isValid).toBe(true);
    expect(validateIdentifier('12345').isValid).toBe(false);
  });
  it('9.º dígito y orden del calendario (el 0 va al final)', () => {
    expect(getNinthDigit('1712345678001')).toBe(7);
    expect(getNinthDigit('123')).toBe(-1);
    expect(getIdentifierSortKey(rucCon(0))).toBe(10);
    expect(getIdentifierSortKey(rucCon(1))).toBe(1);
  });
  it('sociedad = tercer dígito 9', () => {
    expect(esRucSociedad('1790012345001')).toBe(true);
    expect(esRucSociedad('1712345678001')).toBe(false);
  });
});

describe('Frecuencia de IVA y período a declarar', () => {
  const general = { regime: TaxRegime.General, taxProfile: undefined } as any;
  const emprendedor = { regime: TaxRegime.RimpeEmprendedor, taxProfile: undefined } as any;
  const popular = { regime: TaxRegime.RimpeNegocioPopular, taxProfile: undefined } as any;

  it('General mensual, Emprendedor semestral, Popular sin IVA', () => {
    expect(getClientIvaFrequency(general)).toBe('Mensual');
    expect(getClientIvaFrequency(emprendedor)).toBe('Semestral');
    expect(getClientIvaFrequency(popular)).toBe('Popular');
    expect(requiresIva(popular)).toBe(false);
    expect(requiresIva(general)).toBe(true);
  });
  it('lo configurado en la ficha manda sobre el régimen', () => {
    expect(getClientIvaFrequency({ ...emprendedor, taxProfile: { ivaFrequency: 'Mensual' } })).toBe('Mensual');
  });
  it('mensual: en noviembre se declara octubre', () => {
    expect(getPeriod(general, new Date(2026, 10, 22))).toBe('2026-10');
    expect(getPeriod(general, new Date(2027, 0, 5))).toBe('2026-12');
  });
  it('semestral: S1 desde junio, S2 en diciembre y hasta mayo', () => {
    expect(getPeriod(emprendedor, new Date(2026, 5, 1))).toBe('2026-S1');
    expect(getPeriod(emprendedor, new Date(2026, 8, 1))).toBe('2026-S1');
    expect(getPeriod(emprendedor, new Date(2026, 11, 1))).toBe('2026-S2');
    expect(getPeriod(emprendedor, new Date(2027, 2, 1))).toBe('2026-S2');
  });
  it('Popular: siempre la renta del año anterior', () => {
    expect(getPeriod(popular, new Date(2026, 10, 1))).toBe('2025');
  });
});

describe('Vencimientos por 9.º dígito', () => {
  const dias: Record<number, number> = { 1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28 };
  for (const [noveno, dia] of Object.entries(dias)) {
    it(`9.º dígito ${noveno}: IVA de octubre vence el ${dia} de noviembre`, () => {
      const c = { ruc: rucCon(Number(noveno)), regime: TaxRegime.General } as any;
      expect(ymd(getDueDateForPeriod(c, '2026-10'))).toBe(`2026-11-${String(dia).padStart(2, '0')}`);
    });
  }
  it('diciembre vence en enero del año siguiente', () => {
    const c = { ruc: rucCon(1), regime: TaxRegime.General } as any;
    expect(ymd(getDueDateForPeriod(c, '2026-12'))).toBe('2027-01-10');
  });
  it('semestral: S1 en julio, S2 en enero siguiente (y acepta el formato viejo 2026-2S)', () => {
    const c = { ruc: rucCon(3), regime: TaxRegime.RimpeEmprendedor } as any;
    expect(ymd(getDueDateForPeriod(c, '2026-S1'))).toBe('2026-07-14');
    expect(ymd(getDueDateForPeriod(c, '2026-S2'))).toBe('2027-01-14');
    expect(ymd(getDueDateForPeriod(c, '2026-2S'))).toBe('2027-01-14');
  });
  it('sufijos como :ICE no cambian la fecha del mes', () => {
    const c = { ruc: rucCon(2), regime: TaxRegime.General } as any;
    expect(ymd(getDueDateForPeriod(c, '2026-10:ICE'))).toBe('2026-11-12');
  });
  it('renta anual: General en marzo, todo el RIMPE en mayo', () => {
    expect(ymd(getAnnualIncomeTaxDueDate({ ruc: rucCon(5), regime: TaxRegime.General } as any, 2026))).toBe('2027-03-18');
    expect(ymd(getAnnualIncomeTaxDueDate({ ruc: rucCon(5), regime: TaxRegime.RimpeEmprendedor } as any, 2026))).toBe('2027-05-18');
    expect(ymd(getAnnualIncomeTaxDueDate({ ruc: rucCon(5), regime: TaxRegime.RimpeNegocioPopular } as any, 2026))).toBe('2027-05-18');
  });
  it('ATS: mes subsiguiente al período', () => {
    expect(ymd(getAtsDueDate({ ruc: rucCon(1) } as any, new Date(2026, 8, 1)))).toBe('2026-11-10');
  });
});

describe('Períodos', () => {
  it('siguiente período', () => {
    expect(getNextPeriod('2026-12')).toBe('2027-01');
    expect(getNextPeriod('2026-S1')).toBe('2026-S2');
    expect(getNextPeriod('2026-S2')).toBe('2027-S1');
    expect(getNextPeriod('2026')).toBe('2027');
  });
  it('fin de período', () => {
    expect(ymd(getPeriodEndDate('2026-02'))).toBe('2026-02-28');
    expect(ymd(getPeriodEndDate('2026-S1'))).toBe('2026-06-30');
    expect(ymd(getPeriodEndDate('2026'))).toBe('2026-12-31');
  });
  it('nombre legible de la renta anual', () => {
    expect(formatPeriodForDisplay('2025')).toBe('Renta Anual 2025');
  });
});

describe('Clave de acceso de 49 dígitos (módulo 11)', () => {
  // Arma una clave válida calculando el dígito verificador.
  const conDigito = (c48: string) => {
    let peso = 2, suma = 0;
    for (let i = c48.length - 1; i >= 0; i--) { suma += Number(c48[i]) * peso; peso = peso === 7 ? 2 : peso + 1; }
    let d = 11 - (suma % 11); if (d === 11) d = 0; if (d === 10) d = 1;
    return c48 + d;
  };
  const base = '22112026' + '01' + '1712345678001' + '2' + '001' + '001' + '000000123' + '12345678' + '1';
  it('acepta una clave con el dígito correcto y la desarma', () => {
    const r = validateSriClaveAcceso(conDigito(base));
    expect(r.isValid).toBe(true);
    expect(r.tipoComprobanteNombre).toBe('Factura Electrónica');
    expect(r.rucEmisor).toBe('1712345678001');
    expect(r.ambiente).toBe('Producción');
    expect(r.serie).toBe('001-001');
  });
  it('rechaza un dígito verificador cambiado', () => {
    const buena = conDigito(base);
    const mala = buena.slice(0, 48) + ((Number(buena[48]) + 1) % 10);
    expect(validateSriClaveAcceso(mala).isValid).toBe(false);
  });
  it('rechaza largo distinto de 49', () => {
    expect(validateSriClaveAcceso('123').isValid).toBe(false);
  });
});
