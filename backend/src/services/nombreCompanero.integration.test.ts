import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { nombreVisibleDeNpc, nombresVisiblesDeNpcs } from './dynamicMode.js';
import { conNombreVisible, buildNpcInScene, nombreNarrado } from './npcScene.js';

// P358: un compañero se nombra siempre por su nombre, aunque nunca se «descubriera» (antes: «la orca desconocida»).
describe('nombre de un compañero (P358)', () => {
  const saveIds: string[] = [];
  afterAll(async () => { await prisma.save.deleteMany({ where: { id: { in: saveIds } } }); });

  it('un PRINCIPAL sin descubrir se oculta, pero con Companion va por su nombre', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL', genero: 'F', raza: 'orcos' }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Compañero P358', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'V',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    const antes = await nombreVisibleDeNpc(prisma, save.id, npc);
    expect(antes).toEqual({ nombre: 'Orca desconocida', oculto: true });

    await prisma.companion.create({ data: { saveId: save.id, name: npc.name, role: 'x', notes: 'x', tipo: 'NPC', sourceSlug: npc.slug } });
    expect(await nombreVisibleDeNpc(prisma, save.id, npc)).toEqual({ nombre: npc.name, oculto: false });
    expect((await nombresVisiblesDeNpcs(prisma, save.id, [npc])).get(npc.slug)).toBe(npc.name);
    const [enEscena] = await conNombreVisible(prisma, save.id, [buildNpcInScene({ ...npc, items: [] } as never, undefined)]);
    expect(nombreNarrado(enEscena!)).toBe(npc.name);
  });
});
