import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { ownerKeyFor } from '../../services/reinoOwner.js';
import { avanzarViajeros, enlacesDelMundo, rutaMasCorta } from '../../services/viajeros.js';
import { partidasRoutes } from './partidas.js';
import { revisarPiezas } from '../../services/partidasCaza.js';

/// CR-63 (63d): Reino › Partidas — quién puede salir y adónde, lanzar con orden permanente, que se
/// repita y se pare, y las órdenes de volver y cambiar de destino.
async function buildApp() {
  const app = Fastify();
  await app.register(partidasRoutes);
  return app;
}

describe('Reino › Partidas (CR-63 63d)', () => {
  let saveId: string;
  let casa: string;
  let coto: string;
  let otro: string;
  let cazadores: string[];

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Señora de la caza (CR-63)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'S',
        worldState: { create: { fictionalMinutes: 30 * 1440 } },
      },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }) } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    casa = enlaces[0]!.fromId;
    coto = enlaces[0]!.toId;
    // Otro lugar con camino desde casa (los enlaces no forman un solo mapa conexo).
    otro = [...new Set(enlaces.flatMap((e) => [e.fromId, e.toId]))].find((l) => l !== casa && l !== coto && rutaMasCorta(enlaces, casa, l) !== null)!;
    await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'ayuntamiento', name: 'Ayuntamiento', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } });
    // Con Desolladero de sobra, la orden permanente no se para por las piezas que traen.
    await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'desolladero', name: 'Desolladero', kind: 'desolladero', description: 'x', status: 'ACTIVO', tier: 3 } });
    for (const l of [coto, otro]) {
      await prisma.locationVisit.create({ data: { saveId, locationId: l } });
      await prisma.zonePoint.create({ data: { saveId, locationId: l, tipo: 'FAUNA', targetSlug: 'murgol', x: 100, y: 100, cantidad: 40 } });
    }
    cazadores = [];
    for (let i = 0; i < 4; i++) cazadores.push((await prisma.subject.create({ data: { saveId, name: `Cazadora ${i}`, role: 'cazador', notes: '', pueblo: 'orcos' } })).id);
    await prisma.subject.create({ data: { saveId, name: 'Labriega', role: 'trabajador', notes: '', pueblo: 'orcos' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('opciones: solo los cazadores y los lugares que conoces con fauna y camino', async () => {
    const app = await buildApp();
    const r = (await app.inject({ method: 'GET', url: `/saves/${saveId}/partidas` })).json();
    expect(r.opciones.origen.id).toBe(casa);
    expect(r.opciones.cazadores.map((c: { id: string }) => c.id).sort()).toEqual([...cazadores].sort());
    const destino = r.opciones.destinos.find((d: { id: string }) => d.id === coto);
    expect(destino.especies).toEqual([expect.objectContaining({ slug: 'murgol', cantidad: 40 })]);
  });

  it('lanza con orden permanente; repite al volver y ya no ofrece a quien está fuera', async () => {
    const app = await buildApp();
    const mal = await app.inject({ method: 'POST', url: `/saves/${saveId}/partidas`, payload: { tipo: 'CAZA', especie: 'murgol', destinoLocationId: coto, subjectIds: [] } });
    expect(mal.statusCode).toBe(400);
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/partidas`, payload: { tipo: 'CAZA', especie: 'murgol', destinoLocationId: coto, subjectIds: cazadores, permanente: true } });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect((await app.inject({ method: 'GET', url: `/saves/${saveId}/partidas` })).json().opciones.cazadores).toEqual([]);
    // Ida, un día cazando, vuelta: al volver sale otra vez (orden permanente) si no ha caído nadie.
    let salidas = 0;
    for (let d = 31; d <= 50; d++) {
      const antes = (await prisma.viajero.findUniqueOrThrow({ where: { id } })).diaSalida;
      await avanzarViajeros(prisma, saveId, d, () => 0.99);
      // Como en el avance diario: el Desolladero trata las piezas cada día.
      await prisma.$transaction((tx) => revisarPiezas(tx, saveId, d));
      const v = await prisma.viajero.findUniqueOrThrow({ where: { id } });
      if (v.diaSalida !== antes) salidas++;
      if (v.estado === 'TERMINADO') break;
    }
    const v = await prisma.viajero.findUniqueOrThrow({ where: { id } });
    // Con el azar alto nadie muere: sigue repitiendo.
    expect(salidas).toBeGreaterThan(0);
    expect(v.estado).not.toBe('TERMINADO');
    expect((v.orden as { repetir: boolean }).repetir).toBe(true);
  });

  // P313 (usuaria, 2026-10-26): una especie agotada sigue en la lista (con 0) y no se puede mandar a nadie a por ella.
  it('P313: una especie agotada sigue en las opciones con cantidad 0 y no se lanza', async () => {
    const agotado = await prisma.zonePoint.create({ data: { saveId, locationId: coto, tipo: 'FAUNA', targetSlug: 'especie-agotada-p313', x: 200, y: 200, cantidad: 0, activo: false } });
    try {
      const app = await buildApp();
      const r = (await app.inject({ method: 'GET', url: `/saves/${saveId}/partidas` })).json();
      const destino = r.opciones.destinos.find((d: { id: string }) => d.id === coto);
      expect(destino.especies).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'especie-agotada-p313', cantidad: 0 })]));
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/partidas`, payload: { tipo: 'CAZA', especie: 'especie-agotada-p313', destinoLocationId: coto, subjectIds: [cazadores[0]] } });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body).toMatch(/No quedan presas de especie-agotada-p313 en .* por ahora/);
    } finally {
      await prisma.zonePoint.delete({ where: { id: agotado.id } });
    }
  });

  it('órdenes: cambiar de destino de camino, parar la repetición y volver', async () => {
    const app = await buildApp();
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId } });
    await prisma.viajero.update({ where: { id: v.id }, data: { estado: 'IDA', ubicacionLocationId: casa, ruta: [coto], minutosEnTramo: 0 } });
    const cambio = await app.inject({ method: 'POST', url: `/saves/${saveId}/partidas/${v.id}/orden`, payload: { accion: 'destino', destinoLocationId: otro } });
    expect(cambio.statusCode).toBe(200);
    expect((await prisma.viajero.findUniqueOrThrow({ where: { id: v.id } })).destinoLocationId).toBe(otro);
    await app.inject({ method: 'POST', url: `/saves/${saveId}/partidas/${v.id}/orden`, payload: { accion: 'parar' } });
    expect((await prisma.viajero.findUniqueOrThrow({ where: { id: v.id } })).orden).toEqual({ repetir: false });
    await app.inject({ method: 'POST', url: `/saves/${saveId}/partidas/${v.id}/orden`, payload: { accion: 'volver' } });
    expect(await prisma.viajero.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject({ estado: 'VUELTA', ruta: [] });
    const lista = (await app.inject({ method: 'GET', url: `/saves/${saveId}/partidas` })).json().partidas;
    expect(lista[0]).toMatchObject({ id: v.id, tipo: 'CAZA', especieNombre: 'Múrgol', permanente: false });
    expect(lista[0].miembros).toHaveLength(4);
  });

  it('una orden permanente se para si cae alguien de los suyos', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId } });
    await prisma.viajero.update({ where: { id: v.id }, data: { estado: 'VUELTA', ruta: [], orden: { repetir: true } } });
    await prisma.subject.update({ where: { id: cazadores[0]! }, data: { estado: 'MUERTO' } });
    await avanzarViajeros(prisma, saveId, 80, () => 0.99);
    const fin = await prisma.viajero.findUniqueOrThrow({ where: { id: v.id } });
    expect(fin.estado).toBe('TERMINADO');
    expect(fin.orden).toBeNull();
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'deja de repetir su orden: ha caído alguien' } } })).toBe(1);
  });
});
