import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { armasDeLaSemana, asegurarVasallajes, DEUDA_INICIAL, rearme, revisarVasallajes, SOBREPRECIO_ARMAS, vasallajesVista } from './vasallaje.js';
import { EQUIPO } from './facturaEquipo.js';
import { produccionDeFaccion } from '../kingdomTick.js';

describe('vasallaje (CR-59) — reglas puras', () => {
  it('armas al doble y rearme con el excedente (cada guerrero nuevo deja de producir 2)', () => {
    expect(armasDeLaSemana(208)).toBe(1248);
    expect(rearme(5, 359)).toBe(2);
    expect(rearme(-3, 359)).toBe(0);
    expect(rearme(100, 10)).toBe(10);
  });
});

describe('vasallaje (CR-59) — Serhu bajo la Concordia', () => {
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
    const { resembrarFacciones } = await import('./economiaFacciones.js');
    const { syncFactionPopulationToKingdomStats } = await import('../population.js');
    await prisma.$transaction(async (tx) => {
      await resembrarFacciones(tx, saveId);
      await syncFactionPopulationToKingdomStats(tx, { saveId });
      await asegurarVasallajes(tx, saveId, 0);
      await asegurarVasallajes(tx, saveId, 0);
    });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const stats = (slug: string) => prisma.kingdomStats.findFirstOrThrow({ where: { faction: { saveId, slug } } });

  it('una semana: las armas a crédito engordan la deuda y el tesoro del señor; con excedente se rearman; la patrulla acaba en escaramuza', async () => {
    expect(await prisma.vasallaje.count({ where: { saveId } })).toBe(1);
    const serhu = await stats('clan-serhu');
    await prisma.kingdomStats.update({ where: { id: serhu.id }, data: { riqueza: 300, trabajadores: serhu.trabajadores + 10, poblacion: serhu.poblacion + 10 } });
    const concordiaAntes = (await stats('concordia-de-hierro')).riqueza;
    // CR-61: el excedente sale de las tareas de sus trabajadores (caza en agregado, recolección, cocina).
    const k = await stats('clan-serhu');
    const faccion = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-serhu' }, select: { id: true, raza: true } });
    const edificios = await prisma.building.findMany({ where: { factionId: faccion.id, status: 'ACTIVO' }, select: { recipeKey: true, status: true } });
    const margen = produccionDeFaccion(edificios, faccion.raza, k).comida - (k.poblacion + k.soldados + k.visitantes);
    const trab = await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetType: 'FACCION', targetSlug: 'clan-serhu-trabajadores' } });
    const nuevos = rearme(margen, trab.poblacion);
    expect(nuevos).toBeGreaterThan(0);
    const r = await prisma.$transaction((tx) => revisarVasallajes(tx, saveId, 7, 7 * 1440, () => 0.1));
    expect(r.escaramuzas).toBe(1);
    const v = await prisma.vasallaje.findFirstOrThrow({ where: { saveId } });
    // Armas (208 → 1248) y rearme a crédito: paga 300, el resto a deuda; la patrulla rebaja 100.
    expect(v.deuda).toBe(DEUDA_INICIAL + 1248 + nuevos * EQUIPO.arma.valor * SOBREPRECIO_ARMAS - 300 - 100);
    expect((await stats('concordia-de-hierro')).riqueza).toBe(concordiaAntes + 300);
    const despues = await stats('clan-serhu');
    expect(despues.riqueza).toBe(0);
    // CR-62: la patrulla pelea de verdad; con el azar fijo en 0,1 nadie muere (la muerte es al 3 %).
    expect(despues.soldados).toBe(serhu.soldados + nuevos);
    const escaramuza = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'ESCARAMUZA' } });
    expect((escaramuza.datos as { resultado?: string }).resultado).toBeTruthy();
    // La misma semana no se repite.
    expect((await prisma.$transaction((tx) => revisarVasallajes(tx, saveId, 10, 10 * 1440, () => 0.1))).escaramuzas).toBe(0);
  });

  it('P286/P297: la deuda se ve en la vista y una patrulla sin escaramuza deja línea en el diario', async () => {
    const antes = (await prisma.vasallaje.findFirstOrThrow({ where: { saveId } })).deuda;
    const [vista] = await vasallajesVista(prisma, saveId, 10);
    expect(vista).toMatchObject({ vasalloNombre: 'Clan Serhu', senorSlug: 'concordia-de-hierro', deuda: antes, proximaRevision: 14, rotoEn: null });
    const r = await prisma.$transaction((tx) => revisarVasallajes(tx, saveId, 14, 14 * 1440, () => 0.9));
    expect(r.escaramuzas).toBe(0);
    const despues = (await prisma.vasallaje.findFirstOrThrow({ where: { saveId } })).deuda;
    const linea = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'PATRULLA_VASALLO' } });
    expect((linea.datos as { deuda: number }).deuda).toBe(despues);
  });

  it('si cae el señor, el vasallaje se rompe', async () => {
    await prisma.faction.updateMany({ where: { saveId, slug: 'concordia-de-hierro' }, data: { disueltaEn: 20 * 1440 } });
    await prisma.$transaction((tx) => revisarVasallajes(tx, saveId, 21, 21 * 1440, () => 0.9));
    expect(await prisma.vasallaje.findFirstOrThrow({ where: { saveId } })).toMatchObject({ motivoRuptura: 'cayó el señor' });
  });
});
