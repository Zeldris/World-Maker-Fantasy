import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { restartSaveTransactionBody, withCatalogStatBonuses, VALID_ATTRIBUTES } from './shared.js';

/// Cobertura directa del helper (deuda técnica cerrada, auditoría de seguimiento 2026-09-07 —
/// "shared.ts sin ningún test propio pese a contener restartSaveTransactionBody, el borrado+
/// reconstrucción completo de 'volver a Día 1'"): `restartSaveTransactionBody` y
/// `withCatalogStatBonuses` ya se ejercían indirectamente vía POST /saves/:id/restart
/// (creation.integration.test.ts) y POST /saves/:id/death/resolve, pero ninguna prueba fijaba el
/// comportamiento de los helpers en sí — este archivo los llama directamente, contra Postgres real
/// (igual que el resto del proyecto: montar ~20 tablas relacionadas no es mockeable de forma útil).
describe('VALID_ATTRIBUTES', () => {
  it('son exactamente los 7 atributos del juego, sin duplicados', () => {
    expect(VALID_ATTRIBUTES).toEqual(['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'magia']);
    expect(new Set(VALID_ATTRIBUTES).size).toBe(VALID_ATTRIBUTES.length);
  });
});

describe('withCatalogStatBonuses', () => {
  it('copia statBonuses del catálogo cuando el kit inicial no trae ya el suyo propio', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const catalogItem = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId: world.id, NOT: { statBonuses: { equals: Prisma.JsonNull } } } });

    const result = await prisma.$transaction((tx) =>
      withCatalogStatBonuses(tx, world.id, [{ name: catalogItem.name, description: 'x', origin: 'x', catalogSlug: catalogItem.slug }]),
    );

    expect(result[0]?.statBonuses).toEqual(catalogItem.statBonuses);
  });

  it('no toca un item que ya trae su propio statBonuses (no lo sobreescribe con el del catálogo)', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const catalogItem = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId: world.id, NOT: { statBonuses: { equals: Prisma.JsonNull } } } });
    const bonusPropio = { fuerza: 999 };

    const result = await prisma.$transaction((tx) =>
      withCatalogStatBonuses(tx, world.id, [{ name: catalogItem.name, description: 'x', origin: 'x', catalogSlug: catalogItem.slug, statBonuses: bonusPropio }]),
    );

    expect(result[0]?.statBonuses).toEqual(bonusPropio);
  });

  it('un item sin catalogSlug pasa intacto, sin buscar nada en el catálogo', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });

    const result = await prisma.$transaction((tx) => withCatalogStatBonuses(tx, world.id, [{ name: 'Objeto suelto', description: 'x', origin: 'x' }]));

    expect(result).toEqual([{ name: 'Objeto suelto', description: 'x', origin: 'x' }]);
  });

  it('caso borde: catalogSlug que no existe en el catálogo del mundo — el item pasa sin statBonuses, sin lanzar', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });

    const result = await prisma.$transaction((tx) =>
      withCatalogStatBonuses(tx, world.id, [{ name: 'Objeto fantasma', description: 'x', origin: 'x', catalogSlug: 'este-slug-no-existe-en-el-catalogo' }]),
    );

    expect(result[0]?.statBonuses).toBeUndefined();
  });

  it('lista vacía devuelve lista vacía sin consultar el catálogo', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const result = await prisma.$transaction((tx) => withCatalogStatBonuses(tx, world.id, []));
    expect(result).toEqual([]);
  });
});

describe('restartSaveTransactionBody', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        // Nombre EXACTO 'Gorhorn' — initialLocationSlugFor (travel.ts) compara con === estricto,
        // "Gorhorn de prueba (...)" no resolvería nunca la Location inicial.
        characterName: 'Gorhorn',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        level: 5,
        xp: 500,
        pendingAttributePoints: 3,
        kingdomName: 'Reino de prueba',
        condicionFisica: 'HERIDO',
        deathCount: 2,
        pendingDeathResolution: true,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.inventoryItem.create({ data: { saveId, name: 'Objeto de la partida vieja', description: 'x' } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('borra el progreso acumulado y reconstruye el Día 1 real, con Gorhorn resolviendo su Location inicial', async () => {
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });

    await prisma.$transaction((tx) =>
      restartSaveTransactionBody(
        tx,
        { id: save.id, worldId: save.worldId, characterName: save.characterName, raza: save.raza, clase: save.clase, attributes: save.attributes },
        'Texto de personaje',
        'Texto de mundo',
      ),
    );

    const restarted = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, include: { currentLocation: true } });
    expect(restarted.level).toBe(1);
    expect(restarted.xp).toBe(0);
    expect(restarted.pendingAttributePoints).toBe(0);
    expect(restarted.kingdomName).toBeNull();
    expect(restarted.condicionFisica).toBe('ILESO');
    expect(restarted.deathCount).toBe(0);
    expect(restarted.pendingDeathResolution).toBe(false);
    // Caso real (no borde): Gorhorn SÍ resuelve `initialLocationSlugFor` — confirma que la
    // Location inicial se fija de verdad, no solo que quede en null por accidente.
    expect(restarted.currentLocation?.slug).toBe('hondonada-del-eco');

    expect(await prisma.inventoryItem.count({ where: { saveId, name: 'Objeto de la partida vieja' } })).toBe(0);
    expect(await prisma.logEntry.count({ where: { saveId } })).toBe(2); // intro de personaje + intro de mundo
  });

  it('caso borde: initialLocationSlugFor no resuelve para un personaje sin mundo estructurado — currentLocationId queda null, sin lanzar', async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        // Cualquier characterName distinto de 'Gorhorn' — initialLocationSlugFor (travel.ts) solo
        // resuelve Gorhorn hoy (alcance v1, "hoy solo Gorhorn tiene mundo estructurado").
        characterName: 'Personaje sin mundo estructurado',
        characterArchetype: 'guerrero',
        characterOrigin: 'x',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'P',
      },
    });
    await prisma.worldState.create({ data: { saveId: save.id } });

    try {
      await prisma.$transaction((tx) =>
        restartSaveTransactionBody(
          tx,
          { id: save.id, worldId: save.worldId, characterName: save.characterName, raza: save.raza, clase: save.clase, attributes: save.attributes },
          'Texto de personaje',
          'Texto de mundo',
        ),
      );

      const restarted = await prisma.save.findUniqueOrThrow({ where: { id: save.id } });
      expect(restarted.currentLocationId).toBeNull();
      expect(restarted.level).toBe(1); // el resto del reinicio se completa igual, sin verse afectado
    } finally {
      await prisma.save.delete({ where: { id: save.id } });
    }
  });
});
