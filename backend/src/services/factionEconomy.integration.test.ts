import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { decaerRelaciones, producirFacciones, TOPE_STOCK_FACCION_POR_SLUG } from './factionEconomy.js';
import { asegurarMundoDePartida } from './mundoPartida.js';

/// Fase 4 (H-6/H-2/H-4) contra Postgres real, sobre el mundo de una partida (CR-35): un segundo tick
/// el mismo día no hace nada, el Almacén de la facción recibe stock real (con tope), las relaciones
/// decaen una semana y ni el catálogo ni la otra partida cambian. Borrar las partidas borra sus copias.
describe('producirFacciones / decaerRelaciones — integración (Fase 4, por partida)', () => {
  const DIA = 40;
  let worldId: string;
  let saveId: string;
  let otraId: string;
  let serhuId: string;
  let serhuOtraId: string;

  const crear = async (nombre: string) => {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'E',
        worldState: { create: { fictionalMinutes: DIA * 1440 + 30 } },
      },
    });
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  };

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = await crear('Economía de facción');
    otraId = await crear('Economía de facción (otra)');
    serhuId = (await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } })).id;
    serhuOtraId = (await prisma.faction.findFirstOrThrow({ where: { saveId: otraId, origenSlug: 'clan-serhu' } })).id;

    // Línea base: Serhu tenía producido hasta DIA-1 → exactamente 1 día pendiente.
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { ultimoDiaProducido: DIA - 1 } });
    // Riqueza conocida (CI, 2026-09-29): con 0, sus 500 soldados cuestan más de lo que rinden sus 150
    // trabajadores y el día la dejaba en 0 (Math.max), así que "la riqueza cambia" no se vería.
    await prisma.kingdomStats.update({ where: { ownerKey: `faction:${serhuId}` }, data: { riqueza: 10_000 } });
    // Relación Serhu→otra facción de la partida con presión 80 y 2 semanas pendientes.
    const otra = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: { not: null }, id: { not: serhuId } } });
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId: serhuId, targetFactionId: otra.id } },
      update: { presion: 80, type: 'GUERRA', ultimaSemanaDecaida: Math.floor(DIA / 7) - 2 },
      create: { worldId, saveId, sourceFactionId: serhuId, targetFactionId: otra.id, presion: 80, type: 'GUERRA', ultimaSemanaDecaida: Math.floor(DIA / 7) - 2 },
    });
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: [saveId, otraId] } } });
  });

  it('procesa UN día una sola vez, deposita stock con tope y decae la presión, sin tocar el catálogo ni otra partida', async () => {
    const statsDe = (factionId: string) => prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `faction:${factionId}` } });
    const catalogoAntes = await prisma.kingdomStats.findMany({ where: { faction: { worldId, saveId: null } }, orderBy: { id: 'asc' } });
    const otraAntes = await statsDe(serhuOtraId);
    const antes = await statsDe(serhuId);
    const tick = async () => {
      const r = { diasProcesados: 0, semanasDecaidas: 0, depositados: 0 };
      await producirFacciones(prisma, worldId, { saveId, origenSlug: { not: null } }, DIA, r);
      await decaerRelaciones(prisma, { saveId }, DIA, r);
      return r;
    };

    const r1 = await tick();
    expect(r1.diasProcesados).toBeGreaterThan(0);
    const tras1 = await statsDe(serhuId);
    expect(tras1.ultimoDiaProducido).toBe(DIA);
    expect(tras1.riqueza).not.toBe(antes.riqueza);

    // Segundo tick el mismo día: idempotente, nada cambia.
    const r2 = await tick();
    expect(r2.diasProcesados).toBe(0);
    expect(r2.depositados).toBe(0);
    const tras2 = await statsDe(serhuId);
    expect({ c: tras2.comida, r: tras2.riqueza, f: tras2.felicidad }).toEqual({ c: tras1.comida, r: tras1.riqueza, f: tras1.felicidad });

    // Stock real (H-2): lo que lee GET /reino/mercado/:faccion (AlmacenItem.factionId agrupado por slug).
    const items = await prisma.almacenItem.findMany({ where: { factionId: serhuId } });
    expect(items.length).toBeGreaterThan(0);
    const porSlug = new Map<string, number>();
    for (const it of items) porSlug.set(it.catalogSlug!, (porSlug.get(it.catalogSlug!) ?? 0) + 1);
    expect(Math.max(...porSlug.values())).toBeLessThanOrEqual(TOPE_STOCK_FACCION_POR_SLUG);

    // H-4: 2 semanas pendientes → presión 80 → 78; segunda pasada no decae más.
    const rel = await prisma.factionRelation.findFirstOrThrow({ where: { saveId, sourceFactionId: serhuId, presion: { in: [78, 80] } } });
    expect(rel.presion).toBe(78);
    expect(rel.ultimaSemanaDecaida).toBe(Math.floor(DIA / 7));

    // El catálogo nunca cambia jugando, y la otra partida no se entera.
    expect(await prisma.kingdomStats.findMany({ where: { faction: { worldId, saveId: null } }, orderBy: { id: 'asc' } })).toEqual(catalogoAntes);
    expect(await statsDe(serhuOtraId)).toEqual(otraAntes);
  }, 30_000);
});
