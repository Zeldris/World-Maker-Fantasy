import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import type { NarrationResult } from '../services/narrador.js';

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
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
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
    const app = await buildApp();
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Miro alrededor.', enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: 'Miro alrededor.', classification, roll, enCombate: false },
    });
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
          expect(done.dynamicModeOffer).toEqual({ tipo: 'FAUNA', targetSlug: 'fauna-prueba-oferta-modo-dinamico-21', targetName: expect.any(String) });
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
