import { describe, it, expect } from 'vitest';
import { tickKingdomOneDay, DEFAULT_KINGDOM_STATS } from '../kingdomTick.js';
import { AGUA_FUENTE_NATURAL_DIA, avisoMaterialesLlenos, BASE_ALMACEN, explicarComida, suministrosDeEdificios, sueldosSemana, tieneFuenteNatural, tocaDesertar } from './economiaReino.js';

describe('economía del Reino (CR-53) — agua y almacén', () => {
  it('el Ayuntamiento da la base; cada Pozo, Granero, Cisterna y Leñera suma lo suyo', () => {
    expect(suministrosDeEdificios(['ayuntamiento'], false)).toEqual({ agua: 0, topeComida: 60, topeBebida: 60, topeMateriales: 60 });
    expect(suministrosDeEdificios(['pozo', 'pozo', 'granero', 'cisterna', 'lenera', 'herreria', null], false)).toEqual({
      agua: 24, topeComida: BASE_ALMACEN.comida + 120, topeBebida: BASE_ALMACEN.bebida + 120, topeMateriales: BASE_ALMACEN.materiales + 120,
    });
    expect(suministrosDeEdificios([], true).agua).toBe(AGUA_FUENTE_NATURAL_DIA);
  });

  it('agua natural en Los Manaderos, el Cauce o junto al agua', () => {
    expect(tieneFuenteNatural({ slug: 'los-manaderos', name: 'Los Manaderos' })).toBe(true);
    expect(tieneFuenteNatural({ slug: 'pozo-de-cauce-viejo', name: 'El Pozo de Cauce Viejo' })).toBe(true);
    expect(tieneFuenteNatural({ slug: 'karot-veku', name: 'Karot Veku' })).toBe(false);
  });

  it('el pozo da de beber y lo que no cabe en el almacén se pierde', () => {
    const base = { ...DEFAULT_KINGDOM_STATS, poblacion: 10, trabajadores: 10, comida: 55, bebida: 5 };
    const dia = tickKingdomOneDay(base, { agua: 12, topeComida: 60, topeBebida: 60, comidaDia: 20 });
    expect(dia.bebida).toBe(5 + 12 - 10);
    expect(dia.comida).toBe(60); // 55 + 20 de sus tareas - 10 = 65, tope 60
    const sinPozo = tickKingdomOneDay(base, { agua: 0, topeComida: 60, topeBebida: 60 });
    expect(sinPozo.bebida).toBe(0);
    expect(sinPozo.felicidad).toBeLessThan(base.felicidad);
    expect(sinPozo.diasSed).toBe(1);
    expect(dia.diasSed).toBe(0);
  });
});

describe('economía del Reino (CR-53) — sueldos', () => {
  it('trabajador 2 y soldado 5 Goirnos por semana', () => {
    expect(sueldosSemana({ trabajadores: 3, soldados: 2 })).toBe(16);
  });
  it('sin cobrar, deserta uno a los 7 días y luego uno por semana', () => {
    expect([6, 7, 8, 13, 14, 21].map(tocaDesertar)).toEqual([false, true, false, false, true, true]);
  });
  it('con sueldos semanales, el soldado no cuesta a diario', () => {
    const base = { ...DEFAULT_KINGDOM_STATS, soldados: 4, riqueza: 10, comida: 50, bebida: 50 };
    expect(tickKingdomOneDay(base).riqueza).toBe(6);
    expect(tickKingdomOneDay(base, { agua: 0, topeComida: 999, topeBebida: 999, sueldosSemanales: true }).riqueza).toBe(10);
  });
});

describe('P276 — aviso de materiales llenos', () => {
  it('sin Leñera pide construirla; con Leñera dice que está lleno y no pide otra', () => {
    expect(avisoMaterialesLlenos(0, { guardados: 60, tope: 60 })).toContain('construye una Leñera');
    const con = avisoMaterialesLlenos(1, { guardados: 180, tope: 180 });
    expect(con).toContain('lleno');
    expect(con).toContain('180/180');
    expect(con).not.toContain('construye');
  });
});

describe('P279/P300 — por qué se mueve la comida', () => {
  const base = { comida: 10, tope: 60, bocas: { civiles: 2, soldados: 0, visitantes: 0 }, produccion: 4, consumo: 2, tareas: { recolector: 2 } as Record<string, number>, hayAyuntamiento: true, hayAgua: true, escalonCocina: null, factor: 1 };
  it('sin súbditos dice que nadie come; sin trabajadores, que nadie produce', () => {
    expect(explicarComida({ ...base, bocas: { civiles: 0, soldados: 0, visitantes: 0 }, produccion: 0, consumo: 0, tareas: {} }).join(' ')).toContain('Nadie come');
    expect(explicarComida({ ...base, produccion: 0, tareas: {} }).join(' ')).toContain('Nadie produce comida');
  });
  it('el Pescador sin agua o sin Ayuntamiento lo avisa', () => {
    const sinAyto = explicarComida({ ...base, tareas: { pescador: 1, recolector: 1 }, hayAgua: false, hayAyuntamiento: false }).join(' ');
    expect(sinAyto).toContain('No hay Ayuntamiento activo');
    expect(explicarComida({ ...base, tareas: { pescador: 1 }, hayAgua: false }).join(' ')).toContain('no tienen agua junto al Ayuntamiento');
  });
  it('plana por producir lo que come, por herramientas o por el tope', () => {
    expect(explicarComida({ ...base, produccion: 2 }).join(' ')).toContain('justo lo que comen');
    expect(explicarComida({ ...base, factor: 0.5 }).join(' ')).toContain('sin herramienta');
    expect(explicarComida({ ...base, comida: 60 }).join(' ')).toContain('lleno (60)');
  });
});
