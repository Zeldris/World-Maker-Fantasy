import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ayudarNpc, FACTION_REP_AYUDA_DELTA } from './ayudarNpc.js';
import { factionRepFor } from './reputation.js';

// CR-12 paso 12d (hito 0.2) — «Ayudar» a un malherido: pasa a HERIDO, su facción lo agradece y el
// Libro lo registra. Una segunda vez ya no se puede (ya no está malherido).
describe('ayudar a un malherido (CR-12)', () => {
  const saveIds: string[] = [];
  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('atiende al soldado malherido de un campo de batalla', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const soldado = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'guardia-serhu' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Ayuda (CR-12)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'A',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600 } },
      },
    });
    saveIds.push(save.id);
    await prisma.npcState.create({ data: { saveId: save.id, npcId: soldado.id, scope: lugar.id, condicionFisica: 'GRAVE' } });

    const entrada = await ayudarNpc(prisma, save.id, soldado.slug);
    expect(entrada?.text).toContain(soldado.name);
    expect((await prisma.npcState.findFirstOrThrow({ where: { saveId: save.id, npcId: soldado.id } })).condicionFisica).toBe('HERIDO');
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId: save.id } });
    expect((ws.factionsStatus as Record<string, number>)['Clan Serhu']).toBe(factionRepFor({}, 'Clan Serhu') + FACTION_REP_AYUDA_DELTA);
    expect(await prisma.suceso.count({ where: { saveId: save.id, tipo: 'AYUDA_PRESTADA' } })).toBe(1);

    expect(await ayudarNpc(prisma, save.id, soldado.slug)).toBeNull();
  });
});
