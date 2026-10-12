import { describe, it, expect } from 'vitest';
import { sinVictoriaAntesDeLaMuerte } from './leyendas.js';
import { CATALOGO_SUCESOS } from './catalogoSucesos.js';

const entrada = (tipo: string, cuando: number, victima: string) =>
  ({ sucesoId: `${tipo}-${cuando}`, tipo, cuando, actores: [{ tipo: 'NPC', id: victima, nombre: 'Guchapo', papel: 'VICTIMA' }] }) as never;

/// P37 (QA-27): una pelea, una línea en la Crónica; y los nombres de especie con su artículo.
describe('P37 — Crónica', () => {
  it('la victoria seguida de la muerte de la misma víctima deja solo la muerte', () => {
    const r = sinVictoriaAntesDeLaMuerte([entrada('MUERTE_CAUSADA', 600, 'g1'), entrada('COMBATE_GANADO', 599, 'g1'), entrada('COMBATE_GANADO', 300, 'g2')], [{ cuando: 600, victima: 'g1' }]);
    expect(r.map((e: { sucesoId: string }) => e.sucesoId)).toEqual(['MUERTE_CAUSADA-600', 'COMBATE_GANADO-300']);
  });

  it('una victoria sin muerte después se queda', () => {
    const r = sinVictoriaAntesDeLaMuerte([entrada('MUERTE_CAUSADA', 900, 'g1'), entrada('COMBATE_GANADO', 599, 'g1')], [{ cuando: 900, victima: 'g1' }]);
    expect(r).toHaveLength(2);
  });

  it('la muerte que cae en la página anterior también oculta la victoria', () => {
    const r = sinVictoriaAntesDeLaMuerte([entrada('COMBATE_GANADO', 599, 'g1')], [{ cuando: 620, victima: 'g1' }]);
    expect(r).toHaveLength(0);
  });

  it('con el artículo del catálogo', () => {
    expect(CATALOGO_SUCESOS.MUERTE_CAUSADA.plantilla({ personaje: 'Gorhorn', victima: 'Orco Enfurecido', articuloVictima: 'el' })).toBe('Gorhorn da muerte al Orco Enfurecido.');
    expect(CATALOGO_SUCESOS.COMBATE_GANADO.plantilla({ personaje: 'Gorhorn', rival: 'Leshra', articuloRival: 'la' })).toBe('Gorhorn vence a la Leshra.');
    expect(CATALOGO_SUCESOS.MUERTE_CAUSADA.plantilla({ personaje: 'Gorhorn', victima: 'Gistera Koh' })).toBe('Gorhorn da muerte a Gistera Koh.');
  });
});
