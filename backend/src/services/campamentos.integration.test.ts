import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { campamentosActivos, revisarCampamentos } from './campamentos.js';
import { regionesConCampamentos } from './cronista/campamentosBandidos.js';

function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/// CR-50 (50a): aparición y refuerzos de los campamentos de bandidos.
describe('campamentos de bandidos (CR-50 50a)', () => {
  let saveId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Observadora (CR-50)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O' },
    })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('nada antes del día 10; el 10, uno por región con ocupantes y sitio, con su punto de banda', async () => {
    const random = semilla(4);
    expect(await revisarCampamentos(prisma, saveId, 9, random)).toBe(0);
    const n = await revisarCampamentos(prisma, saveId, 10, random);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(regionesConCampamentos().length);
    expect(await revisarCampamentos(prisma, saveId, 11, random)).toBe(0);
    const activos = await prisma.$transaction((tx) => campamentosActivos(tx, saveId));
    expect(new Set(activos.map((c) => c.region)).size).toBe(activos.length);
    const c = activos[0]!;
    expect(c.gente).toBeGreaterThanOrEqual(6);
    const punto = await prisma.zonePoint.findUniqueOrThrow({ where: { id: c.zonePointId! } });
    expect(punto).toMatchObject({ tipo: 'NPC', targetSlug: c.npcSlug, cantidad: c.gente + 1, locationId: c.locationId, saveId });
    // Nunca en un asentamiento.
    expect(await prisma.zonePoint.count({ where: { locationId: c.locationId, tipo: 'EDIFICIO', OR: [{ saveId: null }, { saveId }] } })).toBe(0);
  });

  it('refuerzos cada 3 días hasta su tope; destruido, se rehace a los 20 días en otro sitio', async () => {
    const c = (await prisma.$transaction((tx) => campamentosActivos(tx, saveId)))[0]!;
    await prisma.campamento.update({ where: { id: c.id }, data: { gente: 2, ultimoRefuerzoDia: 11 } });
    await revisarCampamentos(prisma, saveId, 17, semilla(1));
    const reforzado = await prisma.campamento.findUniqueOrThrow({ where: { id: c.id } });
    expect(reforzado.gente).toBe(4);
    expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: c.zonePointId! } })).cantidad).toBe(5);
    await prisma.campamento.update({ where: { id: c.id }, data: { estado: 'DESTRUIDO', caidoDia: 18 } });
    await revisarCampamentos(prisma, saveId, 37, semilla(2));
    expect(await prisma.campamento.count({ where: { saveId, region: c.region, estado: 'ACTIVO' } })).toBe(0);
    await revisarCampamentos(prisma, saveId, 38, semilla(2));
    const nuevo = await prisma.campamento.findFirstOrThrow({ where: { saveId, region: c.region, estado: 'ACTIVO' } });
    expect(nuevo.creadoDia).toBe(38);
  });
});
