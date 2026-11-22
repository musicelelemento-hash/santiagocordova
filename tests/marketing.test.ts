import { describe, it, expect } from 'vitest';
import { calcularCamino, calendarioDelMes, diaHabil, anunciosPara, guionesPara, enlaceWhatsApp, textoPrecio, SUPUESTOS_INICIALES } from '../services/marketing';

describe('Camino a la meta', () => {
  const s = { ...SUPUESTOS_INICIALES, actuales: 52, honorario: 15, bajaMensual: 0 };
  it('sin bajas: (3000 − 52) / 24 = 123 nuevos por mes', () => {
    expect(calcularCamino(s).nuevosPorMes).toBe(123);
  });
  it('conversaciones = nuevos / tasa de cierre; presupuesto = conversaciones × costo', () => {
    const r = calcularCamino({ ...s, tasaCierre: 0.15, costoPorConversacion: 1 });
    expect(r.conversacionesPorMes).toBe(Math.ceil(123 / 0.15));
    expect(r.presupuestoMensual).toBe(r.conversacionesPorMes);
  });
  it('con bajas hacen falta más nuevos', () => {
    expect(calcularCamino({ ...s, bajaMensual: 0.02 }).nuevosPorMes).toBeGreaterThan(123);
  });
  it('capacidad: 3000 clientes = 300 declaraciones por día de vencimiento', () => {
    const r = calcularCamino({ ...s, capacidadPorPersonaDia: 40 });
    expect(r.declaracionesPorDiaVencimiento).toBe(300);
    expect(r.personasNecesarias).toBe(8);
    expect(r.ingresoMensualAlLlegar).toBe(45000);
  });
  it('ya en la meta: no hace falta nadie nuevo', () => {
    expect(calcularCamino({ ...s, actuales: 3000 }).nuevosPorMes).toBe(0);
  });
});

describe('Calendario del SRI', () => {
  it('sábado y domingo pasan al lunes', () => {
    expect(diaHabil(2026, 10, 28).getDate()).toBe(30); // sáb 28-nov-2026 → lun 30
    expect(diaHabil(2026, 10, 22).getDate()).toBe(23); // dom 22 → lun 23
    expect(diaHabil(2026, 10, 10).getDate()).toBe(10); // mar 10
  });
  it('noviembre 2026: una publicación por día de vencimiento, con dígitos juntados', () => {
    const v = calendarioDelMes(2026, 10).filter(p => p.tipo === 'vencimiento');
    // 22 (dom) → lun 23, 28 (sáb) → lun 30; todos los demás caen en día hábil.
    expect(v.map(p => p.fecha.getDate())).toEqual([10, 12, 16, 18, 20, 23, 24, 26, 30]);
    // El 14 cae sábado → lunes 16, junto con el 16 (dígito 4).
    expect(v.find(p => p.fecha.getDate() === 16)!.titulo).toContain('3 y 4');
    expect(v.every(p => p.texto.includes('octubre'))).toBe(true);
  });
  it('julio trae la del semestral y mayo la de Renta RIMPE', () => {
    expect(calendarioDelMes(2026, 6).some(p => p.codigo === 'CAL-SEM')).toBe(true);
    expect(calendarioDelMes(2026, 4).some(p => p.codigo === 'CAL-RENTA-R')).toBe(true);
    expect(calendarioDelMes(2026, 10).some(p => p.tipo === 'temporada')).toBe(false);
  });
});

