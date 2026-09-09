import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
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
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
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

  it('responder con cierra:true limpia pendingDynamicMode y vuelca TODAS las vueltas concatenadas a un LogEntry nuevo (Franja 0, 2026-09-08)', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'Gorhorn acepta ayudar a Gistera Koh.',
      opciones: ['Continuar'],
      cierra: true,
    });
    const app = await buildApp();

    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/responder`,
      payload: { respuesta: 'Aceptar ayudarla' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).cierra).toBe(true);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicMode).toBeNull();

    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    expect(logCountDespues).toBe(logCountAntes + 1);
    const nuevaEntrada = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(nuevaEntrada.channel).toBe('CHARACTER');
    // Las 3 vueltas completas de esta conversación (interactuar + 2x responder de los tests
    // anteriores), concatenadas en orden — antes de este fix, cerrar el modal no dejaba NINGÚN
    // rastro legible en el log permanente de la partida.
    expect(nuevaEntrada.text).toBe(
      [
        'Gistera Koh se acerca con cautela.',
        'Gistera Koh insiste en su petición.',
        'Gorhorn acepta ayudar a Gistera Koh.',
      ].join('\n\n'),
    );
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

  it('ignorar CON un pendingDynamicMode activo (B.5, checklist frontend 2026-08-27: vía de escape real): lo limpia y vuelca la conversación truncada a un LogEntry (Franja 0, 2026-09-08)', async () => {
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

    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicMode).toBeNull();

    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    expect(logCountDespues).toBe(logCountAntes + 1);
    const nuevaEntrada = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(nuevaEntrada.text).toBe('Un cornante te mira desde lejos.');
  });

  it('ignorar SIN pendingDynamicMode activo (solo rechazar oferta): no crea ningún LogEntry (nada que narrar)', async () => {
    const app = await buildApp();
    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
    expect(res.statusCode).toBe(200);

    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    expect(logCountDespues).toBe(logCountAntes);
  });

  it('interactuar con cierra:true YA en la primera vuelta: vuelca esa única vuelta a un LogEntry (caso borde, Franja 0)', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'El jashil huye antes de que puedas acercarte.',
      opciones: [],
      cierra: true,
    });
    const app = await buildApp();
    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/interactuar`,
      payload: { tipo: 'FAUNA', targetSlug: 'jashil-verde', targetName: 'Jashil verde' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).cierra).toBe(true);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicMode).toBeNull();

    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    expect(logCountDespues).toBe(logCountAntes + 1);
    const nuevaEntrada = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(nuevaEntrada.text).toBe('El jashil huye antes de que puedas acercarte.');
  });

  // Bug real jugando en vivo (2026-09-09, ver memoria tarkor_hallazgo_dialogo_gistera_sin_persistir):
  // "Interactuar" nunca pasaba por turnResolution.ts, así que cerrar una conversación con un NPC no
  // dejaba ningún SessionFact — turnos de texto libre posteriores lo trataban como ausente de escena.
  describe('bug real 2026-09-09: cerrar Interactuar con un NPC debe dejarlo "conocido" en escena', () => {
    // El test de la línea ~118 (ya existente, cierra una conversación con Gistera Koh) ahora
    // también genera `pendingQuestOfferInfo` con este mismo fix — se limpia aquí para que este
    // describe arranque desde un estado predecible, sin depender del orden de ejecución del resto
    // del archivo.
    beforeAll(async () => {
      await prisma.save.update({ where: { id: saveId }, data: { pendingQuestOfferInfo: Prisma.JsonNull } });
    });

    it('NPC genérico (no Gistera): cerrar la conversación escribe un SessionFact con su nombre, sin generar ninguna oferta de misión', async () => {
      narrarVueltaModoDinamico.mockResolvedValueOnce({
        narration: 'Serhu Maestro Kade te saluda con la cabeza.',
        opciones: [],
        cierra: true,
      });
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'maestro-kade', targetName: 'Maestro Kade' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cierra).toBe(true);
      expect(body.newQuestOfferInfo).toBeFalsy();

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingQuestOfferInfo).toBeNull();

      const fact = await prisma.sessionFact.findFirst({ where: { saveId, text: 'Maestro Kade conversa con el personaje.' } });
      expect(fact).not.toBeNull();
    });

    it('Gistera Koh: cerrar la conversación SÍ genera pendingQuestOfferInfo ("Acabar con el Orco Enfurecido"), igual que el gancho de texto libre', async () => {
      narrarVueltaModoDinamico.mockResolvedValueOnce({
        narration: 'Gistera Koh, aliviada, formula su petición de ayuda.',
        opciones: ['Aceptar', 'Rechazar'],
        cierra: true,
      });
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.newQuestOfferInfo).toEqual({
        title: 'Acabar con el Orco Enfurecido',
        description: 'Gistera Koh, expulsada del Clan Serhu, pide ayuda para acabar con el guerrero que la persigue. Aceptar la pondría a salvo.',
      });

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingQuestOfferInfo).toEqual(body.newQuestOfferInfo);

      const fact = await prisma.sessionFact.findFirst({ where: { saveId, text: 'Gistera Koh conversa con el personaje.' } });
      expect(fact).not.toBeNull();

      // Idempotencia real: /quests/aceptar acepta esta oferta con el título exacto — mismo criterio
      // que el resto del proyecto (quests.ts § ORCO_ENFURECIDO_QUEST_SLUG), sin duplicar la Quest.
      await prisma.quest.create({
        data: { saveId, questSlug: 'orco-enfurecido-hondonada-gistera', title: body.newQuestOfferInfo.title, description: body.newQuestOfferInfo.description, status: 'ACTIVA' },
      });
    });

    it('Gistera Koh: si la Quest del Orco Enfurecido YA existe (aceptada por otro camino), no vuelve a ofrecerla', async () => {
      // La Quest ya se creó en el test anterior — reabrir una conversación nueva con Gistera (p.ej.
      // el jugador vuelve a pulsar Interactuar sobre un ZonePoint suyo antes de que se retire de
      // escena) no debe generar una segunda oferta duplicada. `pendingQuestOfferInfo` limpio a mano
      // (en producción esto ya lo habría hecho `/quests/aceptar` al crear la Quest de verdad).
      await prisma.save.update({ where: { id: saveId }, data: { pendingQuestOfferInfo: Prisma.JsonNull } });
      narrarVueltaModoDinamico.mockResolvedValueOnce({
        narration: 'Gistera Koh ya no tiene nada más que pedirte.',
        opciones: [],
        cierra: true,
      });
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).newQuestOfferInfo).toBeFalsy();

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingQuestOfferInfo).toBeNull();

      await prisma.quest.deleteMany({ where: { saveId } });
    });

    it('Gistera Koh: "Salir" a medias de la conversación (nunca llegó a cierra:true) deja el SessionFact pero NUNCA genera la oferta de misión (obligatoria, no puede quemarse a medias)', async () => {
      narrarVueltaModoDinamico.mockResolvedValueOnce({
        narration: 'Gistera Koh empieza a hablarte del tótem.',
        opciones: ['Escuchar', 'Ignorarla'],
        cierra: false,
      });
      const app = await buildApp();
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });

      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
      expect(res.statusCode).toBe(200);

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingQuestOfferInfo).toBeNull();
      expect(saveAfter.pendingDynamicMode).toBeNull();

      const fact = await prisma.sessionFact.findFirst({ where: { saveId, text: 'Gistera Koh conversa con el personaje.' } });
      expect(fact).not.toBeNull();
    });

    it('FAUNA: cerrar la conversación NUNCA escribe SessionFact ni genera oferta (el fix es solo para NPC)', async () => {
      narrarVueltaModoDinamico.mockResolvedValueOnce({
        narration: 'El jashil se aleja saltando entre las rocas.',
        opciones: [],
        cierra: true,
      });
      const app = await buildApp();
      const factCountAntes = await prisma.sessionFact.count({ where: { saveId } });

      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'FAUNA', targetSlug: 'jashil-verde', targetName: 'Jashil verde' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).newQuestOfferInfo).toBeFalsy();

      const factCountDespues = await prisma.sessionFact.count({ where: { saveId } });
      expect(factCountDespues).toBe(factCountAntes);
    });
  });
});
