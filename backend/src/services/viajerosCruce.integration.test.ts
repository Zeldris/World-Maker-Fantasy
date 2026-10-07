import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { avanzarViajeros, crearViajero, enlacesDelMundo, rutaMasCorta } from './viajeros.js';
import { comprarCarneAViajero, diasParaVolver, preguntarAViajero, venderAViajero, viajerosAqui } from './viajerosCruce.js';
import { expedicionesVisibles } from './expedicionesMapa.js';

/// CR-63 (63e, Q9): los viajeros en el mapa de Berig y al cruzarte con ellos.
describe('cruzarse con viajeros (CR-63 63e)', () => {
  let saveId: string;
  let ruta: string[];
  let faccionId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    const ids = [...new Set(enlaces.flatMap((e) => [e.fromId, e.toId]))].sort();
    let par: string[] | null = null;
    for (const a of ids) for (const b of ids) {
      if (par || a === b) continue;
      const r = rutaMasCorta(enlaces, a, b);
      if (r && r.length >= 2) par = [a, ...r];
    }
    ruta = par!;
    const casa = await prisma.location.findUniqueOrThrow({ where: { id: ruta[0]! } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Caminante (CR-63)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'C',
        currentLocationId: ruta[1]!, goirnos: 100,
        worldState: { create: { fictionalMinutes: 10 * 1440 } },
      },
    })).id;
    faccionId = (await prisma.faction.create({ data: { worldId: world.id, saveId, slug: 'cazadores-del-llano', name: 'Cazadores del Llano', raza: 'orcos', description: 'x', kingdomStats: { create: { ownerKey: `faccion-prueba-${saveId}`, riqueza: 0 } } } })).id;
    // Algo de fauna a la vista en el lugar por el que pasarán.
    await prisma.zonePoint.create({ data: { saveId, locationId: ruta[1]!, tipo: 'FAUNA', targetSlug: 'murgol', x: 1, y: 1, cantidad: 5 } });
    expect(casa).toBeTruthy();
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un viajero de otra facción en tu región sale en el mapa de Berig, y uno tuyo siempre', async () => {
    await prisma.$transaction((tx) => crearViajero(tx, { saveId, factionId: faccionId, tipo: 'CAZA', objetivo: 'murgol', origenLocationId: ruta[0]!, destinoLocationId: ruta.at(-1)!, dia: 10, miembros: [{ genericos: 8, rol: 'cazador' }] }));
    await avanzarViajeros(prisma, saveId, 11, () => 0.5);
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId } });
    const mapa = await expedicionesVisibles(prisma, saveId);
    const enMapa = mapa.find((e) => e.id === v.id);
    expect(enMapa).toMatchObject({ faccion: 'Cazadores del Llano', oficio: 'partida de caza', delReino: false });
    expect(enMapa!.progreso).toBeGreaterThanOrEqual(0);
    expect(enMapa!.progreso).toBeLessThanOrEqual(0.5);
    const enlaces = await enlacesDelMundo(prisma, (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).worldId);
    expect(enMapa!.diaRegreso).toBe(10 + diasParaVolver(enlaces, v)); // el día del reloj de la partida
  });

  it('de paso por aquí: preguntar cuenta lo que vio y comprar carne cobra y entrega', async () => {
    // El personaje está donde está el viajero.
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: v.ubicacionLocationId } });
    const aqui = await prisma.$transaction((tx) => viajerosAqui(tx, saveId));
    expect(aqui).toEqual([expect.objectContaining({ id: v.id, propia: false, quien: 'Cazadores del Llano', que: 'partida de caza de Múrgol', gente: 8 })]);
    const r = await prisma.$transaction((tx) => preguntarAViajero(tx, saveId, v.id));
    expect(r.ok).toBe(true);
    if (r.ok && v.ubicacionLocationId === ruta[1]) expect(r.lineas.join(' ')).toContain('5 Múrgol');
    // Sin piezas no venden; con piezas, una pieza de carne por su precio.
    expect(await prisma.$transaction((tx) => comprarCarneAViajero(tx, saveId, v.id))).toEqual({ ok: false, motivo: 'No llevan nada que vender.' });
    await prisma.viajero.update({ where: { id: v.id }, data: { carga: { especie: 'murgol', piezas: 2, diaCaza: 11, resumen: 'x' } } });
    const compra = await prisma.$transaction((tx) => comprarCarneAViajero(tx, saveId, v.id));
    expect(compra.ok).toBe(true);
    if (!compra.ok) return;
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos).toBe(100 - compra.precio);
    expect(await prisma.inventoryItem.count({ where: { saveId } })).toBe(compra.items.length);
    expect(((await prisma.viajero.findUniqueOrThrow({ where: { id: v.id } })).carga as { piezas: number }).piezas).toBe(1);
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: faccionId } })).riqueza).toBe(compra.precio);
  });

  it('al preguntar te pasan, como rumor, lo que pasó por donde vinieron; y les vendes comida', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId } });
    const pasado = (v.diario as { locationId: string }[])[0]!.locationId;
    const suceso = await prisma.suceso.create({ data: { saveId, tipo: 'MUERTE_NPC', familia: 'VIDA_MUERTE', fictionalMinutes: 10 * 1440 + 60, locationId: pasado, importancia: 6, origen: 'MUNDO', semilla: 'cr63-rumor', datos: { npcSlug: 'x' }, texto: 'Alguien cae en el camino.' } });
    const r = await prisma.$transaction((tx) => preguntarAViajero(tx, saveId, v.id));
    expect(r.ok && r.lineas.at(-1)).toContain('algo que ha pasado');
    expect(await prisma.conocimiento.findFirst({ where: { saveId, sucesoId: suceso.id } })).toMatchObject({ confirmado: false, via: 'NPC', fuente: 'partida de Cazadores del Llano' });
    // Vender: solo comida y si la facción puede pagar.
    const piedra = await prisma.inventoryItem.create({ data: { saveId, name: 'Piedra', description: 'x', catalogSlug: 'bloque-piedra-tallada' } });
    expect(await prisma.$transaction((tx) => venderAViajero(tx, saveId, v.id, piedra.id))).toEqual({ ok: false, motivo: 'Solo compran comida.' });
    const carne = await prisma.inventoryItem.create({ data: { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' } });
    const goirnos = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;
    const venta = await prisma.$transaction((tx) => venderAViajero(tx, saveId, v.id, carne.id));
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos).toBe(goirnos + venta.precio);
    expect(await prisma.inventoryItem.findUnique({ where: { id: carne.id } })).toBeNull();
  });

  it('si ya no está aquí, no se le puede preguntar', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: v.ubicacionLocationId === ruta[0] ? ruta.at(-1)! : ruta[0]! } });
    expect(await prisma.$transaction((tx) => preguntarAViajero(tx, saveId, v.id))).toEqual({ ok: false, motivo: 'Ya no están aquí.' });
  });
});
