import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import type { NarrationResult } from '../services/narrador.js';
import { questsRoutes } from './saves/quests.js';

/// Enganche end-to-end de `dynamicModeOffer` en `/turn/narrate` (2026-08-27, Pieza 4 de
/// "Dinamismo del mundo") — archivo separado de turn.integration.test.ts a propósito (ese archivo
/// ya es grande y con locks reales; esto es una comprobación quirúrgica de UN campo del `done`).
/// Mismo criterio de mock que el resto de tests de integración: solo se mockea la frontera del LLM
/// (`narrador.js`), Postgres real para todo lo demás — incluida la decisión determinista real de
/// `decideOfertaModoDinamico` (no se mockea: `random` por defecto es `Math.random`, así que estos
/// tests fijan `cantidad` de forma que el resultado sea determinista donde haga falta, o repiten
/// la llamada varias veces donde la probabilidad podría dar falso negativo).
const classifyAction = vi.fn();
const narrateAction = vi.fn(async (_ctx: unknown): Promise<NarrationResult> => ({ narration: 'No pasa nada especial.', newFacts: [] }));

vi.mock('../services/narrador.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/narrador.js')>();
  return { ...actual, classifyAction: (...args: unknown[]) => classifyAction(...args), narrateAction: (ctx: unknown) => narrateAction(ctx) };
});

const { turnRoutes } = await import('./turn.js');

async function buildApp() {
  const app = Fastify();
  await app.register(turnRoutes);
  await app.register(questsRoutes);
  return app;
}

