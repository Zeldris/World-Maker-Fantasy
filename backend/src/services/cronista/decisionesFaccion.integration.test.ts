import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { avanzarAgendaDePartida, initialAgenda } from '../worldAgenda.js';
import { parseAgenda } from './cadenas.js';
import Fastify from 'fastify';
import { decidirFacciones, responderPropuesta } from './decisionesFaccion.js';
import { evaluarConsecuencias } from './consecuencias.js';
import { logRoutes } from '../../routes/saves/log.js';

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
    // CR-18 (Q10): el personaje no está en ninguna región, así que no le llega sola; la noticia queda
    // guardada con su suceso para quien se entere después.
    expect((guerra.noticia as { texto: string } | null)?.texto).toContain('declara la guerra');
    expect(await prisma.conocimiento.count({ where: { saveId, sucesoId: guerra.id } })).toBe(0);

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

/// CR-34 34e contra Postgres real: una facción propone un tratado al Reino de la jugadora (noticia con
/// plazo); aceptarlo deja el tratado en las dos direcciones; rechazarlo o dejarlo pasar sube la presión.
describe('propuestas al Reino de la jugadora (CR-34 34e)', () => {
  const DIA = 70;
  let saveId: string;
  let feg: { id: string; slug: string };
  let reinoId: string;

  const proponer = async (dia: number) => {
    await prisma.worldState.update({ where: { saveId }, data: { presupuestoTension: 10, fictionalMinutes: dia * 1440 + 900 } });
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { ultimaRevision: dia } });
    await prisma.kingdomStats.update({ where: { factionId: feg.id }, data: { ultimaRevision: null } });
    return decidirFacciones(prisma, saveId, dia, () => 0.5);
  };
  const ultimaPropuesta = async () => {
    const entrada = await prisma.logEntry.findFirstOrThrow({ where: { saveId, channel: 'WORLD', text: { contains: 'propone a tu reino' } }, orderBy: { createdAt: 'desc' } });
    return { entrada, propuesta: (entrada.noticia as { propuesta: { id: string; respuesta?: string; tipo: string } }).propuesta };
  };
  const presiones = async () => {
    const filas = await prisma.factionRelation.findMany({ where: { OR: [{ sourceFactionId: feg.id, targetFactionId: reinoId }, { sourceFactionId: reinoId, targetFactionId: feg.id }] }, select: { sourceFactionId: true, presion: true } });
    return { fegAlReino: filas.find((f) => f.sourceFactionId === feg.id)?.presion, reinoAFeg: filas.find((f) => f.sourceFactionId === reinoId)?.presion };
  };

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Propuestas al Reino', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'P',
        worldState: { create: { fictionalMinutes: DIA * 1440 + 900, presupuestoTension: 10 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    reinoId = (await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-propuestas', name: 'Reino de las Propuestas', raza: 'orcos', description: 'x' } })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: `save:${saveId}`, poblacion: 10, soldados: 5 } });
    feg = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'feg-ger' }, select: { id: true, slug: true } });
    // Feg Ger, mercantil y sin carencias, en alianza con todas las demás: solo le queda el Reino.
    await prisma.faction.update({ where: { id: feg.id }, data: { disposicion: 'MERCANTIL' } });
    await prisma.kingdomStats.update({ where: { factionId: feg.id }, data: { comida: 1_000_000, riqueza: 1_000_000 } });
    const otras = await prisma.faction.findMany({ where: { saveId, origenSlug: { not: null }, id: { not: feg.id } }, select: { id: true } });
    for (const o of otras) {
      for (const [a, b] of [[feg.id, o.id], [o.id, feg.id]]) {
        await prisma.factionRelation.upsert({
          where: { sourceFactionId_targetFactionId: { sourceFactionId: a!, targetFactionId: b! } },
          update: { presion: 10, type: 'ALIANZA', stage: 0 }, create: { worldId, saveId, sourceFactionId: a!, targetFactionId: b!, presion: 10, type: 'ALIANZA', stage: 0 },
        });
      }
    }
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('propone un tratado con plazo; aceptarlo lo deja en las dos direcciones y abre su comercio', async () => {
    const r = await proponer(DIA);
    expect(r.decisiones).toEqual([{ faccion: feg.slug, accion: 'PROPONER_TRATADO', objetivo: 'reino-propuestas', aceptada: null }]);
    const { propuesta } = await ultimaPropuesta();
    expect(propuesta).toMatchObject({ tipo: 'TRATADO' });
    expect(propuesta.respuesta).toBeUndefined();
    // Con una pendiente no vuelve a proponer.
    expect((await proponer(DIA + 1)).decisiones[0]).toMatchObject({ aceptada: false });

    expect(await responderPropuesta(prisma, saveId, propuesta.id, true)).toEqual({ respuesta: 'ACEPTADA' });
    expect(await presiones()).toEqual({ fegAlReino: 35, reinoAFeg: 35 });
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'TRATADO_COMERCIAL' } })).toBe(1);
    expect((await ultimaPropuesta()).propuesta.respuesta).toBe('ACEPTADA');
    // Ya respondida: no se puede responder otra vez.
    expect(await responderPropuesta(prisma, saveId, propuesta.id, false)).toBeNull();
  }, 60_000);

  it('rechazar o dejar pasar el plazo sube 5 la presión de la facción hacia el Reino', async () => {
    // De vuelta a neutral para que vuelva a proponer.
    await prisma.factionRelation.updateMany({ where: { OR: [{ sourceFactionId: feg.id, targetFactionId: reinoId }, { sourceFactionId: reinoId, targetFactionId: feg.id }] }, data: { presion: 50, type: 'NEUTRAL', stage: 0 } });
    await proponer(DIA + 10);
    const primera = (await ultimaPropuesta()).propuesta;
    expect(await responderPropuesta(prisma, saveId, primera.id, false)).toEqual({ respuesta: 'RECHAZADA' });
    expect((await presiones()).fegAlReino).toBe(55);

    await proponer(DIA + 20);
    const segunda = (await ultimaPropuesta()).propuesta;
    expect(segunda.id).not.toBe(primera.id);
    // Pasan los 3 días sin responder.
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: (DIA + 24) * 1440 } });
    await evaluarConsecuencias(prisma, saveId);
    expect((await presiones()).fegAlReino).toBe(60);
    expect((await ultimaPropuesta()).propuesta.respuesta).toBe('CADUCADA');
  }, 60_000);

  it('POST /saves/:id/mundo/propuestas/:propuestaId: 400 sin «acepta», 404 si ya no está pendiente', async () => {
    const app = Fastify();
    await app.register(logRoutes);
    const { propuesta } = await ultimaPropuesta();
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/mundo/propuestas/${propuesta.id}`, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/mundo/propuestas/${propuesta.id}`, payload: { acepta: true } })).statusCode).toBe(404);
    await app.close();
  });
});
