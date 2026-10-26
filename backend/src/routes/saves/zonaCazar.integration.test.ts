import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Cazar desde la tarjeta de encuentro de zona (Fase 2, 2026-09-28,
/// `plan-mecanicas-por-zona-2026-09-28.md`) — harness de integración real (Postgres real, sin
/// mocks) sobre una Location/Npc/WorldPopulation propios de este test, mismo patrón que
/// `zonaGrupos.integration.test.ts`/`zonaMover.integration.test.ts`. Los `ZonePoint` de este test
/// se crean YA con `lastUpdatedAtMinutes` fijado — evita que `recalcularZonePointsDeLocation`
/// (disparado por `GET /zona`) reparta de cero y cambie la `cantidad` exacta que el test necesita.
const { zonaRoutes } = await import('./zona.js');
const { dynamicModeRoutes } = await import('./dynamicMode.js');

async function buildApp() {
  const app = Fastify();
  await app.register(zonaRoutes);
  await app.register(dynamicModeRoutes);
  return app;
}

describe('POST /saves/:id/zona/cazar', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;
  let debilNpcId: string;
  let fuerteNpcId: string;
  let agresivoNpcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const location = await prisma.location.create({
      data: {
        worldId,
        slug: 'test-zona-cazar-grupos',
        name: 'Zona de Prueba de Caza en Grupo',
        region: 'Zona de Pruebas',
        kind: 'hito',
        description: 'x',
        aliases: ['zona de prueba de caza en grupo'],
      },
    });
    locationId = location.id;

    // Nivel del jugador = 5 (ver `save` más abajo). Débil = nivel <= jugador-2 = 3.
    const debil = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-cazar-debil',
        name: 'Bestia Débil de Prueba',
        aliases: ['bestia debil de prueba'],
        role: 'Fauna de prueba',
        level: 1,
        capturablePct: 80,
        attributes: { fuerza: 4, destreza: 4, constitucion: 4, inteligencia: 2, voluntad: 2, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    debilNpcId = debil.id;

    // No débil (nivel 5 == nivel del jugador, no <= jugador-2).
    const fuerte = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-cazar-fuerte',
        name: 'Bestia Fuerte de Prueba',
        aliases: ['bestia fuerte de prueba'],
        role: 'Fauna de prueba',
        level: 5,
        capturablePct: 30,
        attributes: { fuerza: 10, destreza: 8, constitucion: 10, inteligencia: 3, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    fuerteNpcId = fuerte.id;

    // Agresivo — para el caso "combate forzado en grupo desde Interactuar" (punto 4 del plan).
    const agresivo = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-cazar-agresivo',
        name: 'Bestia Agresiva de Prueba',
        aliases: ['bestia agresiva de prueba'],
        role: 'Fauna de prueba',
        level: 5,
        capturablePct: 10,
        attributes: { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 3, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'AGRESIVO',
      },
    });
    agresivoNpcId = agresivo.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (zona/cazar)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        level: 5,
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
        zonaPosX: 400,
        zonaPosY: 300,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.delete({ where: { id: debilNpcId } });
    await prisma.npc.delete({ where: { id: fuerteNpcId } });
    await prisma.npc.delete({ where: { id: agresivoNpcId } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: Prisma.JsonNull, pendingCombatNpcSlugs: [] },
    });
  });

  it('sin ninguna oferta pendiente, rechaza con 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { zonePointId: 'no-existe' } });
    expect(res.statusCode).toBe(409);
  });

  it('con una oferta pendiente de OTRO zonePointId, rechaza con 409 (solo se caza lo que se tiene al lado)', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'test-cazar-debil', cantidad: 1, activo: true, lastUpdatedAtMinutes: 480 },
    });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-debil', targetName: 'Bestia Débil de Prueba', zonePointId: punto.id, cantidad: 1 } },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { zonePointId: 'otro-distinto' } });
    expect(res.statusCode).toBe(409);
  });

  // P307 (usuaria, 2026-10-26): la fauna de la escena (tarjeta sin punto en el mapa, como el Corredor de
  // Cauce de Hogar Ketg) se caza por `targetSlug`: el punto se crea al momento y la caza es la normal.
  describe('P307 — Cazar la fauna de la escena sin punto de zona', () => {
    it('crea el punto de fauna en la zona de Gorhorn, abre la caza normal y limpia la oferta', async () => {
      await prisma.save.update({
        where: { id: saveId },
        data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-debil', targetName: 'Bestia Débil de Prueba' } },
      });
      expect(await prisma.zonePoint.count({ where: { saveId, locationId } })).toBe(0);
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { targetSlug: 'test-cazar-debil' } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.resuelveSinCombate).toBe(true);
      expect(body.exito).toBe(true);
      expect(body.cazaLimpia).toMatchObject({ kind: 'caza-sigilo', exito: true, npcName: 'Bestia Débil de Prueba' });
      expect((await prisma.npcState.findFirst({ where: { saveId, npcId: debilNpcId } }))?.condicionFisica).toBe('MUERTO');
      // El punto se creó, se descontó y (sin etiqueta de ancla) se retiró del todo.
      expect(await prisma.zonePoint.count({ where: { saveId, locationId, targetSlug: 'test-cazar-debil', cantidad: { gt: 0 }, activo: true } })).toBe(0);
      expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingDynamicModeOffer).toBeNull();
    });

    it('con un grupo de esa especie ya en la zona, caza ese (el más cercano) y no crea otro', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999); // caza sigilosa fallida: pelea de frente
      const cerca = await prisma.zonePoint.create({
        data: { locationId, saveId, x: 410, y: 310, tipo: 'FAUNA', targetSlug: 'test-cazar-fuerte', cantidad: 2, activo: true, lastUpdatedAtMinutes: 480 },
      });
      const lejos = await prisma.zonePoint.create({
        data: { locationId, saveId, x: 40, y: 40, tipo: 'FAUNA', targetSlug: 'test-cazar-fuerte', cantidad: 3, activo: true, lastUpdatedAtMinutes: 480 },
      });
      await prisma.save.update({
        where: { id: saveId },
        data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-fuerte', targetName: 'Bestia Fuerte de Prueba' } },
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { targetSlug: 'test-cazar-fuerte' } });
      expect(res.statusCode).toBe(200);
      // No se creó ningún punto nuevo, el lejano sigue intacto y el cercano es el que se descontó.
      expect(await prisma.zonePoint.count({ where: { saveId, locationId } })).toBeLessThanOrEqual(2);
      expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: lejos.id } })).cantidad).toBe(3);
      const trasCaza = await prisma.zonePoint.findUnique({ where: { id: cerca.id } });
      expect(trasCaza === null || trasCaza.cantidad < 2).toBe(true);
    });

    it('rechaza con 409 un targetSlug que no es el de la oferta pendiente o una oferta que ya trae punto', async () => {
      await prisma.save.update({
        where: { id: saveId },
        data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-debil', targetName: 'Bestia Débil de Prueba' } },
      });
      const app = await buildApp();
      const otra = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { targetSlug: 'test-cazar-fuerte' } });
      expect(otra.statusCode).toBe(409);
      expect(await prisma.zonePoint.count({ where: { saveId, locationId } })).toBe(0);

      await prisma.save.update({
        where: { id: saveId },
        data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-debil', targetName: 'x', zonePointId: 'otro', cantidad: 1 } },
      });
      const conPunto = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { targetSlug: 'test-cazar-debil' } });
      expect(conPunto.statusCode).toBe(409);
      expect(await prisma.zonePoint.count({ where: { saveId, locationId } })).toBe(0);
    });
  });

  it('punto de 1 presa débil, tirada de caza limpia forzada a éxito: mata sin combate y el ZonePoint se descuenta (ancla a 0 → activo:false)', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'test-cazar-debil', cantidad: 1, activo: true, label: 'Bestia Débil de Prueba', lastUpdatedAtMinutes: 480 },
    });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-debil', targetName: 'Bestia Débil de Prueba', zonePointId: punto.id, cantidad: 1 } },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0); // 0 < cualquier % positivo -> caza limpia con éxito

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { zonePointId: punto.id } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.resuelveSinCombate).toBe(true);
    expect(body.exito).toBe(true);
    expect(body.combate.npcs).toEqual([{ slug: 'test-cazar-debil', name: 'Bestia Débil de Prueba', condicionFisica: 'MUERTO', saqueado: false, lootedItemNames: [], analizado: false, capturable: false, activeEffects: [], targetedForKill: false }]);
    // Fase 10 (2026-09-29) — la caza sigilosa es una tirada visible (d100 vs probabilidad real) y
    // queda en `LogEntry.roll`.
    expect(body.cazaLimpia).toMatchObject({ kind: 'caza-sigilo', roll: 1, exito: true, npcName: 'Bestia Débil de Prueba' });
    expect(body.cazaLimpia.chance).toBeGreaterThan(0);
    expect(body.logEntry.roll).toEqual(body.cazaLimpia);
    const logGuardado = await prisma.logEntry.findUniqueOrThrow({ where: { id: body.logEntry.id } });
    expect(logGuardado.roll).toMatchObject({ kind: 'caza-sigilo', roll: 1, exito: true });

    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId: debilNpcId } });
    expect(npcState?.condicionFisica).toBe('MUERTO');

    // Ancla (label no nulo) nunca se borra — se queda a 0 e inactiva.
    const puntoTrasCaza = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    expect(puntoTrasCaza.cantidad).toBe(0);
    expect(puntoTrasCaza.activo).toBe(false);

    // La oferta ya se resolvió — no debe reaparecer tras un F5.
    const saveTrasCaza = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveTrasCaza.pendingDynamicModeOffer).toBeNull();
  });

  // P187 (QA-27, usuaria 2026-10-15): el ganado de un bando se puede cazar, pero si alguien suyo lo ve,
  // resta mucha reputación con él (más que coger su leche, P172).
  it('cazar un animal del Clan Serhu delante de una cazadora del clan resta mucha reputación con él (P187)', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'test-cazar-debil', cantidad: 1, activo: true, label: 'Bestia del clan', lastUpdatedAtMinutes: 480, factionSlug: 'Clan Serhu' },
    });
    await prisma.zonePoint.create({ data: { locationId, saveId, x: 600, y: 200, tipo: 'NPC', targetSlug: 'cazadora-serhu', cantidad: 1, activo: true } });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-debil', targetName: 'Bestia Débil de Prueba', zonePointId: punto.id, cantidad: 1 } },
    });
    const repDe = async () => ((await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).factionsStatus as Record<string, number> | null)?.['Clan Serhu'] ?? 2500;
    const repInicial = await repDe();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const app = await buildApp();
    const body = JSON.parse((await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { zonePointId: punto.id } })).body);
    expect(body.exito).toBe(true);
    expect(await repDe()).toBe(repInicial - 100);
    expect(body.logEntry.text).toContain('Alguien del Clan Serhu lo ha visto matar a uno de sus animales.');
    await prisma.worldState.update({ where: { saveId }, data: { factionsStatus: {} } });
  });

  it('caza sigilosa fallida (d100 por encima de la probabilidad): devuelve la tirada y el texto de ataque de frente, sin matar', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'test-cazar-debil', cantidad: 1, activo: true, label: 'Bestia Débil de Prueba', lastUpdatedAtMinutes: 480 },
    });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-debil', targetName: 'Bestia Débil de Prueba', zonePointId: punto.id, cantidad: 1 } },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // r = 99.9 -> por encima del tope de 90%

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { zonePointId: punto.id } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.resuelveSinCombate).toBe(false);
    expect(body.exito).toBe(false);
    expect(body.cazaLimpia).toMatchObject({ kind: 'caza-sigilo', roll: 100, exito: false });
    expect(body.cazaLimpia.roll).toBeGreaterThan(body.cazaLimpia.chance);
    // F9-4: el fallo también queda como LogEntry de sistema con la tirada (sobrevive a una recarga).
    expect(body.logEntry.roll).toEqual(body.cazaLimpia);
    const logFallo = await prisma.logEntry.findUniqueOrThrow({ where: { id: body.logEntry.id } });
    expect(logFallo.isSystemMessage).toBe(true);
    expect(logFallo.roll).toMatchObject({ kind: 'caza-sigilo', roll: 100, exito: false });
  });

  it('punto de 1 presa NO débil: 1v1 clásico (sin CombatEncounter) y el individuo enfrentado sale del ZonePoint', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'test-cazar-fuerte', cantidad: 1, activo: true, label: 'Bestia Fuerte de Prueba', lastUpdatedAtMinutes: 480 },
    });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-fuerte', targetName: 'Bestia Fuerte de Prueba', zonePointId: punto.id, cantidad: 1 } },
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { zonePointId: punto.id } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.resuelveSinCombate).toBe(false);
    expect(body.actionText).toContain("'Bestia Fuerte de Prueba'");
    expect(await prisma.combatEncounter.findFirst({ where: { saveId, estado: 'EN_CURSO' } })).toBeNull();

    // Fila ancla (con `label`) -> nunca se borra: queda a 0 e inactiva.
    const puntoTrasCaza = await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } });
    expect(puntoTrasCaza.cantidad).toBe(0);
    expect(puntoTrasCaza.activo).toBe(false);
  });

  it('punto de 3 presas NO débiles: abre CombatEncounter EN_CURSO con 3 enemigos NPC y el ZonePoint (fila de grupo, sin label) se borra del todo', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'test-cazar-fuerte', cantidad: 3, activo: true, label: null, lastUpdatedAtMinutes: 480 },
    });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-cazar-fuerte', targetName: 'Bestia Fuerte de Prueba', zonePointId: punto.id, cantidad: 3 } },
    });
    // roll 4 -> delta 0 (rollGroupEngagement): cantidadElegida=3 (cantidadObjetivo, sin selección
    // parcial) -> cantidadReal=3, exactamente el grupo completo.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/cazar`, payload: { zonePointId: punto.id } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.resuelveSinCombate).toBe(false);
    expect(body.actionText).toContain("'Bestia Fuerte de Prueba'");
    // Fase 10 (2026-09-29) — cuántos entran (d6) + iniciativa de cada combatiente, visibles y persistidas.
    expect(body.tiradasGrupo).toEqual([
      { slug: 'test-cazar-fuerte', name: 'Bestia Fuerte de Prueba', roll: 4, delta: 0, cantidadElegida: 3, avistados: 3, cantidadTirada: 3, cantidadReal: 3 },
    ]);
    expect(body.logEntry.roll.kind).toBe('combate-grupo');
    expect(body.logEntry.roll.engagement).toEqual(body.tiradasGrupo);
    expect(body.logEntry.roll.iniciativa).toHaveLength(4); // jugador + 3 enemigos
    expect(body.logEntry.roll.iniciativa.map((p: { nombre: string }) => p.nombre)).toEqual(
      expect.arrayContaining(['Bestia Fuerte de Prueba 1', 'Bestia Fuerte de Prueba 2', 'Bestia Fuerte de Prueba 3']),
    );
    const resultados = body.logEntry.roll.iniciativa.map((p: { result: number }) => p.result);
    expect(resultados).toEqual([...resultados].sort((a: number, b: number) => b - a)); // ya en orden de actuación
    const logGrupo = await prisma.logEntry.findUniqueOrThrow({ where: { id: body.logEntry.id } });
    expect((logGrupo.roll as { kind: string }).kind).toBe('combate-grupo');

    const encounter = await prisma.combatEncounter.findFirstOrThrow({ where: { saveId, estado: 'EN_CURSO', jugable: true } });
    const participantes = await prisma.combatParticipant.findMany({ where: { encounterId: encounter.id } });
    const enemigos = participantes.filter((p) => p.bando === 'ENEMIGO' && p.npcId === fuerteNpcId);
    expect(enemigos).toHaveLength(3);

    // Fila de grupo (sin `label`) descontada a 0 -> se borra del todo (nunca queda a 0 inactiva).
    const puntoTrasCaza = await prisma.zonePoint.findUnique({ where: { id: punto.id } });
    expect(puntoTrasCaza).toBeNull();
  });

  it('agresivo en grupo (cantidad>1) por Interactuar (quienInicia npc): abre combate múltiple vía iniciarCaza, nunca el 1v1 clásico', async () => {
    const punto = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'test-cazar-agresivo', cantidad: 3, activo: true, label: null, lastUpdatedAtMinutes: 480 },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // roll 4 -> delta 0 -> cantidadReal=3

    const app = await buildApp();
    // P27: Interactuar saca la decisión; el combate de grupo se abre al elegir Combatir.
    const payload = { tipo: 'FAUNA', targetSlug: 'test-cazar-agresivo', targetName: 'Bestia Agresiva de Prueba', quienInicia: 'npc', combateForzado: true, zonePointId: punto.id, cantidad: 3 };
    const paso = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/interactuar`, payload });
    expect(paso.statusCode, paso.body).toBe(200);
    expect(JSON.parse(paso.body).opciones).toEqual(['Combatir', 'Huir']);
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta: 'Combatir' } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Combate múltiple (`actionText`), nunca el 1v1 clásico (`combate` directo) — "un agresivo que
    // te corta el paso nunca se resuelve sigiloso" tampoco aplica aquí (nunca hay caza limpia).
    expect(body.combate).toBeUndefined();
    expect(body.actionText).toContain("'Bestia Agresiva de Prueba'");

    const encounter = await prisma.combatEncounter.findFirstOrThrow({ where: { saveId, estado: 'EN_CURSO', jugable: true } });
    const participantes = await prisma.combatParticipant.findMany({ where: { encounterId: encounter.id } });
    expect(participantes.filter((p) => p.bando === 'ENEMIGO' && p.npcId === agresivoNpcId)).toHaveLength(3);

    const puntoTrasCaza = await prisma.zonePoint.findUnique({ where: { id: punto.id } });
    expect(puntoTrasCaza).toBeNull();
  });
});

describe('GET /saves/:id/zona sigue mostrando otros grupos de la misma especie tras abatir uno (bug de "un solo NpcState por especie")', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const location = await prisma.location.create({
      data: {
        worldId,
        slug: 'test-zona-cazar-ausencia',
        name: 'Zona de Prueba de Ausencia por Grupo',
        region: 'Zona de Pruebas',
        kind: 'hito',
        description: 'x',
        aliases: ['zona de prueba de ausencia por grupo'],
      },
    });
    locationId = location.id;

    const npc = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-cazar-ausencia',
        name: 'Bestia de Prueba (ausencia)',
        aliases: ['bestia de prueba ausencia'],
        role: 'Fauna de prueba',
        level: 1,
        capturablePct: 80,
        attributes: { fuerza: 4, destreza: 4, constitucion: 4, inteligencia: 2, voluntad: 2, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    npcId = npc.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (ausencia por grupo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
        zonaPosX: 400,
        zonaPosY: 300,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.delete({ where: { id: npcId } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  afterEach(async () => {
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
  });

  it('un NpcState "ausente" (6h tras derrota, `scope=Location`) NO oculta los ZonePoint FAUNA restantes de la misma especie', async () => {
    const puntoAusente = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 200, y: 200, tipo: 'FAUNA', targetSlug: 'test-cazar-ausencia', cantidad: 1, activo: true, label: 'Bestia de Prueba (ausencia)', lastUpdatedAtMinutes: 480 },
    });
    const otroGrupo = await prisma.zonePoint.create({
      data: { locationId, saveId, x: 500, y: 200, tipo: 'FAUNA', targetSlug: 'test-cazar-ausencia', cantidad: 2, activo: true, lastUpdatedAtMinutes: 480 },
    });
    // Mismo campo que escribe una derrota real (`minutoDeReaparicion`) — NpcState es UNO por
    // especie/Location (`scopeFor`), así que esta única fila representa a TODA la especie, no solo
    // al individuo del `puntoAusente`.
    await prisma.npcState.create({
      data: { saveId, npcId, scope: locationId, zonaAusenteHastaMinutes: 480 + 6 * 60, zonaLocationId: locationId },
    });

    const { zonaRoutes: zonaRoutesLocal } = await import('./zona.js');
    const app = Fastify();
    await app.register(zonaRoutesLocal);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    const idsVisibles = body.puntos.map((p: { id: string }) => p.id);
    // Los DOS grupos siguen visibles — la ausencia de un individuo no oculta el resto del grupo.
    expect(idsVisibles).toContain(puntoAusente.id);
    expect(idsVisibles).toContain(otroGrupo.id);
  });
});
