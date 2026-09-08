import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Sistema de movimiento por cuadrícula (2026-09-08, "estilo Mount & Blade") — harness de
/// integración real (Postgres real, sin mocks) sobre una Location propia de este test, para no
/// depender de la posición/estado real de ZonePoint compartidos con otros tests. Réplica del
/// ejemplo real citado por la usuaria al diseñar esto: "me muevo a C7, que está a 2 celdas de una
/// cueva de Kirelon" — usa un NPC AGRESIVO real para probar colisión, y uno pacífico para probar
/// aviso/colisión sin combate.
const { zonaRoutes } = await import('./zona.js');

async function buildApp() {
  const app = Fastify();
  await app.register(zonaRoutes);
  return app;
}

describe('POST /saves/:id/zona/mover', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;
  let agresivoNpcId: string;
  let pacificoNpcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const location = await prisma.location.create({
      data: {
        worldId,
        slug: 'test-zona-mover-cuadricula',
        name: 'Zona de Prueba Cuadrícula',
        region: 'Zona de Pruebas',
        kind: 'hito',
        description: 'x',
        aliases: ['zona de prueba cuadricula'],
      },
    });
    locationId = location.id;

    const agresivo = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-mover-agresivo',
        name: 'Agresor de Prueba',
        aliases: ['agresor de prueba'],
        role: 'Bestia de prueba',
        level: 1,
        attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'AGRESIVO',
      },
    });
    agresivoNpcId = agresivo.id;

    const pacifico = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-mover-pacifico',
        name: 'Fauna Pacífica de Prueba',
        aliases: ['fauna pacifica de prueba'],
        role: 'Fauna de prueba',
        level: 1,
        attributes: { fuerza: 4, destreza: 6, constitucion: 4, inteligencia: 2, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    pacificoNpcId = pacifico.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (mover cuadrícula)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
        zonaPosX: 25, // celda (0,0)
        zonaPosY: 25,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.deleteMany({ where: { id: { in: [agresivoNpcId, pacificoNpcId] } } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  afterEach(async () => {
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 25, zonaPosY: 25, zonaCaminoPendiente: Prisma.JsonNull } });
  });

  it('sin ningún ZonePoint en la Location, avanza un paso limpio hacia el destino, sin colisión ni aviso', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } }, // celda (7,0), 7 celdas a la derecha
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.colision).toBeNull();
    expect(body.aviso).toBeNull();
    // Un solo paso: de celda (0,0) a (1,0) → píxel (75, 25) centro de esa celda.
    expect(body.jugador).toEqual({ x: 75, y: 25 });
    expect(body.caminoRestante.length).toBe(6); // quedan 6 celdas más hasta destino

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.zonaPosX).toBe(75);
    expect(saveAfter.zonaCaminoPendiente).not.toBeNull();
  });

  it('colisión real: el jugador entra en la MISMA celda que un ZonePoint AGRESIVO — el movimiento se detiene ahí, sin camino pendiente', async () => {
    // ZonePoint justo en la celda (1,0) — a 1 paso del origen, coincide exactamente con el primer
    // paso. Ruta de un único punto (fijo en su sitio): sin ella, el fallback de paseo aleatorio
    // (avanzarZonePointsUnPaso) lo movería antes de comprobar colisión, haciendo el test no
    // determinista — este test prueba la COLISIÓN, no el paseo aleatorio (que tiene su propio test).
    await prisma.zonePoint.create({
      data: { locationId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-agresivo', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.colision).toMatchObject({ targetSlug: 'test-mover-agresivo', targetName: 'Agresor de Prueba', temperamento: 'AGRESIVO' });
    expect(body.aviso).toBeNull();
    expect(body.jugador).toEqual({ x: 75, y: 25 });
    expect(body.caminoRestante).toEqual([]);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.zonaCaminoPendiente).toBeNull();
  });

  it('celda ADYACENTE (no exacta) a un ZonePoint pacífico: solo aviso, el movimiento sigue su curso', async () => {
    // ZonePoint en celda (2,0) — vecina de la celda destino del primer paso (1,0), no la misma.
    // Ruta de un único punto (fijo en su sitio), mismo motivo que el test de colisión de arriba.
    await prisma.zonePoint.create({
      data: { locationId, x: 125, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 125, y: 25 }] },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.colision).toBeNull();
    expect(body.aviso).toMatchObject({ targetSlug: 'test-mover-pacifico', targetName: 'Fauna Pacífica de Prueba' });
    // Sin colisión, el movimiento SÍ avanza y deja camino pendiente.
    expect(body.jugador).toEqual({ x: 75, y: 25 });
    expect(body.caminoRestante.length).toBeGreaterThan(0);
  });

  it('el mundo también se mueve: un ZonePoint con ruta artesanal avanza un paso a la vez que el jugador', async () => {
    // Ruta de 2 celdas (píxel), lejos del jugador para no interferir con colisión/aviso en este test.
    const ruta = [{ x: 725, y: 575 }, { x: 675, y: 575 }]; // celdas (14,11) y (13,11)
    const punto = await prisma.zonePoint.create({
      data: { locationId, x: 725, y: 575, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta, pasoRuta: 0 },
    });
    const app = await buildApp();
    await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 75, y: 25 } } });

    const puntoAfter = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    expect(puntoAfter.x).toBe(675);
    expect(puntoAfter.y).toBe(575);
    expect(puntoAfter.pasoRuta).toBe(1);
  });

  it('recalcula el camino desde cero si el jugador pulsa un destino DISTINTO a mitad de un movimiento en curso', async () => {
    const app = await buildApp();
    // Primer movimiento: hacia la derecha.
    await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    // Segundo clic: el jugador cambia de idea, ahora hacia abajo.
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 75, y: 275 } } });
    const body = JSON.parse(res.body);
    // Debe moverse hacia ABAJO (nueva dirección), no seguir el camino viejo hacia la derecha.
    expect(body.jugador.y).toBeGreaterThan(25);
  });
});
