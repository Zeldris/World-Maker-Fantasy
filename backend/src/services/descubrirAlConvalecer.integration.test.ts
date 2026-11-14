import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { applyCombatExchangeToNpcState } from './turnLootKill.js';
import { escribirCondicionYEnergia, type ParticipantRef } from './combateMultipleOrquestacion.js';
import type { NpcInScene } from './npcScene.js';

/// P460: ganarle a un NPC (dejarlo CONVALECIENTE) lo descubre en ese momento, no al cerrar el combate: la tarjeta de
/// convaleciente, Clemente y la deuda lo llaman por su nombre real.
describe('P460: dejar CONVALECIENTE descubre al NPC', () => {
  let saveId: string;
  let worldId: string;
  let npc: { id: string; slug: string; kind: 'PRINCIPAL' | 'PLANTILLA' | 'INSTANCIA' | string };
  const slug = 'orco-enfurecido-hondonada';
  const descubierto = async () => (await prisma.discoveredEntity.findFirst({ where: { saveId, entitySlug: slug } }))?.fase ?? null;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    npc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug } });
    const save = await prisma.save.create({
      data: {
        userId, worldId, characterName: 'Gorhorn de prueba (P460 descubrir)', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('1v1 clásico: un golpe que deja CONVALECIENTE lo descubre; uno que lo deja HERIDO, no', async () => {
    const objetivo = { ...npc, groupSize: null, groupDefeated: 0, abilityUsesThisEncounter: {}, name: 'Orco enfurecido', raza: null, faction: null, articulo: null } as unknown as NpcInScene;
    const base = {
      npcAttackTarget: objetivo, npcNuevaEnergia: null, npcAttackHits: true, analizarRivalExito: false, abilityNamesToIncrement: [], npcActiveEffectsNext: [],
      saveId, worldId, currentLocationId: null, nuevoFictionalMinutes: 500, nuevaFictionalDateLabel: 'Día 1, mañana', activeRegion: null,
    };
    await prisma.$transaction((tx) => applyCombatExchangeToNpcState({ tx, ...base, npcTargetNewCondicion: 'HERIDO' }));
    expect(await descubierto()).toBeNull();
    await prisma.$transaction((tx) => applyCombatExchangeToNpcState({ tx, ...base, npcTargetNewCondicion: 'CONVALECIENTE' }));
    expect(await descubierto()).toBe('DESCUBIERTO');
  });

  it('combate de grupo/encuentro: escribir CONVALECIENTE a un participante NPC lo descubre; HERIDO no', async () => {
    await prisma.discoveredEntity.deleteMany({ where: { saveId } });
    const encuentro = await prisma.combatEncounter.create({ data: { saveId } });
    const p = await prisma.combatParticipant.create({ data: { encounterId: encuentro.id, bando: 'ENEMIGO', tipo: 'NPC', npcId: npc.id, npcScope: 'p460', condicionFisicaGrupo: 'ILESO' } });
    const ref = p as unknown as ParticipantRef;
    const escribir = (condicionFisica: 'HERIDO' | 'CONVALECIENTE') =>
      prisma.$transaction((tx) => escribirCondicionYEnergia({ tx, saveId, participant: ref, condicionFisica, energia: null, abilityNameUsada: null, usageCounts: {}, activeEffectsNext: null }));
    await escribir('HERIDO');
    expect(await descubierto()).toBeNull();
    await escribir('CONVALECIENTE');
    expect(await descubierto()).toBe('DESCUBIERTO');
    await prisma.combatEncounter.delete({ where: { id: encuentro.id } });
  });
});
