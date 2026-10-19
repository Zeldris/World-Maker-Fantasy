import { describe, it, expect } from 'vitest';
import { zonePoints } from './worldCatalog.js';
import { datosDePlantillaZonePoint } from './plantillaZonePoint.js';

// QA-100 (retro de P189-P205): el catálogo sembraba los puntos de zona sin origen y ningún animal tenía
// territorio (P189).
describe('plantilla de un punto de zona', () => {
  it('cada punto del catálogo se siembra con su sitio como origen y sus campos de catálogo', () => {
    for (const p of zonePoints) {
      const fila = datosDePlantillaZonePoint(p, 'loc');
      expect({ x: fila.origenX, y: fila.origenY }).toEqual({ x: p.x, y: p.y });
      expect(fila).toMatchObject({ saveId: null, tipo: p.tipo, targetSlug: p.targetSlug, factionSlug: p.factionSlug ?? null, label: p.label ?? null });
    }
  });
});
