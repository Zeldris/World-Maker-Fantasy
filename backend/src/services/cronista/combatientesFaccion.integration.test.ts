import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { atributosMedios, combatientesDeFaccion } from './combatientesFaccion.js';

/// CR-62 (62b, Q3): los combatientes de una facción, sus guerreros con nombre y soldados genéricos.
describe('combatientes de una facción (CR-62 62b)', () => {
  let saveId: string;
  let worldId: string;
  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'x', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'X',
        worldState: { create: { fictionalMinutes: 0 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('los Serhu ponen primero a sus guerreros con nombre (el de más nivel lidera) y completan con soldados genéricos armados', async () => {
    const serhu = { slug: 'clan-serhu', name: 'Clan Serhu', raza: 'orcos', soldados: 208, sinArma: 0 };
    const cs = await prisma.$transaction((tx) => combatientesDeFaccion(tx, { saveId, worldId }, serhu, 12, 'A'));
    expect(cs).toHaveLength(12);
    const conNombre = cs.filter((c) => c.conNombre);
    expect(conNombre.length).toBeGreaterThan(0);
    expect(cs[0]!.lider).toBe(true);
    const genericos = cs.filter((c) => !c.conNombre);
    expect(genericos.length).toBe(12 - conNombre.length);
    for (const g of genericos) expect(g).toMatchObject({ nivel: 3, attributeBonus: 1, conMoral: true, bando: 'A' });
  });

  it('una facción sin guerreros con nombre pelea solo con genéricos; sin armas, sin bono', async () => {
    const cs = await prisma.$transaction((tx) => combatientesDeFaccion(tx, { saveId, worldId }, { slug: 'x', name: 'Nadie', raza: 'faerus', soldados: 5, sinArma: 5 }, 3, 'B'));
    expect(cs.every((c) => !c.conNombre && c.attributeBonus === 0)).toBe(true);
  });

  it('atributos medios', () => {
    expect(atributosMedios([])).toMatchObject({ fuerza: 10 });
    const b = (v: number) => ({ fuerza: v, destreza: v, constitucion: v, inteligencia: v, voluntad: v, carisma: v, magia: 0 });
    expect(atributosMedios([b(8), b(12)])).toMatchObject({ fuerza: 10, magia: 0 });
  });
});
