import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { MINUTOS_POR_ANIO } from './edades.js';
import { linajeDe } from './linajes.js';
import { posiblesParejas, puedeCriar, revisarFamilias, type SubditoFamilia } from './familias.js';
import { crearSubdito } from './subditos.js';

const AHORA = 480 + 60 * MINUTOS_POR_ANIO;
const s = (id: string, extra: Partial<SubditoFamilia>): SubditoFamilia => ({ id, pueblo: 'orcos', genero: 'F', nacidoEn: AHORA - 20 * MINUTOS_POR_ANIO, felicidad: 80, parejaId: null, ...extra });

describe('familias (REI-120) — reglas puras', () => {
  it('se emparejan adultos del mismo pueblo, sin pareja y con felicidad ≥ 70', () => {
    const pares = posiblesParejas(
      [s('a', {}), s('b', { genero: 'M' }), s('c', {}), s('d', { genero: 'M', pueblo: 'goirntes' }), s('e', { genero: 'M', felicidad: 60 }), s('f', { genero: 'M', nacidoEn: AHORA })],
      AHORA,
    );
    expect(pares.map(([m, p]) => [m.id, p.id])).toEqual([['a', 'b']]);
  });

  it('crían en edad fértil y hasta 2 crías', () => {
    expect(puedeCriar(s('a', {}), s('b', { genero: 'M' }), 0, AHORA)).toBe(true);
    expect(puedeCriar(s('a', {}), s('b', { genero: 'M' }), 2, AHORA)).toBe(false);
    expect(puedeCriar(s('a', { nacidoEn: AHORA - 50 * MINUTOS_POR_ANIO }), s('b', { genero: 'M' }), 0, AHORA)).toBe(false);
  });
});

describe('familias (REI-120) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const DIA = 1440;

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
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: `save:${saveId}`, felicidad: 80, comida: 50, bebida: 50 } });
    await prisma.territory.create({ data: { saveId, name: 'Hondonada', description: 'x', region: 'Las Llanuras del Viento Rojo' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId } });
    for (let i = 0; i < 2; i++) {
      await prisma.building.create({ data: { saveId, locationId: location.id, recipeKey: 'choza', name: 'Choza', kind: 'choza', description: 'x', status: 'ACTIVO' } });
    }
    for (const genero of ['F', 'M'] as const) {
      await prisma.$transaction((tx) => crearSubdito(tx, { saveId, worldId, pueblo: 'orcos', genero, nacidoEn: AHORA - 20 * MINUTOS_POR_ANIO, origen: 'LLEGADA', ahora: AHORA, random: () => 0.6 }));
    }
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('una pareja se forma; luego tiene una cría que hereda el linaje de la madre (orcos, mismo rango) y no trabaja', async () => {
    const r1 = await prisma.$transaction((tx) => revisarFamilias(tx, saveId, AHORA, () => 0.1));
    expect(r1.parejas).toBe(1);
    expect(r1.crias).toHaveLength(1);
    const [madre, padre] = await prisma.subject.findMany({ where: { saveId, origen: 'LLEGADA' }, orderBy: { createdAt: 'asc' } });
    expect(madre!.parejaId).toBe(padre!.id);
    const cria = await prisma.subject.findUniqueOrThrow({ where: { id: r1.crias[0]! } });
    expect(cria).toMatchObject({ origen: 'NACIDO', nacidoEn: AHORA, madreId: madre!.id, padreId: padre!.id });
    const linajeMadre = await linajeDe(prisma, saveId, 'SUBDITO', madre!.id);
    expect((await linajeDe(prisma, saveId, 'SUBDITO', cria.id))?.id).toBe(linajeMadre!.id);
    expect(cria.name.endsWith(linajeMadre!.nombre)).toBe(true);
    const stats = await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `save:${saveId}` } });
    expect(stats).toMatchObject({ poblacion: 3, trabajadores: 2 });
    const suceso = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'NACIMIENTO_NOTABLE' } });
    expect(suceso.texto).toBe(`Nace ${cria.name}, ${cria.genero === 'F' ? 'hija' : 'hijo'} de ${padre!.name} y ${madre!.name}.`);
    // P223: pareja y nacimiento avisan en el canal del Reino.
    const avisos = (await prisma.logEntry.findMany({ where: { saveId, channel: 'KINGDOM' }, select: { text: true } })).map((l) => l.text);
    expect(avisos).toContain(`${madre!.name} y ${padre!.name} forman pareja.`);
    expect(avisos).toContain(`Nace ${cria.name}, ${cria.genero === 'F' ? 'hija' : 'hijo'} de ${padre!.name} y ${madre!.name}.`);
  });

  it('una vez por semana; como mucho 2 crías; sin cama no nace nadie', async () => {
    expect((await prisma.$transaction((tx) => revisarFamilias(tx, saveId, AHORA + 3 * DIA, () => 0.1))).crias).toHaveLength(0);
    expect((await prisma.$transaction((tx) => revisarFamilias(tx, saveId, AHORA + 7 * DIA, () => 0.1))).crias).toHaveLength(1);
    // 4 camas, 4 súbditos: ya no cabe nadie, y además ya tienen 2.
    expect((await prisma.$transaction((tx) => revisarFamilias(tx, saveId, AHORA + 14 * DIA, () => 0.1))).crias).toHaveLength(0);
    const madre = await prisma.subject.findFirstOrThrow({ where: { saveId, origen: 'LLEGADA', genero: 'F' } });
    expect(madre.crias).toBe(2);
  });

  it('quien pierde a su pareja queda libre', async () => {
    const padre = await prisma.subject.findFirstOrThrow({ where: { saveId, origen: 'LLEGADA', genero: 'M' } });
    await prisma.subject.update({ where: { id: padre.id }, data: { estado: 'MUERTO' } });
    await prisma.$transaction((tx) => revisarFamilias(tx, saveId, AHORA + 21 * DIA, () => 0.99));
    expect((await prisma.subject.findFirstOrThrow({ where: { saveId, origen: 'LLEGADA', genero: 'F' } })).parejaId).toBeNull();
  });
});
