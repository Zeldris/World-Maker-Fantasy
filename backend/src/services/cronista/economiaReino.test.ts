import { describe, it, expect } from 'vitest';
import { tickKingdomOneDay, DEFAULT_KINGDOM_STATS } from '../kingdomTick.js';
import { AGUA_FUENTE_NATURAL_DIA, BASE_ALMACEN, suministrosDeEdificios, tieneFuenteNatural } from './economiaReino.js';

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
    const dia = tickKingdomOneDay(base, { agua: 12, topeComida: 60, topeBebida: 60 });
    expect(dia.bebida).toBe(5 + 12 - 10);
    expect(dia.comida).toBe(60); // 55 + 20 - 10 = 65, tope 60
    const sinPozo = tickKingdomOneDay(base, { agua: 0, topeComida: 60, topeBebida: 60 });
    expect(sinPozo.bebida).toBe(0);
    expect(sinPozo.felicidad).toBeLessThan(base.felicidad);
  });
});
