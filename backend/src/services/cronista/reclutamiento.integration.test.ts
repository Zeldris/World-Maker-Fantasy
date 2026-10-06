import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { procesarReacciones } from './reacciones.js';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import { actitudDe, proponer, revisarInformantes, tiradaDeCarisma } from './reclutamiento.js';

describe('reclutamiento (CR-32) — reglas puras', () => {
  it('la actitud sale de lo que siente y de la reputación con su facción', () => {
    expect(actitudDe(0, 2500)).toBe('INDIFERENTE');
    expect(actitudDe(5, 2500)).toBe('AMISTOSO');
    expect(actitudDe(0, 4500)).toBe('AMISTOSO');
    expect(actitudDe(-2, 500)).toBe('HOSTIL');
  });

  it('d20 + Carisma/2 + bono contra la dificultad', () => {
    const r = tiradaDeCarisma(14, -2, 15, () => 0.5);
    expect(r).toMatchObject({ roll: 11, result: 16, success: true, difficulty: 15 });
  });
});

describe('reclutamiento (CR-32) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const MIN = 7 * 1440 + 600;
  const siempre = () => 0.99;
  const nunca = () => 0;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 14, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: MIN, fictionalDateLabel: 'Día 8' } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    await procesarReacciones(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const candidato = async (salto = 0) => {
    const lideres = (await prisma.faction.findMany({ where: { saveId }, select: { liderNpcId: true } })).map((f) => f.liderNpcId).filter((x): x is string => !!x);
    return prisma.npc.findFirstOrThrow({ where: { worldId, saveId: null, kind: 'PRINCIPAL', faction: 'Clan Serhu', id: { notIn: lideres } }, orderBy: { slug: 'asc' }, skip: salto });
  };

  it('sin vivienda libre no hay a quién traer', async () => {
    const npc = await candidato();
    expect(await proponer(prisma, saveId, npc.slug, 'RECLUTAR', siempre)).toEqual({ ok: false, motivo: 'No tienes dónde alojar a nadie más en tu Reino.' });
  });

  it('si no le convence, le sienta mal y hoy no hay otra', async () => {
    const npc = await candidato();
    const r = await proponer(prisma, saveId, npc.slug, 'INFORMANTE', nunca);
    expect(r.ok && r.exito).toBe(false);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'RECLUTAMIENTO_FALLIDO' } })).toBe(1);
    expect(await proponer(prisma, saveId, npc.slug, 'INFORMANTE', siempre)).toMatchObject({ ok: false });
  });

  it('con vivienda libre y buena tirada se une: compañero nuevo y fuera del mapa', async () => {
    const receta = CONSTRUCTION_RECIPES.find((r) => (r.companionSlots ?? 0) > 0)!;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId } });
    await prisma.building.create({ data: { saveId, locationId: lugar.id, name: 'Casa', kind: 'casa', description: 'x', recipeKey: receta.key, status: 'ACTIVO' } });
    const npc = await candidato(1);
    const r = await proponer(prisma, saveId, npc.slug, 'RECLUTAR', siempre);
    expect(r.ok && r.exito && r.companionId).toBeTruthy();
    expect(await prisma.companion.count({ where: { saveId, sourceSlug: npc.slug, tipo: 'NPC' } })).toBe(1);
    expect(await prisma.zonePoint.count({ where: { saveId, targetSlug: npc.slug, activo: true } })).toBe(0);
  });

  it('un informante pasa noticias cada semana, o lo descubren y cae la reputación', async () => {
    const npc = await candidato(2);
    const r = await proponer(prisma, saveId, npc.slug, 'INFORMANTE', siempre);
    expect(r.ok && r.exito).toBe(true);
    await prisma.$transaction((tx) => revisarInformantes(tx, { saveId, worldId, dia: 7, random: () => 0.5 }));
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: `${npc.name} te hace` } } })).toBe(1);
    await prisma.$transaction((tx) => revisarInformantes(tx, { saveId, worldId, dia: 14, random: () => 0.05 }));
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'INFORMANTE_DESCUBIERTO' } })).toBe(1);
    expect((await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: '' } } })).informanteDesde).toBeNull();
  });
});
