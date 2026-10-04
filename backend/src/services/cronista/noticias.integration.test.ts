import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { agruparNoticias, marcaDeNoticias, CABECERA_RESUMEN } from './noticias.js';

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
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'CHARACTER' } })).toBe(1);

    // Con una sola no hay resumen.
    const otra = await marcaDeNoticias(prisma, saveId);
    await new Promise((r) => setTimeout(r, 5));
    await entrada('WORLD', 'Llega el invierno.');
    expect(await agruparNoticias(prisma, saveId, otra)).toBe(0);
  });
});
