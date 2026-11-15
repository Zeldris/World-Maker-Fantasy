import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { iniciarCombatEncounter, resolverTurnoAutonomo } from '../../services/combateMultipleOrquestacion.js';

/// P328/P107 (decisión de la usuaria, 2026-11-11): al ACABAR un combate el NPC queda descubierto (su ficha del mapa
/// deja de ser «???»). Abrirlo no lo descubre (P327).
describe('combate: acabarlo descubre al NPC', () => {
  let saveId: string;
  let worldId: string;
  const slugA = 'aullador-rojo';
  const slugB = 'corredor-de-cauce';

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (descubre al acabar)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('empezar no descubre; al terminar el encuentro, los NPC que pelearon quedan DESCUBIERTO', async () => {
    const [a, b] = await Promise.all([prisma.npc.findFirstOrThrow({ where: { worldId, slug: slugA } }), prisma.npc.findFirstOrThrow({ where: { worldId, slug: slugB } })]);
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'NPC', npcId: a.id, npcScope: 'itinerante', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: b.id, npcScope: 'itinerante', destreza: 12, inteligencia: 4 },
      ]),
    );
    expect(await prisma.discoveredEntity.count({ where: { saveId, entitySlug: { in: [slugA, slugB] }, fase: 'DESCUBIERTO' } })).toBe(0);

    let terminado = false;
    for (let i = 0; i < 400 && !terminado; i++) {
      const r = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: async () => 'Narración de prueba.' });
      if (r?.encounterTerminado) terminado = true;
    }
    expect(terminado).toBe(true);

    const descubiertos = await prisma.discoveredEntity.findMany({ where: { saveId, fase: 'DESCUBIERTO' } });
    expect(descubiertos.map((d) => d.entitySlug).sort()).toEqual([slugA, slugB].sort());
  });
});
