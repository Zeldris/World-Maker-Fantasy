import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Harness de integración real (mismo criterio que recolectar.integration.test.ts/turn.integration.
/// test.ts — Postgres local real, solo se mockea la frontera del LLM) para la Pieza 4 de
/// "Dinamismo del mundo": confirma el ciclo completo interactuar → responder → cierre, con el
/// avance de `fictionalMinutes` fijo por vuelta (MINUTOS_POR_VUELTA_MODO_DINAMICO=2), nunca la
/// escala comprimida normal del resto del juego.
const narrarVueltaModoDinamico = vi.fn();
vi.mock('../../services/dynamicModeNarracion.js', () => ({
  narrarVueltaModoDinamico: (...args: unknown[]) => narrarVueltaModoDinamico(...args),
}));

const { dynamicModeRoutes } = await import('./dynamicMode.js');

async function buildApp() {
  const app = Fastify();
  await app.register(dynamicModeRoutes);
  return app;
}

describe('POST /saves/:id/modo-dinamico/interactuar + /responder + /ignorar', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 20',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('interactuar: narra la primera vuelta, persiste pendingDynamicMode, avanza el reloj 2 minutos', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'Gistera Koh se acerca con cautela.',
      opciones: ['Escuchar lo que tiene que decir', 'Ignorarla'],
      cierra: false,
    });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/interactuar`,
      payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.narration).toBe('Gistera Koh se acerca con cautela.');
    expect(body.opciones).toEqual(['Escuchar lo que tiene que decir', 'Ignorarla']);
    expect(body.cierra).toBe(false);
    expect(body.vuelta).toBe(1);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, include: { worldState: true } });
    // A.3 (checklist frontend 2026-08-27) — narration/opciones también persistidas, no solo el
    // estado mecánico, para poder reconstruir el modal exacto tras un F5 sin volver a narrar.
    expect(saveAfter.pendingDynamicMode).toMatchObject({
      tipo: 'NPC',
      targetSlug: 'gistera-koh',
      targetName: 'Gistera Koh',
      vuelta: 1,
      narration: 'Gistera Koh se acerca con cautela.',
      opciones: ['Escuchar lo que tiene que decir', 'Ignorarla'],
    });
    expect(saveAfter.worldState?.fictionalMinutes).toBe(482);
  });

  it('interactuar de nuevo mientras ya hay uno en curso: 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/interactuar`,
      payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('responder: avanza a vuelta 2, sigue sin cerrar, reloj avanza otros 2 minutos', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'Gistera Koh insiste en su petición.',
      opciones: ['Aceptar ayudarla', 'Rechazar de nuevo'],
      cierra: false,
    });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/responder`,
      payload: { respuesta: 'Escuchar lo que tiene que decir' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.vuelta).toBe(2);
    expect(body.cierra).toBe(false);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, include: { worldState: true } });
    expect(saveAfter.pendingDynamicMode).toMatchObject({ vuelta: 2, narration: 'Gistera Koh insiste en su petición.', opciones: ['Aceptar ayudarla', 'Rechazar de nuevo'] });
    expect(saveAfter.worldState?.fictionalMinutes).toBe(484);
  });

  it('responder con cierra:true limpia pendingDynamicMode', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'Gorhorn acepta ayudar a Gistera Koh.',
      opciones: ['Continuar'],
      cierra: true,
    });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/responder`,
      payload: { respuesta: 'Aceptar ayudarla' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).cierra).toBe(true);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicMode).toBeNull();
  });

  it('responder sin ningún modo dinámico en curso: 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/responder`,
      payload: { respuesta: 'x' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('ignorar sin ningún pendingDynamicMode (rechazar oferta sin aceptar): 200 sin tocar la BD', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('ignorar CON un pendingDynamicMode activo (B.5, checklist frontend 2026-08-27: vía de escape real): lo limpia', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'Un cornante te mira desde lejos.',
      opciones: ['Acercarte', 'Ignorarlo'],
      cierra: false,
    });
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/interactuar`,
      payload: { tipo: 'FAUNA', targetSlug: 'cornante', targetName: 'Cornante' },
    });
    const saveConPending = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveConPending.pendingDynamicMode).not.toBeNull();

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicMode).toBeNull();
  });
});
