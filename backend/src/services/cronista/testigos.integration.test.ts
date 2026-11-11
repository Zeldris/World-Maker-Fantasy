import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { testigosEnLugar } from './testigos.js';
import { ORCO_ENFURECIDO_QUEST_SLUG } from '../../routes/saves/quests.js';

// P375 (usuaria, 2026-11-10): solo cuentan como testigos los NPC visibles en la zona; Gistera Koh, con la
// misión del Orco aceptada, el juego la oculta al pintar y no puede ver nada.
describe('testigosEnLugar (P375)', () => {
  const saveIds: string[] = [];
  afterAll(async () => { await prisma.save.deleteMany({ where: { id: { in: saveIds } } }); });

  it('excluye al NPC cuyo ZonePoint oculta el juego por la misión aceptada', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const gistera = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'gistera-koh' } });
    const victima = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL', slug: { not: 'gistera-koh' } }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Testigos P375', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'V',
        currentLocationId: hondonada.id, zonaPosX: 200, zonaPosY: 200,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    await prisma.zonePoint.deleteMany({ where: { saveId: save.id, locationId: hondonada.id, tipo: 'NPC' } });
    await prisma.zonePoint.create({ data: { saveId: save.id, locationId: hondonada.id, tipo: 'NPC', targetSlug: gistera.slug, x: 400, y: 400 } });

    expect(await prisma.$transaction((tx) => testigosEnLugar(tx, save.id, worldId, hondonada.id, victima.id))).toEqual([gistera.id]);

    await prisma.quest.create({ data: { saveId: save.id, questSlug: ORCO_ENFURECIDO_QUEST_SLUG, title: 'Acabar con el Orco Enfurecido', description: 'x' } });
    expect(await prisma.$transaction((tx) => testigosEnLugar(tx, save.id, worldId, hondonada.id, victima.id))).toEqual([]);
  });

  it('excluye al PRINCIPAL ausente tras un combate ganado y lo cuenta de nuevo al pasar la ventana', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const gistera = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'gistera-koh' } });
    const victima = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL', slug: { not: 'gistera-koh' } }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Testigos ausente P375', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'V',
        currentLocationId: hondonada.id, zonaPosX: 200, zonaPosY: 200,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    await prisma.zonePoint.deleteMany({ where: { saveId: save.id, locationId: hondonada.id, tipo: 'NPC' } });
    await prisma.zonePoint.create({ data: { saveId: save.id, locationId: hondonada.id, tipo: 'NPC', targetSlug: gistera.slug, x: 400, y: 400 } });
    const testigos = () => prisma.$transaction((tx) => testigosEnLugar(tx, save.id, worldId, hondonada.id, victima.id));
    expect(await testigos()).toEqual([gistera.id]);

    // Derrotada en combate: ausente de la zona 6 h (hasta el minuto 840), sin cambiar de lugar.
    await prisma.npcState.create({ data: { saveId: save.id, npcId: gistera.id, scope: '', zonaLocationId: hondonada.id, zonaAusenteHastaMinutes: 840 } });
    expect(await testigos()).toEqual([]);

    await prisma.worldState.update({ where: { saveId: save.id }, data: { fictionalMinutes: 900 } });
    expect(await testigos()).toEqual([gistera.id]);
  });
});
