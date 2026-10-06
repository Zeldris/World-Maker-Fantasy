import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { filasDeFaccion, REPARTO_FACCIONES } from '../../scripts/repartoFacciones.js';
import { DIAS_PARA_REFUNDAR, repartoEstandar, resembrarFacciones, revisarExtinciones, VERSION_REPARTO_FACCIONES } from './economiaFacciones.js';
import { producirFacciones } from '../factionEconomy.js';

describe('reparto de las facciones (CR-54, Q16)', () => {
  const margen = (r: (typeof REPARTO_FACCIONES)[number]) => 2 * r.trabajadores - (r.trabajadores + r.soldados + r.civiles);

  it('los Serhu comen justo y no tienen sitio para crecer; las demás, con margen', () => {
    const serhu = REPARTO_FACCIONES.find((r) => r.slug === 'clan-serhu')!;
    expect(margen(serhu) + 3).toBe(1); // +3 de comida de sus edificios
    expect(serhu.soldados / (serhu.trabajadores + serhu.soldados + serhu.civiles)).toBeGreaterThan(0.28);
    for (const r of REPARTO_FACCIONES.filter((x) => x.slug !== 'clan-serhu')) expect(margen(r)).toBeGreaterThan(0);
  });

  it('cuatro filas por facción; la de civiles es `poblacion` y el tope deja la holgura', () => {
    const filas = filasDeFaccion(REPARTO_FACCIONES.find((r) => r.slug === 'clan-serhu')!);
    expect(filas.map((f) => f.targetSlug)).toEqual(['clan-serhu-poblacion', 'clan-serhu-soldados', 'clan-serhu-trabajadores', 'clan-serhu-visitantes']);
    expect(filas[0]).toMatchObject({ poblacion: 153, poblacionMax: 157 });
  });
});

describe('re-siembra única del reparto en una partida (CR-54, Q20)', () => {
  let saveId: string;
  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: 0 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('una partida con las cifras viejas pasa al reparto nuevo una sola vez', async () => {
    await prisma.worldPopulation.updateMany({ where: { saveId, targetSlug: 'clan-serhu-soldados' }, data: { poblacion: 500 } });
    await prisma.worldPopulation.deleteMany({ where: { saveId, targetSlug: 'keseg-sael-trabajadores' } });
    expect(await prisma.$transaction((tx) => resembrarFacciones(tx, saveId))).toBeGreaterThan(0);
    const fila = (slug: string) => prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetType: 'FACCION', targetSlug: slug } });
    expect((await fila('clan-serhu-soldados')).poblacion).toBe(208);
    expect((await fila('keseg-sael-trabajadores')).poblacion).toBe(825);
    expect((await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).repartoFacciones).toBe(VERSION_REPARTO_FACCIONES);
    // La segunda vez no toca nada (lo que la partida haya cambiado después se respeta).
    await prisma.worldPopulation.updateMany({ where: { saveId, targetSlug: 'clan-serhu-soldados' }, data: { poblacion: 190 } });
    expect(await prisma.$transaction((tx) => resembrarFacciones(tx, saveId))).toBe(0);
    expect((await fila('clan-serhu-soldados')).poblacion).toBe(190);
  });

  it('una facción sin comida pierde gente de hambre (primero civiles) y queda en el Libro (CR-54 54b)', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const f = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-goshg' }, include: { kingdomStats: true } });
    await prisma.building.updateMany({ where: { factionId: f.id }, data: { status: 'DANADO' } });
    await prisma.kingdomStats.update({ where: { id: f.kingdomStats!.id }, data: { poblacion: 200, trabajadores: 0, soldados: 50, comida: 0, diasHambre: 0, ultimoDiaProducido: 10 } });
    const civilesAntes = (await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'clan-goshg-poblacion' } })).poblacion;
    await producirFacciones(prisma, worldId, { id: f.id }, 15, { diasProcesados: 0, semanasDecaidas: 0, depositados: 0 });
    const civiles = (await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'clan-goshg-poblacion' } })).poblacion;
    expect(civiles).toBeLessThan(civilesAntes);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { id: f.kingdomStats!.id } })).poblacion).toBeLessThan(200);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'HAMBRUNA' } })).toBeGreaterThan(0);
  });

  it('los Serhu siembran su rebaño (60 Múrgol y 20 Corretolvas) y su leche les da más comida que el pasivo de sus ganaderos (CR-55 55f)', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const f = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-serhu' }, include: { kingdomStats: true } });
    const ks = f.kingdomStats!;
    await prisma.kingdomStats.update({ where: { id: ks.id }, data: { comida: 500, diasHambre: 0, ultimoDiaProducido: 20 } });
    const antes = await prisma.kingdomStats.findUniqueOrThrow({ where: { id: ks.id } });
    await producirFacciones(prisma, worldId, { id: f.id }, 21, { diasProcesados: 0, semanasDecaidas: 0, depositados: 0 });
    const cohortes = await prisma.ganadoFaccion.findMany({ where: { factionId: f.id } });
    expect(cohortes.filter((c) => c.especie === 'murgol').reduce((s, c) => s + c.cantidad, 0)).toBeGreaterThanOrEqual(60);
    expect(cohortes.filter((c) => c.especie === 'corretolvas').reduce((s, c) => s + c.cantidad, 0)).toBeGreaterThanOrEqual(20);
    const despues = await prisma.kingdomStats.findUniqueOrThrow({ where: { id: ks.id } });
    expect(despues.ganadoSembrado).toBe(true);
    // Sin el rebaño el balance del día sería el pasivo (≈ +1); con él, unos +8 más.
    const bocas = antes.poblacion + antes.soldados + antes.visitantes;
    const sinRebano = antes.trabajadores * 2 + 3 - bocas;
    expect(despues.comida - antes.comida).toBeGreaterThan(sinRebano);
  });

  it('sin nadie, la facción se extingue; un año después su pueblo refunda otra en la región (CR-54 54c)', async () => {
    expect(repartoEstandar(100)).toEqual({ trabajadores: 55, soldados: 15, civiles: 30 });
    const f = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'feg-ger' }, include: { kingdomStats: true } });
    await prisma.kingdomStats.update({ where: { id: f.kingdomStats!.id }, data: { poblacion: 0, soldados: 0, visitantes: 0 } });
    const AHORA = 1000 * 1440;
    expect((await prisma.$transaction((tx) => revisarExtinciones(tx, saveId, AHORA, () => 0.3))).extintas).toEqual(['feg-ger']);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'FACCION_CAE' } })).toBe(1);
    // Antes del año no se refunda.
    expect((await prisma.$transaction((tx) => revisarExtinciones(tx, saveId, AHORA + 10 * 1440, () => 0.3))).refundadas).toEqual([]);
    const r = await prisma.$transaction((tx) => revisarExtinciones(tx, saveId, AHORA + DIAS_PARA_REFUNDAR * 1440, () => 0.3));
    expect(r.refundadas).toHaveLength(1);
    const nueva = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: r.refundadas[0]! }, include: { kingdomStats: true } });
    expect(nueva.name.startsWith('Feg ')).toBe(true);
    expect(nueva.kingdomStats!.trabajadores).toBeGreaterThan(0);
    expect(await prisma.worldPopulation.count({ where: { saveId, targetType: 'FACCION', targetSlug: { startsWith: `${nueva.slug}-` } } })).toBe(4);
    // Ya hay una de su pueblo viva en la región: no se refunda otra.
    expect((await prisma.$transaction((tx) => revisarExtinciones(tx, saveId, AHORA + 200 * 1440, () => 0.3))).refundadas).toEqual([]);
  });
});
