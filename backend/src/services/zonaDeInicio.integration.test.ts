import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarZonePointsDePartida, avanzarZonePointsUnPaso, recalcularZonePointsDeLocation, TOPE_HOSTIL_ZONA_DE_INICIO } from './zonePoints.js';
import { celdaDePixel, pixelDeCelda } from './zonaPosicion.js';

/// P88 (QA-27, decisión de la usuaria 2026-10-12): en la zona de inicio (la Hondonada del Eco) la
/// fauna hostil se queda en su guarida — un solo grupo, topado — y no persigue a la jugadora.
describe('Zona de inicio: la fauna hostil se queda en su guarida (P88)', () => {
  let saveId: string;
  let hondonadaId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (zona de inicio)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 },
        portraitInitial: 'G',
        currentLocationId: hondonadaId,
        zonaPosX: 75,
        zonaPosY: 75,
      },
    });
    saveId = save.id;
    await asegurarZonePointsDePartida(prisma, saveId, hondonadaId);
    // El reparto viejo: varios grupos de Kirelon sueltos por la zona, como en la partida de prueba.
    for (const [x, y, cantidad] of [[300, 300, 5], [500, 450, 5], [150, 450, 1]] as const) {
      await prisma.zonePoint.create({ data: { saveId, locationId: hondonadaId, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', x, y, origenX: x, origenY: y, cantidad, activo: true } });
    }
  });

  afterAll(async () => {
    await prisma.zonePoint.deleteMany({ where: { saveId } });
    await prisma.worldPopulation.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('los grupos de Kirelon se recogen en la guarida (un solo punto, como mucho el tope)', async () => {
    await recalcularZonePointsDeLocation(prisma, (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).worldId, saveId, hondonadaId, 'Las Llanuras del Viento Rojo', 2000);
    const kirelon = await prisma.zonePoint.findMany({ where: { saveId, locationId: hondonadaId, targetSlug: 'kirelon-arenoso' } });
    expect(kirelon).toHaveLength(1);
    expect(kirelon[0].label).toBe('Boca de cueva (Kirelon Arenoso)');
    expect(kirelon[0].cantidad).toBeLessThanOrEqual(TOPE_HOSTIL_ZONA_DE_INICIO);
  });

  it('el Kirelon no persigue a la jugadora aunque esté a su lado', async () => {
    const guarida = await prisma.zonePoint.findFirstOrThrow({ where: { saveId, locationId: hondonadaId, targetSlug: 'kirelon-arenoso' } });
    const celda = celdaDePixel({ x: guarida.x, y: guarida.y });
    const jugador = pixelDeCelda({ col: celda.col + 2, row: celda.row });
    // Varias vueltas: si persiguiera, en dos pasos se plantaría en la celda de la jugadora.
    for (let i = 0; i < 4; i++) {
      await avanzarZonePointsUnPaso(prisma, hondonadaId, saveId, () => 0.5, jugador, {}, 'noche');
    }
    const despues = await prisma.zonePoint.findUniqueOrThrow({ where: { id: guarida.id } });
    const d = celdaDePixel({ x: despues.x, y: despues.y });
    expect(d.col === celda.col + 2 && d.row === celda.row).toBe(false);
  });
});
