import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { avanzarAgendaDePartida, initialAgenda } from '../worldAgenda.js';
import { parseAgenda } from './cadenas.js';
import { decidirFacciones } from './decisionesFaccion.js';

/// CR-34 34c contra Postgres real, en el mundo de una partida: el Clan Serhu (líder estratega, 500
/// soldados) en tensión con Helsig (60) le declara la guerra; Helsig, que se queda corta, pide la paz
/// y Serhu, con hambre, la acepta; la paz corta la cadena del conflicto Serhu (Q19). Las demás
/// facciones no revisan (ya lo hicieron hoy) para aislar el caso. La partida es de Gorhorn porque la
/// cadena Serhu solo corre en las suyas. Borrar la partida borra sus copias.
describe('decidirFacciones — guerra, paz y corte de la cadena (CR-34 34c)', () => {
  const DIA = 50;
  let saveId: string;
  let serhu: { id: string; slug: string };
  let helsig: { id: string; slug: string };

  const presionPar = async (a: string, b: string) => {
    const filas = await prisma.factionRelation.findMany({ where: { OR: [{ sourceFactionId: a, targetFactionId: b }, { sourceFactionId: b, targetFactionId: a }] }, select: { presion: true } });
    return filas.map((f) => f.presion).sort();
  };
  const soloRevisan = async (ids: string[], dia: number) => {
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { ultimaRevision: dia } });
    await prisma.kingdomStats.updateMany({ where: { factionId: { in: ids } }, data: { ultimaRevision: null } });
  };

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'D',
        worldState: { create: { fictionalMinutes: DIA * 1440 + 900, presupuestoTension: 10, factionsStatus: { 'Clan Serhu': 0, 'Clan Helsig': 0 }, agenda: initialAgenda(0) as object } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    serhu = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' }, select: { id: true, slug: true } });
    helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig' }, select: { id: true, slug: true } });
    // Serhu sin carencias (que no le tiente un tratado) y solo en tensión con Helsig: el resto de sus
    // relaciones, neutrales (en el catálogo ya está en guerra con Feg Tusha, y el estratega no abre dos).
    await prisma.kingdomStats.update({ where: { factionId: serhu.id }, data: { comida: 1_000_000, riqueza: 1_000_000 } });
    await prisma.factionRelation.updateMany({ where: { saveId, OR: [{ sourceFactionId: serhu.id }, { targetFactionId: serhu.id }] }, data: { presion: 50, type: 'NEUTRAL', stage: 0 } });
    for (const [a, b] of [[serhu.id, helsig.id], [helsig.id, serhu.id]] as const) {
      await prisma.factionRelation.upsert({
        where: { sourceFactionId_targetFactionId: { sourceFactionId: a, targetFactionId: b } },
        update: { presion: 70, type: 'TENSION', stage: 1 }, create: { worldId, saveId, sourceFactionId: a, targetFactionId: b, presion: 70, type: 'TENSION', stage: 1 },
      });
    }
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('Serhu declara la guerra a Helsig, Helsig pide la paz, Serhu la acepta con hambre y la cadena se corta', async () => {
    await soloRevisan([serhu.id], DIA);
    const r1 = await decidirFacciones(prisma, saveId, DIA, () => 0.5);
    expect(r1.decisiones).toEqual([{ faccion: serhu.slug, accion: 'DECLARAR_GUERRA', objetivo: helsig.slug, aceptada: null }]);
    expect(await presionPar(serhu.id, helsig.id)).toEqual([80, 80]);
    expect(r1.presupuesto).toBe(2); // 10 − 8 (guerra)
    const guerra = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'GUERRA_DECLARADA', origen: 'MUNDO' } });
    expect(guerra.texto).toContain('declara la guerra');
    // Conoce a las dos, pero sin lugar concreto: le llega como rumor al día siguiente (Q9).
    expect(await prisma.consecuencia.count({ where: { saveId, regla: 'NOTICIA', origenSucesoId: guerra.id } })).toBe(1);

    // Mismo día: nadie vuelve a revisar.
    expect((await decidirFacciones(prisma, saveId, DIA, () => 0.5)).revisadas).toBe(0);

    // Al día siguiente Helsig (60 soldados frente a 500: carencia grave) pide la paz; Serhu, con hambre, acepta.
    await prisma.kingdomStats.update({ where: { factionId: serhu.id }, data: { comida: 0 } });
    await prisma.worldState.update({ where: { saveId }, data: { presupuestoTension: 10, fictionalMinutes: (DIA + 1) * 1440 + 900 } });
    await soloRevisan([helsig.id], DIA + 1);
    const r2 = await decidirFacciones(prisma, saveId, DIA + 1, () => 0.5);
    expect(r2.decisiones).toEqual([{ faccion: helsig.slug, accion: 'PEDIR_PAZ', objetivo: serhu.slug, aceptada: true }]);
    expect(await presionPar(serhu.id, helsig.id)).toEqual([65, 65]);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'TREGUA' } })).toBe(1);

    // Q19: la paz corta la cadena del conflicto Serhu.
    await avanzarAgendaDePartida(prisma, saveId);
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId }, select: { agenda: true } });
    expect(parseAgenda(ws.agenda)[0]!.cortadaEn).toBeDefined();
  }, 60_000);

  it('sin presupuesto, la decisión grande espera', async () => {
    for (const [a, b] of [[serhu.id, helsig.id], [helsig.id, serhu.id]] as const) {
      await prisma.factionRelation.updateMany({ where: { sourceFactionId: a, targetFactionId: b }, data: { presion: 70, type: 'TENSION', stage: 1 } });
    }
    await prisma.kingdomStats.update({ where: { factionId: serhu.id }, data: { comida: 1_000_000 } });
    await prisma.worldState.update({ where: { saveId }, data: { presupuestoTension: 0, fictionalMinutes: (DIA + 10) * 1440 + 900 } });
    await soloRevisan([serhu.id], DIA + 10);
    const r = await decidirFacciones(prisma, saveId, DIA + 10, () => 0.5);
    expect(r.revisadas).toBe(1);
    expect(r.decisiones).toEqual([]);
    expect(await presionPar(serhu.id, helsig.id)).toEqual([70, 70]);
  }, 60_000);
});
