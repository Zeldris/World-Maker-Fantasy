import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { detectNpcsInScene, nombraPorPalabraDelNombre } from './npcScene.js';

describe('P441 — a la compañera se la nombra por su nombre de pila', () => {
  it('casa una palabra entera del nombre de 4 letras o más, no un trozo', () => {
    expect(nombraPorPalabraDelNombre('Le doy el Tótem Maktor a Tirag.', 'Tirag Susig')).toBe(true);
    expect(nombraPorPalabraDelNombre('Le doy el Tótem Maktor a Tiragón', 'Tirag Susig')).toBe(false);
    expect(nombraPorPalabraDelNombre('Le doy el Tótem a Ko', 'Gistera Ko')).toBe(false);
  });

  let saveId: string;
  let worldId: string;
  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (P441)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 }, portraitInitial: 'G',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const enEscena = async (action: string) =>
    (await detectNpcsInScene({ action, worldId, sessionFacts: [], saveId, currentLocationId: (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).currentLocationId, fictionalMinutes: 600 })).map((n) => n.slug);

  it('«Tirag» suelto mete en escena a Tirag Susig solo si va de compañera', async () => {
    expect(await enEscena('Le doy el Tótem Maktor a Tirag')).not.toContain('tirag-susig');
    await prisma.companion.create({ data: { saveId, name: 'Tirag Susig', role: 'Cazadora', notes: '', tipo: 'NPC', sourceSlug: 'tirag-susig' } });
    expect(await enEscena('Le doy el Tótem Maktor a Tirag')).toContain('tirag-susig');
  });
});