describe('dynamicModeOffer en /turn/narrate', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-serhu' } });
    locationId = location.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba 21',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });

    // La Pieza 3 (recalcularZonePointsDeLocation) recalcula `cantidad` en CADA turno a partir de
    // `WorldPopulation` real de la región — sin esta fila, cualquier ZonePoint de prueba se
    // recalcularía a 0 en cuanto pasara un turno, aunque se creara con `cantidad: 5`.
    await prisma.worldPopulation.create({
      data: {
        worldId,
        targetType: 'FAUNA',
        targetSlug: 'fauna-prueba-oferta-modo-dinamico-21',
        label: 'Fauna de prueba (test Pieza 4)',
        poblacion: 100,
        poblacionMax: 200,
        distribucion: { [location.region]: 1.0 },
      },
    });

    classifyAction.mockResolvedValue({
      requiereTirada: false,
      atributo: 'destreza',
      dificultad: 8,
      razon: 'x',
      banda: 'instantanea',
      duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.zonePoint.deleteMany({ where: { locationId, targetSlug: 'fauna-prueba-oferta-modo-dinamico-21' } });
    await prisma.worldPopulation.deleteMany({ where: { worldId, targetSlug: 'fauna-prueba-oferta-modo-dinamico-21' } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin ningún ZonePoint NPC/FAUNA activo en la Location, nunca ofrece modo dinámico', async () => {
    // Flake real encontrado 2026-09-09 (suite completa en paralelo, 1/2378): `campamento-serhu`
    // (la Location de este describe) SÍ tiene un candidato RECURSO real de catálogo
    // (`murgoles-domados-campamento`) — el nombre del test se refiere a la ausencia del ZonePoint
    // FAUNA sintético que crean los tests siguientes, no a la ausencia de TODO candidato real.
    // `PROBABILIDAD_OFERTA = 0.2` (dynamicMode.ts) hacía que este turno único, sin mockear
    // `Math.random`, tuviera un 20% real de disparar la oferta — mock a 1 (nunca por debajo del
    // umbral) para que este test concreto sea determinista, sin afectar a los siguientes tests del
    // mismo describe (cada uno gestiona su propio mock/probabilidad real donde corresponde).
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const app = await buildApp();
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Miro alrededor.', enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: 'Miro alrededor.', classification, roll, enCombate: false },
    });
    vi.restoreAllMocks();
    expect(narrateRes.statusCode).toBe(200);
    const done = JSON.parse(narrateRes.body.trim().split('\n').pop()!);
    expect(done.dynamicModeOffer).toBeNull();
  }, 15_000);

  it('con un ZonePoint FAUNA activo en la Location, alguna de varias repeticiones ofrece modo dinámico (probabilidad real, no forzada)', async () => {
    const zonePoint = await prisma.zonePoint.create({
      data: { locationId, x: 10, y: 10, tipo: 'FAUNA', targetSlug: 'fauna-prueba-oferta-modo-dinamico-21', cantidad: 5, activo: true },
    });
    try {
      const app = await buildApp();

      // Causa raíz real de este flake (encontrada y confirmada 2026-09-09, ver memoria
      // tarkor_flake_turndynamicmodeoffer_causa_real_franja3): tras aceptar la misión de Gistera, el
      // Orco Enfurecido (PRINCIPAL, AGRESIVO, candidato en cualquier ubicación sin restricción de
      // homeLocationSlug — mismo criterio que Gistera) entra en `npcsInScene` de este mismo
      // `campamento-serhu` en las vueltas del bucle de abajo. Con Franja 3 (gate de colisión de
      // celda, `turnResolution.ts` ~6956) ya cerrada, el fallback de "sin posición de zona conocida"
      // es forzar combate directo SIEMPRE — así que sin fijar `zonaPosX/Y`, el Orco bloqueaba el
      // bucle entero desde la segunda iteración (100% reproducible, no era un flake probabilístico).
      // Su `ZonePoint` real de catálogo vive en `hondonada-del-eco` (worldCatalog.ts, x:400/y:130),
      // no en esta Location — cualquier posición de zona real en `campamento-serhu` ya satisface
      // "sin ZonePoint real EN ESTA LOCATION" (la otra excepción documentada de Franja 3), así que
      // el Orco deja de forzar combate sin tener que simular una posición lejana artificial.
      await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 400, zonaPosY: 300 } });

      // Colisión de fixtures descubierta jugando en vivo (2026-09-01): `campamento-serhu` (la
      // Location de este describe, compartida por todos sus tests) dispara el encuentro guionizado
      // determinista de Gistera Koh en el turno 1 del save (ver turnResolution.ts, "Encuentro
      // guionizado del primer turno"). Mientras `gisteraEnEscena && !gisteraSeHaMarchado`, el guard
      // de la línea ~6293 de turnResolution.ts bloquea `dynamicModeOffer` a propósito (nunca ofrece
      // el modo dinámico con un encuentro guionizado sin resolver todavía) — con el bucle de abajo
      // repitiendo siempre "Espero un momento.", Gistera nunca se resolvía y el test fallaba de
      // forma determinista (100%, no un flake de probabilidad).
      //
      // `gisteraSeHaMarchado` solo lee `true` en el turno EXACTO de aceptación en texto libre, o si
      // `gisteraQuestYaExiste` (Quest real ya creada) — la aceptación real del juego NUNCA pasa por
      // texto libre (decisión de diseño 2026-08-26, ver quests.ts: "Aceptar"/"Cancelar" deterministas
      // vía botón, sin depender de que el jugador acierte la frase ni de que el LLM decida). Se
      // resuelve aquí ANTES del bucle, mismo flujo de 2 pasos que seguiría la UI real: un turno de
      // diálogo (dispara `detectsDialogueIntent`, la presenta y ofrece `newQuestOfferInfo`) y una
      // llamada directa a `POST /saves/:id/quests/aceptar` (el endpoint real que materializa la
      // Quest, mismo que pulsa el botón "Aceptar" en el frontend) — así `gisteraQuestYaExiste` pasa
      // a ser cierto de verdad en los turnos siguientes del bucle.
      const gisteraClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: '¿Quién eres?', enCombate: false } });
      const { classification: gisteraClassification, roll: gisteraRoll } = gisteraClassify.json();
      await app.inject({
        method: 'POST',
        url: '/turn/narrate',
        payload: { saveId, action: '¿Quién eres?', classification: gisteraClassification, roll: gisteraRoll, enCombate: false },
      });
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/quests/aceptar`,
        payload: { title: 'Acabar con el Orco Enfurecido', description: 'Gistera Koh pidió ayuda para acabar con quien la persigue.' },
      });

      let algunaOferta = false;
      // 60 intentos con probabilidad real 0.2/turno (bajada de 0.35, 2026-08-27, bug real "sale
      // en la gran mayoría de turnos"): fallo por puro azar ≈ 0.8^60 ≈ 8.3e-7, margen amplio para
      // no depender de una semilla concreta de Math.random().
      for (let i = 0; i < 60 && !algunaOferta; i++) {
        const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Espero un momento.', enCombate: false } });
        const { classification, roll } = classifyRes.json();
        const narrateRes = await app.inject({
          method: 'POST',
          url: '/turn/narrate',
          payload: { saveId, action: 'Espero un momento.', classification, roll, enCombate: false },
        });
        const done = JSON.parse(narrateRes.body.trim().split('\n').pop()!);
        if (done.dynamicModeOffer) {
          algunaOferta = true;
          // RECURSO ahora también es candidato elegible (2026-09-08, "Ver qué hay en la zona") —
          // `campamento-serhu` ya tiene su propio `ZonePoint` RECURSO real de catálogo
          // (`murgoles-domados-campamento`), así que la oferta real puede ser CUALQUIERA de los
          // candidatos activos en la Location, no solo la fauna sintética de este test. `cazadora-
          // serhu` se sumó como tercer candidato real (hallazgo 4, 2026-09-15: único NPC con
          // homeLocationSlug en el exterior de Karot Veku sin ZonePoint todavía). El propósito del
          // test (el mecanismo dispara alguna vez con probabilidad real) sigue cubierto con
          // cualquiera de los tres.
          expect(['fauna-prueba-oferta-modo-dinamico-21', 'murgoles-domados-campamento', 'cazadora-serhu']).toContain(done.dynamicModeOffer.targetSlug);
        }
      }
      expect(algunaOferta).toBe(true);
    } finally {
      await prisma.zonePoint.delete({ where: { id: zonePoint.id } });
      await prisma.save.update({ where: { id: saveId }, data: { lastDynamicModeOfferAtMinutes: null } });
    }
  }, 45_000);

  it('con un pendingDynamicMode ya activo, nunca ofrece uno nuevo aunque haya candidatos', async () => {
    const zonePoint = await prisma.zonePoint.create({
      data: { locationId, x: 10, y: 10, tipo: 'FAUNA', targetSlug: 'fauna-prueba-oferta-modo-dinamico-21', cantidad: 5, activo: true },
    });
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingDynamicMode: { tipo: 'NPC', targetSlug: 'x', targetName: 'X', vuelta: 1, iniciadoAtMinutes: 480 } },
    });
    try {
      const app = await buildApp();
      for (let i = 0; i < 10; i++) {
        const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Espero.', enCombate: false } });
        const { classification, roll } = classifyRes.json();
        const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action: 'Espero.', classification, roll, enCombate: false } });
        const done = JSON.parse(narrateRes.body.trim().split('\n').pop()!);
        expect(done.dynamicModeOffer).toBeNull();
      }
    } finally {
      await prisma.zonePoint.delete({ where: { id: zonePoint.id } });
      await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicMode: Prisma.JsonNull } });
    }
  }, 30_000);

  it('tras ofrecer una vez, respeta el cooldown y no vuelve a ofrecer aunque haya candidatos', async () => {
    const zonePoint = await prisma.zonePoint.create({
      data: { locationId, x: 10, y: 10, tipo: 'FAUNA', targetSlug: 'fauna-prueba-oferta-modo-dinamico-21', cantidad: 5, activo: true },
    });
    // Simula que ya se ofreció hace muy poco (5 min de ficción atrás) — dentro del cooldown de
    // 45 min (COOLDOWN_MODO_DINAMICO_MINUTOS, dynamicMode.ts).
    await prisma.save.update({
      where: { id: saveId },
      data: { lastDynamicModeOfferAtMinutes: (await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).fictionalMinutes - 5 },
    });
    try {
      const app = await buildApp();
      for (let i = 0; i < 10; i++) {
        const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Espero.', enCombate: false } });
        const { classification, roll } = classifyRes.json();
        const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action: 'Espero.', classification, roll, enCombate: false } });
        const done = JSON.parse(narrateRes.body.trim().split('\n').pop()!);
        expect(done.dynamicModeOffer).toBeNull();
      }
    } finally {
      await prisma.zonePoint.delete({ where: { id: zonePoint.id } });
      await prisma.save.update({ where: { id: saveId }, data: { lastDynamicModeOfferAtMinutes: null } });
    }
  }, 30_000);

  it('si este turno ya ofrece una misión (newQuestOfferInfo), nunca ofrece modo dinámico a la vez', async () => {
    const zonePoint = await prisma.zonePoint.create({
      data: { locationId, x: 10, y: 10, tipo: 'FAUNA', targetSlug: 'fauna-prueba-oferta-modo-dinamico-21', cantidad: 5, activo: true },
    });
    // Fuerza probabilidad 1.0 real de que HABRÍA ofrecido modo dinámico si no fuera por el guard:
    // como decideOfertaModoDinamico usa Math.random() real, no se puede forzar 100% sin mockear —
    // en su lugar, se repite igual que el test de "alguna repetición" de arriba, pero esperando
    // SIEMPRE null porque el guard de newQuestOfferInfo debe ganarle a la probabilidad en cada
    // intento donde el turno también anclaría la misión.
    narrateAction.mockResolvedValueOnce({
      narration: 'Karot Veku necesita tu ayuda.',
      newFacts: [],
      newQuest: { title: 'Ayudar en Karot Veku', description: 'Alguien en Karot Veku - Campamento del Clan Serhu pide ayuda.' },
    });
    try {
      const app = await buildApp();
      const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Ayudo.', enCombate: false } });
      const { classification, roll } = classifyRes.json();
      const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action: 'Ayudo.', classification, roll, enCombate: false } });
      const done = JSON.parse(narrateRes.body.trim().split('\n').pop()!);
      expect(done.newQuestOfferInfo).not.toBeNull();
      expect(done.dynamicModeOffer).toBeNull();
    } finally {
      await prisma.zonePoint.delete({ where: { id: zonePoint.id } });
      await prisma.save.update({ where: { id: saveId }, data: { lastDynamicModeOfferAtMinutes: null } });
    }
  }, 15_000);
});
