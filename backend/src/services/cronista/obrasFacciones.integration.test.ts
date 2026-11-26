import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import { avanzarObrasDeFacciones, sembrarSuministrosDeFacciones, suministrosParaBocas } from './obrasFacciones.js';

const receta = (key: string) => CONSTRUCTION_RECIPES.find((r) => r.key === key)!;

/// CR-36 (36a): las facciones construyen con materiales de su Almacén, una obra a la vez.
describe('obras de las facciones (CR-36 36a)', () => {
  let saveId: string;
  let worldId: string;
  let casa: string;
  let faccionId: string;
  const jornada = (ahora = 100) => prisma.$transaction((tx) => avanzarObrasDeFacciones(tx, saveId, ahora));

  /// Mete en el Almacén de la facción los materiales de una receta (por categoría, el primer objeto del catálogo de esa categoría).
  const llenarPara = async (key: string, factionId = faccionId) => {
    const data: { factionId: string; name: string; description: string; catalogSlug: string }[] = [];
    for (const req of receta(key).requirements) {
      const slug = req.match.kind === 'exact' ? req.match.catalogSlug : (await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, tipo: req.match.tipo, category: req.match.category }, orderBy: { slug: 'asc' } })).slug;
      for (let i = 0; i < req.cantidad; i++) data.push({ factionId, name: req.label, description: 'x', catalogSlug: slug });
    }
    await prisma.almacenItem.createMany({ data });
    return data.length;
  };

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    casa = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } })).id;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId, characterName: 'Observadora (CR-36a)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O' },
    })).id;
    // 30 bocas (1,1 × 30 = 33 de agua) y un Pozo ya levantado (20 + 12 = 32): le falta agua. 200 trabajadores dan obreros de sobra: plazo ×1.
    faccionId = (await prisma.faction.create({
      data: {
        worldId, saveId, slug: 'clan-prueba-36a', name: 'Clan de Obras', raza: 'orcos', description: 'x', origenSlug: 'clan-prueba-obras',
        kingdomStats: { create: { ownerKey: `faccion-36a-${saveId}`, poblacion: 30, trabajadores: 200, comida: 1000 } },
        buildings: {
          create: [
            { saveId: null, locationId: casa, recipeKey: 'cocina-serhu', name: 'Cocina', kind: 'cocina', description: 'x', status: 'ACTIVO' },
            { saveId: null, locationId: casa, recipeKey: 'pozo', name: 'un pozo', kind: 'pozo', description: 'x', status: 'ACTIVO' },
          ],
        },
      },
    })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin materiales en su Almacén la obra se queda con su aviso y no avanza ni empieza', async () => {
    const r = await jornada();
    expect(r).toEqual({ empezadas: 1, avanzadas: 0, terminadas: 0 });
    const obra = await prisma.obraFaccion.findUniqueOrThrow({ where: { factionId: faccionId } });
    expect(obra).toMatchObject({ recipeKey: 'pozo', tier: 1, dias: 1, diasHechos: 0, empezada: false });
    expect(obra.aviso).toMatch(/^Faltan materiales en el Almacén: /);
    expect(await prisma.suceso.count({ where: { saveId, tipo: { in: ['OBRA_EMPEZADA', 'EDIFICIO_CONSTRUIDO'] } } })).toBe(0);
    // Otro día igual: sigue sin perder nada ni duplicar la obra.
    expect(await jornada()).toEqual({ empezadas: 0, avanzadas: 0, terminadas: 0 });
    expect(await prisma.obraFaccion.count({ where: { factionId: faccionId } })).toBe(1);
  });

  it('con piedra y leña en su Almacén levanta el Pozo: suma cantidad, gasta lo suyo y deja sus sucesos', async () => {
    const n = await llenarPara('pozo');
    // El Almacén del Reino (de la partida) no se toca: la facción gasta el suyo.
    expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(0);
    expect(await jornada()).toEqual({ empezadas: 0, avanzadas: 1, terminadas: 1 });
    expect(await prisma.almacenItem.count({ where: { factionId: faccionId } })).toBe(0);
    expect(n).toBeGreaterThan(0);
    expect(await prisma.obraFaccion.count({ where: { factionId: faccionId } })).toBe(0);
    const pozo = await prisma.building.findUniqueOrThrow({ where: { factionId_recipeKey: { factionId: faccionId, recipeKey: 'pozo' } } });
    expect(pozo.cantidad).toBe(2);
    const sucesos = await prisma.suceso.findMany({ where: { saveId, tipo: { in: ['OBRA_EMPEZADA', 'EDIFICIO_CONSTRUIDO'] } }, include: { actores: true }, orderBy: { id: 'asc' } });
    expect(sucesos.map((s) => s.tipo).sort()).toEqual(['EDIFICIO_CONSTRUIDO', 'OBRA_EMPEZADA']);
    const fin = sucesos.find((s) => s.tipo === 'EDIFICIO_CONSTRUIDO')!;
    expect(fin.actores).toEqual(expect.arrayContaining([expect.objectContaining({ entidadTipo: 'FACCION', entidadId: 'clan-prueba-36a', papel: 'AUTOR' }), expect.objectContaining({ entidadTipo: 'EDIFICIO', entidadId: pozo.id, papel: 'BENEFICIARIO' })]));
    expect(fin.locationId).toBe(casa);
  });

  it('con pocos obreros el plazo se alarga y la obra avanza un día cada vez, gastando por cuotas', async () => {
    // 20 trabajadores = 1 obrero de 5 que pide un tier 1: ×4 (4 días). Con agua para sus bocas, la sed ya no manda: pide una Cisterna (tier 2 → 8 días).
    await prisma.kingdomStats.update({ where: { factionId: faccionId }, data: { trabajadores: 20 } });
    await prisma.building.update({ where: { factionId_recipeKey: { factionId: faccionId, recipeKey: 'pozo' } }, data: { cantidad: 5 } });
    await llenarPara('cisterna');
    expect(await jornada()).toEqual({ empezadas: 1, avanzadas: 1, terminadas: 0 });
    const obra = await prisma.obraFaccion.findUniqueOrThrow({ where: { factionId: faccionId } });
    expect(obra).toMatchObject({ recipeKey: 'cisterna', tier: 2, dias: 8, diasHechos: 1, empezada: true, aviso: null });
    expect(obra.gastados).toBeGreaterThan(0);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'OBRA_EMPEZADA' } })).toBe(2);
    // El segundo día no repite el suceso de inicio.
    await jornada();
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'OBRA_EMPEZADA' } })).toBe(2);
    expect((await prisma.obraFaccion.findUniqueOrThrow({ where: { factionId: faccionId } })).diasHechos).toBe(2);
  });

  it('no empieza una obra sin comida para 7 días de sus bocas', async () => {
    await prisma.obraFaccion.deleteMany({ where: { factionId: faccionId } });
    await prisma.kingdomStats.update({ where: { factionId: faccionId }, data: { comida: 30 * 7 - 1 } });
    expect(await jornada()).toEqual({ empezadas: 0, avanzadas: 0, terminadas: 0 });
    expect(await prisma.obraFaccion.count({ where: { factionId: faccionId } })).toBe(0);
  });

  it('la siembra deja a una facción sin Pozos, Cisternas ni Graneros con los de su población máxima, una sola vez y sin bajar lo que tenga', async () => {
    const otra = await prisma.faction.create({
      data: {
        worldId, saveId, slug: 'clan-siembra-36a', name: 'Clan de la Siembra', raza: 'orcos', description: 'x', origenSlug: 'clan-siembra',
        kingdomStats: { create: { ownerKey: `faccion-36a-siembra-${saveId}`, poblacion: 60, soldados: 10, trabajadores: 20, visitantes: 10 } },
        buildings: { create: { saveId: null, locationId: casa, recipeKey: 'cocina-serhu', name: 'Cocina', kind: 'cocina', description: 'x', status: 'ACTIVO' } },
      },
    });
    // Su población máxima (las filas de WorldPopulation) manda sobre lo que tiene hoy: 150 bocas.
    await prisma.worldPopulation.createMany({
      data: [['poblacion', 80, 90], ['soldados', 10, 20], ['trabajadores', 20, 30], ['visitantes', 0, 10]].map(([c, p, m]) => ({ worldId, saveId, targetType: 'FACCION' as const, targetSlug: `clan-siembra-36a-${c}`, label: `${c}`, poblacion: p as number, poblacionMax: m as number, distribucion: {} })),
    });
    const hechas = await prisma.$transaction((tx) => sembrarSuministrosDeFacciones(tx, saveId));
    // Solo la nueva: la otra ya tiene Pozo.
    expect(hechas).toBe(1);
    const esperado = suministrosParaBocas(150);
    const filas = await prisma.building.findMany({ where: { factionId: otra.id, recipeKey: { in: ['pozo', 'cisterna', 'granero'] } } });
    expect(Object.fromEntries(filas.map((b) => [b.recipeKey, b.cantidad]))).toEqual(esperado);
    expect(filas.every((b) => b.status === 'ACTIVO' && b.locationId === casa)).toBe(true);
    // Idempotente, y una cantidad que luego suba por obras no baja.
    await prisma.building.update({ where: { factionId_recipeKey: { factionId: otra.id, recipeKey: 'pozo' } }, data: { cantidad: esperado.pozo + 5 } });
    expect(await prisma.$transaction((tx) => sembrarSuministrosDeFacciones(tx, saveId))).toBe(0);
    expect((await prisma.building.findUniqueOrThrow({ where: { factionId_recipeKey: { factionId: otra.id, recipeKey: 'pozo' } } })).cantidad).toBe(esperado.pozo + 5);
    expect(await prisma.building.count({ where: { factionId: otra.id, recipeKey: { in: ['pozo', 'cisterna', 'granero'] } } })).toBe(3);
  });
});
