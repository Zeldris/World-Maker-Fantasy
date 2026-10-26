import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { retirarFaccionesHuerfanas, retirarLugaresHuerfanos, retirarNpcsHuerfanos } from './retirarHuerfanos.js';

/// QA-256 (2026-10-26): el seed retira lugares, facciones y NPC que salen del catálogo, pero solo si ninguna partida
/// los referencia. Mundo propio del test: no toca el catálogo real.
describe('retirar lo huérfano del catálogo (Postgres real)', () => {
  let worldId: string;
  let saveId: string;
  const ATTR = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

  beforeAll(async () => {
    const world = await prisma.world.create({
      data: { slug: `test-retirar-${Date.now()}`, name: 'Mundo de prueba', tagline: 'x', synopsis: 'x', tone: 'x', lethality: 'MEDIA', theme: {} },
    });
    worldId = world.id;
    const lugar = (slug: string) => ({ worldId, slug, name: slug, region: 'r', kind: 'asentamiento', description: 'x', aliases: [] });
    const vivo = await prisma.location.create({ data: lugar('vivo') });
    await prisma.location.create({ data: lugar('huerfano-libre') });
    const conPartida = await prisma.location.create({ data: lugar('huerfano-con-visita') });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Partida retiro', characterArchetype: 'guerrero',
        characterOrigin: 'x', characterMotivation: 'x', attributes: ATTR, portraitInitial: 'P', currentLocationId: vivo.id,
      },
    });
    saveId = save.id;
    await prisma.locationVisit.create({ data: { saveId, locationId: conPartida.id } });
    // Un punto de zona de plantilla cuelga del huérfano libre: es del mundo y se va con él.
    const libre = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'huerfano-libre' } });
    await prisma.zonePoint.create({ data: { locationId: libre.id, saveId: null, x: 1, y: 1, origenX: 1, origenY: 1, tipo: 'RECURSO', targetSlug: 'x' } });

    await prisma.faction.create({ data: { worldId, slug: 'faccion-viva', name: 'Viva', raza: 'x', description: 'x' } });
    await prisma.faction.create({ data: { worldId, slug: 'faccion-huerfana', name: 'Huérfana', raza: 'x', description: 'x' } });
    const conReino = await prisma.faction.create({ data: { worldId, slug: 'faccion-con-reino', name: 'Con reino', raza: 'x', description: 'x' } });
    await prisma.territory.create({ data: { saveId, factionId: conReino.id, name: 't', description: 'x' } });

    const npc = (slug: string) => ({ worldId, kind: 'PRINCIPAL' as const, slug, name: slug, role: 'x', level: 1, attributes: ATTR, bio: 'x', personality: 'x' });
    await prisma.npc.create({ data: npc('npc-vivo') });
    await prisma.npc.create({ data: npc('npc-huerfano') });
    const conEstado = await prisma.npc.create({ data: npc('npc-con-estado') });
    await prisma.npcState.create({ data: { saveId, npcId: conEstado.id } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.world.delete({ where: { id: worldId } });
  });

  it('retira el lugar sin referencias (y su punto de plantilla) y conserva el que tiene una visita', async () => {
    const r = await retirarLugaresHuerfanos(prisma, worldId, ['vivo']);
    expect(r.retirados).toEqual(['huerfano-libre']);
    expect(r.conservados).toEqual([{ slug: 'huerfano-con-visita', motivo: '1 visita(s)' }]);
    expect(await prisma.location.count({ where: { worldId } })).toBe(2);
    expect(await prisma.zonePoint.count({ where: { location: { worldId } } })).toBe(0);
  });

  it('retira la facción sin referencias y conserva la que tiene territorio de partida', async () => {
    const r = await retirarFaccionesHuerfanas(prisma, worldId, ['faccion-viva']);
    expect(r.retirados).toEqual(['faccion-huerfana']);
    expect(r.conservados.map((c) => c.slug)).toEqual(['faccion-con-reino']);
    expect(r.conservados[0].motivo).toContain('territorio');
  });

  it('retira el NPC sin referencias y conserva el que tiene estado de partida', async () => {
    const r = await retirarNpcsHuerfanos(prisma, worldId, ['npc-vivo']);
    expect(r.retirados).toEqual(['npc-huerfano']);
    expect(r.conservados).toEqual([{ slug: 'npc-con-estado', motivo: '1 estado(s) de partida' }]);
  });
});
