import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { MINUTOS_POR_ANIO } from './edades.js';
import { linajeDe } from './linajes.js';
import { avanzarSubditos, cambiarRolSubdito, cambiarTareaSubdito, cifrasDePoblacion, crearSubdito, cupoDeCamas, datosDeSubditos, felicidadHacia, repartirCamas, rolDeSubdito, tareasDelReino } from './subditos.js';
import { comidaDelReino } from './economiaReino.js';
import { rendimientoRecolector } from './comidaOficios.js';
import { estacionFor } from '../worldClock.js';

describe('súbditos (REI-118) — reglas puras', () => {
  it('los roles narrados antes del 0.3 se leen como los del motor', () => {
    expect(rolDeSubdito('Guerrera de la empalizada')).toBe('soldado');
    expect(rolDeSubdito('vigía')).toBe('vigia');
    expect(rolDeSubdito('capataz')).toBe('trabajador');
    expect(rolDeSubdito('viajero')).toBe('visitante');
  });

  it('la población son los civiles (soldados y visitantes comen aparte); las crías comen pero no trabajan ni combaten', () => {
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
    expect(cifras).toEqual({ poblacion: 2, trabajadores: 1, soldados: 2, visitantes: 0 });
  });

  it('tareas (CR-61): los trabajadores adultos, por su tarea; sin tarea, recolectores', () => {
    const ahora = 30 * MINUTOS_POR_ANIO;
    const t = tareasDelReino(
      [
        { role: 'trabajador', pueblo: 'orcos', nacidoEn: 0, tarea: null },
        { role: 'trabajador', pueblo: 'orcos', nacidoEn: 0, tarea: 'pescador' },
        { role: 'trabajador', pueblo: 'orcos', nacidoEn: 0, tarea: 'cocinero' },
        { role: 'soldado', pueblo: 'orcos', nacidoEn: 0, tarea: 'cocinero' },
        { role: 'trabajador', pueblo: 'orcos', nacidoEn: ahora - MINUTOS_POR_ANIO, tarea: null },
      ],
      ahora,
    );
    expect(t).toEqual({ recolector: 1, pescador: 1, cocinero: 1, ganadero: 0, fibrero: 0 });
  });

  it('P220a: las camas temporales del Ayuntamiento son solo de súbditos; los compañeros no las usan', () => {
    // Sin camas de verdad: 2 temporales para súbditos, ninguna para compañeros.
    expect(repartirCamas(0, 0, 0, 2)).toMatchObject({ libres: 0, libresSubditos: 2, enAyuntamiento: 0 });
    expect(repartirCamas(0, 0, 2, 2)).toMatchObject({ libres: 0, libresSubditos: 0, enAyuntamiento: 2 });
    // Con una Choza (2): los súbditos llenan primero las temporales y la cama permanente queda para un compañero.
    expect(repartirCamas(2, 1, 2, 2)).toMatchObject({ libres: 1, libresSubditos: 1, enAyuntamiento: 2 });
    expect(repartirCamas(2, 0, 2, 2)).toMatchObject({ libres: 2, libresSubditos: 2, enAyuntamiento: 2 });
    // Solo cuando las temporales se llenan pasan a las permanentes.
    expect(repartirCamas(2, 0, 3, 2)).toMatchObject({ libres: 1, libresSubditos: 1, enAyuntamiento: 2 });
    expect(repartirCamas(4, 0, 3, 2)).toMatchObject({ libres: 3, libresSubditos: 3, enAyuntamiento: 2 });
    // Sin Ayuntamiento no hay camas temporales.
    expect(repartirCamas(0, 0, 0, 0)).toMatchObject({ libres: 0, libresSubditos: 0 });
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

  it('un apellido que ya es de una familia no hace pariente: quien llega funda la suya con otro nombre', async () => {
    const ketg = await prisma.linaje.create({ data: { saveId, nombre: 'Ketg', pueblo: 'orcos', tipo: 'APELLIDO', origen: 'CATALOGO', desdeMinutes: 0 } });
    const { fundarLinaje } = await import('./linajes.js');
    expect(await prisma.$transaction((tx) => fundarLinaje(tx, { saveId, pueblo: 'orcos', desdeMinutes: AHORA, random: () => 0.3, nombre: 'Ketg', soloNuevo: true }))).toBeNull();
    await prisma.linaje.delete({ where: { id: ketg.id } });
  });

  it('compañeros y súbditos comparten las camas (la Choza da 2)', async () => {
    expect(await cupoDeCamas(prisma, saveId)).toMatchObject({ total: 2, subditos: 2, companeros: 0, libres: 0 });
  });

  it('el rol de un adulto se cambia y cuenta como soldado; el de una cría no', async () => {
    const [adulto] = await prisma.subject.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
    expect(await prisma.$transaction((tx) => cambiarRolSubdito(tx, saveId, adulto!.id, 'soldado', AHORA))).toEqual({ ok: true });
    expect(await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `save:${saveId}` } })).toMatchObject({ poblacion: 1, trabajadores: 1, soldados: 1 });
    expect((await prisma.$transaction((tx) => cambiarRolSubdito(tx, saveId, adulto!.id, 'rey', AHORA))).ok).toBe(false);
    const cria = await crear('orcos', AHORA, 'NACIDO');
    const r = await prisma.$transaction((tx) => cambiarRolSubdito(tx, saveId, cria.id, 'soldado', AHORA));
    expect(r.ok).toBe(false);
    const datos = await datosDeSubditos(prisma, saveId, AHORA);
    expect(datos.find((d) => d.id === cria.id)).toMatchObject({ edad: 0, adulto: false });
  });

  it('la tarea de un trabajador adulto da su comida (CR-61): sin Cocina el cocinero recolecta', async () => {
    const adulto = await crear('orcos', 0);
    await prisma.$transaction((tx) => avanzarSubditos(tx, saveId, 0, AHORA));
    await prisma.subject.updateMany({ where: { saveId, id: { not: adulto.id } }, data: { tarea: 'ganadero' } });
    expect(await prisma.$transaction((tx) => cambiarTareaSubdito(tx, saveId, adulto.id, 'cocinero', AHORA))).toEqual({ ok: true });
    expect((await prisma.$transaction((tx) => cambiarTareaSubdito(tx, saveId, adulto.id, 'cazador', AHORA))).ok).toBe(false);
    expect((await datosDeSubditos(prisma, saveId, AHORA)).find((d) => d.id === adulto.id)?.tarea).toBe('cocinero');
    expect(await comidaDelReino(prisma, saveId, AHORA, 100)).toBe(rendimientoRecolector(estacionFor(AHORA)));
    const location = await prisma.location.findFirstOrThrow({ where: { worldId } });
    const cocina = await prisma.building.create({ data: { saveId, locationId: location.id, recipeKey: 'cocina', name: 'Cocina', kind: 'cocina', description: 'x', status: 'ACTIVO' } });
    expect(await comidaDelReino(prisma, saveId, AHORA, 100)).toBe(5);
    expect(await comidaDelReino(prisma, saveId, AHORA, 0)).toBe(0); // sin comida cruda no cocina
    await prisma.building.delete({ where: { id: cocina.id } });
    await prisma.subject.updateMany({ where: { saveId }, data: { tarea: null } });
    // Fuera, para no cambiar las cuentas de los tests de después.
    await prisma.subject.delete({ where: { id: adulto.id } });
    await prisma.$transaction((tx) => avanzarSubditos(tx, saveId, 0, AHORA));
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
