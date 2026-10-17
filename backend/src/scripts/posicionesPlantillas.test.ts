import { describe, it, expect } from 'vitest';
import { zonePoints } from './worldCatalog.js';

/// QA-90 (retro del 2026-10-17): las partidas copian los recursos y edificios del catálogo por
/// (tipo, slug, x, y) (`plantillasQueFaltan`, zonePoints.ts). Mover o renombrar una de estas plantillas
/// hace que una partida ya empezada reciba una copia nueva y conserve la vieja: dos puntos. Pasó con el
/// recinto de múrgoles (P185). Si este test falla porque has movido una plantilla a propósito, piensa
/// antes qué pasa con sus copias en las partidas ya empezadas (y dilo en el PR); luego `vitest -u`.
describe('posiciones de las plantillas RECURSO y EDIFICIO del catálogo', () => {
  it('no cambian sin pensar en las partidas ya empezadas', () => {
    const posiciones = zonePoints
      .filter((p) => p.tipo === 'RECURSO' || p.tipo === 'EDIFICIO')
      .map((p) => `${p.locationSlug}|${p.tipo}|${p.targetSlug}|${p.x}|${p.y}`)
      .sort();
    expect(posiciones).toMatchSnapshot('mover una plantilla duplica sus copias en las partidas ya empezadas (QA-90)');
  });
});
