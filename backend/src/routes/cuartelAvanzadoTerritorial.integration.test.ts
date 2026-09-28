import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import type { NarrationResult } from '../services/narrador.js';

/// Conquista territorial estilo X4 (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, pieza 7, 2026-09-21) —
/// primer caller real de `recordFactionEvent` en producción: construir un Cuartel Avanzado en una
/// región con Faction dueña real (REGION_OWNING_FACTIONS) DISTINTA de la propia dispara
/// EXPANSION_TERRITORIAL_AGRESIVA. También verifica que el Cuartel genera su propia zona-interior
/// (menor escala que la Capital: 1 parcela AVANZADA + 1 BÁSICA). Mismo patrón de mock aislado que
/// turn.integration.test.ts, en archivo propio para no inflar más ese archivo ya enorme.
const classifyAction = vi.fn();
const narrateAction = vi.fn(async (ctx: { onNarrationChunk?: (d: string) => void }): Promise<NarrationResult> => {
  ctx.onNarrationChunk?.('El cuartel queda listo.');
  return { narration: 'El cuartel queda listo.', newFacts: [] };
});

vi.mock('../services/narrador.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/narrador.js')>();
  return {
    ...actual,
    classifyAction: (...args: unknown[]) => classifyAction(...args),
    narrateAction: (ctx: Parameters<typeof narrateAction>[0]) => narrateAction(ctx),
  };
});

const { turnRoutes } = await import('./turn.js');

async function buildApp() {
  const app = Fastify();
  await app.register(turnRoutes);
  return app;
}

function lastNdjsonLine(payload: string): Record<string, unknown> {
  const lines = payload.trim().split('\n');
  return JSON.parse(lines[lines.length - 1]);
}

const ATTRS = { fuerza: 20, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 20, magia: 10 };

describe('Cuartel Avanzado en territorio ajeno — evento territorial real (2026-09-21)', () => {
  let saveId: string;
  let worldId: string;
  let cristalHeladoLocationId: string;
  let playerFactionId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const cristalHelado = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-helsig' } });
    cristalHeladoLocationId = cristalHelado.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (cuartel territorial)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        raza: 'orcos',
        portraitInitial: 'G',
        currentLocationId: cristalHeladoLocationId,
        zonaPosEntradaX: 400,
        zonaPosEntradaY: 300,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    // Ayuntamiento YA fundado en Las Llanuras (región del propio jugador) — el Cuartel se levanta
    // DESPUÉS, en Cristal Helado (Clan Helsig, dueño real de esa región).
    const ayuntamiento = await prisma.building.create({
      data: { saveId, locationId: hondonada.id, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    const playerFaction = await prisma.faction.create({
      data: { worldId, saveId, slug: `reino-de-prueba-${save.id}`, name: 'Reino de Prueba Territorial', raza: 'orcos', description: 'x' },
    });
    playerFactionId = playerFaction.id;
    await prisma.save.update({ where: { id: saveId }, data: { kingdomName: 'Reino de Prueba Territorial' } });

    // Materiales EXACTOS de CUARTEL_AVANZADO_RECIPE: 10 piedra, 10 leña, 4 cuerda de tendón.
    await prisma.inventoryItem.createMany({
      data: [
        { saveId, name: 'Piedra (10)', description: 'x', catalogSlug: 'piedra', origin: 'partida' },
        { saveId, name: 'Leña de matorral de cuerno (10)', description: 'x', catalogSlug: 'lena-matorral-cuerno', origin: 'partida' },
        { saveId, name: 'Cuerda de tendón (4)', description: 'x', catalogSlug: 'cuerda-tendon', origin: 'partida' },
      ],
    });
    void ayuntamiento;
  });

  afterAll(async () => {
    await prisma.factionRelation.deleteMany({ where: { OR: [{ sourceFactionId: playerFactionId }, { targetFactionId: playerFactionId }] } });
    await prisma.parcela.deleteMany({ where: { location: { worldId, slug: { contains: saveId } } } });
    await prisma.locationLink.deleteMany({ where: { OR: [{ from: { slug: { contains: saveId } } }, { to: { slug: { contains: saveId } } }] } });
    await prisma.location.deleteMany({ where: { worldId, slug: { contains: saveId } } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('construir el Cuartel Avanzado en Cristal Helado (dueño real: Clan Helsig) dispara EXPANSION_TERRITORIAL_AGRESIVA y genera su propia zona-interior', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
    const app = await buildApp();

    const action = 'Construyo un cuartel avanzado en este lugar.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    expect(narrateRes.statusCode).toBe(200);
    const body = lastNdjsonLine(narrateRes.payload);
    expect(body.narration).toEqual({ narration: expect.stringContaining('cuartel avanzado'), newFacts: [] });

    const cuartel = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'cuartel-avanzado' } });
    expect(cuartel.status).toBe('ACTIVO');

    // Zona-interior propia del Cuartel, más pequeña que la Capital (1 AVANZADA + 1 BÁSICA).
    const cuartelLocation = await prisma.location.findUniqueOrThrow({
      where: { worldId_slug: { worldId, slug: `cuartel-avanzado-interior-${cuartel.id}` } },
    });
    expect(cuartelLocation.kind).toBe('interior');
    expect(cuartelLocation.region).toBe('Cristal Helado');
    const parcelas = await prisma.parcela.findMany({ where: { locationId: cuartelLocation.id } });
    expect(parcelas).toHaveLength(2);
    const avanzada = parcelas.find((p) => p.tipo === 'AVANZADA');
    expect(avanzada?.buildingId).toBe(cuartel.id); // ya ocupada por el propio Cuartel
    expect(parcelas.filter((p) => p.tipo === 'BASICA')).toHaveLength(1);

    // Evento territorial real: FactionRelation dirigida jugador → Clan Helsig, con presión subida.
    const helsigFaction = await prisma.faction.findFirstOrThrow({ where: { worldId, name: 'Clan Helsig', saveId: null } });
    const relation = await prisma.factionRelation.findUniqueOrThrow({
      where: { sourceFactionId_targetFactionId: { sourceFactionId: playerFactionId, targetFactionId: helsigFaction.id } },
    });
    expect(relation.presion).toBe(65); // 50 neutro + 15 (EXPANSION_TERRITORIAL_AGRESIVA)
    expect(relation.type).toBe('TENSION'); // banda 60-79 — un solo evento ya cruza a tensión real
  }, 30_000);
});
