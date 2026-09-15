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
// `aceptarQuest` (quests.ts, ver dynamicMode.ts § Gistera Koh aceptando) llama a Ollama real para
// la narración de aceptación — mockeada aquí, mismo criterio que `narrarVueltaModoDinamico` arriba,
// para no depender de un servicio externo en el harness de tests.
const generateQuestResponseNarration = vi.fn();
vi.mock('../../services/narrador.js', () => ({
  generateQuestResponseNarration: (...args: unknown[]) => generateQuestResponseNarration(...args),
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
    // Default estable para todos los tests de este archivo (`aceptarQuest` cae al texto fijo
    // "${characterName} acepta la misión: ${title}." si esto no está mockeado, pero mejor explícito).
    generateQuestResponseNarration.mockResolvedValue('Gorhorn acepta ayudar a Gistera Koh.');
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('interactuar: narra la primera vuelta, persiste pendingDynamicMode, avanza el reloj 2 minutos', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'Maestro Kade se acerca con cautela.',
      opciones: ['Escuchar lo que tiene que decir', 'Ignorarlo'],
      cierra: false,
    });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/interactuar`,
      payload: { tipo: 'NPC', targetSlug: 'maestro-kade', targetName: 'Maestro Kade' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.narration).toBe('Maestro Kade se acerca con cautela.');
    expect(body.opciones).toEqual(['Escuchar lo que tiene que decir', 'Ignorarlo']);
    expect(body.cierra).toBe(false);
    expect(body.vuelta).toBe(1);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, include: { worldState: true } });
    // A.3 (checklist frontend 2026-08-27) — narration/opciones también persistidas, no solo el
    // estado mecánico, para poder reconstruir el modal exacto tras un F5 sin volver a narrar.
    expect(saveAfter.pendingDynamicMode).toMatchObject({
      tipo: 'NPC',
      targetSlug: 'maestro-kade',
      targetName: 'Maestro Kade',
      vuelta: 1,
      narration: 'Maestro Kade se acerca con cautela.',
      opciones: ['Escuchar lo que tiene que decir', 'Ignorarlo'],
    });
    expect(saveAfter.worldState?.fictionalMinutes).toBe(482);
  });

  it('interactuar de nuevo mientras ya hay uno en curso: 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/interactuar`,
      payload: { tipo: 'NPC', targetSlug: 'maestro-kade', targetName: 'Maestro Kade' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('responder: avanza a vuelta 2, sigue sin cerrar, reloj avanza otros 2 minutos', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'Maestro Kade insiste en su petición.',
      opciones: ['Aceptar ayudarlo', 'Rechazar de nuevo'],
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
    expect(saveAfter.pendingDynamicMode).toMatchObject({ vuelta: 2, narration: 'Maestro Kade insiste en su petición.', opciones: ['Aceptar ayudarlo', 'Rechazar de nuevo'] });
    expect(saveAfter.worldState?.fictionalMinutes).toBe(484);
  });

  it('responder con cierra:true limpia pendingDynamicMode y vuelca TODAS las vueltas concatenadas a un LogEntry nuevo (Franja 0, 2026-09-08)', async () => {
    narrarVueltaModoDinamico.mockResolvedValueOnce({
      narration: 'Gorhorn acepta ayudar a Maestro Kade.',
      opciones: ['Continuar'],
      cierra: true,
    });
    const app = await buildApp();

    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/modo-dinamico/responder`,
      payload: { respuesta: 'Aceptar ayudarlo' },
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
        'Maestro Kade se acerca con cautela.',
        'Maestro Kade insiste en su petición.',
        'Gorhorn acepta ayudar a Maestro Kade.',
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
    expect(JSON.parse(res.body)).toEqual({ ok: true, logEntry: null });
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
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicMode).toBeNull();

    const logCountDespues = await prisma.logEntry.count({ where: { saveId } });
    expect(logCountDespues).toBe(logCountAntes + 1);
    const nuevaEntrada = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(nuevaEntrada.text).toBe('Un cornante te mira desde lejos.');
    // Bug real jugando en vivo (2026-09-15, hallazgo Álvaro: "cerrar Interactuar no deja rastro en
    // el log") — antes esta ruta devolvía solo `{ ok: true }`: el LogEntry se creaba en BD pero el
    // frontend nunca lo recibía para insertarlo, así que desaparecía visualmente. Ahora viaja en
    // la propia respuesta, mismo criterio que `/zona/mover`.
    expect(body.logEntry).not.toBeNull();
    expect(body.logEntry.id).toBe(nuevaEntrada.id);
    expect(body.logEntry.text).toBe('Un cornante te mira desde lejos.');
  });

  it('ignorar SIN pendingDynamicMode activo (solo rechazar oferta): no crea ningún LogEntry (nada que narrar)', async () => {
    const app = await buildApp();
    const logCountAntes = await prisma.logEntry.count({ where: { saveId } });

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).logEntry).toBeNull();

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
      // Hallazgo 47 (revisar-partida-hallazgos.md, 2026-09-15) — la marca DESCUBIERTO ahora se
      // escribe DENTRO de la misma transacción que cierra la conversación, no en una llamada suelta
      // aparte.
      const discovered = await prisma.discoveredEntity.findFirst({ where: { saveId, entityType: 'npc', entitySlug: 'maestro-kade' } });
      expect(discovered?.fase).toBe('DESCUBIERTO');
    });

    // Hallazgo 47 (2026-09-15) — el mismo fix, pero por el camino de "Salir" (`/ignorar`), que es
    // el que el propio hallazgo señaló como el más expuesto (ninguna otra escritura de la petición
    // dependía de esta, así que un fallo aquí era más fácil de pasar desapercibido).
    it('"Salir" (/ignorar) con una conversación de NPC en curso también deja al NPC DESCUBIERTO, dentro de la misma transacción', async () => {
      // El test anterior de este describe ya deja a Maestro Kade DESCUBIERTO — se limpia para que
      // este test verifique de verdad que /ignorar es quien lo marca, no un estado heredado.
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'maestro-kade' } });
      narrarVueltaModoDinamico.mockResolvedValueOnce({
        narration: 'Serhu Maestro Kade te mira, esperando.',
        opciones: ['Preguntar por el clan'],
        cierra: false,
      });
      const app = await buildApp();

      const open = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'maestro-kade', targetName: 'Maestro Kade' },
      });
      expect(open.statusCode).toBe(200);
      expect(JSON.parse(open.body).cierra).toBe(false);

      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.logEntry).not.toBeNull();

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicMode).toBeNull();

      const discovered = await prisma.discoveredEntity.findFirst({ where: { saveId, entityType: 'npc', entitySlug: 'maestro-kade' } });
      expect(discovered?.fase).toBe('DESCUBIERTO');
    });

    // Guion determinista de Gistera Koh (2026-09-09, ver dynamicMode.ts § `narrarVueltaGistera` —
    // bug real jugando en vivo: "ya no estamos usando los mensajes deterministas... y qué tiene
    // que ver el tótem con ella") — a diferencia del resto de NPC, Gistera NUNCA pasa por
    // `narrarVueltaModoDinamico` (LLM): el mock de ese módulo no se usa en estos 3 tests, se
    // ejercita el guion fijo real de 3 vueltas (avistamiento → presentación → despedida).
    // Bug real jugando en vivo (2026-09-09, tras cerrar el fix del guion determinista — Álvaro: "al
    // acabar de interactuar me sale para aceptar la misión otra vez... como ya aceptamos esto no
    // debería salir... solo un log al final que confirme que la misión se ha aceptado") — Gistera
    // ya NO ofrece (`newQuestOfferInfo`, exige un segundo clic): crea la Quest DIRECTAMENTE al
    // aceptar dentro de la conversación (`questAceptada`, ver `aceptarQuest` extraída en quests.ts).
    it('Gistera Koh: aceptar dentro de la conversación crea la Quest DIRECTAMENTE (questAceptada), sin pedir una segunda confirmación por botones', async () => {
      const app = await buildApp();

      const res1 = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      expect(body1.narration).toContain('orca de las llanuras');
      expect(body1.cierra).toBe(false);

      const res2 = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Me acerco a ella' },
      });
      const body2 = JSON.parse(res2.body);
      expect(body2.narration).toContain('Soy Gistera Koh');
      // Guard del bug original (2026-09-09) — el tótem se atribuye a GORHORN ("Llevas la marca de
      // los Maktor"), nunca a Gistera ("su tótem Maktor").
      expect(body2.narration).not.toContain('su tótem Maktor');
      expect(body2.cierra).toBe(false);

      const res3 = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Aceptar ayudarla' },
      });
      expect(res3.statusCode).toBe(200);
      const body3 = JSON.parse(res3.body);
      expect(body3.cierra).toBe(true);
      // Nunca ofrece — `newQuestOfferInfo` debe quedar vacío, la Quest ya nació ACTIVA de verdad.
      expect(body3.newQuestOfferInfo).toBeFalsy();
      expect(body3.questAceptada.quest.questSlug).toBe('orco-enfurecido-hondonada-gistera');
      expect(body3.questAceptada.quest.title).toBe('Acabar con el Orco Enfurecido');
      expect(body3.questAceptada.logEntry.text).toContain('Gistera Koh');

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingQuestOfferInfo).toBeNull();

      const questReal = await prisma.quest.findFirst({ where: { saveId, questSlug: 'orco-enfurecido-hondonada-gistera' } });
      expect(questReal).not.toBeNull();
      expect(questReal!.status).toBe('ACTIVA');

      const fact = await prisma.sessionFact.findFirst({ where: { saveId, text: 'Gistera Koh conversa con el personaje.' } });
      expect(fact).not.toBeNull();
      // Generalización del nombre oculto (2026-09-09) — presentarse marca DiscoveredEntity real,
      // coherente con "conocer a Gistera" para el resto del motor (mapa/colisión ya no la ocultan).
      const discovered = await prisma.discoveredEntity.findFirst({ where: { saveId, entityType: 'npc', entitySlug: 'gistera-koh' } });
      expect(discovered?.fase).toBe('DESCUBIERTO');
    });

    it('Gistera Koh: si la Quest del Orco Enfurecido YA existe (aceptada por otro camino), no vuelve a ofrecerla', async () => {
      // La Quest ya se creó en el test anterior — reabrir una conversación nueva con Gistera (p.ej.
      // el jugador vuelve a pulsar Interactuar sobre un ZonePoint suyo antes de que se retire de
      // escena) no debe generar una segunda oferta duplicada. `pendingQuestOfferInfo` limpio a mano
      // (en producción esto ya lo habría hecho `/quests/aceptar` al crear la Quest de verdad).
      await prisma.save.update({ where: { id: saveId }, data: { pendingQuestOfferInfo: Prisma.JsonNull } });
      const app = await buildApp();

      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Me acerco a ella' },
      });
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Aceptar ayudarla' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.newQuestOfferInfo).toBeFalsy();
      // Idempotente (`aceptarQuest`, quests.ts) — reconoce la Quest ya existente por `questSlug` y
      // no la duplica; `logEntry: null` porque no hay nada nuevo que narrar/persistir.
      expect(body.questAceptada.alreadyExisted).toBe(true);
      expect(body.questAceptada.logEntry).toBeNull();

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingQuestOfferInfo).toBeNull();

      const questCount = await prisma.quest.count({ where: { saveId, questSlug: 'orco-enfurecido-hondonada-gistera' } });
      expect(questCount).toBe(1);

      await prisma.quest.deleteMany({ where: { saveId } });
    });

    it('Gistera Koh: rechazar su ayuda cierra la conversación SIN generar ninguna oferta de misión', async () => {
      const app = await buildApp();
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Me acerco a ella' },
      });
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Rechazar y seguir tu camino' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cierra).toBe(true);
      expect(body.newQuestOfferInfo).toBeFalsy();

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingQuestOfferInfo).toBeNull();
      expect(saveAfter.pendingDynamicMode).toBeNull();
    });

    it('Gistera Koh: "Salir" a medias en la VUELTA 1 (nunca se presentó) no marca su nombre como descubierto — sigue siendo un spoiler evitado', async () => {
      // Limpieza explícita (2026-09-09) — el test "cerrar la conversación SÍ genera
      // pendingQuestOfferInfo" (más arriba en este mismo describe) ya deja un SessionFact/
      // DiscoveredEntity reales de Gistera al completar su propio flujo hasta aceptar; sin esta
      // limpieza, la aserción `toBeNull()` de este test sería un falso positivo (encontraría la
      // fila del test anterior, no una generada — o no— por este caso concreto).
      await prisma.sessionFact.deleteMany({ where: { saveId, text: 'Gistera Koh conversa con el personaje.' } });
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'gistera-koh' } });
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

      // Salir en vuelta 1 (avistamiento sin nombre) — Gistera nunca se presentó, así que no cuenta
      // como "conocida" todavía (ni SessionFact ni DiscoveredEntity), a diferencia del resto de
      // NPC (que sí revelan su nombre en la propia narración de la vuelta 1).
      const fact = await prisma.sessionFact.findFirst({ where: { saveId, text: 'Gistera Koh conversa con el personaje.' } });
      expect(fact).toBeNull();
      const discovered = await prisma.discoveredEntity.findFirst({ where: { saveId, entityType: 'npc', entitySlug: 'gistera-koh' } });
      expect(discovered).toBeNull();
    });

    it('Gistera Koh: "Salir" a medias DESPUÉS de presentarse (vuelta 2) SÍ deja el SessionFact — ya no es un spoiler', async () => {
      const app = await buildApp();
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Me acerco a ella' },
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
