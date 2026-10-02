import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { regionControlActual, sincronizarRelacionesConflicto, stagesConflictoPorRegion } from './worldAgenda.js';

/// Fase D del hito 0.1 contra Postgres real: el control de Cristal Helado y Ciénaga Troncal sale de las
/// relaciones sembradas Serhu→Helsig/Goshg (presión 70 = etapa 1 → dueño original, igual que antes) y
/// la agenda solo las empuja hacia arriba. Restaura las relaciones al terminar (son del mundo compartido).
describe('worldAgenda — control de región desde FactionRelation (Fase D)', () => {
  let worldId: string;
  let snapshot: { id: string; presion: number; type: never; stage: number }[] = [];

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    snapshot = (await prisma.factionRelation.findMany({
      where: { worldId, sourceFaction: { name: 'Clan Serhu', saveId: null }, targetFaction: { name: { in: ['Clan Helsig', 'Clan Goshg'] }, saveId: null } },
      select: { id: true, presion: true, type: true, stage: true },
    })) as never;
  });

  afterAll(async () => {
    for (const r of snapshot) await prisma.factionRelation.update({ where: { id: r.id }, data: { presion: r.presion, type: r.type, stage: r.stage } });
  });

  it('con las relaciones sembradas, el control es el de siempre; al sincronizar a la etapa 3, las dos regiones entran en disputa', async () => {
    expect(snapshot).toHaveLength(2);
    // Línea base conocida: la presión sembrada (70).
    for (const r of snapshot) await prisma.factionRelation.update({ where: { id: r.id }, data: { presion: 70, type: 'TENSION', stage: 1 } });

    const stages = await stagesConflictoPorRegion(prisma, worldId);
    expect(stages.get('Cristal Helado')).toBe(1);
    expect(stages.get('Ciénaga Troncal')).toBe(1);
    expect(await regionControlActual(prisma, worldId, 'Cristal Helado', [], 'Clan Helsig')).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Clan Helsig' });

    await sincronizarRelacionesConflicto(prisma, worldId, 3);
    expect(await regionControlActual(prisma, worldId, 'Cristal Helado', [], 'Clan Helsig')).toMatchObject({ estado: 'EN_DISPUTA', duenoActual: 'Clan Helsig' });
    expect(await regionControlActual(prisma, worldId, 'Ciénaga Troncal', [], 'Clan Goshg')).toMatchObject({ estado: 'EN_DISPUTA' });

    // Nunca baja: sincronizar a una etapa menor no toca nada.
    await sincronizarRelacionesConflicto(prisma, worldId, 1);
    expect((await stagesConflictoPorRegion(prisma, worldId)).get('Cristal Helado')).toBe(3);
  });

  it('una región sin conflicto sembrado sigue con su dueño (no se inventa disputa)', async () => {
    expect(await regionControlActual(prisma, worldId, 'Las Llanuras del Viento Rojo', [], 'Clan Serhu')).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Clan Serhu' });
  });
});
