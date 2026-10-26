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

// P324: `appendSessionFacts` llama a Ollama (embebido) y corre fuera de la transacción de cierre;
// `fallaSessionFact` lo hace fallar en los tests que comprueban que el cierre aguanta.
let fallaSessionFact: Error | null = null;
vi.mock('../../services/worldFacts.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/worldFacts.js')>();
  return {
    ...real,
    appendSessionFacts: (...args: Parameters<typeof real.appendSessionFacts>) =>
      fallaSessionFact ? Promise.reject(fallaSessionFact) : real.appendSessionFacts(...args),
  };
});

const { dynamicModeRoutes } = await import('./dynamicMode.js');
const { detailRoutes } = await import('./detail.js');

async function buildApp() {
  const app = Fastify();
  await app.register(dynamicModeRoutes);
  return app;
}

/// P27 (decidido por la usuaria 2026-10-26): Interactuar con quien te corta el paso nunca abre el combate; sale
/// la decisión (Combatir/Huir) y el combate empieza al elegir Combatir. Devuelve la respuesta de Combatir.
async function interactuarYCombatir(app: Awaited<ReturnType<typeof buildApp>>, saveId: string, payload: Record<string, unknown>) {
  const paso = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/interactuar`, payload });
  expect(paso.statusCode, paso.body).toBe(200);
  expect(JSON.parse(paso.body)).toMatchObject({ cierra: false, opciones: ['Combatir', 'Huir'] });
  return app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta: 'Combatir' } });
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

  // P150 (QA-27): «Seguir mi camino» manda el ignorar de la oferta vieja y el paso siguiente a la vez; el
  // paso guardaba la oferta nueva y el ignorar, que acababa después, la borraba (409 al pulsar «Cazar»).
  it('ignorar una oferta concreta no borra la nueva que ya puso el paso siguiente (P150)', async () => {
    const app = await buildApp();
    const nueva = { tipo: 'FAUNA', targetSlug: 'cornante', targetName: 'Cornante' };
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicMode: Prisma.JsonNull, pendingDynamicModeOffer: nueva } });
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar`, payload: { targetSlug: 'guchapo' } });
    expect(res.statusCode).toBe(200);
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingDynamicModeOffer).toEqual(nueva);
    // La misma oferta sí se borra.
    await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar`, payload: { targetSlug: 'cornante' } });
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingDynamicModeOffer).toBeNull();
  });

  // Bug real jugando en vivo (2026-09-28): "Ignorar" en "X te corta el paso" era una huida gratis.
  it('ignorar una oferta de combate forzado (AGRESIVO/ENEMIGO) sin abrir: 409 y la oferta sigue pendiente', async () => {
    const oferta = { tipo: 'NPC', targetSlug: 'orco-enfurecido-hondonada', targetName: 'Alguien', quienInicia: 'npc', combateForzado: true };
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicMode: Prisma.JsonNull, pendingDynamicModeOffer: oferta } });
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
      expect(res.statusCode).toBe(409);
      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicModeOffer).toEqual(oferta);
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
    }
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

    // P324: «Salir» y «Rechazar» daban 500 y luego 409 porque el hecho de sesión (embebido de Ollama,
    // fuera de la transacción) lanzaba con el cierre ya confirmado. Los tres caminos que cierran con
    // un NPC siguen respondiendo 200 y dejan la conversación cerrada y al NPC DESCUBIERTO.
    describe('P324: si el hecho de sesión falla, el cierre no da 500', () => {
      const fallo = new Error('Ollama (embeddings) no respondió en 30s — probable cuelgue.');
      beforeAll(() => {
        fallaSessionFact = fallo;
      });
      afterAll(() => {
        fallaSessionFact = null;
      });

      async function abrirKade(app: Awaited<ReturnType<typeof buildApp>>) {
        await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'maestro-kade' } });
        narrarVueltaModoDinamico.mockResolvedValueOnce({ narration: 'Maestro Kade te mira, esperando.', opciones: ['Preguntar'], cierra: false });
        const open = await app.inject({
          method: 'POST',
          url: `/saves/${saveId}/modo-dinamico/interactuar`,
          payload: { tipo: 'NPC', targetSlug: 'maestro-kade', targetName: 'Maestro Kade' },
        });
        expect(open.statusCode).toBe(200);
      }

      async function comprobarCerrada() {
        const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
        expect(saveAfter.pendingDynamicMode).toBeNull();
        const discovered = await prisma.discoveredEntity.findFirst({ where: { saveId, entityType: 'npc', entitySlug: 'maestro-kade' } });
        expect(discovered?.fase).toBe('DESCUBIERTO');
      }

      it('/ignorar («Salir»)', async () => {
        const app = await buildApp();
        await abrirKade(app);
        const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
        expect(res.statusCode).toBe(200);
        await comprobarCerrada();
      });

      it('/responder con cierre', async () => {
        const app = await buildApp();
        await abrirKade(app);
        narrarVueltaModoDinamico.mockResolvedValueOnce({ narration: 'Maestro Kade asiente y se marcha.', opciones: [], cierra: true });
        const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta: 'Preguntar' } });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).cierra).toBe(true);
        await comprobarCerrada();
      });

      it('/interactuar que cierra ya en la primera vuelta', async () => {
        const app = await buildApp();
        await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'maestro-kade' } });
        narrarVueltaModoDinamico.mockResolvedValueOnce({ narration: 'Maestro Kade te saluda con la cabeza.', opciones: [], cierra: true });
        const res = await app.inject({
          method: 'POST',
          url: `/saves/${saveId}/modo-dinamico/interactuar`,
          payload: { tipo: 'NPC', targetSlug: 'maestro-kade', targetName: 'Maestro Kade' },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).cierra).toBe(true);
        await comprobarCerrada();
      });
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
      // P244: con Gistera ya DESCUBIERTO el segundo Interactuar abre un reencuentro (test aparte, más
      // abajo); este caso es el del primer encuentro con la Quest ya creada por otro camino.
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'gistera-koh' } });
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

    // P244 (decidido por la usuaria 2026-10-26): Interactuar con un NPC ya conocido (DESCUBIERTO) abre un
    // reencuentro, sin avistamiento ni presentación.
    it('P244 Gistera Koh ya conocida: Interactuar abre un reencuentro sin presentación (sin la misión: vuelve a decidir)', async () => {
      await prisma.quest.deleteMany({ where: { saveId } });
      await prisma.discoveredEntity.upsert({
        where: { saveId_entityType_entitySlug: { saveId, entityType: 'npc', entitySlug: 'gistera-koh' } },
        create: { saveId, entityType: 'npc', entitySlug: 'gistera-koh', fase: 'DESCUBIERTO' },
        update: { fase: 'DESCUBIERTO' },
      });
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.narration).toContain('te reconoce');
      expect(body.narration).not.toContain('ves a una orca');
      expect(body.narration).not.toContain('Soy Gistera Koh');
      expect(body.opciones).toEqual(['Aceptar ayudarla', 'Rechazar y seguir tu camino']);
      expect(body.cierra).toBe(false);
      await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });
    });

    it('P244 Gistera Koh ya conocida y con la misión tomada: el reencuentro cierra solo, sin ofrecer nada', async () => {
      await prisma.quest.create({
        data: { saveId, title: 'Acabar con el Orco Enfurecido', description: 'x', questSlug: 'orco-enfurecido-hondonada-gistera', status: 'ACTIVA' },
      });
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.narration).toContain('te reconoce');
      expect(body.cierra).toBe(true);
      expect(body.opciones).toEqual([]);
      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicMode).toBeNull();
      await prisma.quest.deleteMany({ where: { saveId } });
    });

    it('P244 otro NPC (LLM) ya conocido: el narrador recibe reencuentro:true y la conversación lo recuerda; sin descubrir, no', async () => {
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'maestro-kade' } });
      const app = await buildApp();
      narrarVueltaModoDinamico.mockClear();
      narrarVueltaModoDinamico.mockResolvedValueOnce({ narration: 'Maestro Kade te saluda.', opciones: ['Hablar', 'Irte'], cierra: false });
      const nuevo = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'maestro-kade', targetName: 'Maestro Kade' },
      });
      expect(nuevo.statusCode).toBe(200);
      expect(narrarVueltaModoDinamico.mock.calls[0][0].reencuentro).toBeFalsy();
      await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/ignorar` });

      await prisma.discoveredEntity.upsert({
        where: { saveId_entityType_entitySlug: { saveId, entityType: 'npc', entitySlug: 'maestro-kade' } },
        create: { saveId, entityType: 'npc', entitySlug: 'maestro-kade', fase: 'DESCUBIERTO' },
        update: { fase: 'DESCUBIERTO' },
      });
      narrarVueltaModoDinamico.mockClear();
      narrarVueltaModoDinamico.mockResolvedValueOnce({ narration: 'Maestro Kade te reconoce.', opciones: ['Hablar', 'Irte'], cierra: false });
      const conocido = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'NPC', targetSlug: 'maestro-kade', targetName: 'Maestro Kade' },
      });
      expect(conocido.statusCode).toBe(200);
      expect(narrarVueltaModoDinamico.mock.calls[0][0].reencuentro).toBe(true);
      narrarVueltaModoDinamico.mockResolvedValueOnce({ narration: 'Sigue la charla.', opciones: [], cierra: true });
      await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta: 'Hablar' } });
      expect(narrarVueltaModoDinamico.mock.calls[1][0].reencuentro).toBe(true);
    });

    it('P243 Gistera Koh: desde la segunda vez, «Preguntar más» no avanza el reloj y dice que ya lo contó', async () => {
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'gistera-koh' } });
      const app = await buildApp();
      const reloj = async () => (await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).fictionalMinutes;
      const responder = async (respuesta: string) =>
        JSON.parse((await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta } })).body);

      await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/interactuar`, payload: { tipo: 'NPC', targetSlug: 'gistera-koh', targetName: 'Gistera Koh' } });
      const presentacion = await responder('Me acerco a ella');
      expect(presentacion.narration).toContain('Soy Gistera Koh');
      const primera = await responder('Preguntar más antes de decidir');
      expect(primera.narration).toContain('Soy Gistera Koh');
      const antes = await reloj();

      const segunda = await responder('Preguntar más antes de decidir');
      expect(segunda.narration).toContain('Ya te lo he contado todo');
      expect(segunda.narration).not.toContain('Soy Gistera Koh');
      expect(segunda.opciones).toEqual(['Aceptar ayudarla', 'Preguntar más antes de decidir', 'Rechazar y seguir tu camino']);
      expect(segunda.cierra).toBe(false);
      expect(await reloj()).toBe(antes);
      const tercera = await responder('Preguntar más antes de decidir');
      expect(tercera.narration).toContain('Ya te lo he contado todo');
      expect(await reloj()).toBe(antes);

      // Y la conversación sigue: se puede rechazar con normalidad (el reloj vuelve a avanzar).
      const rechazo = await responder('Rechazar y seguir tu camino');
      expect(rechazo.cierra).toBe(true);
      expect(await reloj()).toBe(antes + 2);
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'gistera-koh' } });
    });

    it('Gistera Koh: rechazar su ayuda cierra la conversación SIN generar ninguna oferta de misión', async () => {
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'gistera-koh' } });
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

  // Corrección de diseño (2026-09-20, hallazgo real jugando en vivo — Álvaro: "todos los
  // encuentros deben provocar el interactuar... si choco con el orco me dice que está ahí y tengo
  // que escribir para que salte el combate, cuando debería saltar el interactuar y ahí darte la
  // opción de combatir o huir") — un AGRESIVO/ENEMIGO en Zona ya no deja solo un aviso de texto
  // (esperando al turno de texto libre siguiente): abre el mismo modal de Interactuar, marcado
  // `combateForzado`. Harness propio con un `Npc` real (necesita pasar por `detectNpcsInScene` de
  // verdad, a diferencia del resto de tests de este archivo que usan slugs sin fila de catálogo).
  // CR-49: una persona agresiva con los suyos cerca no pelea sola: el combate forzado abre el de
  // varios con todos (como la caza en grupo: `actionText` para el turno siguiente).
  // P90 (QA-27): un grupo de fauna que embosca a la jugadora no deja «Salgo a cazar…» como acción
  // suya: el diario lo cuenta la entrada de sistema del combate («El grupo de 3 … te embosca.»).
  describe('P90 — emboscada de un grupo de fauna', () => {
    let locationId: string;

    beforeAll(async () => {
      const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
      locationId = (await prisma.location.create({
        data: { worldId: world.id, slug: 'test-p90-emboscada', name: 'Zona de Prueba P90', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba p90'] },
      })).id;
      await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: locationId } });
    });

    afterAll(async () => {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: null, pendingCombatNpcSlugs: [] } });
      await prisma.zonePoint.deleteMany({ where: { locationId } });
      await prisma.location.delete({ where: { id: locationId } });
    });

    it('sin acción de la jugadora en el diario y con la emboscada en la entrada de sistema', async () => {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      const punto = await prisma.zonePoint.create({ data: { saveId, locationId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'aullador-rojo', cantidad: 3, activo: true } });
      const app = await buildApp();
      const res = await interactuarYCombatir(app, saveId, { tipo: 'FAUNA', targetSlug: 'aullador-rojo', targetName: 'Aullador Rojo', quienInicia: 'npc', combateForzado: true, zonePointId: punto.id, cantidad: 3 });
      expect(res.statusCode, res.body).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.actionText).toMatch(/^Me defiendo de /);
      expect(body.accionEnDiario).toBeNull();
      expect(body.combateGrupoLogEntry.text).toMatch(/te embosca\./);
    });
  });

  describe('CR-49 — combate forzado contra una persona con los suyos cerca', () => {
    let locationId: string;
    const ids: string[] = [];

    beforeAll(async () => {
      const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
      locationId = (await prisma.location.create({
        data: { worldId: world.id, slug: 'test-cr49-banda', name: 'Zona de Prueba CR-49', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba cr49'] },
      })).id;
      for (const [slug, x] of [['test-cr49-jefe', 400], ['test-cr49-segundo', 450]] as const) {
        const npc = await prisma.npc.create({
          data: {
            worldId: world.id, kind: 'PLANTILLA', slug, name: slug, aliases: [slug], role: 'x', level: 1, faction: 'Banda de Prueba CR-49', raza: 'orcos',
            attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 8, voluntad: 8, carisma: 2, magia: 0 }, bio: 'x', personality: 'x', homeLocationSlug: null, temperamento: 'AGRESIVO',
          },
        });
        ids.push(npc.id);
        await prisma.zonePoint.create({ data: { saveId, locationId, x, y: 300, tipo: 'NPC', targetSlug: slug } });
      }
      await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: locationId } });
    });

    afterAll(async () => {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: null, pendingCombatNpcSlugs: [] } });
      await prisma.zonePoint.deleteMany({ where: { locationId } });
      await prisma.npcState.deleteMany({ where: { saveId, npcId: { in: ids } } });
      await prisma.npc.deleteMany({ where: { id: { in: ids } } });
      await prisma.location.delete({ where: { id: locationId } });
    });

    it('abre el combate de varios con los dos y devuelve el texto del turno siguiente', async () => {
      const app = await buildApp();
      const res = await interactuarYCombatir(app, saveId, { tipo: 'NPC', targetSlug: 'test-cr49-jefe', targetName: 'test-cr49-jefe', quienInicia: 'npc', combateForzado: true });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).actionText).toContain('test-cr49-jefe');
      // P90: la vieron antes ellos (`quienInicia: 'npc'`): emboscada, sin acción suya en el diario.
      expect(JSON.parse(res.body).accionEnDiario).toBeNull();
      const encuentro = await prisma.combatEncounter.findFirstOrThrow({ where: { saveId, estado: 'EN_CURSO' }, include: { participantes: true } });
      expect(encuentro.participantes.filter((p) => p.bando === 'ENEMIGO').map((p) => p.npcId).sort()).toEqual([...ids].sort());
    });

    it('revisión P327: con el jefe PRINCIPAL sin conocer, el diario lo llama «el orco desconocido» y la acción sigue con su nombre', async () => {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      await prisma.npc.update({ where: { id: ids[0]! }, data: { kind: 'PRINCIPAL' } });
      await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'test-cr49-jefe' } });
      try {
        const app = await buildApp();
        const res = await interactuarYCombatir(app, saveId, { tipo: 'NPC', targetSlug: 'test-cr49-jefe', targetName: 'Orco desconocido', quienInicia: 'jugador', combateForzado: true });
        expect(res.statusCode, res.body).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.actionText).toContain('test-cr49-jefe');
        expect(body.accionEnDiario).toBe('Me enfrento al orco desconocido y a los suyos.');
      } finally {
        await prisma.npc.update({ where: { id: ids[0]! }, data: { kind: 'PLANTILLA' } });
        await prisma.combatEncounter.deleteMany({ where: { saveId } });
        await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [] } });
      }
    });

    it('contra alguien ya muerto no se abre combate de grupo', async () => {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      await prisma.npcState.create({ data: { saveId, npcId: ids[0]!, scope: '', condicionFisica: 'MUERTO', muerto: true } });
      const app = await buildApp();
      const res = await interactuarYCombatir(app, saveId, { tipo: 'NPC', targetSlug: 'test-cr49-jefe', targetName: 'test-cr49-jefe', quienInicia: 'npc', combateForzado: true });
      expect(res.statusCode).toBe(400);
      expect(await prisma.combatEncounter.count({ where: { saveId, estado: 'EN_CURSO' } })).toBe(0);
    });
  });

  describe('AGRESIVO/ENEMIGO — combateForzado desde Interactuar (2026-09-20)', () => {
    let locationId: string;
    let npcId: string;

    beforeAll(async () => {
      const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
      const location = await prisma.location.create({
        data: {
          worldId: world.id,
          slug: 'test-dynamicmode-combate-forzado',
          name: 'Zona de Prueba Combate Forzado',
          region: 'Zona de Pruebas',
          kind: 'hito',
          description: 'x',
          aliases: ['zona de prueba combate forzado'],
        },
      });
      locationId = location.id;
      const npc = await prisma.npc.create({
        data: {
          worldId: world.id,
          kind: 'PLANTILLA',
          slug: 'test-dynamicmode-agresivo',
          name: 'Agresor de Prueba (dynamicMode)',
          aliases: ['agresor de prueba (dynamicmode)'],
          role: 'Bestia de prueba',
          level: 1,
          attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 4, carisma: 2, magia: 0 },
          bio: 'x',
          personality: 'x',
          homeLocationSlug: null,
          temperamento: 'AGRESIVO',
        },
      });
      npcId = npc.id;
      await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: locationId } });
    });

    afterAll(async () => {
      await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: null } });
      await prisma.npcState.deleteMany({ where: { saveId, npcId } });
      await prisma.npc.delete({ where: { id: npcId } });
      await prisma.location.delete({ where: { id: locationId } });
    });

    it('P27 — quienInicia: "npc": Interactuar NO abre el combate, saca la decisión; el combate solo empieza con Combatir', async () => {
      // La oferta real que deja /zona/mover — debe quedar resuelta al abrir el combate (2026-09-28:
      // antes se quedaba en BD y reaparecía tras recargar, bloqueando cualquier encuentro nuevo).
      await prisma.save.update({
        where: { id: saveId },
        data: { pendingCombatNpcSlugs: [], pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'test-dynamicmode-agresivo', targetName: 'Agresor de Prueba (dynamicMode)', quienInicia: 'npc', combateForzado: true } },
      });
      const app = await buildApp();
      const payload = { tipo: 'FAUNA', targetSlug: 'test-dynamicmode-agresivo', targetName: 'Agresor de Prueba (dynamicMode)', quienInicia: 'npc', combateForzado: true };
      const paso = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/interactuar`, payload });
      expect(paso.statusCode).toBe(200);
      const pasoBody = JSON.parse(paso.body);
      // Decisión, no combate: sin `combate`, la conversación sigue abierta con Combatir/Huir y te vieron antes.
      expect(pasoBody.combate).toBeUndefined();
      expect(pasoBody.cierra).toBe(false);
      expect(pasoBody.opciones).toEqual(['Combatir', 'Huir']);
      expect(pasoBody.narration).toContain('te ha visto antes');
      const trasInteractuar = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(trasInteractuar.pendingCombatNpcSlugs).toEqual([]);
      expect(trasInteractuar.pendingDynamicMode).toMatchObject({ combateForzado: true, emboscada: true, targetSlug: 'test-dynamicmode-agresivo' });

      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta: 'Combatir' } });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cierra).toBe(true);
      expect(body.combate).toMatchObject({ npcs: [{ slug: 'test-dynamicmode-agresivo', condicionFisica: 'ILESO' }] });

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicMode).toBeNull();
      expect(saveAfter.pendingDynamicModeOffer).toBeNull();
      expect(saveAfter.pendingCombatNpcSlugs).toEqual(['test-dynamicmode-agresivo']);
    });

    // P27/P166 (revisión 2026-10-26): la tarjeta antes del combate no cambia el coste de huir. Si el rival te vio
    // antes, Huir pide la misma tirada que `/combat/flee` (antes la emboscada abría el combate y solo quedaba esa
    // huida); con 1 en el d20 no escapas y empieza el combate como emboscada, con 20 escapas a la entrada.
    async function huirDeEmboscada(app: Awaited<ReturnType<typeof buildApp>>, d20: number) {
      await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [], zonaPosX: 40, zonaPosY: 60, zonaPosEntradaX: 12, zonaPosEntradaY: 88 } });
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'FAUNA', targetSlug: 'test-dynamicmode-agresivo', targetName: 'Agresor de Prueba (dynamicMode)', quienInicia: 'npc', combateForzado: true },
      });
      const azar = vi.spyOn(Math, 'random').mockReturnValue((d20 - 1) / 20);
      try {
        return await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta: 'Huir' } });
      } finally {
        azar.mockRestore();
      }
    }

    it('P27 — quienInicia: "npc": Huir tira dados; si falla, no escapa y empieza el combate como emboscada', async () => {
      const app = await buildApp();
      const res = await huirDeEmboscada(app, 1);
      expect(res.statusCode, res.body).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cierra).toBe(true);
      expect(body.combate).toMatchObject({ npcs: [{ slug: 'test-dynamicmode-agresivo' }] });
      expect(body.huidaLogEntry).toMatchObject({ roll: { attribute: 'destreza', roll: 1, success: false } });
      expect(body.huidaLogEntry.text).toContain('no le dejan escapar');
      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingCombatNpcSlugs).toEqual(['test-dynamicmode-agresivo']);
      expect(saveAfter.pendingDynamicMode).toBeNull();
      // Sigue donde estaba: no ha escapado a la entrada.
      expect({ x: saveAfter.zonaPosX, y: saveAfter.zonaPosY }).toEqual({ x: 40, y: 60 });
    });

    it('P27 — quienInicia: "npc": Huir con la tirada a favor escapa a la entrada sin combate, y la tirada queda en el diario', async () => {
      const app = await buildApp();
      const res = await huirDeEmboscada(app, 20);
      expect(res.statusCode, res.body).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cierra).toBe(true);
      expect(body.combate).toBeUndefined();
      expect(body.huidaLogEntry).toMatchObject({ roll: { attribute: 'destreza', roll: 20, success: true } });
      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingCombatNpcSlugs).toEqual([]);
      expect(saveAfter.pendingDynamicMode).toBeNull();
      expect({ x: saveAfter.zonaPosX, y: saveAfter.zonaPosY }).toEqual({ x: 12, y: 88 });
    });

    it('quienInicia: "jugador" — ofrece Combatir/Huir, sin narración LLM, pendingDynamicMode marcado combateForzado', async () => {
      // El mock de narrarVueltaModoDinamico es compartido por todo el archivo y nunca se limpia
      // entre tests — se compara el CONTEO antes/después en vez de "no se llamó nunca", para no
      // depender de qué otros tests corrieron antes de este.
      const llamadasAntes = narrarVueltaModoDinamico.mock.calls.length;
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'FAUNA', targetSlug: 'test-dynamicmode-agresivo', targetName: 'Agresor de Prueba (dynamicMode)', quienInicia: 'jugador', combateForzado: true },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cierra).toBe(false);
      expect(body.opciones).toEqual(['Combatir', 'Huir']);
      expect(body.combate).toBeUndefined();
      expect(narrarVueltaModoDinamico.mock.calls.length).toBe(llamadasAntes);

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicMode).toMatchObject({ combateForzado: true, targetSlug: 'test-dynamicmode-agresivo' });

      // Responder "Combatir" abre combate directo, mismo shape que el caso quienInicia:'npc'.
      const combatir = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Combatir' },
      });
      expect(combatir.statusCode).toBe(200);
      const combatirBody = JSON.parse(combatir.body);
      expect(combatirBody.cierra).toBe(true);
      expect(combatirBody.combate).toMatchObject({ npcs: [{ slug: 'test-dynamicmode-agresivo', condicionFisica: 'ILESO' }] });

      const saveTrasCombatir = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveTrasCombatir.pendingDynamicMode).toBeNull();
      expect(saveTrasCombatir.pendingCombatNpcSlugs).toEqual(['test-dynamicmode-agresivo']);
    });

    it('quienInicia: "jugador" — responder "Huir" cierra sin combate, gratis, deja LogEntry real', async () => {
      // Limpieza de estado que el test anterior ("Combatir") deja a propósito tras abrir combate
      // real — en el juego real se limpia al cerrar el combate (CombatPanel), pero este test no
      // llega a jugar ese combate, solo verificar que se abrió.
      await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [], zonaPosX: 40, zonaPosY: 60, zonaPosEntradaX: 12, zonaPosEntradaY: 88 } });
      const app = await buildApp();
      await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/interactuar`,
        payload: { tipo: 'FAUNA', targetSlug: 'test-dynamicmode-agresivo', targetName: 'Agresor de Prueba (dynamicMode)', quienInicia: 'jugador', combateForzado: true },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/saves/${saveId}/modo-dinamico/responder`,
        payload: { respuesta: 'Huir' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cierra).toBe(true);
      expect(body.combate).toBeUndefined();

      const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveAfter.pendingDynamicMode).toBeNull();
      expect(saveAfter.pendingCombatNpcSlugs).toEqual([]);
      // Reaparece en la entrada de la zona, no junto al agresor.
      expect({ x: saveAfter.zonaPosX, y: saveAfter.zonaPosY }).toEqual({ x: 12, y: 88 });

      const logEntry = await prisma.logEntry.findFirst({ where: { saveId }, orderBy: { createdAt: 'desc' } });
      expect(logEntry?.text).toContain('Agresor de Prueba (dynamicMode)');
      // P27: la vio ella primero: huir no tira dados.
      expect(logEntry?.roll).toBeNull();
      expect(body.huidaLogEntry).toMatchObject({ id: logEntry?.id });
      expect(body.huidaLogEntry.roll).toBeUndefined();
    });

    // P116: la huida de «te corta el paso» usa la misma regla que las de session.ts — la entrada
    // guardada fuera del radio seguro se cambia por la entrada más cercana, y la oferta forzada se
    // quita. La zona de prueba no tiene coordenadas: con un vecino, su única salida es la puerta de
    // abajo, (400,550), celda (8,11).
    it('quienInicia: "jugador" — "Huir" con la entrada fuera del radio seguro vuelve a la entrada más cercana y quita la oferta', async () => {
      const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
      const vecina = await prisma.location.create({ data: { worldId: world.id, slug: 'test-dynamicmode-huida-vecina', name: 'Vecina huida', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: [] } });
      const link = await prisma.locationLink.create({ data: { fromId: locationId, toId: vecina.id, minutosBase: 10, terreno: 'llano' } });
      try {
        const oferta = { tipo: 'FAUNA', targetSlug: 'test-dynamicmode-agresivo', targetName: 'Agresor de Prueba (dynamicMode)', quienInicia: 'jugador', combateForzado: true };
        await prisma.save.update({
          where: { id: saveId },
          data: { pendingCombatNpcSlugs: [], pendingDynamicModeOffer: oferta, zonaPosX: 40, zonaPosY: 60, zonaPosEntradaX: 400, zonaPosEntradaY: 300 }, // celda (8,6), a 5 de la puerta
        });
        const app = await buildApp();
        await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/interactuar`, payload: oferta });
        const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta: 'Huir' } });
        expect(res.statusCode).toBe(200);

        const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
        expect(saveAfter.pendingDynamicModeOffer).toBeNull();
        expect({ col: Math.floor(saveAfter.zonaPosX! / 50), row: Math.floor(saveAfter.zonaPosY! / 50) }).toEqual({ col: 8, row: 11 });
      } finally {
        await prisma.locationLink.delete({ where: { id: link.id } });
        await prisma.location.delete({ where: { id: vecina.id } });
      }
    });

    // Bug real jugando en vivo (2026-09-20, verificación en vivo tras implementar combateForzado:
    // "Ese encuentro ya no está disponible aquí" al pulsar Combatir) — el body de `/interactuar` y
    // `/responder` recibe el `targetName` que ya vio el frontend, que para un NPC de nombre propio
    // (`kind: 'PRINCIPAL'`) TODAVÍA NO descubierto (`DiscoveredEntity`) es el nombre OCULTO genérico
    // "Alguien" (`NOMBRE_OCULTO_GENERICO`, colisión de Zona) — nunca su nombre real. Usar ese nombre
    // oculto como `action` para el match de alias de `detectNpcsInScene` no podía coincidir nunca,
    // así que el NPC (aunque candidato plausible por ser PRINCIPAL) no pasaba el filtro de
    // "mencionado" y el combate directo fallaba con 400 pese a la colisión real ya confirmada.
    describe('NPC único (kind: PRINCIPAL) todavía no descubierto — nombre oculto no debe romper el combate directo', () => {
      let principalId: string;

      beforeAll(async () => {
        const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
        const principal = await prisma.npc.create({
          data: {
            worldId: world.id,
            kind: 'PRINCIPAL',
            slug: 'test-dynamicmode-principal-oculto',
            name: 'Verdadero Nombre de Prueba',
            aliases: ['verdadero nombre de prueba'],
            role: 'Jefe de prueba',
            level: 1,
            attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 4, carisma: 2, magia: 0 },
            bio: 'x',
            personality: 'x',
            homeLocationSlug: null,
            temperamento: 'AGRESIVO',
          },
        });
        principalId = principal.id;
      });

      afterAll(async () => {
        await prisma.npcState.deleteMany({ where: { saveId, npcId: principalId } });
        await prisma.discoveredEntity.deleteMany({ where: { saveId, entityType: 'npc', entitySlug: 'test-dynamicmode-principal-oculto' } });
        await prisma.npc.delete({ where: { id: principalId } });
      });

      it('quienInicia: "npc", targetName oculto ("Alguien") — igualmente abre combate real', async () => {
        const app = await buildApp();
        const res = await interactuarYCombatir(app, saveId, { tipo: 'NPC', targetSlug: 'test-dynamicmode-principal-oculto', targetName: 'Alguien', quienInicia: 'npc', combateForzado: true });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.cierra).toBe(true);
        // P327 (decidido por la usuaria 2026-10-26): mientras Gorhorn no conozca al PRINCIPAL, el combate lo
        // nombra como la tarjeta («Alguien», sin raza en esta fixture), nunca por su nombre real, y abrir el
        // combate no lo descubre (antes B9 lo identificaba al instante).
        expect(body.combate).toMatchObject({ npcs: [{ slug: 'test-dynamicmode-principal-oculto', name: 'Alguien', condicionFisica: 'ILESO' }] });
        expect(JSON.stringify(body)).not.toContain('Verdadero Nombre de Prueba');
        expect(await prisma.discoveredEntity.count({ where: { saveId, entityType: 'npc', entitySlug: 'test-dynamicmode-principal-oculto' } })).toBe(0);

        const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
        expect(saveAfter.pendingCombatNpcSlugs).toEqual(['test-dynamicmode-principal-oculto']);

        // Recargar la partida a mitad del combate tampoco lo identifica (GET /saves/:id).
        const detalleApp = Fastify();
        await detalleApp.register(detailRoutes);
        const detalle = await detalleApp.inject({ method: 'GET', url: `/saves/${saveId}` });
        expect(detalle.statusCode).toBe(200);
        expect(JSON.parse(detalle.body).combateIniciado.npcs[0].name).toBe('Alguien');
      });

      it('P327: una vez descubierto, el combate sí lo nombra por su nombre real', async () => {
        await prisma.discoveredEntity.create({ data: { saveId, entityType: 'npc', entitySlug: 'test-dynamicmode-principal-oculto', fase: 'DESCUBIERTO' } });
        const app = await buildApp();
        const res = await interactuarYCombatir(app, saveId, { tipo: 'NPC', targetSlug: 'test-dynamicmode-principal-oculto', targetName: 'Verdadero Nombre de Prueba', quienInicia: 'npc', combateForzado: true });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).combate).toMatchObject({ npcs: [{ name: 'Verdadero Nombre de Prueba' }] });
      });
    });
  });
});
