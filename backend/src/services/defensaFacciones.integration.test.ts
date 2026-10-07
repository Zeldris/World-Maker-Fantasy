import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarDefensasDeFacciones, coberturaDeFaccion, escalonInicialEmpalizada, reforzarDefensaFaccion } from './defensaFacciones.js';

/// CR-65 (65e, Q8): las facciones arrancan con Empalizada según su tamaño y la refuerzan al ser
/// asaltadas si les sobra comida (X4).
describe('defensa de las facciones (CR-65 65e)', () => {
  let saveId: string;
  let faccionId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const casa = (await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } })).id;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Observadora (CR-65e)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O' },
    })).id;
    faccionId = (await prisma.faction.create({
      data: {
        worldId: world.id, saveId, slug: 'clan-prueba-65e', name: 'Clan de Prueba', raza: 'orcos', description: 'x', origenSlug: 'clan-prueba',
        kingdomStats: { create: { ownerKey: `faccion-65e-${saveId}`, poblacion: 70, soldados: 10, comida: 2000, riqueza: 100 } },
        buildings: { create: { saveId: null, locationId: casa, recipeKey: 'cocina-serhu', name: 'Cocina', kind: 'cocina', description: 'x', status: 'ACTIVO' } },
      },
    })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('escalón inicial por tamaño', () => {
    expect([10, 60, 199, 200].map(escalonInicialEmpalizada)).toEqual([1, 2, 2, 3]);
  });

  it('levanta su Empalizada una sola vez; la refuerza si le llega y la repara si cae', async () => {
    expect(await prisma.$transaction((tx) => asegurarDefensasDeFacciones(tx, saveId))).toBe(1);
    expect(await prisma.$transaction((tx) => asegurarDefensasDeFacciones(tx, saveId))).toBe(0);
    const e = await prisma.building.findFirstOrThrow({ where: { factionId: faccionId, recipeKey: 'empalizada' } });
    expect(e).toMatchObject({ tier: 2, name: 'un muro de piedra' });
    expect(await prisma.$transaction((tx) => coberturaDeFaccion(tx, faccionId))).toBe(2);
    // 100 Goirnos no llegan a la Muralla (300): sin caer, nada.
    expect(await prisma.$transaction((tx) => reforzarDefensaFaccion(tx, faccionId))).toBeNull();
    await prisma.building.update({ where: { id: e.id }, data: { caida: true, golpesDefensa: 2 } });
    expect(await prisma.$transaction((tx) => coberturaDeFaccion(tx, faccionId))).toBe(0);
    expect(await prisma.$transaction((tx) => reforzarDefensaFaccion(tx, faccionId))).toBe('reparada');
    await prisma.kingdomStats.updateMany({ where: { factionId: faccionId }, data: { riqueza: 400 } });
    expect(await prisma.$transaction((tx) => reforzarDefensaFaccion(tx, faccionId))).toBe('reforzada');
    expect(await prisma.building.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ tier: 3, name: 'una muralla' });
    expect(await prisma.$transaction((tx) => coberturaDeFaccion(tx, faccionId))).toBe(5);
    // Sin reserva de comida no se arriesga.
    await prisma.kingdomStats.updateMany({ where: { factionId: faccionId }, data: { comida: 0 } });
    await prisma.building.update({ where: { id: e.id }, data: { caida: true } });
    expect(await prisma.$transaction((tx) => reforzarDefensaFaccion(tx, faccionId))).toBeNull();
  });
});
