import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { registrarSuceso } from '../../services/cronista/sucesos.js';

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
  let dinamicoNpcId: string;
  let maestroNpcId: string;
  let guardiaNpcId: string;
  let principalNpcId: string;

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
        articulo: 'la',
        genero: 'F',
        level: 1,
        attributes: { fuerza: 4, destreza: 6, constitucion: 4, inteligencia: 2, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    pacificoNpcId = pacifico.id;

    // NPC "dinámico" (2026-09-09, bug real jugando en vivo — Álvaro: "me he movido hasta la
    // casilla anterior a un NPC... pero no pasa nada... me puedo seguir moviendo libremente") —
    // sin `ZonePoint` propio, itinerante (`homeLocationSlug: null`), entra en escena vía
    // `detectNpcsInScene`/sessionFacts (ver cada test que lo usa, siembra el sessionFact que lo
    // menciona) con posición real en `NpcState.zonaPosX/Y` (nunca `ZonePoint.x/y`).
    const dinamico = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-mover-dinamico',
        name: 'Merodeador Dinámico de Prueba',
        aliases: ['merodeador dinámico de prueba', 'merodeador'],
        role: 'Bestia de prueba (dinámica)',
        level: 1,
        attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 2, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'AGRESIVO',
      },
    });
    dinamicoNpcId = dinamico.id;

    // Sistema de plantillas de movimiento (2026-09-17) — 2 NPCs reales para probar la inferencia
    // GENERAL de extremo a extremo (sin ruta artesanal ni plantillaEspecifica asignada): un
    // "Maestro" (role que matchea ROLE_MAESTRO_REGEX) debe quedarse ESTATICO en su origen, un
    // "guardia" (role que matchea ROLE_GUARDIA_REGEX) debe seguir PATRULLA_BREVE (determinista,
    // sin random) en vez del antiguo paseo aleatorio único.
    const maestro = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-mover-maestro',
        name: 'Maestro de Prueba',
        aliases: ['maestro de prueba'],
        role: 'Maestro Herrero de prueba',
        level: 1,
        attributes: { fuerza: 8, destreza: 6, constitucion: 8, inteligencia: 6, voluntad: 6, carisma: 4, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    maestroNpcId = maestro.id;

    const guardia = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-mover-guardia',
        name: 'Guardia de Prueba',
        aliases: ['guardia de prueba'],
        role: 'Guardia de las murallas de prueba',
        level: 1,
        attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 6, carisma: 4, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    guardiaNpcId = guardia.id;

    // NPC único de trama (`kind: 'PRINCIPAL'`, nombre propio) con `ZonePoint` fijo — mismo perfil
    // real que el Orco Enfurecido (bug real jugando en vivo, 2026-09-20: "al vencer al orco...
    // no desaparecía correctamente y me bloqueaba la partida"). Ver `zonePointNpcMuertoParaSiempre`.
    const principal = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PRINCIPAL',
        slug: 'test-mover-principal',
        name: 'Enemigo Único de Prueba',
        aliases: ['enemigo único de prueba'],
        role: 'Jefe de prueba',
        level: 1,
        attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'AGRESIVO',
      },
    });
    principalNpcId = principal.id;

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
    await prisma.npc.deleteMany({ where: { id: { in: [agresivoNpcId, pacificoNpcId, dinamicoNpcId, maestroNpcId, guardiaNpcId, principalNpcId] } } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  afterEach(async () => {
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId, npcId: { in: [dinamicoNpcId, principalNpcId] } } });
    await prisma.sessionFact.deleteMany({ where: { saveId } });
    await prisma.save.update({
      where: { id: saveId },
      data: { zonaPosX: 25, zonaPosY: 25, zonaCaminoPendiente: Prisma.JsonNull, pendingDynamicModeOffer: Prisma.JsonNull, zonaUltimoEncuentro: Prisma.JsonNull },
    });
  });

  // Hallazgo 45 (revisar-partida-hallazgos.md, 2026-09-15): sin candado, dos peticiones
  // concurrentes reales al mismo saveId podían leer la misma posición de partida y escribir cada
  // una su propio "siguiente paso" — la segunda pisando/duplicando la primera.
  it('dos peticiones concurrentes al mismo saveId: la segunda recibe 409, solo una avanza de verdad', async () => {
    const app = await buildApp();
    const [first, second] = await Promise.all([
      app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } }),
      app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } }),
    ]);
    const statusCodes = [first.statusCode, second.statusCode].sort();
    expect(statusCodes).toEqual([200, 409]);

    const rejected = first.statusCode === 409 ? first : second;
    expect(JSON.parse(rejected.body).error).toMatch(/movimiento en curso/i);

    // Solo UN paso real se aplicó — no dos pasos acumulados por la petición rechazada colándose de
    // todos modos.
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.zonaPosX).toBe(75);
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
    // Un solo paso: de celda (0,0) a (1,0) → píxel (75, 25) centro de esa celda.
    expect(body.jugador).toEqual({ x: 75, y: 25 });
    expect(body.caminoRestante.length).toBe(6); // quedan 6 celdas más hasta destino
    expect(body.llegado).toBe(false); // P135: aún no es el último paso

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.zonaPosX).toBe(75);
    expect(saveAfter.zonaCaminoPendiente).not.toBeNull();

    // F9-2: la respuesta trae la hora tras el paso (el reloj avanza 1 min por paso, B2) — la misma
    // que quedó en BD — para que el frontend actualice la cabecera sin esperar al siguiente turno.
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(body.fictionalMinutes).toBe(ws.fictionalMinutes);
    expect(body.fictionalDateLabel).toBe(ws.fictionalDateLabel);
    expect(body.fictionalMinutes).toBeGreaterThan(480);
  });

  it('colisión real: el jugador entra en la MISMA celda que un ZonePoint AGRESIVO — dispara Interactuar con combateForzado (2026-09-20)', async () => {
    // ZonePoint justo en la celda (1,0) — a 1 paso del origen, coincide exactamente con el primer
    // paso. Ruta de un único punto (fijo en su sitio): sin ella, el fallback de paseo aleatorio
    // (avanzarZonePointsUnPaso) lo movería antes de comprobar colisión, haciendo el test no
    // determinista — este test prueba la COLISIÓN, no el paseo aleatorio (que tiene su propio test).
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-agresivo', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
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
    expect(body.jugador).toEqual({ x: 75, y: 25 });
    expect(body.caminoRestante).toEqual([]);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.zonaCaminoPendiente).toBeNull();
    // Corrección de diseño (2026-09-20, hallazgo real jugando en vivo — Álvaro: "todos los
    // encuentros deben provocar el interactuar... si choco con el orco me dice que está ahí y
    // tengo que escribir para que salte el combate, cuando debería saltar el interactuar") — un
    // AGRESIVO en la misma celda AHORA sí dispara la tarjeta de Interactuar, marcada
    // `combateForzado: true` para que el modal ofrezca Combatir/Huir en vez de conversación normal.
    expect(body.dynamicModeOffer).toMatchObject({
      tipo: 'FAUNA',
      targetSlug: 'test-mover-agresivo',
      targetName: 'Agresor de Prueba',
      combateForzado: true,
    });
    expect(['jugador', 'npc']).toContain(body.dynamicModeOffer.quienInicia);
    // QA-27 P27: quien te corta el paso también lleva el aviso de riesgo de la tarjeta.
    expect(['bajo', 'alto', 'mortal']).toContain(body.dynamicModeOffer.riesgoCaza?.riesgo);
    expect(saveAfter.pendingDynamicModeOffer).toMatchObject({ combateForzado: true });
    // Un LogEntry real avisando del encuentro inevitable sigue existiendo (mismo criterio de
    // siempre: nunca desaparece sin dejar rastro).
    expect(body.logEntry).not.toBeNull();
    expect(body.logEntry.text).toContain('Agresor de Prueba');
    const logEntryCreado = await prisma.logEntry.findUnique({ where: { id: body.logEntry.id } });
    expect(logEntryCreado).not.toBeNull();
  });

  // P116 (QA-27, decisión de la usuaria 2026-10-13): junto a una entrada, la fauna hostil no corta el
  // paso ni persigue. La zona de prueba no tiene coordenadas: su salida es la puerta de abajo (400,550).
  describe('P116 — radio seguro de las entradas', () => {
    let otraId: string;
    let linkId: string;
    beforeAll(async () => {
      const otra = await prisma.location.create({ data: { worldId, slug: 'test-zona-mover-vecina', name: 'Vecina de prueba', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: [] } });
      otraId = otra.id;
      linkId = (await prisma.locationLink.create({ data: { fromId: locationId, toId: otraId, minutosBase: 10, terreno: 'llano' } })).id;
    });
    afterAll(async () => {
      await prisma.locationLink.delete({ where: { id: linkId } });
      await prisma.location.delete({ where: { id: otraId } });
    });

    it('un agresivo junto a la entrada no corta el paso', async () => {
      await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 325, zonaPosY: 525 } });
      await prisma.zonePoint.create({
        data: { locationId, saveId, x: 425, y: 525, tipo: 'FAUNA', targetSlug: 'test-mover-agresivo', cantidad: 1, activo: true, ruta: [{ x: 425, y: 525 }] },
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 525 } } });
      const body = JSON.parse(res.body);
      expect(body.colision).toBeNull();
      expect(body.dynamicModeOffer).toBeNull();
    });

    it('con la jugadora junto a la entrada un agresivo cercano no la persigue', async () => {
      // La jugadora pasa a la celda (10,10), a 2 de la entrada (8,11); el agresivo, en (12,10), queda a
      // 2 de ella (rango de persecución) y a 4 de la entrada: perseguirla lo metería en el radio.
      await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 575, zonaPosY: 525 } });
      const punto = await prisma.zonePoint.create({
        data: { locationId, saveId, x: 625, y: 525, tipo: 'FAUNA', targetSlug: 'test-mover-agresivo', cantidad: 1, activo: true },
      });
      const app = await buildApp();
      await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 525, y: 525 } } });
      const despues = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
      const col = Math.floor(despues.x / 50);
      const row = Math.floor(despues.y / 50);
      expect(Math.max(Math.abs(col - 8), Math.abs(row - 11))).toBeGreaterThan(3);
    });
  });

  // QA-27 P82: tras reaparecer (suceso RENACER reciente), un AGRESIVO en la casilla no corta el paso.
  it('gracia tras reaparecer: un AGRESIVO en la casilla no corta el paso durante la gracia', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-agresivo', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
    });
    const ahora = (await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).fictionalMinutes;
    await prisma.$transaction((tx) =>
      registrarSuceso(tx, {
        saveId, tipo: 'RENACER', fictionalMinutes: ahora, locationId, origen: 'JUGADOR',
        actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AFECTADO' }],
        datos: { personaje: 'Prueba', lugar: 'Prueba' },
      }),
    );
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.colision).toBeNull();
      expect(body.dynamicModeOffer ?? null).toBeNull();
    } finally {
      await prisma.suceso.deleteMany({ where: { saveId, tipo: 'RENACER' } });
    }
  });

  // Bug real jugando en vivo (2026-09-20, Álvaro: "al vencer al orco... no desaparecía
  // correctamente y me bloqueaba la partida") — un NPC único (`kind: 'PRINCIPAL'`) con `ZonePoint`
  // fijo, derrotado en combate (`NpcState.condicionFisica: 'MUERTO'`), no debe volver a colisionar
  // NUNCA, ni siquiera pasada la ventana normal de "ausente por combate ganado" (6h,
  // `zonaAusenteHastaMinutes`) que sí aplica a fauna genérica. Ver `zonePointNpcMuertoParaSiempre`.
  describe('NPC único (kind: PRINCIPAL) derrotado — muerte permanente, nunca reaparece (2026-09-20)', () => {
    afterEach(async () => {
      await prisma.npcState.deleteMany({ where: { saveId, npcId: principalNpcId } });
    });

    it('vivo: colisiona normalmente como cualquier AGRESIVO', async () => {
      await prisma.zonePoint.create({
        data: { locationId, saveId, x: 75, y: 25, tipo: 'NPC', targetSlug: 'test-mover-principal', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.colision).toMatchObject({ targetSlug: 'test-mover-principal', temperamento: 'AGRESIVO' });
    });

    it('muerto (condicionFisica: MUERTO, dentro de la ventana de 6h): ya no colisiona', async () => {
      await prisma.zonePoint.create({
        data: { locationId, saveId, x: 75, y: 25, tipo: 'NPC', targetSlug: 'test-mover-principal', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
      });
      await prisma.npcState.create({
        data: {
          saveId,
          npcId: principalNpcId,
          scope: '',
          condicionFisica: 'MUERTO',
          zonaAusenteHastaMinutes: 480 + 6 * 60,
          zonaLocationId: locationId,
        },
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.colision).toBeNull();
    });

    // P269/P329: el orco convaleciente (perdonado con Clemente) volvía a cortar el paso en el siguiente movimiento.
    it('convaleciente (derrotado y perdonado): no corta el paso; sano otra vez, sí', async () => {
      await prisma.zonePoint.create({
        data: { locationId, saveId, x: 75, y: 25, tipo: 'NPC', targetSlug: 'test-mover-principal', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
      });
      await prisma.npcState.create({ data: { saveId, npcId: principalNpcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).colision).toBeNull();
      await prisma.npcState.updateMany({ where: { saveId, npcId: principalNpcId }, data: { condicionFisica: 'ILESO' } });
      await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 25, zonaPosY: 25, zonaCaminoPendiente: Prisma.JsonNull, pendingDynamicModeOffer: Prisma.JsonNull, pendingDynamicMode: Prisma.JsonNull, zonaUltimoEncuentro: Prisma.JsonNull } });
      const otra = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(JSON.parse(otra.body).colision).toMatchObject({ targetSlug: 'test-mover-principal' });
    });

    // Revisión de P269/P329: el `NpcState` de fauna y plantillas es uno por especie y lugar; un individuo
    // convaleciente no puede silenciar la colisión de todos los de su especie en la zona.
    it('fauna convaleciente (estado compartido por especie y lugar): los demás de su especie siguen cortando el paso', async () => {
      await prisma.zonePoint.create({
        data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-agresivo', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
      });
      await prisma.npcState.create({ data: { saveId, npcId: agresivoNpcId, scope: locationId, condicionFisica: 'CONVALECIENTE' } });
      try {
        const app = await buildApp();
        const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).colision).toMatchObject({ targetSlug: 'test-mover-agresivo' });
      } finally {
        await prisma.npcState.deleteMany({ where: { saveId, npcId: agresivoNpcId } });
      }
    });

    it('muerto y con la ventana de 6h ya vencida: sigue sin colisionar (a diferencia de fauna genérica, nunca reaparece)', async () => {
      await prisma.zonePoint.create({
        data: { locationId, saveId, x: 75, y: 25, tipo: 'NPC', targetSlug: 'test-mover-principal', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
      });
      await prisma.npcState.create({
        data: {
          saveId,
          npcId: principalNpcId,
          scope: '',
          condicionFisica: 'MUERTO',
          // Ventana de 6h ya vencida (muy en el pasado respecto al reloj de la partida, 480 min) —
          // sin el fix, `estaAusente` deja de aplicar y el fantasma vuelve a colisionar.
          zonaAusenteHastaMinutes: 1,
          zonaLocationId: locationId,
        },
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.colision).toBeNull();
    });
  });

  // Regresión (2026-09-08, mismo hallazgo de arriba) — a diferencia del AGRESIVO, un CAUTELOSO/
  // INOFENSIVO en la MISMA celda debe disparar una acción real: la tarjeta de Interactuar
  // (`pendingDynamicModeOffer`), reutilizando el mismo flujo ya existente (OfferCard →
  // DynamicModeModal) — antes solo dejaba un mensaje de texto plano sin ninguna consecuencia.
  // P190 (QA-27): el rebaño de un bando avisa de quién es y de lo que cuesta que te vean cazarlo.
  it('colisión con fauna de un bando: la oferta dice de quién es y cuánta reputación cuesta', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }], factionSlug: 'Clan Serhu' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).dynamicModeOffer.deBando).toEqual({ faccion: 'Clan Serhu', deQuien: 'del Clan Serhu', reputacion: -100 });
  });

  it('colisión con un ZonePoint PACÍFICO (misma celda): dispara pendingDynamicModeOffer real', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.colision).toMatchObject({ targetSlug: 'test-mover-pacifico', temperamento: 'CAUTELOSO' });
    // P166 (QA-27, usuaria 2026-10-17): con alguien tranquilo no hay «¿Quién ve a quién primero?»: te
    // topas con él, sin tirada (solo la hay con alguien hostil, más abajo).
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', targetName: 'Fauna Pacífica de Prueba', quienInicia: 'jugador' });
    // Regresión (2026-09-09, hallazgo real jugando en vivo: la oferta quedaba persistida en BD
    // pero invisible en el log, porque LogPanel.tsx solo la pinta colgada de una LogEntry
    // concreta) — el encuentro debe dejar su propio LogEntry real determinista, no solo la oferta.
    expect(body.logEntry).toMatchObject({ text: expect.stringContaining('se topa con una Fauna Pacífica de Prueba') });
    // P196: el aviso lleva el artículo, como el diario («Una Fauna Pacífica de Prueba busca tu atención»).
    expect(body.dynamicModeOffer.quien).toBe('Una Fauna Pacífica de Prueba');
    expect(body.dynamicModeOffer.deBando).toBeUndefined();
    expect(body.logEntry.roll).toBeUndefined();
    const logRow = await prisma.logEntry.findUnique({ where: { id: body.logEntry.id } });
    expect(logRow).not.toBeNull();
    expect(logRow!.saveId).toBe(saveId);
    expect(logRow!.roll).toBeNull();

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', targetName: 'Fauna Pacífica de Prueba' });
  });

  // QA-27 (P3, 2026-10-09, jugando): la tirada de «quién ve a quién primero» usaba la Destreza sin
  // el equipo, mientras la huida y el combate sí la sumaban (Gorhorn: +3 en una y +5 en la otra).
  it('«¿quién ve a quién primero?» cuenta la Destreza del equipo puesto', async () => {
    // Con alguien hostil, el único encuentro que tira (P166).
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-agresivo', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
    });
    const item = await prisma.inventoryItem.create({
      data: { saveId, name: 'Pantalones de prueba', description: 'Prueba', slot: 'ARMADURA_INFERIOR', statBonuses: { destreza: 4 } },
    });
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).logEntry.roll).toMatchObject({ kind: 'iniciativa-encuentro', jugador: { attribute: 'destreza', value: 14 } });
    } finally {
      await prisma.inventoryItem.delete({ where: { id: item.id } });
    }
  });

  // Regresión (2026-09-08, reproducido jugando en vivo: "llego a la celda adyacente de Gistera,
  // clico su misma celda de nuevo, y no pasa nada") — `calcularCamino(origen, destino)` devuelve
  // `[]` en cuanto origen y destino YA son la misma celda (su `while` nunca se ejecuta). El bloque
  // de "camino vacío" devolvía `colision: null` sin comprobar nada — el jugador podía estar parado
  // JUSTO ENCIMA de un NPC/fauna real (llegó ahí en un paso anterior) y un clic de más nunca se lo
  // decía. Reproduce el escenario exacto: el destino clicado resuelve a la MISMA celda donde el
  // jugador YA está, con un ZonePoint real en esa celda.
  it('destino clicado ya coincide con la celda ACTUAL del jugador (camino vacío) — SÍ evalúa colisión/aviso, no los ignora', async () => {
    // ZonePoint justo en la celda de origen del jugador (0,0) — antes de este fix, ni el guard de
    // arriba (que solo compara contra `siguienteCelda`, nunca existe si el camino está vacío) ni
    // este otro caso comprobaban nada.
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 25, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 25, y: 25 }] },
    });
    const app = await buildApp();
    // Destino = misma celda que la posición inicial del jugador (25,25) — calcularCamino da [].
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 25, y: 25 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.caminoRestante).toEqual([]);
    expect(body.colision).toMatchObject({ targetSlug: 'test-mover-pacifico', temperamento: 'CAUTELOSO' });
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', targetName: 'Fauna Pacífica de Prueba' });

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', targetName: 'Fauna Pacífica de Prueba' });
  });

  it('celda ADYACENTE (no exacta) a un ZonePoint pacífico: dispara Interactuar igual que la misma celda (2026-09-17)', async () => {
    // ZonePoint en celda (2,0) — vecina de la celda destino del primer paso (1,0), no la misma.
    // Ruta de un único punto (fijo en su sitio), mismo motivo que el test de colisión de arriba.
    //
    // Petición explícita de Álvaro, 2026-09-17: "revisa bien que si estas a una casilla de un
    // elemento salte el interactuar... a mi hay veces que no me funciona y es frustrante" — antes
    // la celda adyacente solo dejaba un "aviso" de texto plano sin abrir nada; ahora dispara
    // exactamente el mismo árbol de decisión que la MISMA celda (colisión/Interactuar/combate).
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 125, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 125, y: 25 }] },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.colision).toMatchObject({ targetSlug: 'test-mover-pacifico', targetName: 'Fauna Pacífica de Prueba', temperamento: 'CAUTELOSO' });
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', targetName: 'Fauna Pacífica de Prueba' });
    expect(['jugador', 'npc']).toContain(body.dynamicModeOffer.quienInicia);
    // Una colisión (ahora también la adyacente) detiene el avance — sin camino pendiente.
    expect(body.jugador).toEqual({ x: 75, y: 25 });
    expect(body.caminoRestante).toEqual([]);
  });

  // P143 (decisión de la usuaria, 2026-10-13): en un asentamiento, un NPC no hostil no corta el paso
  // al caminar; se le habla yendo hasta él o pulsando la propia casilla.
  describe('P143 — NPC no hostiles en un asentamiento', () => {
    const conAsentamiento = async (prueba: () => Promise<void>) => {
      await prisma.location.update({ where: { id: locationId }, data: { kind: 'asentamiento' } });
      await prisma.zonePoint.create({
        data: { locationId, saveId, x: 125, y: 25, tipo: 'NPC', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 125, y: 25 }] },
      });
      try {
        await prueba();
      } finally {
        await prisma.location.update({ where: { id: locationId }, data: { kind: 'hito' } });
      }
    };

    it('pasar a su lado camino de otro sitio: no corta el paso', async () => {
      await conAsentamiento(async () => {
        const app = await buildApp();
        const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
        const body = JSON.parse(res.body);
        expect(body.colision).toBeNull();
        expect(body.dynamicModeOffer).toBeNull();
        expect(body.caminoRestante.length).toBeGreaterThan(0);
      });
    });

    it('ir hasta él: sí se ofrece el encuentro', async () => {
      await conAsentamiento(async () => {
        const app = await buildApp();
        const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 125, y: 25 } } });
        expect(JSON.parse(res.body).dynamicModeOffer).toMatchObject({ tipo: 'NPC', targetSlug: 'test-mover-pacifico' });
      });
    });

    it('pulsar la propia casilla a su lado: sí se ofrece el encuentro', async () => {
      await conAsentamiento(async () => {
        await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 75, zonaPosY: 25 } });
        const app = await buildApp();
        const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 75, y: 25 } } });
        expect(JSON.parse(res.body).dynamicModeOffer).toMatchObject({ tipo: 'NPC', targetSlug: 'test-mover-pacifico' });
      });
    });

    it('fuera de un asentamiento sigue cortando el paso', async () => {
      await prisma.zonePoint.create({
        data: { locationId, saveId, x: 125, y: 25, tipo: 'NPC', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 125, y: 25 }] },
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(JSON.parse(res.body).dynamicModeOffer).toMatchObject({ tipo: 'NPC', targetSlug: 'test-mover-pacifico' });
    });
  });

  // RECURSO (2026-09-20, hallazgo real jugando en vivo — Álvaro: "mira también si funciona lo de
  // descubrir al acercarnos a una flora" — confirmado que NO funcionaba: `detectarEncuentroEnCelda`
  // solo miraba FAUNA/NPC, caminar hasta un recurso nunca disparaba nada). RECURSO nunca tiene
  // temperamento/combate/tirada de iniciativa — el jugador SIEMPRE es quien "encuentra" el recurso.
  it('celda ADYACENTE/MISMA a un ZonePoint RECURSO: dispara dynamicModeOffer tipo RECURSO, sin colisión de combate', async () => {
    const recurso = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'RECURSO', targetSlug: 'test-mover-recurso', cantidad: 1, activo: true },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // RECURSO nunca puebla `colision` (ese campo es solo para FAUNA/NPC con temperamento real) —
    // solo la oferta de Interactuar, coherente con que un recurso nunca fuerza combate ni reacción.
    expect(body.colision).toBeNull();
    // Grupos de fauna reales (Fase 1, 2026-09-28) — `zonePointId`/`cantidad` también viajan en la
    // oferta de RECURSO (siempre tiene `ZonePoint` real, nunca se agrupa: `cantidad` siempre 1).
    expect(body.dynamicModeOffer).toEqual({
      tipo: 'RECURSO',
      targetSlug: 'test-mover-recurso',
      targetName: 'test-mover-recurso',
      quienInicia: 'jugador',
      zonePointId: recurso.id,
      cantidad: 1,
      // Sin ningún HarvestYield real para este slug de prueba — método desconocido, no ausente.
      metodo: null,
    });
    expect(body.logEntry).toMatchObject({ text: expect.stringContaining('test-mover-recurso') });
    const logRow = await prisma.logEntry.findUnique({ where: { id: body.logEntry.id } });
    expect(logRow).not.toBeNull();

    // El encuentro con el recurso detiene el trayecto igual que una colisión con FAUNA/NPC
    // (2026-09-28) — antes el camino seguía y el jugador pasaba de largo.
    expect(body.caminoRestante).toEqual([]);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicModeOffer).toEqual({
      tipo: 'RECURSO',
      targetSlug: 'test-mover-recurso',
      targetName: 'test-mover-recurso',
      quienInicia: 'jugador',
      zonePointId: recurso.id,
      cantidad: 1,
      // Sin ningún HarvestYield real para este slug de prueba — método desconocido, no ausente.
      metodo: null,
    });
    expect(saveAfter.zonaCaminoPendiente).toBeNull();
  });

  // Modal de detalle de RECURSO (2026-09-29, petición de Álvaro: "un botón con texto según la
  // profesión: Recolectar, Talar, Minar...") — la oferta trae el `metodoObtencion` real de la fuente.
  // P136 (QA-27): la tarjeta nombra el recurso igual que su ficha del mapa (su label).
  it('la oferta RECURSO usa el label del punto del mapa', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'RECURSO', targetSlug: 'telda-comun', label: 'Bosquecillo de Telda', cantidad: 1, activo: true },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    const body = JSON.parse(res.body);
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'RECURSO', targetName: 'Bosquecillo de Telda' });
    expect(body.logEntry.text).toContain('Bosquecillo de Telda');
  });

  it('la oferta RECURSO incluye el metodo de obtención real de la fuente (HarvestYield)', async () => {
    const recurso = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'RECURSO', targetSlug: 'telda-comun', cantidad: 1, activo: true },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'RECURSO', targetSlug: 'telda-comun', zonePointId: recurso.id, metodo: 'TALA' });
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicModeOffer).toMatchObject({ metodo: 'TALA' });
  });

  // Bug real jugando en vivo (2026-09-28): tras Ignorar la oferta de un recurso/fauna, el primer
  // paso para alejarse seguía dentro de su radio de 1 celda y volvía a disparar el MISMO encuentro,
  // casilla tras casilla. Ahora el último encuentro se silencia hasta que el jugador sale del radio.
  it('el mismo encuentro no se repite mientras el jugador sigue en su radio; salir y volver lo ofrece de nuevo', async () => {
    // Recurso en la celda (2,1): el primer paso hacia (1,0) ya entra en su radio.
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 125, y: 75, tipo: 'RECURSO', targetSlug: 'test-mover-recurso', cantidad: 1, activo: true },
    });
    const app = await buildApp();
    const mover = async (x: number, y: number) =>
      JSON.parse((await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x, y } } })).body);

    const primero = await mover(375, 25);
    expect(primero.jugador).toEqual({ x: 75, y: 25 });
    expect(primero.dynamicModeOffer).toMatchObject({ tipo: 'RECURSO', targetSlug: 'test-mover-recurso' });
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).zonaUltimoEncuentro).toMatchObject([{ targetSlug: 'test-mover-recurso', locationId, tipo: 'RECURSO' }]);

    // "Ignorar" limpia la oferta pendiente (lo que hace /modo-dinamico/ignorar).
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });

    // (2,0) sigue en el radio de (2,1): ni oferta nueva ni parada.
    const segundo = await mover(375, 25);
    expect(segundo.jugador).toEqual({ x: 125, y: 25 });
    expect(segundo.dynamicModeOffer).toBeNull();
    expect(segundo.caminoRestante.length).toBeGreaterThan(0);

    // (3,0) sigue en el radio; (4,0) ya no — el último encuentro se olvida.
    await mover(375, 25);
    const fuera = await mover(375, 25);
    expect(fuera.jugador).toEqual({ x: 225, y: 25 });
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).zonaUltimoEncuentro).toBeNull();

    // Volver a acercarse lo ofrece otra vez.
    const vuelta = await mover(25, 25);
    expect(vuelta.jugador).toEqual({ x: 175, y: 25 });
    expect(vuelta.dynamicModeOffer).toMatchObject({ tipo: 'RECURSO', targetSlug: 'test-mover-recurso' });
  });

  // P177 (QA-27): el mismo NPC salía tres veces en 10 minutos tras «Ignorar» y «Seguir mi camino».
  it('un ser vivo con el que ya te topaste no vuelve a salir al paso al volver hasta que pasa un rato (P177)', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 125, y: 75, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 125, y: 75 }] },
    });
    const app = await buildApp();
    const mover = async (x: number, y: number) =>
      JSON.parse((await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x, y } } })).body);

    const primero = await mover(375, 25);
    expect(primero.dynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico' });
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });

    // Se aleja fuera de su radio y vuelve: no sale otra vez.
    for (let i = 0; i < 3; i++) await mover(375, 25);
    const vuelta = await mover(25, 25);
    expect(vuelta.dynamicModeOffer).toBeNull();

    // Pasado el rato, sí.
    const [ultimo] = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).zonaUltimoEncuentro as { minutos: number }[];
    await prisma.save.update({ where: { id: saveId }, data: { zonaUltimoEncuentro: [{ ...ultimo, minutos: ultimo.minutos - 61 }] } });
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 225, zonaPosY: 25, zonaCaminoPendiente: Prisma.JsonNull } });
    await mover(375, 25); // un paso más, fuera de su radio: ahora sí se olvida
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).zonaUltimoEncuentro).toBeNull();
    await mover(25, 25);
    const tarde = await mover(25, 25);
    expect(tarde.dynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico' });
  });

  // P177 reabierto (2026-10-17): solo se recordaba el último encuentro, y otro en medio liberaba al
  // anterior (en el Pozo, un Guchapo y la Telda Común se alternaban a cada paso).
  it('otro encuentro en medio no libera al ser vivo de antes: al volver no sale otra vez (P177)', async () => {
    await prisma.zonePoint.createMany({
      data: [
        { locationId, saveId, x: 125, y: 75, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 125, y: 75 }] },
        // (5,1): al lado de (4,0), ya fuera del radio de la fauna.
        { locationId, saveId, x: 275, y: 75, tipo: 'RECURSO', targetSlug: 'test-mover-recurso', cantidad: 1, activo: true },
      ],
    });
    const app = await buildApp();
    const mover = async (x: number, y: number) =>
      JSON.parse((await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x, y } } })).body);
    const ignorar = () => prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });

    expect((await mover(375, 25)).dynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico' });
    await ignorar();
    await mover(375, 25); // (2,0)
    await mover(375, 25); // (3,0)
    const enMedio = await mover(375, 25); // (4,0)
    expect(enMedio.dynamicModeOffer).toMatchObject({ tipo: 'RECURSO', targetSlug: 'test-mover-recurso' });
    await ignorar();

    const vuelta = await mover(25, 25); // (3,0), otra vez junto a la fauna
    expect(vuelta.jugador).toEqual({ x: 175, y: 25 });
    expect(vuelta.dynamicModeOffer).toBeNull();
    // El recurso, ya lejos, se olvida; la fauna sigue en su rato.
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).zonaUltimoEncuentro).toMatchObject([{ targetSlug: 'test-mover-pacifico', tipo: 'FAUNA' }]);
  });

  // P177: con otra conversación abierta (P186) el primer ser vivo del radio se pasa de largo, pero la
  // búsqueda ya había parado en él y no miró al otro, silenciado y pasado su rato: se olvidaba y volvía a salir.
  it('una colisión que se pasa de largo (P186) no hace olvidar a los silenciados que no llegó a mirar (P177)', async () => {
    // Los dos junto a (1,0); el primero, sin silenciar, es el que para la búsqueda.
    await prisma.zonePoint.create({ data: { locationId, saveId, x: 125, y: 75, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 125, y: 75 }] } });
    await prisma.zonePoint.create({ data: { locationId, saveId, x: 125, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-guardia', cantidad: 1, activo: true, ruta: [{ x: 125, y: 25 }] } });
    // Visto hace más de 60 minutos: ya no está en su rato, solo lo retiene seguir en su radio.
    const recordado = { targetSlug: 'test-mover-guardia', locationId, minutos: 0, tipo: 'FAUNA' };
    await prisma.save.update({
      where: { id: saveId },
      data: { zonaUltimoEncuentro: [recordado], pendingDynamicMode: { tipo: 'NPC', targetSlug: 'otra-persona', targetName: 'Otra persona', vuelta: 1 } },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicMode: Prisma.JsonNull } });
    const body = JSON.parse(res.body);
    expect(body.colision).toBeNull();
    expect(body.dynamicModeOffer).toBeNull();
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).zonaUltimoEncuentro).toEqual([recordado]);
  });

  // P186 (QA-27): tras una escena, con la conversación aún abierta, el primer clic en una salida daba un
  // paso y paraba sin aviso ni «Reanudar» al toparse con alguien pacífico: había que volver a pulsar.
  it('con una conversación abierta, alguien pacífico en el camino no corta el viaje (P186)', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 125, y: 75, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 125, y: 75 }] },
    });
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicMode: { tipo: 'NPC', targetSlug: 'otra-persona', targetName: 'Otra persona', vuelta: 1 } } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicMode: Prisma.JsonNull } });
    const body = JSON.parse(res.body);
    expect(body.colision).toBeNull();
    expect(body.dynamicModeOffer).toBeNull();
    expect(body.caminoRestante.length).toBeGreaterThan(0);
  });

  it('pulsar la propia casilla (camino vacío) ofrece el encuentro aunque sea el último ya ofrecido', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'RECURSO', targetSlug: 'test-mover-recurso', cantidad: 1, activo: true },
    });
    await prisma.save.update({ where: { id: saveId }, data: { zonaUltimoEncuentro: { targetSlug: 'test-mover-recurso', locationId } } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 25, y: 25 } } });
    const body = JSON.parse(res.body);
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'RECURSO', targetSlug: 'test-mover-recurso' });
  });

  it('un último encuentro de OTRA Location no silencia nada en esta', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'RECURSO', targetSlug: 'test-mover-recurso', cantidad: 1, activo: true },
    });
    await prisma.save.update({ where: { id: saveId }, data: { zonaUltimoEncuentro: { targetSlug: 'test-mover-recurso', locationId: 'otra-location' } } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    expect(JSON.parse(res.body).dynamicModeOffer).toMatchObject({ tipo: 'RECURSO', targetSlug: 'test-mover-recurso' });
  });

  // Bug real jugando en vivo (2026-09-28): con "X te corta el paso" pendiente el jugador seguía
  // caminando y el agresor le perseguía hasta su misma casilla sin consecuencia alguna.
  it('con una oferta de combate forzado pendiente no se puede mover: 409 y la posición no cambia', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'NPC', targetSlug: 'test-mover-agresivo', targetName: 'Agresor de Prueba', quienInicia: 'npc', combateForzado: true } },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toContain('Agresor de Prueba');
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.zonaPosX).toBe(25);
  });

  it('dar un paso con una oferta pacífica pendiente la descarta (alejarse = ignorarla) y deja ofrecer encuentros nuevos', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'otra-fauna-lejana', targetName: 'Otra', quienInicia: 'jugador' } },
    });
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 125, y: 75, tipo: 'RECURSO', targetSlug: 'test-mover-recurso', cantidad: 1, activo: true },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    const body = JSON.parse(res.body);
    expect(body.ofertaDescartada).toBe(true);
    // El mismo paso ya puede toparse con algo nuevo (antes: bloqueado por la oferta vieja).
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'RECURSO', targetSlug: 'test-mover-recurso' });
  });

  it('el último paso del trayecto llega con llegado: true (P135)', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 25, zonaPosY: 25 } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 75, y: 25 } } });
    const body = JSON.parse(res.body);
    expect(body.jugador).toEqual({ x: 75, y: 25 });
    expect(body.llegado).toBe(true);
  });

  it('al descartar el encuentro, se va también el menú del NPC abierto desde él (P142)', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: {
        pendingDynamicModeOffer: { tipo: 'NPC', targetSlug: 'test-mover-maestro', targetName: 'Maestro', quienInicia: 'jugador' },
        pendingNpcInteractionOffer: { npcSlug: 'test-mover-maestro', npcName: 'Maestro', options: ['Charlar', 'Salir'], desdeEncuentro: true },
      },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    expect(JSON.parse(res.body).ofertaDescartada).toBe(true);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingNpcInteractionOffer).toBeNull();
  });

  it('un AGRESIVO nunca se silencia por ser el último encuentro: sigue cortando el paso', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'NPC', targetSlug: 'test-mover-agresivo', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
    });
    await prisma.save.update({ where: { id: saveId }, data: { zonaUltimoEncuentro: { targetSlug: 'test-mover-agresivo', locationId } } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    const body = JSON.parse(res.body);
    expect(body.colision).toMatchObject({ targetSlug: 'test-mover-agresivo', temperamento: 'AGRESIVO' });
    expect(body.dynamicModeOffer).toMatchObject({ combateForzado: true });
  });

  it('un ZonePoint FAUNA y uno RECURSO en la misma celda: la FAUNA (ser vivo) gana, el recurso ni se evalúa', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
    });
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'RECURSO', targetSlug: 'test-mover-recurso', cantidad: 1, activo: true },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.colision).toMatchObject({ targetSlug: 'test-mover-pacifico' });
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-mover-pacifico' });
  });

  it('el mundo también se mueve: un ZonePoint con ruta artesanal avanza un paso a la vez que el jugador — y la respuesta HTTP lo confirma (2026-09-09)', async () => {
    // Ruta de 2 celdas (píxel), lejos del jugador para no interferir con colisión/aviso en este test.
    const ruta = [{ x: 725, y: 575 }, { x: 675, y: 575 }]; // celdas (14,11) y (13,11)
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 725, y: 575, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta, pasoRuta: 0 },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 75, y: 25 } } });

    const puntoAfter = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    expect(puntoAfter.x).toBe(675);
    expect(puntoAfter.y).toBe(575);
    expect(puntoAfter.pasoRuta).toBe(1);

    // Bug real jugando en vivo (2026-09-09, Álvaro: "los elementos se mueven, pero no...a la vez
    // que muevo yo") — antes `avanzarZonePointsUnPaso` corría como puro efecto secundario en BD,
    // sin llegar nunca a la respuesta HTTP; el frontend nunca se enteraba de este paso hasta un
    // refetch completo del panel. Ahora la propia respuesta trae la posición ya actualizada.
    const body = JSON.parse(res.body);
    expect(body.zonePointsMovidos).toEqual([{ id: punto.id, x: 675, y: 575 }]);
  });

  it('sistema de plantillas de movimiento (2026-09-17): un NPC "Maestro" sin ruta ni plantillaEspecifica se queda ESTATICO, nunca se mueve', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 725, y: 575, origenX: 725, origenY: 575, tipo: 'NPC', targetSlug: 'test-mover-maestro', cantidad: 1, activo: true },
    });
    const app = await buildApp();
    // 3 movimientos del jugador seguidos — cada uno dispara avanzarZonePointsUnPaso una vez.
    for (const destino of [{ x: 375, y: 25 }, { x: 25, y: 375 }, { x: 375, y: 375 }]) {
      await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino } });
      await prisma.save.update({ where: { id: saveId }, data: { zonaCaminoPendiente: Prisma.JsonNull } });
    }
    const puntoAfter = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    expect(puntoAfter.x).toBe(725);
    expect(puntoAfter.y).toBe(575);
  });

  it('sistema de plantillas de movimiento (2026-09-17): un NPC "Guardia" sin ruta ni plantillaEspecifica sigue PATRULLA_BREVE (determinista, no aleatorio)', async () => {
    // Origen lejos de cualquier borde (celda 7,5 de 16×12) para que el eje horizontal de la
    // patrulla esté disponible (radio 2 celdas a cada lado) — el caso normal, no un caso límite de
    // esquina donde el clamp al borde del lienzo podría dejarlo inmóvil por el propio recorte.
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 375, y: 275, origenX: 375, origenY: 275, tipo: 'NPC', targetSlug: 'test-mover-guardia', cantidad: 1, activo: true },
    });
    const app = await buildApp();
    // El jugador parte de (25,25) — un destino distinto (no la misma celda) para que el camino no
    // salga vacío y el mundo sí avance un paso.
    await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
    const puntoAfter = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    // PATRULLA_BREVE, primer paso: pasoRuta=0 calcula el offset del PROPIO paso 0 (=0, el origen
    // sin moverse todavía) y avanza pasoRuta a 1 para la siguiente llamada — mismo desfase ya
    // documentado en movementTemplates.test.ts. La celda no cambia en esta primera llamada; lo que
    // sí confirma el sistema nuevo es que pasoRuta avanzó de verdad (antes, sin plantilla, un NPC
    // sin ruta con `pixel.x === punto.x && pixel.y === punto.y` no llegaba a persistir ningún
    // cambio — ver el guard `if (pixel.x === punto.x...) return null` un poco más abajo en
    // zonePoints.ts, que ahora también exige que `nuevoPasoRuta === punto.pasoRuta` para saltarse
    // la escritura, así que este primer paso SÍ queda persistido aunque la celda sea la misma).
    expect(puntoAfter.x).toBe(375);
    expect(puntoAfter.y).toBe(275);
    expect(puntoAfter.pasoRuta).toBe(1);

    // Segundo paso del jugador: ahora sí se mueve — offset=1 en el eje horizontal (col 7→8).
    await prisma.save.update({ where: { id: saveId }, data: { zonaCaminoPendiente: Prisma.JsonNull } });
    await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 425, y: 25 } } });
    const puntoAfter2 = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    expect(puntoAfter2.x).toBe(425);
    expect(puntoAfter2.y).toBe(275);
    expect(puntoAfter2.pasoRuta).toBe(2);
  });

  // Persecución de AGRESIVO/ENEMIGO (2026-09-17, bug real jugando en vivo — Álvaro: "he chocado
  // con el orco enfurecido y no ha saltado el combate ni el interactuar" — sin esto, un ZonePoint
  // agresivo nunca sabía dónde estaba el jugador, solo seguía su propia ruta/plantilla). El jugador
  // parte de (25,25), celda (0,0).
  it('persecución (2026-09-17): un AGRESIVO con el jugador a 2 celdas o menos rompe su ruta y avanza hacia él', async () => {
    // Ruta fija que lo alejaría del jugador (hacia la derecha, columna 10) — sin persecución, el
    // siguiente paso de la ruta lo llevaría a (475,25), AÚN MÁS lejos del jugador. Origen
    // deliberadamente pegado al jugador (radio 2) para no depender de cuántas celdas exactas avanza
    // un solo paso Chebyshev.
    const punto = await prisma.zonePoint.create({
      data: {
        locationId, saveId,
        x: 125,
        y: 25, // celda (2,0) — exactamente en el borde del radio de persecución (Chebyshev 2)
        origenX: 125,
        origenY: 25,
        tipo: 'FAUNA',
        targetSlug: 'test-mover-agresivo',
        cantidad: 1,
        activo: true,
        ruta: [{ x: 125, y: 25 }, { x: 475, y: 25 }], // sin persecución, el siguiente paso se aleja
      },
    });
    const app = await buildApp();
    // El jugador se mueve un paso hacia el sur (celda (0,0)→(0,1)) — persecución evalúa contra la
    // posición NUEVA del jugador (mismo paso, "el mundo se mueve a la vez que tú"), no la vieja.
    await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 25, y: 375 } } });
    const puntoAfter = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    // Persiguiendo hacia celda (0,1) desde (2,0): un paso Chebyshev = celda (1,1) = píxel (75,75)
    // — más cerca del jugador, NO el (475,25) que dictaría su `ruta` artesanal.
    expect(puntoAfter.x).toBe(75);
    expect(puntoAfter.y).toBe(75);
  });

  // Revisión de P269/P329: un agresivo único convaleciente (derrotado y perdonado) no persigue ni patrulla:
  // REVIEW.md «Muertos y caídos», un convaleciente no actúa ni se mueve.
  it('persecución: un NPC único AGRESIVO convaleciente se queda en su sitio (ni persigue ni sigue su ruta); sano otra vez, persigue', async () => {
    const punto = await prisma.zonePoint.create({
      data: {
        locationId, saveId, x: 125, y: 25, origenX: 125, origenY: 25, tipo: 'NPC', targetSlug: 'test-mover-principal', cantidad: 1, activo: true,
        ruta: [{ x: 125, y: 25 }, { x: 475, y: 25 }],
      },
    });
    await prisma.npcState.create({ data: { saveId, npcId: principalNpcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
    const app = await buildApp();
    await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 25, y: 375 } } });
    const quieto = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    // Ni hacia el jugador (75,75) ni por su ruta (475,25): en su sitio, sin avanzar la ruta.
    expect({ x: quieto.x, y: quieto.y, pasoRuta: quieto.pasoRuta }).toEqual({ x: 125, y: 25, pasoRuta: 0 });

    await prisma.npcState.updateMany({ where: { saveId, npcId: principalNpcId }, data: { condicionFisica: 'ILESO' } });
    await prisma.zonePoint.update({ where: { id: punto.id }, data: { x: 125, y: 25, pasoRuta: 0 } });
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 25, zonaPosY: 25, zonaCaminoPendiente: Prisma.JsonNull, zonaUltimoEncuentro: Prisma.JsonNull } });
    await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 25, y: 375 } } });
    const persigue = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    expect(persigue.x).toBe(75);
    expect(persigue.y).toBe(75);
  });

  // Revisión de P269/P329: GET /zona sacaba hostil a un PRINCIPAL convaleciente y el cliente le pintaba radio de
  // amenaza y «¡te persigue!» (ZonaPanel, riesgoDeRuta), aunque ya no persigue ni corta el paso.
  it('GET /zona: un NPC único AGRESIVO convaleciente no sale hostil; sano otra vez, sí', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 475, y: 475, origenX: 475, origenY: 475, tipo: 'NPC', targetSlug: 'test-mover-principal', cantidad: 1, activo: true },
    });
    await prisma.discoveredEntity.create({ data: { saveId, entityType: 'npc', entitySlug: 'test-mover-principal', fase: 'DESCUBIERTO' } });
    await prisma.npcState.create({ data: { saveId, npcId: principalNpcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
    try {
      const app = await buildApp();
      const puntoDe = async () => {
        const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
        expect(res.statusCode).toBe(200);
        return (res.json().puntos as { targetSlug: string; hostil: boolean; descubierto: boolean }[]).find((p) => p.targetSlug === 'test-mover-principal');
      };
      expect(await puntoDe()).toMatchObject({ descubierto: true, hostil: false });
      await prisma.npcState.updateMany({ where: { saveId, npcId: principalNpcId }, data: { condicionFisica: 'ILESO' } });
      expect(await puntoDe()).toMatchObject({ descubierto: true, hostil: true });
    } finally {
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entitySlug: 'test-mover-principal' } });
    }
  });

  // Revisión de P269/P329 (leve): los Npc se buscaban por slug sin mundo; uno de otro mundo con el mismo slug
  // podía quedarse con el punto y su id no tiene el NpcState del convaleciente.
  it('persecución: un NPC de otro mundo con el mismo slug no tapa al convaleciente de esta partida', async () => {
    const otroMundo = await prisma.world.create({
      data: { slug: 'test-mover-otro-mundo', name: 'Otro mundo', tagline: 'x', synopsis: 'x', tone: 'x', lethality: 'MEDIA', theme: {} },
    });
    try {
      await prisma.npc.create({
        data: {
          worldId: otroMundo.id, kind: 'PRINCIPAL', slug: 'test-mover-principal', name: 'Gemelo de otro mundo', aliases: [], role: 'x', level: 1,
          attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 4, carisma: 2, magia: 0 }, bio: 'x', personality: 'x', homeLocationSlug: null, temperamento: 'CAUTELOSO',
        },
      });
      const punto = await prisma.zonePoint.create({
        data: {
          locationId, saveId, x: 125, y: 25, origenX: 125, origenY: 25, tipo: 'NPC', targetSlug: 'test-mover-principal', cantidad: 1, activo: true,
          ruta: [{ x: 125, y: 25 }, { x: 475, y: 25 }],
        },
      });
      await prisma.npcState.create({ data: { saveId, npcId: principalNpcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
      const app = await buildApp();
      await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 25, y: 375 } } });
      const quieto = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
      expect({ x: quieto.x, y: quieto.y }).toEqual({ x: 125, y: 25 });
    } finally {
      await prisma.world.delete({ where: { id: otroMundo.id } });
    }
  });

  it('persecución (2026-09-17): fuera del radio de 2 celdas, el AGRESIVO sigue su ruta normal, ignora al jugador', async () => {
    const punto = await prisma.zonePoint.create({
      data: {
        locationId, saveId,
        x: 725,
        y: 575, // celda (14,11) — muy lejos del jugador en (0,0), fuera del radio de persecución
        origenX: 725,
        origenY: 575,
        tipo: 'FAUNA',
        targetSlug: 'test-mover-agresivo',
        cantidad: 1,
        activo: true,
        ruta: [{ x: 725, y: 575 }, { x: 675, y: 575 }],
      },
    });
    const app = await buildApp();
    await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 25, y: 375 } } });
    const puntoAfter = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    // Sigue su `ruta` artesanal tal cual, sin desviarse hacia el jugador lejano.
    expect(puntoAfter.x).toBe(675);
    expect(puntoAfter.y).toBe(575);
  });

  // Fauna diurna/nocturna (2026-09-17, bug real jugando en vivo — Álvaro: "está apareciendo un
  // kirelon todo el rato que no se está representando con icono... y sin abrir combate") — un
  // Kirelon nocturno (`targetSlug: 'kirelon-arenoso'`, Npc real del mundo `helek-sirik`, sin
  // crear ninguno de prueba aparte — `faunaMomentoDelDia` es keyed por slug real de catálogo) no
  // debe colisionar/perseguir de DÍA, aunque su ZonePoint esté activo y en la misma celda.
  it('fauna nocturna (Kirelon Arenoso): NO colisiona ni persigue de día, aunque esté en la misma celda que el jugador', async () => {
    await prisma.zonePoint.create({
      data: {
        locationId, saveId,
        x: 75,
        y: 25, // celda (1,0) — coincide con el primer paso del jugador
        origenX: 75,
        origenY: 25,
        tipo: 'FAUNA',
        targetSlug: 'kirelon-arenoso',
        cantidad: 1,
        activo: true,
      },
    });
    const app = await buildApp();
    // `WorldState.fictionalMinutes` por defecto (sembrado en `beforeAll`) es 480 = 08:00, de día.
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } },
    });
    const body = JSON.parse(res.body);
    expect(body.colision).toBeNull();
    // Tampoco se mueve ni persigue — de día, no está "activo" en absoluto.
    expect(body.zonePointsMovidos).toEqual([]);
  });

  it('camino vacío (destino ya es la celda actual): el mundo NO da un paso, zonePointsMovidos llega vacío', async () => {
    const ruta = [{ x: 725, y: 575 }, { x: 675, y: 575 }];
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 725, y: 575, tipo: 'FAUNA', targetSlug: 'test-mover-pacifico', cantidad: 1, activo: true, ruta, pasoRuta: 0 },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 25, y: 25 } } });

    expect(JSON.parse(res.body).zonePointsMovidos).toEqual([]);
    const puntoAfter = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    expect(puntoAfter.pasoRuta).toBe(0); // sin cambios — el jugador no avanzó, el mundo tampoco
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

  // NPC "dinámico" — bug real jugando en vivo (2026-09-09, Álvaro: "me he movido hasta la casilla
  // anterior a un NPC que no sé lo que es porque tiene ???... pero ni me salta ninguna narración...
  // me puedo seguir moviendo libremente por el mapa sin que pase nada"). Hasta este fix,
  // `detectarEncuentroEnCelda` solo miraba `ZonePoint` de catálogo — un NPC presentado por la
  // narración (misión/evento/sessionFact, sin fila `ZonePoint` propia) era invisible al motor de
  // colisión, aunque SÍ se pintara como pin real en el mapa (`GET /zona` § `dinamicos`). El fix
  // reutiliza `detectNpcsInScene` (la MISMA función central que decide "qué hay en escena" en todo
  // el motor) — cubre por diseño cualquier NPC/fauna dinámico futuro (misiones/eventos que añadan
  // elementos a la zona), no un caso concreto: no hay ninguna lista cerrada de slugs, es genérico.
  describe('NPC "dinámico" (sin ZonePoint, presentado por sessionFacts) — mismo umbral único de colisión (2026-09-17)', () => {
    it('colisión real: el jugador entra en la MISMA celda que un NPC dinámico — se detiene ahí, sin camino pendiente', async () => {
      await prisma.$executeRaw`
        INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
        VALUES (${crypto.randomUUID()}, ${saveId}, 'Un Merodeador Dinámico de Prueba ronda cerca de la Zona de Prueba Cuadrícula.', NULL, ${new Date()})
      `;
      // Posición real en NpcState.zonaPosX/Y (nunca ZonePoint.x/y) — celda (1,0), coincide con el
      // primer paso del jugador, mismo montaje que el test de colisión con ZonePoint de arriba.
      await prisma.npcState.create({
        data: { saveId, npcId: dinamicoNpcId, scope: locationId, zonaPosX: 75, zonaPosY: 25, zonaLocationId: locationId },
      });
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/zona/mover`,
        payload: { destino: { x: 375, y: 25 } },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.colision).toMatchObject({ targetSlug: 'test-mover-dinamico', targetName: 'Merodeador Dinámico de Prueba', temperamento: 'AGRESIVO' });
      expect(body.jugador).toEqual({ x: 75, y: 25 });
      expect(body.caminoRestante).toEqual([]);

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.zonaCaminoPendiente).toBeNull();
      // Bug real jugando en vivo (2026-09-15) — mismo fix que el AGRESIVO de catálogo de arriba,
      // también cubre el NPC dinámico (sin ZonePoint propio).
      expect(body.logEntry).not.toBeNull();
      expect(body.logEntry.text).toContain('Merodeador Dinámico de Prueba');
    }, 15_000);

    it('celda ADYACENTE (no exacta) a un NPC dinámico AGRESIVO: dispara colisión igual que la misma celda (2026-09-17)', async () => {
      await prisma.$executeRaw`
        INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
        VALUES (${crypto.randomUUID()}, ${saveId}, 'Un Merodeador Dinámico de Prueba ronda cerca de la Zona de Prueba Cuadrícula.', NULL, ${new Date()})
      `;
      // Celda (2,0) — vecina de la celda destino del primer paso (1,0), no la misma.
      await prisma.npcState.create({
        data: { saveId, npcId: dinamicoNpcId, scope: locationId, zonaPosX: 125, zonaPosY: 25, zonaLocationId: locationId },
      });
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/zona/mover`,
        payload: { destino: { x: 375, y: 25 } },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.colision).toMatchObject({ targetSlug: 'test-mover-dinamico', targetName: 'Merodeador Dinámico de Prueba', temperamento: 'AGRESIVO' });
      expect(body.jugador).toEqual({ x: 75, y: 25 });
      expect(body.caminoRestante).toEqual([]);
    }, 15_000);

    // Revisión de P269/P329: un dinámico único (PRINCIPAL sin ZonePoint) convaleciente tampoco corta el paso.
    it('un NPC único dinámico convaleciente no corta el paso; sano otra vez, sí', async () => {
      await prisma.$executeRaw`
        INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
        VALUES (${crypto.randomUUID()}, ${saveId}, 'Un Enemigo Único de Prueba ronda cerca de la Zona de Prueba Cuadrícula.', NULL, ${new Date()})
      `;
      await prisma.npcState.create({
        data: { saveId, npcId: principalNpcId, scope: '', condicionFisica: 'CONVALECIENTE', zonaPosX: 75, zonaPosY: 25, zonaLocationId: locationId },
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).colision).toBeNull();
      await prisma.npcState.updateMany({ where: { saveId, npcId: principalNpcId }, data: { condicionFisica: 'ILESO' } });
      await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 25, zonaPosY: 25, zonaCaminoPendiente: Prisma.JsonNull, pendingDynamicModeOffer: Prisma.JsonNull, pendingDynamicMode: Prisma.JsonNull, zonaUltimoEncuentro: Prisma.JsonNull } });
      const otra = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/mover`, payload: { destino: { x: 375, y: 25 } } });
      expect(JSON.parse(otra.body).colision).toMatchObject({ targetSlug: 'test-mover-principal' });
    }, 15_000);

    it('un NPC dinámico SIN posición asignada todavía (nunca se movió/vio en Zona) no puede colisionar ni avisar — fallback seguro', async () => {
      await prisma.$executeRaw`
        INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
        VALUES (${crypto.randomUUID()}, ${saveId}, 'Un Merodeador Dinámico de Prueba ronda cerca de la Zona de Prueba Cuadrícula.', NULL, ${new Date()})
      `;
      // Sin NpcState — nunca se le asignó posición real en Zona (a diferencia de GET /zona, que la
      // asigna perezosamente; el endpoint de movimiento nunca la inventa).
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/zona/mover`,
        payload: { destino: { x: 375, y: 25 } },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.colision).toBeNull();
    }, 15_000);
  });
});
