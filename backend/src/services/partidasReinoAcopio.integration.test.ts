import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { enlacesDelMundo, crearViajero, TRABAJOS } from './viajeros.js';
import { lanzarPartida, opcionesDePartida, partidasDelReino } from './partidasReino.js';
import { asentamientosDelReino } from './defensaReino.js';

/// CR-36b (Q-35, Q-37, Q-41): el Reino manda una partida de acopio con porteadores y guardias.
describe('partidas de acopio del Reino (CR-36b)', () => {
  let saveId: string;
  let casa: string;
  let zona: string;
  let porteador: string;
  let guardia: string;
  const HOY = 20;
  const ahora = HOY * 1440;
  const FUENTE = 'roca-luclara';

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Acopio del Reino', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'A',
        worldState: { create: { fictionalMinutes: ahora } },
      },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), comida: 0, poblacion: 8 } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    casa = enlaces[0]!.fromId;
    zona = enlaces[0]!.toId;
    await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'ayuntamiento', name: 'Ayuntamiento', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } });
    await prisma.zonePoint.create({ data: { saveId, locationId: zona, tipo: 'RECURSO', targetSlug: FUENTE, x: 1, y: 1, cantidad: 100 } });
    await prisma.locationVisit.create({ data: { saveId, locationId: zona } });
    porteador = (await prisma.subject.create({ data: { saveId, name: 'Carga', role: 'trabajador', notes: '', pueblo: 'orcos', createdAt: new Date(Date.now() - 60000) } })).id;
    guardia = (await prisma.subject.create({ data: { saveId, name: 'Escolta', role: 'soldado', notes: '', pueblo: 'orcos', createdAt: new Date(Date.now() - 50000) } })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('las opciones traen destinos con recursos por categoría, porteadores y guardias', async () => {
    const op = await opcionesDePartida(prisma, saveId, ahora);
    expect(op.acopio.destinos.find((d) => d.id === zona)?.categorias).toEqual([{ categoria: 'piedra', cantidad: 100 }]);
    expect(op.acopio.porteadores.map((s) => s.id)).toEqual(expect.arrayContaining([porteador, guardia]));
    expect(op.acopio.guardias.map((s) => s.id)).toEqual([guardia]);
  });

  it('rechaza sin porteadores y con una categoría sin recursos allí', async () => {
    const sin = await prisma.$transaction((tx) => lanzarPartida(tx, saveId, { tipo: 'ACOPIO', especie: '', categoria: 'piedra', destinoLocationId: zona, guardiaIds: [guardia] }, ahora));
    expect(sin).toEqual({ ok: false, motivo: 'Elige al menos un porteador.' });
    const mala = await prisma.$transaction((tx) => lanzarPartida(tx, saveId, { tipo: 'ACOPIO', especie: '', categoria: 'madera', destinoLocationId: zona, porteadorIds: [porteador] }, ahora));
    expect(mala.ok).toBe(false);
    expect((mala as { motivo: string }).motivo).toMatch(/No quedan recursos de madera/);
  });

  it('lanza el acopio con porteadores y guardias por rol; el guardia en viaje no cuenta en la guarnición', async () => {
    const antes = (await asentamientosDelReino(prisma, saveId))[0]!;
    expect(antes.guarnicion.map((g) => g.id)).toEqual([guardia]);
    const r = await prisma.$transaction((tx) => lanzarPartida(tx, saveId, { tipo: 'ACOPIO', especie: '', categoria: 'piedra', destinoLocationId: zona, porteadorIds: [porteador], guardiaIds: [guardia] }, ahora));
    expect(r.ok).toBe(true);
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId, tipo: 'ACOPIO' }, include: { miembros: true } });
    expect(v).toMatchObject({ objetivo: 'piedra', factionId: null, destinoLocationId: zona });
    expect(v.miembros.map((m) => [m.subjectId, m.rol]).sort()).toEqual([[guardia, 'guardia'], [porteador, 'porteador']].sort());
    expect((await asentamientosDelReino(prisma, saveId))[0]!.guarnicion).toEqual([]);
    expect((await partidasDelReino(prisma, saveId)).find((p) => p.id === v.id)?.acopio).toEqual({ categoria: 'piedra', total: 0 });
    // Ya fuera, no se puede mandar otra vez.
    const otra = await prisma.$transaction((tx) => lanzarPartida(tx, saveId, { tipo: 'ACOPIO', especie: '', categoria: 'piedra', destinoLocationId: zona, porteadorIds: [porteador] }, ahora));
    expect(otra.ok).toBe(false);
  });

  it('al llegar carga 10 por porteador con nombre y al volver hay AlmacenItem del save', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId, tipo: 'ACOPIO' } });
    await prisma.viajero.update({ where: { id: v.id }, data: { ubicacionLocationId: zona, estado: 'TRABAJANDO' } });
    const recargar = () => prisma.viajero.findUniqueOrThrow({ where: { id: v.id }, include: { miembros: true } });
    await prisma.$transaction(async (tx) => TRABAJOS.ACOPIO!.alLlegar!(tx, await recargar(), HOY + 1, () => 0.5));
    expect((await prisma.zonePoint.findFirstOrThrow({ where: { saveId, locationId: zona } })).cantidad).toBe(90);
    await prisma.$transaction(async (tx) => TRABAJOS.ACOPIO!.alVolver!(tx, await recargar(), HOY + 2, () => 0.5));
    expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(10);
  });

  it('al volver, el Reino respeta el tope de materiales del Almacén y avisa de lo que no cupo', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId, tipo: 'ACOPIO' } });
    // Tope base 60: ya hay 10; se llena hasta dejar 5 de hueco y la carga trae 10.
    const item = await prisma.almacenItem.findFirstOrThrow({ where: { saveId }, select: { name: true, description: true, catalogSlug: true } });
    await prisma.almacenItem.createMany({ data: Array.from({ length: 45 }, () => ({ saveId, ...item })) });
    await prisma.viajero.update({ where: { id: v.id }, data: { carga: { categoria: 'piedra', items: [{ slug: item.catalogSlug, name: item.name, description: item.description, n: 10 }] } } });
    const antes = await prisma.almacenItem.count({ where: { saveId } });
    await prisma.$transaction(async (tx) => TRABAJOS.ACOPIO!.alVolver!(tx, await prisma.viajero.findUniqueOrThrow({ where: { id: v.id }, include: { miembros: true } }), HOY + 3, () => 0.5));
    expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(antes + 5);
    await prisma.viajero.update({ where: { id: v.id }, data: { estado: 'TERMINADO' } });
  });

  it('solo cargan los porteadores con nombre que siguen activos', async () => {
    const vivo = (await prisma.subject.create({ data: { saveId, name: 'Vivo', role: 'trabajador', notes: '', pueblo: 'orcos' } })).id;
    const muerto = (await prisma.subject.create({ data: { saveId, name: 'Muerto', role: 'trabajador', notes: '', pueblo: 'orcos', estado: 'MUERTO' } })).id;
    await prisma.zonePoint.updateMany({ where: { saveId, locationId: zona }, data: { cantidad: 100, activo: true } });
    const r = await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'ACOPIO', objetivo: 'piedra', origenLocationId: casa, destinoLocationId: zona, dia: HOY + 4, miembros: [{ subjectId: vivo, rol: 'porteador' }, { subjectId: muerto, rol: 'porteador' }] }));
    if (!r.ok) throw new Error(r.motivo);
    await prisma.viajero.update({ where: { id: r.id }, data: { ubicacionLocationId: zona, estado: 'TRABAJANDO' } });
    await prisma.$transaction(async (tx) => TRABAJOS.ACOPIO!.alLlegar!(tx, await prisma.viajero.findUniqueOrThrow({ where: { id: r.id }, include: { miembros: true } }), HOY + 5, () => 0.5));
    expect((await prisma.zonePoint.findFirstOrThrow({ where: { saveId, locationId: zona } })).cantidad).toBe(90);
  });

  it('un lugar que no has visitado no sale como destino de acopio ni se puede lanzar', async () => {
    await prisma.locationVisit.deleteMany({ where: { saveId, locationId: zona } });
    const op = await opcionesDePartida(prisma, saveId, ahora);
    expect(op.acopio.destinos.map((d) => d.id)).not.toContain(zona);
    const r = await prisma.$transaction((tx) => lanzarPartida(tx, saveId, { tipo: 'ACOPIO', especie: '', categoria: 'piedra', destinoLocationId: zona, porteadorIds: [porteador] }, ahora));
    expect(r.ok).toBe(false);
  });
});
