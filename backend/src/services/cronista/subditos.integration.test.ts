import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { MINUTOS_POR_ANIO } from './edades.js';
import { linajeDe } from './linajes.js';
import { avanzarSubditos, cambiarRolSubdito, cifrasDePoblacion, crearSubdito, cupoDeCamas, datosDeSubditos, felicidadHacia, rolDeSubdito } from './subditos.js';

describe('súbditos (REI-118) — reglas puras', () => {
  it('los roles narrados antes del 0.3 se leen como los del motor', () => {
    expect(rolDeSubdito('Guerrera de la empalizada')).toBe('soldado');
    expect(rolDeSubdito('vigía')).toBe('vigia');
    expect(rolDeSubdito('capataz')).toBe('trabajador');
    expect(rolDeSubdito('viajero')).toBe('visitante');
  });

  it('la población son todos; las crías comen pero no trabajan ni combaten', () => {
    const ahora = 30 * MINUTOS_POR_ANIO;
    const cifras = cifrasDePoblacion(
      [
        { role: 'trabajador', pueblo: 'orcos', nacidoEn: 0 },
        { role: 'soldado', pueblo: 'orcos', nacidoEn: null },
        { role: 'vigia', pueblo: 'goirntes', nacidoEn: 0 },
        { role: 'trabajador', pueblo: 'orcos', nacidoEn: ahora - MINUTOS_POR_ANIO },
      ],
      ahora,
    );
    expect(cifras).toEqual({ poblacion: 4, trabajadores: 1, soldados: 2, visitantes: 0 });
  });

  it('la felicidad de cada súbdito se acerca a la del Reino 5 puntos por día', () => {
    expect(felicidadHacia(60, 40, 1)).toBe(55);
    expect(felicidadHacia(60, 40, 10)).toBe(40);
    expect(felicidadHacia(30, 80, 2)).toBe(40);
  });
});

describe('súbditos (REI-118) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const AHORA = 480 + 40 * MINUTOS_POR_ANIO;

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
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: `save:${saveId}`, felicidad: 70 } });
    await prisma.territory.create({ data: { saveId, name: 'Hondonada', description: 'x', population: 15 } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId } });
    await prisma.building.create({ data: { saveId, locationId: location.id, recipeKey: 'choza', name: 'Choza', kind: 'choza', description: 'x', status: 'ACTIVO' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const crear = (pueblo: string, nacidoEn: number, origen: 'LLEGADA' | 'NACIDO' = 'LLEGADA') =>
    prisma.$transaction((tx) => crearSubdito(tx, { saveId, worldId, pueblo, nacidoEn, origen, ahora: AHORA, random: () => 0.3 }));

  it('quien llega es una persona: nombre, pueblo, edad, territorio, linaje; la población es su número', async () => {
    const s = await crear('orcos', AHORA - 25 * MINUTOS_POR_ANIO);
    const fila = await prisma.subject.findUniqueOrThrow({ where: { id: s.id } });
    expect(fila).toMatchObject({ pueblo: 'orcos', origen: 'LLEGADA', estado: 'ACTIVO', felicidad: 70, role: 'trabajador' });
    expect(fila.territoryId).not.toBeNull();
    if (s.linajeId) expect((await linajeDe(prisma, saveId, 'SUBDITO', s.id))?.id).toBe(s.linajeId);
    const stats = await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `save:${saveId}` } });
    expect(stats).toMatchObject({ poblacion: 1, trabajadores: 1, soldados: 0 });
    expect((await prisma.territory.findFirstOrThrow({ where: { saveId } })).population).toBe(1);
  });

  it('un faerus llega con su rastro (sin apellido en el nombre)', async () => {
    const s = await crear('faerus', AHORA - 30 * MINUTOS_POR_ANIO);
    const linaje = (await linajeDe(prisma, saveId, 'SUBDITO', s.id))!;
    expect(linaje.tipo).toBe('RASTRO');
    expect(s.name.split(' ')).toHaveLength(1);
  });

  it('compañeros y súbditos comparten las camas (la Choza da 2)', async () => {
    expect(await cupoDeCamas(prisma, saveId)).toMatchObject({ total: 2, subditos: 2, companeros: 0, libres: 0 });
  });

  it('el rol de un adulto se cambia y cuenta como soldado; el de una cría no', async () => {
    const [adulto] = await prisma.subject.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
    expect(await prisma.$transaction((tx) => cambiarRolSubdito(tx, saveId, adulto!.id, 'soldado', AHORA))).toEqual({ ok: true });
    expect(await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `save:${saveId}` } })).toMatchObject({ trabajadores: 1, soldados: 1 });
    expect((await prisma.$transaction((tx) => cambiarRolSubdito(tx, saveId, adulto!.id, 'rey', AHORA))).ok).toBe(false);
    const cria = await crear('orcos', AHORA, 'NACIDO');
    const r = await prisma.$transaction((tx) => cambiarRolSubdito(tx, saveId, cria.id, 'soldado', AHORA));
    expect(r.ok).toBe(false);
    const datos = await datosDeSubditos(prisma, saveId, AHORA);
    expect(datos.find((d) => d.id === cria.id)).toMatchObject({ edad: 0, adulto: false });
  });

  it('cada día su felicidad sigue a la del Reino', async () => {
    await prisma.kingdomStats.update({ where: { ownerKey: `save:${saveId}` }, data: { felicidad: 40 } });
    await prisma.$transaction((tx) => avanzarSubditos(tx, saveId, 2, AHORA));
    const filas = await prisma.subject.findMany({ where: { saveId } });
    expect(filas.every((f) => f.felicidad === 60)).toBe(true);
  });

  it('los que se fueron no cuentan ni ocupan cama', async () => {
    const [primero] = await prisma.subject.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
    await prisma.subject.update({ where: { id: primero!.id }, data: { estado: 'SE_FUE' } });
    await prisma.$transaction((tx) => avanzarSubditos(tx, saveId, 0, AHORA));
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `save:${saveId}` } })).poblacion).toBe(2);
    expect((await cupoDeCamas(prisma, saveId)).subditos).toBe(2);
  });
});
