import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { reinoRoutes } from './reino.js';
import { buildAdjacency, shortestPath } from '../../services/travel.js';

/// Zona-interior navegable propia del reino (docs/rpgtarkor/mundo-vivo-x4.md § 7.4, 2026-09-21) —
/// primera vez que el motor crea una `Location` en TIEMPO DE PARTIDA (hasta ahora, 100% catálogo
/// sembrado a mano). Test de integración real contra Postgres, sin mocks — verifica que la fila
/// se crea de verdad, con el slug determinista correcto, y que es NAVEGABLE (LocationLink real,
/// resoluble por `shortestPath`, mismo motor de viaje que usa cualquier otro tramo del mundo).
const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

async function buildApp() {
  const app = Fastify();
  await app.register(reinoRoutes);
  return app;
}

describe('POST /saves/:id/reino/fundar — Location-interior dinámica (2026-09-21)', () => {
  let saveId: string;
  let worldId: string;
  let hondonadaId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (zona interior reino)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonadaId,
        raza: 'orcos',
      },
    });
    saveId = save.id;
    await prisma.building.create({
      data: { saveId, locationId: hondonadaId, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
  });

  afterAll(async () => {
    await prisma.locationLink.deleteMany({ where: { OR: [{ from: { slug: `ayuntamiento-interior-${saveId}` } }, { to: { slug: `ayuntamiento-interior-${saveId}` } }] } });
    await prisma.location.deleteMany({ where: { worldId, slug: `ayuntamiento-interior-${saveId}` } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('crea una Location real con slug determinista, region heredada del Ayuntamiento, y es navegable desde su exterior', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/reino/fundar`,
      payload: { kingdomName: 'Reino de Prueba' },
    });
    expect(res.statusCode).toBe(200);

    const kingdomLocation = await prisma.location.findUnique({
      where: { worldId_slug: { worldId, slug: `ayuntamiento-interior-${saveId}` } },
    });
    expect(kingdomLocation).not.toBeNull();
    expect(kingdomLocation!.kind).toBe('interior');
    expect(kingdomLocation!.region).toBe('Las Llanuras del Viento Rojo'); // heredada de hondonada-del-eco
    expect(kingdomLocation!.name).toContain('Reino de Prueba');
    // Sin x/y propias a propósito — vive "dentro" de las coordenadas del exterior.
    expect(kingdomLocation!.x).toBeNull();
    expect(kingdomLocation!.y).toBeNull();

    // Navegable de verdad: un solo LocationLink basta (buildAdjacency ya lo trata bidireccional,
    // mismo motor de viaje real que cualquier otro tramo del mundo).
    const link = await prisma.locationLink.findFirst({ where: { fromId: hondonadaId, toId: kingdomLocation!.id } });
    expect(link).not.toBeNull();
    expect(link!.minutosBase).toBe(0);

    const links = await prisma.locationLink.findMany({ where: { from: { worldId } }, select: { fromId: true, toId: true, minutosBase: true, terreno: true, riesgo: true } });
    const path = shortestPath(buildAdjacency(links), hondonadaId, kingdomLocation!.id);
    expect(path).not.toBeNull();
    expect(path!.totalMinutos).toBe(0);
    const pathBack = shortestPath(buildAdjacency(links), kingdomLocation!.id, hondonadaId);
    expect(pathBack).not.toBeNull(); // navegable también de vuelta, sin fila explícita en ese sentido
  });

  it('el slug es determinista por save.id — no choca con otra partida ni con el catálogo de facción NPC', async () => {
    const kingdomLocation = await prisma.location.findUnique({
      where: { worldId_slug: { worldId, slug: `ayuntamiento-interior-${saveId}` } },
    });
    expect(kingdomLocation!.slug).toBe(`ayuntamiento-interior-${saveId}`);
    expect(kingdomLocation!.slug).not.toBe('campamento-serhu-interior');
  });

  it('siembra 1 Parcela AVANZADA (centro, ya ocupada por el Ayuntamiento real) + 3 BÁSICAS vacías', async () => {
    const kingdomLocation = await prisma.location.findUniqueOrThrow({
      where: { worldId_slug: { worldId, slug: `ayuntamiento-interior-${saveId}` } },
    });
    const ayuntamiento = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'ayuntamiento' } });
    const parcelas = await prisma.parcela.findMany({ where: { locationId: kingdomLocation.id }, orderBy: { tipo: 'asc' } });
    expect(parcelas).toHaveLength(4);

    const avanzada = parcelas.find((p) => p.tipo === 'AVANZADA');
    expect(avanzada).toBeDefined();
    expect(avanzada!.recipeKeyFijo).toBe('ayuntamiento');
    expect(avanzada!.buildingId).toBe(ayuntamiento.id); // ocupada desde el minuto uno, nunca vacía
    expect(avanzada!.x).toBe(400);
    expect(avanzada!.y).toBe(300);

    const basicas = parcelas.filter((p) => p.tipo === 'BASICA');
    expect(basicas).toHaveLength(3);
    for (const basica of basicas) {
      expect(basica.recipeKeyFijo).toBeNull();
      expect(basica.buildingId).toBeNull(); // vacías, el jugador construye ahí después
    }
  });
});
