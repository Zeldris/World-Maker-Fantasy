import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { expedicionesVisibles, progresoDeExpedicion } from './expedicionesMapa.js';

/// CR-46: qué expediciones ve el personaje en el mapa (como en X4: las tuyas, las aliadas, las cercanas).
describe('CR-46 — expediciones en el mapa', () => {
  let saveId: string;
  let worldId: string;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (mapa)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 }, portraitInitial: 'G',
        currentLocationId: hondonada.id, worldState: { create: { fictionalMinutes: 3 * 1440 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('progreso: ida hasta la mitad, vuelta después', () => {
    expect(progresoDeExpedicion(2, 6, 2)).toBe(0);
    expect(progresoDeExpedicion(2, 6, 4)).toBe(0.5);
    expect(progresoDeExpedicion(2, 6, 9)).toBe(1);
  });

  it('se ve la que va a tu región; no la de una facción sin trato que va lejos', async () => {
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig' } });
    const destinoCerca = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const lejos = await prisma.location.findFirstOrThrow({ where: { worldId, region: { not: destinoCerca.region } } });
    const base = { worldId, saveId, factionId: helsig.id, professionId: 'minero', diaSalida: 2, diaRegreso: 6 };
    const cerca = await prisma.expedicion.create({ data: { ...base, destinoLocationId: destinoCerca.id } });
    const otra = await prisma.expedicion.create({ data: { ...base, destinoLocationId: lejos.id } });
    const vistas = await expedicionesVisibles(prisma, saveId);
    const ids = vistas.map((v) => v.id);
    expect(ids).toContain(cerca.id);
    const origenEnLaRegion = vistas.find((v) => v.id === cerca.id)!;
    expect(origenEnLaRegion).toMatchObject({ faccion: 'Clan Helsig', destinoSlug: 'hondonada-del-eco', progreso: 0.25, delReino: false });
    expect(origenEnLaRegion.origenSlug.endsWith('-interior')).toBe(false);
    // La segunda solo se ve si el asentamiento de Helsig está en tu región.
    const helsigEnTuRegion = (await prisma.building.findFirst({ where: { factionId: helsig.id, locationId: { not: null } }, select: { location: { select: { region: true } } } }))?.location?.region === destinoCerca.region;
    expect(ids.includes(otra.id)).toBe(helsigEnTuRegion);
  });

  it('también se ve mientras recolecta y de vuelta', async () => {
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig' } });
    const destino = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const vuelta = await prisma.expedicion.create({ data: { worldId, saveId, factionId: helsig.id, professionId: 'minero', diaSalida: 0, diaRegreso: 4, destinoLocationId: destino.id, status: 'RETORNANDO' } });
    expect((await expedicionesVisibles(prisma, saveId)).find((v) => v.id === vuelta.id)?.progreso).toBe(0.75);
  });
});
