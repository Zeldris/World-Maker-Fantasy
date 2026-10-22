import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { armasDeLaSemana, asegurarVasallajes, cuotaSemanal, pagoSemanal, PATRULLA_GUERREROS, rearme, revisarVasallajes, SOBREPRECIO_ARMAS, vasallajesVista } from './vasallaje.js';
import { EQUIPO } from './facturaEquipo.js';
import { produccionDeFaccion } from '../kingdomTick.js';

describe('vasallaje (CR-59) — reglas puras', () => {
  it('armas al doble y rearme con el excedente (cada guerrero nuevo deja de producir 2)', () => {
    expect(armasDeLaSemana(208)).toBe(1248);
    expect(rearme(5, 359)).toBe(2);
    expect(rearme(-3, 359)).toBe(0);
    expect(rearme(100, 10)).toBe(10);
  });

  it('pago semanal al estilo X4 (2026-10-22): lo pendiente nunca pasa de una cuota', () => {
    expect(pagoSemanal(2000, 0, 1248)).toEqual({ pagado: 1248, pendiente: 0, alCorriente: true });
    expect(pagoSemanal(300, 0, 1248)).toEqual({ pagado: 300, pendiente: 948, alCorriente: false });
    // Con lo pendiente de la semana anterior (y una deuda vieja recortada a una cuota).
    expect(pagoSemanal(0, 948, 1248)).toEqual({ pagado: 0, pendiente: 1248, alCorriente: false });
    expect(pagoSemanal(0, 9000, 1248)).toEqual({ pagado: 0, pendiente: 1248, alCorriente: false });
    expect(pagoSemanal(2496, 1248, 1248)).toEqual({ pagado: 2496, pendiente: 0, alCorriente: true });
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
  const vasallaje = () => prisma.vasallaje.findFirstOrThrow({ where: { saveId } });
  const ponerRiqueza = async (slug: string, riqueza: number) => prisma.kingdomStats.update({ where: { id: (await stats(slug)).id }, data: { riqueza } });
  const semana = (dia: number, azar: number) => prisma.$transaction((tx) => revisarVasallajes(tx, saveId, dia, dia * 1440, () => azar));
  const ultimaLinea = () => prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'PATRULLA_VASALLO' }, orderBy: { fictionalMinutes: 'desc' } });

  it('empieza al corriente; con fondos paga la cuota al señor, se rearma con lo que le sobra y patrulla', async () => {
    expect(await prisma.vasallaje.count({ where: { saveId } })).toBe(1);
    expect((await vasallaje()).deuda).toBe(0);
    const serhu = await stats('clan-serhu');
    const cuota = cuotaSemanal(serhu.soldados);
    const precio = EQUIPO.arma.valor * SOBREPRECIO_ARMAS;
    // Le llega para la cuota y para 2 armas más (aunque el excedente daría para más guerreros).
    await prisma.kingdomStats.update({ where: { id: serhu.id }, data: { riqueza: cuota + 2 * precio + 5, trabajadores: serhu.trabajadores + 10, poblacion: serhu.poblacion + 10 } });
    const concordiaAntes = (await stats('concordia-de-hierro')).riqueza;
    // CR-61: el excedente sale de las tareas de sus trabajadores (caza en agregado, recolección, cocina).
    const k = await stats('clan-serhu');
    const faccion = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-serhu' }, select: { id: true, raza: true } });
    const edificios = await prisma.building.findMany({ where: { factionId: faccion.id, status: 'ACTIVO' }, select: { recipeKey: true, status: true } });
    const margen = produccionDeFaccion(edificios, faccion.raza, k).comida - (k.poblacion + k.soldados + k.visitantes);
    const trab = await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetType: 'FACCION', targetSlug: 'clan-serhu-trabajadores' } });
    const nuevos = Math.min(rearme(margen, trab.poblacion), 2);
    expect(nuevos).toBe(2);
    const r = await semana(7, 0.1);
    expect(r.escaramuzas).toBe(1);
    expect((await vasallaje()).deuda).toBe(0);
    expect((await stats('concordia-de-hierro')).riqueza).toBe(concordiaAntes + cuota + nuevos * precio);
    const despues = await stats('clan-serhu');
    expect(despues.riqueza).toBe(5);
    // CR-62: la patrulla pelea de verdad; con el azar fijo en 0,1 nadie muere (la muerte es al 3 %).
    expect(despues.soldados).toBe(serhu.soldados + nuevos);
    const escaramuza = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'ESCARAMUZA' } });
    expect((escaramuza.datos as { resultado?: string }).resultado).toBeTruthy();
    // La misma semana no se repite.
    expect((await semana(10, 0.1)).escaramuzas).toBe(0);
    const [vista] = await vasallajesVista(prisma, saveId, 10);
    expect(vista).toMatchObject({ vasalloNombre: 'Clan Serhu', senorSlug: 'concordia-de-hierro', deuda: 0, alCorriente: true, cuota: cuotaSemanal(despues.soldados), sobreprecioArmas: SOBREPRECIO_ARMAS, patrullaGuerreros: PATRULLA_GUERREROS, proximaRevision: 14, rotoEn: null });
  });

  it('sin fondos: impagado, patrullas suspendidas (ni escaramuza ni rearme) y línea en el diario', async () => {
    await ponerRiqueza('clan-serhu', 100);
    const soldados = (await stats('clan-serhu')).soldados;
    const cuota = cuotaSemanal(soldados);
    const concordiaAntes = (await stats('concordia-de-hierro')).riqueza;
    const r = await semana(14, 0.1);
    expect(r.escaramuzas).toBe(0);
    expect((await vasallaje()).deuda).toBe(cuota - 100);
    expect((await stats('concordia-de-hierro')).riqueza).toBe(concordiaAntes + 100);
    expect(await stats('clan-serhu')).toMatchObject({ riqueza: 0, soldados });
    const linea = await ultimaLinea();
    expect(linea.datos).toMatchObject({ estado: 'impagado' });
    const [vista] = await vasallajesVista(prisma, saveId, 14);
    expect(vista).toMatchObject({ alCorriente: false, deuda: cuota - 100 });
  });

  it('la deuda no se acumula: otra semana sin fondos se queda en una cuota', async () => {
    const cuota = cuotaSemanal((await stats('clan-serhu')).soldados);
    expect((await semana(21, 0.1)).escaramuzas).toBe(0);
    expect((await vasallaje()).deuda).toBe(cuota);
    expect((await semana(28, 0.1)).escaramuzas).toBe(0);
    expect((await vasallaje()).deuda).toBe(cuota);
  });

  it('cuando vuelve a tener fondos paga lo pendiente y la cuota, queda al corriente y reanuda la patrulla', async () => {
    const cuota = cuotaSemanal((await stats('clan-serhu')).soldados);
    await ponerRiqueza('clan-serhu', 2 * cuota);
    const concordiaAntes = (await stats('concordia-de-hierro')).riqueza;
    expect((await semana(35, 0.9)).escaramuzas).toBe(0);
    expect((await vasallaje()).deuda).toBe(0);
    expect((await stats('concordia-de-hierro')).riqueza).toBe(concordiaAntes + 2 * cuota);
    const linea = await ultimaLinea();
    expect(linea.datos).toMatchObject({ estado: 'al-corriente' });
    expect(linea.fictionalMinutes).toBe(35 * 1440);
  });

  it('migración: una deuda vieja de más de una cuota se recorta a una cuota, o se salda si hay fondos', async () => {
    const cuota = cuotaSemanal((await stats('clan-serhu')).soldados);
    const v = await vasallaje();
    await prisma.vasallaje.update({ where: { id: v.id }, data: { deuda: 8310 } });
    await ponerRiqueza('clan-serhu', 0);
    await prisma.$transaction((tx) => asegurarVasallajes(tx, saveId, 36 * 1440));
    expect((await vasallaje()).deuda).toBe(cuota);
    await prisma.vasallaje.update({ where: { id: v.id }, data: { deuda: 8310 } });
    await ponerRiqueza('clan-serhu', cuota + 7);
    const concordiaAntes = (await stats('concordia-de-hierro')).riqueza;
    await prisma.$transaction((tx) => asegurarVasallajes(tx, saveId, 36 * 1440));
    expect((await vasallaje()).deuda).toBe(0);
    expect((await stats('clan-serhu')).riqueza).toBe(7);
    expect((await stats('concordia-de-hierro')).riqueza).toBe(concordiaAntes + cuota);
  });

  it('si cae el señor, el vasallaje se rompe', async () => {
    await prisma.faction.updateMany({ where: { saveId, slug: 'concordia-de-hierro' }, data: { disueltaEn: 40 * 1440 } });
    await semana(42, 0.9);
    expect(await vasallaje()).toMatchObject({ motivoRuptura: 'cayó el señor' });
  });
});
