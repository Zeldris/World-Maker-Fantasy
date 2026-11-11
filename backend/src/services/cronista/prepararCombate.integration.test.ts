import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { detailRoutes } from '../../routes/saves/detail.js';
import { scopeFor } from '../npcScene.js';
import { abrirCombateDePreparacion } from './prepararCombate.js';

// P374: el paso `combate:<npc>` de `prepararReino.ts` contra una partida real. Con el Guchapo ya MUERTO de un combate
// anterior, el paso abría un encuentro nuevo con él dentro y `GET /saves/:id` lo devolvía «MUERTO» en
// `combateIniciado`: el panel salía con «¡Victoria!» de entrada, sin nada que jugar. Ahora el paso se niega, con el
// motivo, como `combate1v1`.
describe('abrirCombateDePreparacion (P374)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 15, destreza: 10, constitucion: 12, inteligencia: 8, voluntad: 8, carisma: 8, magia: 4 }, portraitInitial: 'Q',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return { saveId: save.id, locationId: lugar.id };
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('con el Guchapo vivo abre el combate y GET /saves/:id lo devuelve en pie', async () => {
    const { saveId } = await partida('Combate preparado vivo (P374)');
    expect(await abrirCombateDePreparacion(prisma, { saveId, npcSlugs: ['guchapo'] })).toMatchObject({ rivales: [{ nombre: expect.any(String) }] });
    const detalle = Fastify();
    await detalle.register(detailRoutes);
    const res = await detalle.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(res.json().combateIniciado.npcs).toEqual([expect.objectContaining({ slug: 'guchapo', condicionFisica: 'ILESO' })]);
  }, 30_000);

  it.each(['MUERTO', 'CONVALECIENTE'] as const)('con el Guchapo %s de un combate anterior se niega y no abre un encuentro', async (condicion) => {
    const { saveId, locationId } = await partida(`Combate preparado ${condicion} (P374)`);
    const guchapo = await prisma.npc.findFirstOrThrow({ where: { slug: 'guchapo', saveId: null } });
    const scope = scopeFor(guchapo.kind, locationId);
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: guchapo.id, scope } },
      create: { saveId, npcId: guchapo.id, scope, condicionFisica: condicion },
      update: { condicionFisica: condicion },
    });
    expect(await abrirCombateDePreparacion(prisma, { saveId, npcSlugs: ['guchapo'] })).toEqual({ error: `combate: ${guchapo.name} está ${condicion} aquí; el paso no mete en combate a un NPC caído, aunque su grupo tenga otros en pie.` });
    expect(await prisma.combatEncounter.count({ where: { saveId, estado: 'EN_CURSO' } })).toBe(0);
  }, 30_000);
});
