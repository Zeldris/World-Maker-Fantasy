import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { avanzarGanadoReino } from './ganadoReino.js';

/// CR-55 (55d): un día del ganado del Reino con las reglas de la ronda (Q4, Q6, Q7, Q12, Q15).
const DIA = 14; // múltiplo de 7 (día de crías) y de 1, no de 3 (sin lana).
const AHORA = DIA * 1440 + 600;
const ADULTO = AHORA - 200 * 1440; // 200 días: Múrgol adulto.

describe('Avance diario del ganado del Reino (CR-55 55d)', () => {
  let saveId: string;
  let corralId: string;

  async function animal(sexo: 'M' | 'F', nacidoEn = ADULTO) {
    return prisma.ganado.create({ data: { saveId, buildingId: corralId, especie: 'murgol', sexo, nacidoEn } });
  }
  async function ganadero() {
    await prisma.companion.create({ data: { saveId, name: 'Ganadera', role: 'aliado', notes: '', tipo: 'NPC', rolReino: 'trabajador', buildingId: corralId } });
  }
  const stats = () => prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKeyFor({ saveId }) } });

  beforeEach(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Ganadera de prueba (CR-55 55d)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Serhu',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    })).id;
    await prisma.kingdomStats.create({ data: { ownerKey: ownerKeyFor({ saveId }), saveId, comida: 10, bebida: 30, forraje: 20 } });
    corralId = (await prisma.building.create({ data: { saveId, recipeKey: 'corrales', name: 'Corrales del Ganadero', kind: 'ganadero-orcos-llanuras', status: 'ACTIVO', description: 'x', tier: 1 } })).id;
  });

  afterEach(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('comen forraje y beben agua; con ganadero, la leche alimenta (4 de curaHambre por litro, 10 = 1 de comida)', async () => {
    for (let i = 0; i < 5; i++) await animal(i % 2 ? 'M' : 'F');
    await ganadero();
    const r = await avanzarGanadoReino(prisma, saveId, DIA, AHORA, () => 0.99);
    expect(r).toMatchObject({ comido: true, bebido: true, producido: { 'leche-murgol': 5 }, comidaDeLeche: 2 });
    const s = await stats();
    expect(s.forraje).toBe(15);
    expect(s.bebida).toBe(25);
    expect(s.comida).toBe(12);
  });

  it('sin ganadero no producen, pero crían (una cría por semana con pareja adulta)', async () => {
    await animal('M');
    await animal('F');
    const r = await avanzarGanadoReino(prisma, saveId, DIA, AHORA, () => 0.99);
    expect(r?.producido).toEqual({});
    expect(r?.crias).toBe(1);
    expect(await prisma.ganado.count({ where: { saveId } })).toBe(3);
  });

  it('la lana va al Almacén los días que toca', async () => {
    await animal('F');
    await ganadero();
    await avanzarGanadoReino(prisma, saveId, 15, 15 * 1440 + 600, () => 0.99);
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: 'lana-murgol' } })).toBe(1);
  });

  it('sin forraje no producen ni crían; al tercer día empiezan a morir, primero las crías', async () => {
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKeyFor({ saveId }) }, data: { forraje: 0, ganadoDiasSinComer: 2 } });
    await animal('M');
    await animal('F');
    const cria = await animal('F', AHORA - 5 * 1440);
    await ganadero();
    const r = await avanzarGanadoReino(prisma, saveId, DIA, AHORA, () => 0.99);
    expect(r).toMatchObject({ comido: false, producido: {}, crias: 0, muertos: 1 });
    expect(await prisma.ganado.findUnique({ where: { id: cria.id } })).toBeNull();
    expect((await stats()).ganadoDiasSinComer).toBe(3);
  });

  it('las Fibrerías dan 10 de forraje por trabajador', async () => {
    const fibreria = await prisma.building.create({ data: { saveId, recipeKey: 'fibreria', name: 'Fibrería', kind: 'fibreria', status: 'ACTIVO', description: 'x' } });
    await prisma.companion.create({ data: { saveId, name: 'Segadora', role: 'aliado', notes: '', tipo: 'NPC', rolReino: 'trabajador', buildingId: fibreria.id } });
    await avanzarGanadoReino(prisma, saveId, DIA, AHORA, () => 0.99);
    expect((await stats()).forraje).toBe(30);
  });
});
