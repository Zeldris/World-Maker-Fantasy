import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { advanceFactionEconomy, TOPE_STOCK_FACCION_POR_SLUG } from './factionEconomy.js';

/// Fase 4 (H-6/H-2/H-4) contra Postgres real: dos partidas del MISMO mundo no duplican la producción,
/// un segundo tick el mismo día no hace nada, el Almacén de la facción recibe stock real (con tope) y
/// las relaciones decaen una semana. Se restauran los marcadores/stats del mundo al terminar.
describe('advanceFactionEconomy — integración (Fase 4)', () => {
  const DIA = 100_001; // muy por encima de cualquier partida real: domina el "máximo del mundo"
  let worldId: string;
  let saveIds: string[] = [];
  let serhuId: string;
  let statsSnapshot: Awaited<ReturnType<typeof prisma.kingdomStats.findMany>> = [];
  let relSnapshot: Awaited<ReturnType<typeof prisma.factionRelation.findMany>> = [];
  let almacenPreviosIds: string[] = [];
  let relCreadaId: string | null = null;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    for (const [i, min] of [DIA * 1440 + 30, (DIA - 3) * 1440].entries()) {
      const save = await prisma.save.create({
        data: {
          userId, worldId, characterName: `Economía de facción ${i}`, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
          attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'E',
        },
      });
      await prisma.worldState.create({ data: { saveId: save.id, fictionalMinutes: min } });
      saveIds.push(save.id);
    }
    const serhu = await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-serhu', saveId: null } });
    serhuId = serhu.id;
    statsSnapshot = await prisma.kingdomStats.findMany({ where: { faction: { worldId } } });
    relSnapshot = await prisma.factionRelation.findMany({ where: { worldId } });
    almacenPreviosIds = (await prisma.almacenItem.findMany({ where: { factionId: serhuId }, select: { id: true } })).map((a) => a.id);

    // Línea base: Serhu tenía producido hasta DIA-1 → exactamente 1 día pendiente.
    await prisma.kingdomStats.updateMany({ where: { faction: { worldId } }, data: { ultimoDiaProducido: DIA - 1 } });
    // Relación Serhu→otra facción con presión 80 y 2 semanas pendientes.
    const otra = await prisma.faction.findFirstOrThrow({ where: { worldId, saveId: null, id: { not: serhuId } } });
    const existente = await prisma.factionRelation.findUnique({ where: { sourceFactionId_targetFactionId: { sourceFactionId: serhuId, targetFactionId: otra.id } } });
    const data = { presion: 80, type: 'GUERRA' as const, ultimaSemanaDecaida: Math.floor(DIA / 7) - 2 };
    if (existente) await prisma.factionRelation.update({ where: { id: existente.id }, data });
    else relCreadaId = (await prisma.factionRelation.create({ data: { worldId, sourceFactionId: serhuId, targetFactionId: otra.id, ...data } })).id;
  });

  afterAll(async () => {
    await prisma.almacenItem.deleteMany({ where: { factionId: serhuId, id: { notIn: almacenPreviosIds } } });
    for (const s of statsSnapshot) {
      await prisma.kingdomStats.update({
        where: { id: s.id },
        data: { comida: s.comida, riqueza: s.riqueza, felicidad: s.felicidad, diasFelicidadAlta: s.diasFelicidadAlta, diasFelicidadBaja: s.diasFelicidadBaja, ultimoDiaProducido: s.ultimoDiaProducido },
      });
    }
    if (relCreadaId) await prisma.factionRelation.delete({ where: { id: relCreadaId } });
    for (const r of relSnapshot) {
      await prisma.factionRelation.update({ where: { id: r.id }, data: { presion: r.presion, type: r.type, stage: r.stage, ultimaSemanaDecaida: r.ultimaSemanaDecaida } });
    }
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('con dos partidas del mismo mundo procesa UN día una sola vez, deposita stock con tope y decae la presión', async () => {
    const antes = await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `faction:${serhuId}` } });
    const r1 = await advanceFactionEconomy(prisma);
    expect(r1.diasProcesados).toBeGreaterThan(0);
    const tras1 = await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `faction:${serhuId}` } });
    expect(tras1.ultimoDiaProducido).toBe(DIA);
    expect(tras1.riqueza).not.toBe(antes.riqueza);

    // Segundo tick el mismo día (y "otra partida"): idempotente, nada cambia.
    const r2 = await advanceFactionEconomy(prisma);
    expect(r2.diasProcesados).toBe(0);
    expect(r2.depositados).toBe(0);
    const tras2 = await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `faction:${serhuId}` } });
    expect({ c: tras2.comida, r: tras2.riqueza, f: tras2.felicidad }).toEqual({ c: tras1.comida, r: tras1.riqueza, f: tras1.felicidad });

    // Stock real (H-2): lo que lee GET /reino/mercado/:faccion (AlmacenItem.factionId agrupado por slug).
    const items = await prisma.almacenItem.findMany({ where: { factionId: serhuId, id: { notIn: almacenPreviosIds } } });
    expect(items.length).toBeGreaterThan(0);
    const porSlug = new Map<string, number>();
    for (const it of items) porSlug.set(it.catalogSlug!, (porSlug.get(it.catalogSlug!) ?? 0) + 1);
    expect(Math.max(...porSlug.values())).toBeLessThanOrEqual(TOPE_STOCK_FACCION_POR_SLUG);

    // H-4: 2 semanas pendientes → presión 80 → 78; segunda pasada no decae más.
    const rel = await prisma.factionRelation.findFirstOrThrow({ where: { worldId, sourceFactionId: serhuId, presion: { in: [78, 80] } } });
    expect(rel.presion).toBe(78);
    expect(rel.ultimaSemanaDecaida).toBe(Math.floor(DIA / 7));
  }, 30_000);
});
