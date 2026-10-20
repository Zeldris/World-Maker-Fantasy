import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { agruparNoticias, darNoticia, marcaDeNoticias, CABECERA_RESUMEN } from './noticias.js';
import { evaluarConsecuencias } from './consecuencias.js';

// CR-12 paso 12d (hito 0.2) / UX-31 — varios días de golpe: las noticias llegan en un solo resumen.
describe('resumen de varios días (CR-12)', () => {
  const saveIds: string[] = [];
  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('junta en una entrada las de «El mundo» escritas tras la marca; las anteriores y las del personaje no', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Resumen (CR-12)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'R',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    const saveId = save.id;
    const entrada = (channel: 'WORLD' | 'CHARACTER', text: string) => prisma.logEntry.create({ data: { saveId, channel, text, timeLabel: 'Día 3', fictionalMinutes: 3 * 1440 } });

    await entrada('WORLD', 'Antes del viaje.');
    const desde = await marcaDeNoticias(prisma, saveId);
    // La marca es estricta (`>`): que lo siguiente no caiga en el mismo milisegundo.
    await new Promise((r) => setTimeout(r, 5));
    await entrada('WORLD', 'Una caravana viaja de A a B.');
    await entrada('CHARACTER', 'Caminas.');
    await entrada('WORLD', 'Se dice que una plaga golpea C.');

    expect(await agruparNoticias(prisma, saveId, desde)).toBe(2);
    const mundo = await prisma.logEntry.findMany({ where: { saveId, channel: 'WORLD' }, orderBy: { createdAt: 'asc' } });
    expect(mundo.map((e) => e.text)).toEqual(['Antes del viaje.', `${CABECERA_RESUMEN}\n• Una caravana viaja de A a B.\n• Se dice que una plaga golpea C.`]);
    expect(mundo[1]!.noticia).toEqual({ resumen: true, lineas: [null, null] });
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'CHARACTER' } })).toBe(1);

    // Con una sola no hay resumen.
    const otra = await marcaDeNoticias(prisma, saveId);
    await new Promise((r) => setTimeout(r, 5));
    await entrada('WORLD', 'Llega el invierno.');
    expect(await agruparNoticias(prisma, saveId, otra)).toBe(0);
  });

  it('P237: el resumen no repite la misma noticia dada varios días (un tablón renovado cada pocos días)', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Resumen repetido (P237)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'R',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    const saveId = save.id;
    const desde = await marcaDeNoticias(prisma, saveId);
    await new Promise((r) => setTimeout(r, 5));
    const aviso = 'Se dice que Feg Tusha ha colgado nuevos avisos en Trono Madre.';
    for (const t of [aviso, 'Llega el invierno.', aviso, aviso]) await prisma.logEntry.create({ data: { saveId, channel: 'WORLD', text: t, timeLabel: 'Día 3', fictionalMinutes: 3 * 1440 } });

    expect(await agruparNoticias(prisma, saveId, desde)).toBe(4);
    const mundo = await prisma.logEntry.findMany({ where: { saveId, channel: 'WORLD' } });
    expect(mundo).toHaveLength(1);
    expect(mundo[0]!.text).toBe(`${CABECERA_RESUMEN}\n• ${aviso}\n• Llega el invierno.`);
    expect(mundo[0]!.noticia).toEqual({ resumen: true, lineas: [null, null] });
  });

  it('UX-38: la noticia guarda su categoría y su oportunidad, también la que llega tarde', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Noticia meta (UX-38)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'N',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    const saveId = save.id;
    const oportunidad = { lugar: lugar.name, locationId: lugar.id, venceEn: 480 + 3 * 1440 };
    const otra = (await prisma.location.findFirstOrThrow({ where: { worldId, region: { not: lugar.region } } })).region;

    await prisma.$transaction((tx) => darNoticia(tx, { saveId, worldId, fictionalMinutes: 480 }, { texto: 'Aquí mismo.', facciones: [], region: lugar.region, categoria: 'CONFLICTO', oportunidad }));
    await prisma.$transaction((tx) => darNoticia(tx, { saveId, worldId, fictionalMinutes: 480 }, { texto: 'Una caravana pasa lejos.', facciones: [], region: otra, categoria: 'COMERCIO' }));
    expect((await prisma.logEntry.findFirstOrThrow({ where: { saveId, text: 'Aquí mismo.' } })).noticia).toEqual({ categoria: 'CONFLICTO', oportunidad });

    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + 4 * 1440 } });
    await evaluarConsecuencias(prisma, saveId);
    expect((await prisma.logEntry.findFirstOrThrow({ where: { saveId, text: 'Se dice que una caravana pasa lejos.' } })).noticia).toEqual({ categoria: 'COMERCIO', rumor: { region: otra, pasoEn: 480 } });
  });

  it('P237 (revisión): si tras quitar repetidos queda una sola, es una entrada normal, sin cabecera', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Resumen único (P237)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'R',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    const saveId = save.id;
    const desde = await marcaDeNoticias(prisma, saveId);
    await new Promise((r) => setTimeout(r, 5));
    const aviso = 'Se dice que Feg Tusha ha colgado nuevos avisos en Trono Madre.';
    for (const t of [aviso, aviso, aviso]) await prisma.logEntry.create({ data: { saveId, channel: 'WORLD', text: t, timeLabel: 'Día 3', fictionalMinutes: 3 * 1440 } });
    expect(await agruparNoticias(prisma, saveId, desde)).toBe(3);
    const mundo = await prisma.logEntry.findMany({ where: { saveId, channel: 'WORLD' } });
    expect(mundo.map((e) => e.text)).toEqual([aviso]);
    expect(mundo[0]!.noticia).toBeNull();
  });
});
