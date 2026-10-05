import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { abrirCombateDePersonas, grupoDePersona } from './combatePersonas.js';

/// CR-49: atacar a una persona con los suyos cerca abre el combate de varios con todos.
describe('CR-49 — grupos de personas en combate', () => {
  let saveId: string;
  let worldId: string;
  let interiorId: string;
  const ATR = { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    interiorId = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-serhu-interior' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (grupo)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: ATR, portraitInitial: 'G', currentLocationId: interiorId, worldState: { create: { fictionalMinutes: 600 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const objetivo = async (slug: string) => prisma.npc.findFirstOrThrow({ where: { worldId, slug, saveId: null } });

  it('al atacar a Torgash se unen los del Clan Serhu cercanos (Ulkha entre ellos), como mucho 4 en total', async () => {
    const torgash = await objetivo('torgash-ketg');
    const grupo = await grupoDePersona(prisma, { saveId, worldId, locationId: interiorId, objetivo: torgash });
    expect(grupo[0]!.npcId).toBe(torgash.id);
    expect(grupo.length).toBeGreaterThan(1);
    expect(grupo.length).toBeLessThanOrEqual(4);
    const nombres = grupo.map((m) => m.nombre);
    expect(nombres).toContain('Ulkha Ketg');
  });

  it('una persona sin facción ni banda pelea sola', async () => {
    const renegado = await objetivo('goirnte-renegado');
    expect(await grupoDePersona(prisma, { saveId, worldId, locationId: interiorId, objetivo: renegado })).toHaveLength(1);
  });

  it('una banda (su punto con cantidad > 1) pelea entera, miembros de grupo', async () => {
    const renegado = await objetivo('goirnte-renegado');
    const punto = await prisma.zonePoint.create({ data: { saveId, locationId: interiorId, x: 100, y: 100, tipo: 'NPC', targetSlug: 'goirnte-renegado', cantidad: 3 } });
    const banda = await grupoDePersona(prisma, { saveId, worldId, locationId: interiorId, objetivo: renegado });
    expect(banda).toHaveLength(3);
    expect(banda.every((m) => m.esGrupo)).toBe(true);
    await prisma.zonePoint.delete({ where: { id: punto.id } });
  });

  it('abre el combate de varios con la jugadora y todo el grupo, y no abre otro encima', async () => {
    const torgash = await objetivo('torgash-ketg');
    const grupo = await grupoDePersona(prisma, { saveId, worldId, locationId: interiorId, objetivo: torgash });
    const save = { id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' };
    const abierto = await abrirCombateDePersonas(prisma, save, grupo);
    expect(abierto).not.toBeNull();
    const participantes = await prisma.combatParticipant.findMany({ where: { encounterId: abierto!.encounterId } });
    expect(participantes.filter((p) => p.bando === 'ENEMIGO')).toHaveLength(grupo.length);
    expect(participantes.some((p) => p.tipo === 'JUGADOR')).toBe(true);
    expect(await abrirCombateDePersonas(prisma, save, grupo)).toBeNull();
  });
});
