import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { equiparAlta, esMaterial, huecoDeMateriales, motivoMaterialesLlenos, resumenEconomia, revisarSueldos, suministrosDelReino, traspasarGoirnos } from './economiaReino.js';
import { crearSubdito } from './subditos.js';

describe('economía del Reino (CR-53) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: 0 } },
      },
    })).id;
    locationId = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: { not: { contains: 'cauce' } }, NOT: { slug: { contains: 'manadero' } } } })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const edificio = (recipeKey: string) =>
    prisma.building.create({ data: { saveId, locationId, recipeKey, name: recipeKey, kind: recipeKey, description: 'x', status: 'ACTIVO' } });

  it('el Pozo da agua y la Leñera hace sitio a los materiales del Almacén', async () => {
    await edificio('ayuntamiento');
    await edificio('pozo');
    expect((await suministrosDelReino(prisma, saveId)).agua).toBeGreaterThanOrEqual(12);
    const recurso = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, tipo: 'RECURSO' } });
    const arma = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, tipo: { not: 'RECURSO' } } });
    expect(await esMaterial(prisma, saveId, recurso.slug)).toBe(true);
    expect(await esMaterial(prisma, saveId, arma.slug)).toBe(false);
    await prisma.almacenItem.createMany({ data: Array.from({ length: 60 }, () => ({ saveId, name: recurso.name, description: '', catalogSlug: recurso.slug })) });
    expect(await huecoDeMateriales(prisma, saveId)).toBe(0);
    await edificio('lenera');
    expect(await huecoDeMateriales(prisma, saveId)).toBe(120);
    // P276: con Leñera construida el aviso ya no pide otra; solo dice que está lleno.
    await prisma.almacenItem.createMany({ data: Array.from({ length: 120 }, () => ({ saveId, name: recurso.name, description: '', catalogSlug: recurso.slug })) });
    expect(await motivoMaterialesLlenos(prisma, saveId)).toMatch(/lleno.*180\/180.*tu Leñera/);
    await prisma.almacenItem.deleteMany({ where: { saveId, catalogSlug: recurso.slug, id: { in: (await prisma.almacenItem.findMany({ where: { saveId, catalogSlug: recurso.slug }, take: 120, select: { id: true } })).map((r) => r.id) } } });
  });

  it('P275/P279: el resumen da los topes de comida y agua y la producción y el consumo diarios con sus motivos', async () => {
    const r = await resumenEconomia(prisma, saveId);
    expect(r).toMatchObject({ topeComida: 60, topeBebida: 60 });
    expect(r).toHaveProperty('comidaProduccionDia');
    expect(r).toHaveProperty('comidaConsumoDia');
    expect(Array.isArray(r.motivosComida)).toBe(true);
  });

  it('sueldos: se pagan por semana; sin Goirnos baja la felicidad y a los 7 días deserta un soldado; el traspaso salda la deuda', async () => {
    const ownerKey = `save:${saveId}`;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey, felicidad: 60, riqueza: 20, comida: 50, bebida: 50 } });
    const s = await prisma.$transaction((tx) => crearSubdito(tx, { saveId, worldId, pueblo: 'orcos', nacidoEn: -30 * 120 * 1440, origen: 'LLEGADA', ahora: 0, random: () => 0.4 }));
    await prisma.subject.update({ where: { id: s.id }, data: { role: 'soldado' } });
    const { recalcularPoblacion } = await import('./subditos.js');
    await prisma.$transaction((tx) => recalcularPoblacion(tx, saveId, 0));
    const DIA = 1440;
    expect(await prisma.$transaction((tx) => revisarSueldos(tx, saveId, 0))).toEqual({ pagado: 5, desertor: null });
    // CR-58: con el sueldo, el desgaste de su arma y su armadura (3 + 2, sin taller: se compran).
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey } })).riqueza).toBe(10);
    // A mitad de semana no se paga nada.
    expect((await prisma.$transaction((tx) => revisarSueldos(tx, saveId, 3 * DIA))).pagado).toBe(0);
    await prisma.kingdomStats.update({ where: { ownerKey }, data: { riqueza: 0 } });
    let desertor: string | null = null;
    for (let d = 7; d <= 13; d++) desertor = (await prisma.$transaction((tx) => revisarSueldos(tx, saveId, d * DIA))).desertor;
    const k = await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey } });
    expect(k.diasSinCobrar).toBe(7);
    expect(k.felicidad).toBe(60 - 7 * 3);
    expect(desertor).toBe(s.id);
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: s.id } })).notes).toBe('Desertó: no le pagabas.');
    // Traspaso de la bolsa al tesoro y vuelta.
    await prisma.save.update({ where: { id: saveId }, data: { goirnos: 30 } });
    expect(await prisma.$transaction((tx) => traspasarGoirnos(tx, saveId, 25))).toEqual({ ok: true, bolsa: 5, tesoro: 25 });
    expect((await prisma.$transaction((tx) => traspasarGoirnos(tx, saveId, -40))).ok).toBe(false);
    expect(await prisma.$transaction((tx) => traspasarGoirnos(tx, saveId, -5))).toEqual({ ok: true, bolsa: 10, tesoro: 20 });
    expect(await resumenEconomia(prisma, saveId)).toMatchObject({ topeMateriales: 180, materiales: 60, tesoro: 20, bolsa: 10, sueldosSemana: 0 });
  });

  it('factura de equipo (CR-58): con Herrería y trabajador, el arma se hace en casa con materiales; la armadura se compra', async () => {
    const ownerKey = `save:${saveId}`;
    const herreria = await edificio('herreria');
    await prisma.companion.create({ data: { saveId, name: 'Herrera', role: 'x', notes: 'x', buildingId: herreria.id } });
    await prisma.kingdomStats.update({ where: { ownerKey }, data: { riqueza: 100, sinArma: 0, sinHerramienta: 0 } });
    const materialesAntes = 180 - (await huecoDeMateriales(prisma, saveId));
    expect(await prisma.$transaction((tx) => equiparAlta(tx, saveId, 'soldado'))).toBe(true);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey } })).riqueza).toBe(100 - 16);
    expect(180 - (await huecoDeMateriales(prisma, saveId))).toBe(materialesAntes - 2);
    // Sin Goirnos para la armadura: entra sin equipo.
    await prisma.kingdomStats.update({ where: { ownerKey }, data: { riqueza: 0 } });
    expect(await prisma.$transaction((tx) => equiparAlta(tx, saveId, 'soldado'))).toBe(false);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey } })).sinArma).toBe(1);
    // El equipo que falta nunca pasa de la gente que hay (aquí ya no queda ningún soldado).
    const { recalcularPoblacion } = await import('./subditos.js');
    await prisma.$transaction((tx) => recalcularPoblacion(tx, saveId, 0));
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey } })).sinArma).toBe(0);
    // Con la deuda pendiente y nadie a quien pagar, la deuda se salda (sin perder felicidad).
    await prisma.kingdomStats.update({ where: { ownerKey }, data: { diasSinCobrar: 3, felicidad: 50 } });
    await prisma.$transaction((tx) => revisarSueldos(tx, saveId, 2 * 7 * 1440 + 1));
    expect(await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey } })).toMatchObject({ diasSinCobrar: 0, felicidad: 50 });
    // Dos traspasos a la vez no dejan la bolsa en negativo.
    await prisma.save.update({ where: { id: saveId }, data: { goirnos: 10 } });
    const r = await Promise.all([1, 2].map(() => prisma.$transaction((tx) => traspasarGoirnos(tx, saveId, 10))));
    expect(r.filter((x) => x.ok)).toHaveLength(1);
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos).toBe(0);
  });
});
