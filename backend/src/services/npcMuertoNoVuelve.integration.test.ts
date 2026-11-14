import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { applyCombatExchangeToNpcState } from './turnLootKill.js';
import { advanceCorpseAndRecoveryTimeouts } from './companionSupervivencia.js';
import { npcVivoEnPartida } from './mundoPartida.js';
import { zonePointNpcMuertoParaSiempre } from './zonePoints.js';
import type { NpcInScene } from './npcScene.js';

/// P461: un NPC con nombre (PRINCIPAL) rematado y con el cadáver ya desaparecido sigue muerto: conserva su
/// NpcState (muerto) y no vuelve a contar como vivo ni a generar su punto hostil.
describe('P461: muerto es muerto para un NPC con nombre', () => {
  const DIA = 24 * 60;
  let saveId: string;
  let worldId: string;
  let npc: { id: string; slug: string; kind: string };
  const slug = 'orco-enfurecido-hondonada';

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    npc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug } });
    const save = await prisma.save.create({
      data: {
        userId, worldId, characterName: 'Gorhorn de prueba (P461)', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 100 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('tras rematarlo y desaparecer el cadaver (2+ dias) sigue muerto, con NpcState y fuera de escena', async () => {
    expect(npc.kind).toBe('PRINCIPAL');
    const objetivo = { ...npc, groupSize: null, groupDefeated: 0, abilityUsesThisEncounter: {}, name: 'Orco enfurecido', raza: null, faction: null, articulo: null } as unknown as NpcInScene;
    await prisma.$transaction((tx) => applyCombatExchangeToNpcState({
      tx, npcAttackTarget: objetivo, npcNuevaEnergia: null, npcAttackHits: true, analizarRivalExito: false, abilityNamesToIncrement: [], npcActiveEffectsNext: [],
      saveId, worldId, currentLocationId: null, nuevoFictionalMinutes: 100, nuevaFictionalDateLabel: 'Día 1', activeRegion: null, npcTargetNewCondicion: 'MUERTO',
    }));
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 100 + 2 * DIA + 10 } });
    await advanceCorpseAndRecoveryTimeouts(prisma);
    await advanceCorpseAndRecoveryTimeouts(prisma); // un segundo barrido no cambia nada ni repite el suceso

    const estado = await prisma.npcState.findFirst({ where: { saveId, npcId: npc.id, scope: '' } });
    expect(estado).not.toBeNull();
    expect(estado!.muerto).toBe(true);
    expect(estado!.condicionFisica).toBe('MUERTO');
    expect(zonePointNpcMuertoParaSiempre(npc.kind, estado!.condicionFisica)).toBe(true);
    expect(await prisma.npc.count({ where: { id: npc.id, ...npcVivoEnPartida(saveId) } })).toBe(0);
    const sucesos = await prisma.sucesoActor.count({ where: { entidadId: npc.id, suceso: { saveId, tipo: 'CADAVER_DESAPARECE' } } });
    expect(sucesos).toBe(1);
  });
});
