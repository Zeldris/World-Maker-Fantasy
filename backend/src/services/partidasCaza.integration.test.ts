import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { avanzarViajeros, crearViajero } from './viajeros.js';
import { aplicarBajas, type Cazador, descargarCaza, desolladeroDaAbasto, DIAS_PIEZA, revisarPiezas, SLUG_PIEZA } from './partidasCaza.js';

/// CR-63 (63b): la partida caza de fondo al llegar, trae piezas que se estropean y el Desolladero las
/// convierte en comida y materiales.
function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

describe('partidas de caza (CR-63 63b)', () => {
  let saveId: string;
  let lugar: string;
  let grupoId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Cazadora (CR-63)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'C',
        worldState: { create: { fictionalMinutes: 20 * 1440 } },
      },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), comida: 0, poblacion: 8 } });
    lugar = (await prisma.location.findFirstOrThrow({ where: { worldId: world.id, linksFrom: { some: {} } } })).id;
    grupoId = (await prisma.zonePoint.create({ data: { saveId, locationId: lugar, tipo: 'FAUNA', targetSlug: 'murgol', x: 100, y: 100, cantidad: 6 } })).id;
    for (let i = 0; i < 8; i++) await prisma.subject.create({ data: { saveId, name: `Cazador ${i}`, role: 'cazador', notes: '', pueblo: 'orcos' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const viajero = () => prisma.viajero.findFirstOrThrow({ where: { saveId, objetivo: 'murgol' } });

  it('caza en su destino, vuelve con piezas que caducan y el grupo de fauna pierde las suyas', async () => {
    const miembros = (await prisma.subject.findMany({ where: { saveId } })).map((s) => ({ subjectId: s.id, rol: 'cazador' }));
    expect((await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'CAZA', objetivo: 'murgol', origenLocationId: lugar, destinoLocationId: lugar, dia: 20, miembros }))).ok).toBe(true);
    const random = semilla(11);
    for (let d = 21; d <= 24 && (await viajero()).estado !== 'TERMINADO'; d++) await avanzarViajeros(prisma, saveId, d, random);
    const v = await viajero();
    expect(v.estado).toBe('TERMINADO');
    const carga = v.carga as { piezas: number; diaCaza: number; especie: string };
    expect(carga.especie).toBe('murgol');
    expect(carga.piezas).toBeGreaterThan(0);
    const grupo = await prisma.zonePoint.findUnique({ where: { id: grupoId } });
    expect(6 - (grupo?.cantidad ?? 0)).toBe(carga.piezas);
    const piezas = await prisma.almacenItem.findMany({ where: { saveId, catalogSlug: SLUG_PIEZA } });
    expect(piezas).toHaveLength(carga.piezas);
    expect(piezas[0]).toMatchObject({ name: 'Pieza de Múrgol', especieSlug: 'murgol', caducaEnDia: carga.diaCaza + DIAS_PIEZA });
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: { contains: 'piezas de Múrgol' } } })).toBe(1);
  });

  it('sin Desolladero se echan a perder; con él, dan comida y materiales (4 al día por escalón)', async () => {
    const piezas = await prisma.almacenItem.findMany({ where: { saveId, catalogSlug: SLUG_PIEZA } });
    const caduca = piezas[0]!.caducaEnDia!;
    // Un día antes de caducar, sin Desolladero: siguen ahí.
    expect(await prisma.$transaction((tx) => revisarPiezas(tx, saveId, caduca - 1))).toEqual({ desolladas: 0, perdidas: 0 });
    await prisma.building.create({ data: { saveId, recipeKey: 'desolladero', name: 'Desolladero', kind: 'desolladero', description: 'x', status: 'ACTIVO' } });
    const r = await prisma.$transaction((tx) => revisarPiezas(tx, saveId, caduca - 1));
    expect(r.desolladas).toBe(Math.min(4, piezas.length));
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKeyFor({ saveId }) } })).comida).toBeGreaterThan(0);
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: { not: SLUG_PIEZA } } })).toBeGreaterThan(0);
    // Las que quedan, al llegar su día, se pierden.
    const quedan = piezas.length - r.desolladas;
    await prisma.building.deleteMany({ where: { saveId, recipeKey: 'desolladero' } });
    expect(await prisma.$transaction((tx) => revisarPiezas(tx, saveId, caduca))).toEqual({ desolladas: 0, perdidas: quedan });
  });

  // P312: lo que fue de las piezas (desolladas o echadas a perder) queda en el diario del Reino, fechado con la hora
  // del mundo en que pasa (la de `WorldState`, 20 días en este escenario).
  it('el diario del Reino dice qué fue de las piezas: desolladas y echadas a perder', async () => {
    await prisma.almacenItem.deleteMany({ where: { saveId, catalogSlug: SLUG_PIEZA } });
    await prisma.logEntry.deleteMany({ where: { saveId, channel: 'KINGDOM' } });
    const pieza = (caducaEnDia: number) => ({ saveId, name: 'Pieza de Múrgol', description: 'x', catalogSlug: SLUG_PIEZA, especieSlug: 'murgol', caducaEnDia });
    await prisma.building.create({ data: { saveId, recipeKey: 'desolladero', name: 'Desolladero', kind: 'desolladero', description: 'x', status: 'ACTIVO' } });
    await prisma.almacenItem.createMany({ data: [pieza(90), pieza(90), pieza(90)] });
    expect(await prisma.$transaction((tx) => revisarPiezas(tx, saveId, 80))).toEqual({ desolladas: 3, perdidas: 0 });
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: { contains: 'El Desolladero desuella 3 piezas' } } })).toBe(1);
    // Caducadas el mismo día: se pierden y también se cuenta.
    await prisma.almacenItem.createMany({ data: [pieza(80), pieza(80)] });
    expect(await prisma.$transaction((tx) => revisarPiezas(tx, saveId, 80))).toEqual({ desolladas: 0, perdidas: 2 });
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: { contains: 'Se echan a perder 2 piezas' } } })).toBe(1);
    const fechas = await prisma.logEntry.findMany({ where: { saveId, channel: 'KINGDOM' }, select: { fictionalMinutes: true } });
    expect(fechas.length).toBeGreaterThanOrEqual(2);
    expect(new Set(fechas.map((f) => f.fictionalMinutes))).toEqual(new Set([20 * 1440]));
    await prisma.building.deleteMany({ where: { saveId, recipeKey: 'desolladero' } });
  });

  it('el Desolladero no da abasto con más piezas pendientes de las que trata antes de que se estropeen', async () => {
    await prisma.almacenItem.deleteMany({ where: { saveId, catalogSlug: SLUG_PIEZA } });
    expect(await prisma.$transaction((tx) => desolladeroDaAbasto(tx, saveId))).toBe(true);
    await prisma.almacenItem.create({ data: { saveId, name: 'Pieza de Múrgol', description: 'x', catalogSlug: SLUG_PIEZA, especieSlug: 'murgol', caducaEnDia: 99 } });
    expect(await prisma.$transaction((tx) => desolladeroDaAbasto(tx, saveId))).toBe(false); // sin Desolladero
    await prisma.building.create({ data: { saveId, recipeKey: 'desolladero', name: 'Desolladero', kind: 'desolladero', description: 'x', status: 'ACTIVO' } });
    expect(await prisma.$transaction((tx) => desolladeroDaAbasto(tx, saveId))).toBe(true); // 4 al día × 3 días
    await prisma.building.deleteMany({ where: { saveId, recipeKey: 'desolladero' } });
    await prisma.almacenItem.deleteMany({ where: { saveId, catalogSlug: SLUG_PIEZA } });
  });

  it('sin la especie en su destino vuelve de vacío y avisa', async () => {
    await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'CAZA', objetivo: 'corretolvas', origenLocationId: lugar, destinoLocationId: lugar, dia: 30, miembros: [] }));
    for (let d = 31; d <= 33; d++) await avanzarViajeros(prisma, saveId, d, semilla(3));
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId, objetivo: 'corretolvas' } });
    expect(v).toMatchObject({ estado: 'TERMINADO', carga: expect.objectContaining({ piezas: 0 }) });
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'no encuentra Corretolvas' } } })).toBe(1);
  });

  it('una partida que vuelve sin cazar (solo con sus cuerdas) no descarga nada', async () => {
    const v = await viajero();
    const n = await prisma.$transaction((tx) => descargarCaza(tx, { ...v, carga: { cuerdas: 2 }, miembros: [] }, 30));
    expect(n).toBe(0);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'undefined' } } })).toBe(0);
  });

  it('P223 (revisión): un súbdito caído en combate se avisa con su causa, queda con suceso MUERTE_NPC y hastaMinutes', async () => {
    const s = await prisma.subject.create({ data: { saveId, name: 'Caído del camino', role: 'cazador', notes: '', pueblo: 'orcos' } });
    const cazador = { miembroId: 'm', subjectId: s.id, c: { id: s.id, nombre: s.name } } as unknown as Cazador;
    await prisma.$transaction((tx) => aplicarBajas(tx, saveId, [cazador], new Map(), new Set([s.id]), 20, 'combate'));
    const fila = await prisma.subject.findUniqueOrThrow({ where: { id: s.id } });
    expect(fila).toMatchObject({ estado: 'MUERTO', hastaMinutes: 20 * 1440 });
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: 'Caído del camino ha muerto en combate.' } })).toBe(1);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'MUERTE_NPC' } })).toBeGreaterThan(0);
  });
});
