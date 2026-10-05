import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { avanzarExpedicionesDePartida, REINTENTO_EXPEDICION_DIAS } from './factionExpeditions.js';

/// CR-48: una facción que no puede lanzar expedición espera unos días antes de volver a intentarlo.
describe('CR-48 — espera de reintento de expediciones', () => {
  let saveId: string;
  let worldId: string;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Reintento', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 }, portraitInitial: 'R',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('quien no lanza queda en espera unos días; quien lanza, no', async () => {
    await avanzarExpedicionesDePartida(prisma, worldId, saveId, 0); // línea base
    await avanzarExpedicionesDePartida(prisma, worldId, saveId, 1, () => 0.5);
    const stats = await prisma.kingdomStats.findMany({ where: { faction: { saveId } }, select: { factionId: true, expedicionReintentoDia: true } });
    const conExpedicion = new Set((await prisma.expedicion.findMany({ where: { saveId }, select: { factionId: true } })).map((e) => e.factionId));
    for (const s of stats) {
      if (conExpedicion.has(s.factionId!)) expect(s.expedicionReintentoDia).toBeNull();
      else expect(s.expedicionReintentoDia).toBe(1 + REINTENTO_EXPEDICION_DIAS);
    }
  });

  it('mientras espera no lo intenta: con la espera puesta, no sale ninguna expedición nueva', async () => {
    await prisma.expedicion.deleteMany({ where: { saveId } });
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId } }, data: { expedicionReintentoDia: 99 } });
    await avanzarExpedicionesDePartida(prisma, worldId, saveId, 2, () => 0.5);
    expect(await prisma.expedicion.count({ where: { saveId } })).toBe(0);
  });
});
