import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { advanceFactionExpeditions } from './factionExpeditions.js';

/// Fase 13-B contra Postgres real: lanzar, llegar, completar, stock, XP e idempotencia del tick. Usa la
/// facción sembrada Clan Serhu (con NPC de pescador/herborista con potencial) en el mundo helek-sirik y
/// restaura al terminar marcadores, progreso de NPC, Almacén y expediciones creadas.
describe('advanceFactionExpeditions — integración (Fase 13-B)', () => {
  const DIA = 300_001; // muy por encima de cualquier partida real: domina el "máximo del mundo"
  const random = () => 0.99; // tirada 20 (recolección OK), sin intercepción
  let worldId: string;
  let saveId: string;
  let serhuId: string;
  let statsSnapshot: { id: string; ultimoDiaExpedicion: number | null }[] = [];
  let progresoSnapshot: Awaited<ReturnType<typeof prisma.npcProfessionProgress.findMany>> = [];
  let almacenPreviosIds: string[] = [];
  let expedicionesPreviasIds: string[] = [];

  const irAlDia = (dia: number) => prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: dia * 1440 + 30 } });

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const save = await prisma.save.create({
      data: {
        userId, worldId, characterName: 'Expediciones de facción', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'E',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: DIA * 1440 + 30 } });
    serhuId = (await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-serhu', saveId: null } })).id;
    statsSnapshot = (await prisma.kingdomStats.findMany({ where: { faction: { worldId } }, select: { id: true, ultimoDiaExpedicion: true } }));
    progresoSnapshot = await prisma.npcProfessionProgress.findMany({ where: { npc: { worldId } } });
    almacenPreviosIds = (await prisma.almacenItem.findMany({ where: { faction: { worldId } }, select: { id: true } })).map((a) => a.id);
    expedicionesPreviasIds = (await prisma.expedicion.findMany({ where: { worldId }, select: { id: true } })).map((e) => e.id);
    // Línea base: todas las facciones procesadas hasta DIA-1 → el primer tick procesa exactamente el día DIA.
    await prisma.kingdomStats.updateMany({ where: { faction: { worldId } }, data: { ultimoDiaExpedicion: DIA - 1 } });
  });

  afterAll(async () => {
    await prisma.expedicion.deleteMany({ where: { worldId, id: { notIn: expedicionesPreviasIds } } });
    await prisma.almacenItem.deleteMany({ where: { faction: { worldId }, id: { notIn: almacenPreviosIds } } });
    for (const p of progresoSnapshot) await prisma.npcProfessionProgress.update({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
    for (const s of statsSnapshot) await prisma.kingdomStats.update({ where: { id: s.id }, data: { ultimoDiaExpedicion: s.ultimoDiaExpedicion } });
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('lanza, llega, completa, deposita stock y da XP; el mismo día dos veces es idempotente; la intercepción pierde la carga', async () => {
    const propias = () => prisma.expedicion.findMany({ where: { factionId: serhuId, id: { notIn: expedicionesPreviasIds } }, include: { members: true }, orderBy: { diaSalida: 'asc' } });

    // Día DIA: lanza una (y solo una) expedición.
    const r1 = await advanceFactionExpeditions(prisma, random);
    expect(r1.lanzadas).toBeGreaterThan(0);
    let exps = await propias();
    expect(exps).toHaveLength(1);
    const exp = exps[0]!;
    expect(exp).toMatchObject({ status: 'EN_TRANSITO', diaSalida: DIA, diaRegreso: DIA + 2, riesgo: 0 });
    expect(exp.members.filter((m) => m.rol === 'recolector').length).toBeGreaterThanOrEqual(1);
    const recolectores = exp.members.filter((m) => m.rol === 'recolector').map((m) => m.npcId);
    const xpAntes = await prisma.npcProfessionProgress.findMany({ where: { npcId: { in: recolectores }, professionId: exp.professionId } });

    // Idempotencia: mismo día, segundo tick, nada cambia.
    const r2 = await advanceFactionExpeditions(prisma, random);
    expect(r2.diasProcesados).toBe(0);
    expect(r2.lanzadas).toBe(0);
    expect(await propias()).toHaveLength(1);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `faction:${serhuId}` } })).ultimoDiaExpedicion).toBe(DIA);

    // Día DIA+1: llegada, recolección, RETORNANDO con botín.
    await irAlDia(DIA + 1);
    await advanceFactionExpeditions(prisma, random);
    const llegada = (await propias())[0]!;
    expect(llegada.status).toBe('RETORNANDO');
    const items = (llegada.botin as { items: { npcId: string; cantidad: number; catalogSlug: string }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(llegada.tiradaRiesgo).not.toBeNull();

    // Día DIA+2: completa, botín al Almacén con tope, XP a quien sacó algo, y (mismo día) lanza otra.
    await irAlDia(DIA + 2);
    const r3 = await advanceFactionExpeditions(prisma, random);
    expect(r3.completadas).toBeGreaterThan(0);
    exps = await propias();
    expect(exps[0]!.status).toBe('COMPLETADA');
    const almacen = await prisma.almacenItem.findMany({ where: { factionId: serhuId, id: { notIn: almacenPreviosIds } } });
    for (const it of items) expect(almacen.some((a) => a.catalogSlug === it.catalogSlug)).toBe(true);
    const xpDespues = await prisma.npcProfessionProgress.findMany({ where: { npcId: { in: items.map((i) => i.npcId) }, professionId: exp.professionId } });
    expect(xpDespues.length).toBeGreaterThan(0);
    for (const d of xpDespues) {
      const antes = xpAntes.find((a) => a.npcId === d.npcId);
      expect(d.xp).toBeGreaterThan(antes?.xp ?? -1);
    }
    expect(exps).toHaveLength(2);
    expect(exps[1]!.status).toBe('EN_TRANSITO');

    // Segunda expedición con riesgo 100: la intercepción la marca INTERCEPTADA y pierde la carga.
    await prisma.expedicion.update({ where: { id: exps[1]!.id }, data: { riesgo: 100 } });
    const stockAntes = await prisma.almacenItem.count({ where: { factionId: serhuId } });
    await irAlDia(DIA + 3);
    const r4 = await advanceFactionExpeditions(prisma, () => 0.1);
    expect(r4.interceptadas).toBeGreaterThan(0);
    const interceptada = await prisma.expedicion.findUniqueOrThrow({ where: { id: exps[1]!.id } });
    expect(interceptada.status).toBe('INTERCEPTADA');
    expect(interceptada.botin).toBeNull();
    // Nada entra al Almacén por la interceptada.
    expect(await prisma.almacenItem.count({ where: { factionId: serhuId } })).toBe(stockAntes);
  }, 60_000);
});