describe('Anuncios y guiones', () => {
  it('tres ángulos por servicio, titulares de hasta 40 caracteres, enlace con código', () => {
    const a = anunciosPara('iva_mensual', { ivaMensual: 15 });
    expect(a).toHaveLength(3);
    expect(a.every(x => x.titular.length <= 40)).toBe(true);
    expect(a[0].enlace).toContain('wa.me/593978980722');
    expect(decodeURIComponent(a[0].enlace)).toContain('[IVA-M1]');
    expect(a[0].texto).toContain('$15 al mes');
  });
  it('las siglas no se pasan a minúsculas («IVA», no «iva»)', () => {
    const t = anunciosPara('iva_mensual', {}).map(a => a.texto).join(' ');
    expect(t).toContain('declaración de IVA mensual');
    expect(t).not.toMatch(/\biva\b/);
  });
  it('sin tarifa cargada dice «Consulta tu precio»', () => {
    expect(textoPrecio('firma', {})).toBe('Consulta tu precio');
  });
  it('guiones de 15 s con escenas continuas', () => {
    for (const g of guionesPara('iva_semestral')) {
      expect(g.escenas[0].desde).toBe(0);
      expect(g.escenas[g.escenas.length - 1].hasta).toBe(g.segundos);
      for (let i = 1; i < g.escenas.length; i++) expect(g.escenas[i].desde).toBe(g.escenas[i - 1].hasta);
    }
  });
  it('enlace sin código no agrega corchetes', () => {
    expect(decodeURIComponent(enlaceWhatsApp(''))).not.toContain('[');
  });
});

import { extraerCodigo, resultadosPorCodigo, proximoVencimientoIva, respuestaVencimiento, respuestasRapidas } from '../services/marketing';

describe('Medir qué anuncio trae clientes', () => {
  it('lee el código del mensaje de WhatsApp', () => {
    expect(extraerCodigo('Hola, quiero información sobre sus servicios [IVA-M1]')).toBe('IVA-M1');
    expect(extraerCodigo('hola [iva-mf]')).toBe('IVA-MF');
    expect(extraerCodigo('Hola, ¿cuánto cuesta?')).toBeNull();
  });
  it('cuenta prospectos y ganados por código', () => {
    const r = resultadosPorCodigo([
      { codigoCampana: 'IVA-M1', etapa: 'ganado' },
      { codigoCampana: 'IVA-M1', etapa: 'prospecto' },
      { codigoCampana: 'FIRMA2', etapa: 'prospecto' },
      { etapa: 'ganado' },
    ]);
    expect(r[0]).toEqual({ codigo: 'IVA-M1', prospectos: 2, ganados: 1, tasa: 0.5 });
    expect(r[r.length - 1].codigo).toBe('Sin código');
  });
});

describe('¿Cuándo me vence?', () => {
  it('si la fecha de este mes no pasó, es la de este mes', () => {
    // 9.º dígito 9 → jueves 26-nov-2026; hoy 22-nov.
    const v = proximoVencimientoIva('1712345690001', new Date(2026, 10, 22))!;
    expect(v.fecha.getDate()).toBe(26);
    expect(v.mesDeclarado).toBe('octubre');
  });
  it('si ya pasó, es la del mes siguiente (y declara el mes en curso)', () => {
    // 9.º dígito 1 → 10-nov ya pasó → jueves 10-dic-2026.
    const v = proximoVencimientoIva('1712345610001', new Date(2026, 10, 22))!;
    expect(v.fecha.getMonth()).toBe(11);
    expect(v.fecha.getDate()).toBe(10);
    expect(v.mesDeclarado).toBe('noviembre');
  });
  it('el mismo día de vencimiento cuenta como «hoy»', () => {
    expect(proximoVencimientoIva('1712345690001', new Date(2026, 10, 26, 18))!.fecha.getDate()).toBe(26);
  });
  it('fin de semana pasa al lunes; sin 9.º dígito no responde', () => {
    // dígito 0 → sábado 28-nov-2026 → lunes 30.
    expect(proximoVencimientoIva('1712345600001', new Date(2026, 10, 22))!.fecha.getDate()).toBe(30);
    expect(respuestaVencimiento('1234')).toBeNull();
  });
  it('respuestas rápidas con el precio de Ajustes', () => {
    const t = respuestasRapidas({ ivaMensual: 15, ivaSemestral: 25 }).find(x => x.id === 'precio')!.texto;
    expect(t).toContain('$15 al mes');
    expect(t).toContain('$25 por semestre');
  });
});
