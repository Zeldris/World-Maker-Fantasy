import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { guardarSlugsDeCombate } from './combateDesde.js';

/// P327/P460 (revisión del bloque): un NPC nombrado un solo turno por el LLM (entra y sale de `pendingCombatNpcSlugs`)
/// no queda DESCUBIERTO sin combate; sí cuando hubo intercambio real.
describe('guardarSlugsDeCombate: descubrir solo con combate real', () => {
  const slug = 'orco-enfurecido-hondonada';
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    npcId = (await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug } })).id;
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'Gorhorn de prueba (combateDesde)', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('nombrado un turno y sin combate: sale de la lista y no se descubre', async () => {
    await guardarSlugsDeCombate(prisma, saveId, [slug]);
    await guardarSlugsDeCombate(prisma, saveId, []);
    expect(await prisma.discoveredEntity.count({ where: { saveId, entitySlug: slug } })).toBe(0);
  });

  it('con intercambio real (queda herido) al salir de la lista, se descubre', async () => {
    await guardarSlugsDeCombate(prisma, saveId, [slug]);
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'HERIDO' } });
    await guardarSlugsDeCombate(prisma, saveId, []);
    expect(await prisma.discoveredEntity.count({ where: { saveId, entitySlug: slug, fase: 'DESCUBIERTO' } })).toBe(1);
  });
});
