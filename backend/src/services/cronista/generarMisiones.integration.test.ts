import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { ofrecerTrabajoDeNpc, renovarTablones } from './generarMisiones.js';
import { validarHuecos, MISIONES_POR_TABLON, type HuecosMision } from './misiones.js';

/// CR-40 40d contra Postgres real: el tablón del Clan Serhu se llena con misiones que salen del mundo
/// de la partida (un exceso de fauna en las Llanuras, la guerra con Helsig), sin repetir tipo, todas
/// válidas; no se rellena dos veces el mismo día y los avisos vencidos se retiran y se reponen.
describe('renovarTablones (CR-40 40d)', () => {
  const DIA = 30;
  let saveId: string;
  let tablonSerhu: string;

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Avisos', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'A',
        worldState: { create: { fictionalMinutes: DIA * 1440 + 900, factionsStatus: { 'Clan Serhu': 2500 } } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    // Exceso de canizores en la partida (solo en su copia de la población).
    const canizor = await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'canizor' } });
    await prisma.worldPopulation.update({ where: { id: canizor.id }, data: { poblacion: canizor.poblacionMax } });
    const serhu = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } });
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig' } });
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId: serhu.id, targetFactionId: helsig.id } },
      update: { presion: 85, type: 'GUERRA' }, create: { worldId, saveId, sourceFactionId: serhu.id, targetFactionId: helsig.id, presion: 85, type: 'GUERRA' },
    });
    tablonSerhu = (await prisma.building.findFirstOrThrow({ where: { factionId: serhu.id, recipeKey: 'tablon-avisos' } })).id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('cuelga misiones del mundo de la partida, válidas y sin repetir tipo; no rellena dos veces el mismo día', async () => {
    const r = await renovarTablones(prisma, saveId, DIA, () => 0.3);
    expect(r.colgadas).toBeGreaterThan(0);
    const avisos = await prisma.misionOfrecida.findMany({ where: { buildingId: tablonSerhu, estado: 'DISPONIBLE' } });
    expect(avisos.length).toBe(MISIONES_POR_TABLON);
    expect(new Set(avisos.map((a) => a.tipo)).size).toBe(avisos.length);
    for (const a of avisos) {
      expect(validarHuecos(a.huecos as unknown as HuecosMision)).toEqual([]);
      expect(a.descripcion).not.toMatch(/undefined|null/);
      expect(a.retiraEn - a.creadaEn).toBe(7 * 1440);
    }
    // Lo que hay en el mundo de la partida: cazar canizores o combatir/eliminar contra Helsig.
    const huecos = avisos.map((a) => a.huecos as unknown as HuecosMision);
    expect(huecos.some((h) => h.especie?.slug === 'canizor' || h.enemiga?.slug === 'clan-helsig')).toBe(true);
    // Avisa en «El mundo» (conoce a Serhu): al momento o, según la distancia, como rumor programado.
    const alMomento = await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: { contains: 'ha colgado nuevos avisos' } } });
    const programadas = (await prisma.consecuencia.findMany({ where: { saveId, regla: 'NOTICIA' }, select: { datos: true } })).filter((c) => JSON.stringify(c.datos).includes('ha colgado nuevos avisos')).length;
    expect(alMomento + programadas).toBeGreaterThan(0);

    expect((await renovarTablones(prisma, saveId, DIA, () => 0.3)).colgadas).toBe(0);
  }, 60_000);

  it('a la semana los avisos que nadie cogió se retiran y se reponen', async () => {
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: (DIA + 8) * 1440 + 900 } });
    const r = await renovarTablones(prisma, saveId, DIA + 8, () => 0.7);
    expect(r.retiradas).toBeGreaterThanOrEqual(MISIONES_POR_TABLON);
    expect(await prisma.misionOfrecida.count({ where: { buildingId: tablonSerhu, estado: 'RETIRADA' } })).toBe(MISIONES_POR_TABLON);
    expect(await prisma.misionOfrecida.count({ where: { buildingId: tablonSerhu, estado: 'DISPONIBLE' } })).toBe(MISIONES_POR_TABLON);
  }, 60_000);
});

/// CR-40 40f contra Postgres real: «¿Tienes trabajo?» a un NPC con nombre de una facción viva de la
/// partida da UNA misión personal de las plantillas (con su nombre y más recompensa), la misma si se
/// vuelve a preguntar, y nada si el NPC no es de ninguna facción de la partida.
describe('ofrecerTrabajoDeNpc (CR-40 40f)', () => {
  let saveId: string;

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const campamento = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-serhu' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Trabajo', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'T',
        currentLocationId: campamento.id, worldState: { create: { fictionalMinutes: 5 * 1440 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    const serhu = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } });
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig' } });
    // Algo que encargar seguro: guerra con Helsig (Combatir) en las Llanuras.
    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId: serhu.id, targetFactionId: helsig.id } },
      update: { presion: 85, type: 'GUERRA' }, create: { worldId, saveId, sourceFactionId: serhu.id, targetFactionId: helsig.id, presion: 85, type: 'GUERRA' },
    });
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('el NPC con nombre propone una misión personal de las plantillas; la misma si se le vuelve a preguntar', async () => {
    const npc = await prisma.npc.findFirstOrThrow({ where: { faction: 'Clan Serhu', kind: { not: 'PLANTILLA' }, slug: { not: 'ulkha-ketg' } }, orderBy: { slug: 'asc' } });
    const aviso = await ofrecerTrabajoDeNpc(prisma, saveId, npc.slug, () => 0.4);
    expect(aviso).not.toBeNull();
    expect(aviso!.descripcion.startsWith(`${npc.name}: «`)).toBe(true);
    const fila = await prisma.misionOfrecida.findUniqueOrThrow({ where: { id: aviso!.id } });
    expect(fila).toMatchObject({ npcId: npc.id, buildingId: null, estado: 'DISPONIBLE', retiraEn: 5 * 1440 + 1440 });
    const h = fila.huecos as unknown as HuecosMision;
    expect(validarHuecos(h)).toEqual([]);
    expect(h.npc).toEqual({ id: npc.id, nombre: npc.name });
    expect((await ofrecerTrabajoDeNpc(prisma, saveId, npc.slug, () => 0.9))!.id).toBe(aviso!.id);
  }, 60_000);

  it('sin facción viva en la partida no hay trabajo', async () => {
    const sinFaccion = await prisma.npc.findFirst({ where: { faction: null, kind: { not: 'PLANTILLA' } } });
    if (sinFaccion) expect(await ofrecerTrabajoDeNpc(prisma, saveId, sinFaccion.slug)).toBeNull();
    expect(await ofrecerTrabajoDeNpc(prisma, saveId, 'no-existe')).toBeNull();
  }, 60_000);
});
