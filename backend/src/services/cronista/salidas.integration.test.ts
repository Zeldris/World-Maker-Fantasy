import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { MINUTOS_POR_ANIO } from './edades.js';
import { procesarReacciones } from './reacciones.js';
import { crearSubdito } from './subditos.js';
import { morir, quienSeVa, revisarSalidas, salidasRecientes, victimaDelHambre } from './salidas.js';

const AHORA = 480 + 100 * MINUTOS_POR_ANIO;
const DIA = 1440;
const v = (id: string, extra: object = {}) => ({ id, name: id, pueblo: 'orcos', nacidoEn: AHORA - 30 * MINUTOS_POR_ANIO, felicidad: 50, madreId: null, padreId: null, poblacionOrigenId: null, ...extra });

describe('salidas y muerte (REI-121) — reglas puras', () => {
  it('se va el adulto más descontento; una cría nunca se va sola', () => {
    expect(quienSeVa([v('a', { felicidad: 30 }), v('b', { felicidad: 10 }), v('c', { felicidad: 0, nacidoEn: AHORA })], AHORA)?.id).toBe('b');
  });
  it('el hambre se lleva primero a la cría más pequeña y, sin crías, al de más edad', () => {
    expect(victimaDelHambre([v('a'), v('b', { nacidoEn: AHORA - MINUTOS_POR_ANIO }), v('c', { nacidoEn: AHORA })], AHORA)?.id).toBe('c');
    expect(victimaDelHambre([v('a'), v('b', { nacidoEn: AHORA - 50 * MINUTOS_POR_ANIO })], AHORA)?.id).toBe('b');
  });
});

describe('salidas y muerte (REI-121) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const ownerKey = () => `save:${saveId}`;
  const serhu = async () => (await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'orcos-llanuras' } })).poblacion;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: AHORA } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKey(), felicidad: 50, comida: 50, bebida: 50 } });
    await prisma.territory.create({ data: { saveId, name: 'Hondonada', description: 'x', region: 'Las Llanuras del Viento Rojo' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId } });
    for (let i = 0; i < 3; i++) await prisma.building.create({ data: { saveId, locationId: location.id, recipeKey: 'choza', name: 'Choza', kind: 'choza', description: 'x', status: 'ACTIVO' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const crear = (anos: number, extra: object = {}) =>
    prisma.$transaction((tx) => crearSubdito(tx, { saveId, worldId, pueblo: 'orcos', nacidoEn: AHORA - anos * MINUTOS_POR_ANIO, origen: 'LLEGADA', ahora: AHORA, random: () => 0.4, ...extra }));

  it('muere de viejo quien pasa de la vejez; queda en el Libro y deja de contar', async () => {
    const viejo = await crear(58);
    await crear(25);
    const r = await prisma.$transaction((tx) => revisarSalidas(tx, saveId, AHORA, () => 0));
    expect(r.muertos).toEqual([viejo.id]);
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: viejo.id } })).estado).toBe('MUERTO');
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKey() } })).poblacion).toBe(1);
    const suceso = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'MUERTE_NPC' } });
    expect(suceso.texto).toContain(viejo.name);
    await procesarReacciones(prisma, saveId);
    const [salida] = await salidasRecientes(prisma, saveId, AHORA);
    expect(salida).toMatchObject({ id: viejo.id, estado: 'MUERTO', motivo: 'Murió de viejo.' });
  });

  it('con hambruna puede morir uno de hambre', async () => {
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { diasHambre: 3 } });
    const r = await prisma.$transaction((tx) => revisarSalidas(tx, saveId, AHORA + DIA, () => 0.05));
    expect(r.muertos).toHaveLength(1);
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: r.muertos[0]! } })).notes).toBe('Murió de hambre.');
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { diasHambre: 0 } });
  });

  it('a los 2 días sin agua puede morir uno de sed (CR-53)', async () => {
    await crear(20);
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { diasSed: 2 } });
    const r = await prisma.$transaction((tx) => revisarSalidas(tx, saveId, AHORA + DIA, () => 0.15));
    expect(r.muertos).toHaveLength(1);
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: r.muertos[0]! } })).notes).toBe('Murió de sed.');
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { diasSed: 0 } });
  });

  it('con el Reino triste 7 días se va el más descontento con sus crías y vuelve a su pueblo; una vez por semana', async () => {
    const madre = await crear(25, { genero: 'F' });
    const cria = await crear(1, { madreId: madre.id });
    await prisma.subject.update({ where: { id: madre.id }, data: { felicidad: 5 } });
    const otro = await crear(30);
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { diasFelicidadBaja: 7 } });
    const antes = await serhu();
    const r = await prisma.$transaction((tx) => revisarSalidas(tx, saveId, AHORA + 2 * DIA, () => 0.99));
    expect(r.idos.sort()).toEqual([madre.id, cria.id].sort());
    expect(await serhu()).toBe(antes + 2);
    expect((await prisma.$transaction((tx) => revisarSalidas(tx, saveId, AHORA + 3 * DIA, () => 0.99))).idos).toEqual([]);
    expect((await prisma.$transaction((tx) => revisarSalidas(tx, saveId, AHORA + 9 * DIA, () => 0.99))).idos).toEqual([otro.id]);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKey() } })).poblacion).toBe(0);
  });

  it('P223/P224: al irse o morir, avisa en el canal del Reino y su pareja queda libre en el acto', async () => {
    const a = await crear(25, { genero: 'F' });
    const b = await crear(25, { genero: 'M' });
    const c = await crear(25, { genero: 'F' });
    const d = await crear(25, { genero: 'M' });
    await prisma.subject.update({ where: { id: a.id }, data: { parejaId: b.id } });
    await prisma.subject.update({ where: { id: b.id }, data: { parejaId: a.id } });
    await prisma.subject.update({ where: { id: c.id }, data: { parejaId: d.id } });
    await prisma.subject.update({ where: { id: d.id }, data: { parejaId: c.id } });
    // Muerte (de sed): la pareja de la víctima queda libre y el Reino lo cuenta.
    await prisma.$transaction((tx) => morir(tx, saveId, a, 'hambre', AHORA));
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: b.id } })).parejaId).toBeNull();
    const avisos = async () => (await prisma.logEntry.findMany({ where: { saveId, channel: 'KINGDOM' }, select: { text: true } })).map((l) => l.text);
    expect(await avisos()).toContain(`${a.name} ha muerto de hambre. ${b.name} se queda sin pareja.`);
    // Marcha: se va el más descontento; su pareja queda libre.
    await prisma.subject.updateMany({ where: { saveId, estado: 'ACTIVO' }, data: { felicidad: 90 } });
    await prisma.subject.update({ where: { id: c.id }, data: { felicidad: 1 } });
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { diasFelicidadBaja: 7 } });
    const r = await prisma.$transaction((tx) => revisarSalidas(tx, saveId, AHORA + 30 * DIA, () => 0.99));
    expect(r.idos).toContain(c.id);
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: d.id } })).parejaId).toBeNull();
    expect(await avisos()).toContain(`${c.name} se marcha del Reino, descontento. ${d.name} se queda sin pareja.`);
  });
});
