import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { sincronizarObjetosDeCatalogo } from './itemCatalogSync.js';

/// Fase B (plan 0.1) — partida "antigua" con copias de objetos previas al rebalanceo del
/// 2026-09-29. Requiere `seed-catalog` ya corrido (catálogo actual en la BD).
describe('sincronizarObjetosDeCatalogo (Postgres real)', () => {
  let saveId: string;
  let petoId: string;
  let tocadoId: string;
  let libreId: string;
  let almacenId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const userId = await getDefaultUserId();
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Partida antigua sync',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    const peto = await prisma.inventoryItem.create({
      data: { saveId, name: 'Peto de placas óseas de gargantúa', description: 'x', origin: 'crafteo', catalogSlug: 'peto-placas-gargantua', statBonuses: { constitucion: 3, voluntad: 2, carisma: 2 }, slot: 'ARMADURA_SUPERIOR' },
    });
    petoId = peto.id;
    const tocado = await prisma.inventoryItem.create({
      data: { saveId, name: 'Tocado de plumas', description: 'x', catalogSlug: 'tocado-plumas', statBonuses: { carisma: 2 }, slot: 'CASCO' },
    });
    tocadoId = tocado.id;
    const libre = await prisma.inventoryItem.create({
      data: { saveId, name: 'Objeto narrativo suelto', description: 'x', statBonuses: { fuerza: 9 }, slot: 'CASCO' },
    });
    libreId = libre.id;
    const almacen = await prisma.almacenItem.create({
      data: { saveId, name: 'Peto de placas óseas de gargantúa', description: 'x', catalogSlug: 'peto-placas-gargantua', statBonuses: { constitucion: 6 } },
    });
    almacenId = almacen.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } }); // cascada: inventario y almacén
  });

  it('actualiza el peto, desequipa el tocado sin borrarlo, no toca lo que no tiene catalogSlug, y es idempotente', async () => {
    const r1 = await sincronizarObjetosDeCatalogo(prisma, { tamanoLote: 2 });
    expect(r1.inventarioActualizados).toBeGreaterThanOrEqual(1);
    expect(r1.inventarioDesequipados).toBeGreaterThanOrEqual(1);
    expect(r1.almacenActualizados).toBeGreaterThanOrEqual(1);

    const peto = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: petoId } });
    expect(peto.statBonuses).toEqual({ fuerza: 3, constitucion: 4 });
    expect(peto.slot).toBe('ARMADURA_SUPERIOR'); // sigue equipado: su ranura es válida

    const tocado = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: tocadoId } });
    expect(tocado.slot).toBeNull();
    expect(tocado.saveId).toBe(saveId); // sigue siendo suyo
    expect(tocado.statBonuses).toEqual({ carisma: 2 });

    const libre = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: libreId } });
    expect(libre.slot).toBe('CASCO');
    expect(libre.statBonuses).toEqual({ fuerza: 9 });

    const almacen = await prisma.almacenItem.findUniqueOrThrow({ where: { id: almacenId } });
    expect(almacen.statBonuses).toEqual({ fuerza: 3, constitucion: 4 });

    const r2 = await sincronizarObjetosDeCatalogo(prisma);
    expect(r2.inventarioActualizados).toBe(0);
    expect(r2.inventarioDesequipados).toBe(0);
    expect(r2.almacenActualizados).toBe(0);
  });
});
