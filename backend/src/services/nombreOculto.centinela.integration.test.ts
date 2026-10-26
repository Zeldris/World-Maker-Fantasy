import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import * as ollama from '../lib/ollama.js';

/// QA-256 · centinela del nombre oculto (P327). Un PRINCIPAL que Gorhorn aún no ha descubierto no puede salir con su
/// nombre real, ni en lo que ve la jugadora (respuestas JSON de las rutas, diario) ni en lo que se manda al modelo
/// (clasificador, narrador, réplica del NPC, narrador de combate y de modo dinámico). Cuatro fugas pasaron la revisión
/// de cada tanda (`npcAbilityUsed`, la línea del diario del combate de grupo, `generateNpcReply` y el diario de la
/// emboscada); este test recorre los caminos con un PRINCIPAL de nombre inconfundible y falla si aparece.
///
/// Solo se mockea la frontera de Ollama (`lib/ollama.js`): toda la construcción de prompts (classifyAction,
/// narrateAction, generateNpcReply, narrarTurnoCombateMultiple, narrarVueltaModoDinamico) corre con el código real y
/// cada prompt enviado queda registrado. Un camino nuevo que nombre al PRINCIPAL oculto se añade aquí como un `it`.
const NOMBRE_REAL = 'Zarghul Ojonegro';
const PROHIBIDOS = [/zarghul/i, /ojonegro/i];
/// Slug único por pasada (`Location` y `Npc` tienen `@@unique([worldId, slug])`): una pasada cortada a medias no tumba
/// las siguientes. Los restos de pasadas anteriores se borran al empezar (`limpiarRestos`).
const PASADA = Date.now().toString(36);
const SLUG = `test-centinela-oculto-${PASADA}`;
const SLUG_ALIADO = `test-centinela-aliado-${PASADA}`;
const SLUG_OTRO = `test-centinela-otro-${PASADA}`;
const FACCION = 'Banda de Prueba Centinela';

const mock = vi.hoisted(() => ({
  llamadas: [] as { tarea: string; texto: string }[],
  clasificacion: { requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0 } as Record<string, unknown>,
}));

/// `vitest.bdReal.setup.ts` ya carga `lib/ollama.js` antes de este archivo, así que un `vi.mock` del módulo no llega a
/// los importadores en caché: se intercepta con `vi.spyOn` sobre el propio módulo (vite-node resuelve el export en
/// cada llamada, de modo que `narrador.ts`, `dynamicModeNarracion.ts`… pasan por el espía).
function responder(o: { tarea?: string; prompt: string; system?: string }) {
  const tarea = o.tarea ?? 'otra';
  mock.llamadas.push({ tarea, texto: `${o.system ?? ''}\n${o.prompt}` });
  const cuerpo: Record<string, unknown> =
    tarea === 'clasificar' ? mock.clasificacion
    : tarea === 'dialogo_npc' ? { reply: '«¿Qué quieres de mí, forastero?»' }
    : tarea === 'modo_dinamico' ? { narration: 'Se queda mirándote en silencio.', opciones: ['Acercarte', 'Ignorarlo y seguir tu camino'], cierra: false }
    : tarea === 'combate' ? { narration: 'Los golpes se cruzan sin que nadie ceda.' }
    : tarea === 'narrar' || tarea === 'narrar_respaldo' ? { narration: 'El aire se tensa entre los dos.', newFacts: [] }
    : {};
  return { text: JSON.stringify(cuerpo), raw: {} };
}

const { turnRoutes } = await import('../routes/turn.js');
const { sessionRoutes } = await import('../routes/saves/session.js');
const { dynamicModeRoutes } = await import('../routes/saves/dynamicMode.js');
const { detailRoutes } = await import('../routes/saves/detail.js');

const ATTRS = { fuerza: 15, destreza: 10, constitucion: 12, inteligencia: 8, voluntad: 8, carisma: 8, magia: 4 };
const ATAQUE = { requiereTirada: true, atributo: 'fuerza', dificultad: 12, razon: 'ataque', banda: 'instantanea', duracionEstimadaMinutos: 0 };
const CHARLA = { requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0 };

async function buildApp() {
  const app = Fastify();
  await app.register(turnRoutes);
  await app.register(sessionRoutes);
  await app.register(dynamicModeRoutes);
  await app.register(detailRoutes);
  return app;
}
type App = Awaited<ReturnType<typeof buildApp>>;

/// Lo que ve la jugadora: todas las respuestas de las rutas del recorrido, en texto.
let vistas: string[] = [];

/// Qué se ha mandado a los modelos (por tarea) desde una marca.
const marca = () => mock.llamadas.length;
const promptsDesde = (desde: number, tarea?: string) => mock.llamadas.slice(desde).filter((l) => !tarea || l.tarea === tarea);

/// Falla si el nombre real (entero o de pila) sale en algo que ve la jugadora o en un prompt del modelo.
function sinFugas(desde: number, vistoPorLaJugadora: string[] = vistas) {
  const fragmento = (texto: string, re: RegExp) => {
    const i = texto.search(re);
    return i < 0 ? '' : `…${texto.slice(Math.max(0, i - 160), i + 120)}…`;
  };
  for (const re of PROHIBIDOS) {
    for (const texto of vistoPorLaJugadora) expect(fragmento(texto, re), `VISTO POR LA JUGADORA: ${re}`).toBe('');
    for (const l of promptsDesde(desde)) expect(fragmento(l.texto, re), `PROMPT AL MODELO (${l.tarea}): ${re}`).toBe('');
  }
}

/// Restos de una pasada cortada: partidas, puntos, zonas y NPC de pruebas anteriores (por prefijo, no por slug exacto).
async function limpiarRestos(worldId: string) {
  const zonas = await prisma.location.findMany({ where: { worldId, slug: { startsWith: 'test-centinela' } }, select: { id: true } });
  const ids = zonas.map((z) => z.id);
  await prisma.save.deleteMany({ where: { OR: [{ characterName: { startsWith: 'Gorhorn centinela' } }, { currentLocationId: { in: ids } }] } });
  await prisma.zonePoint.deleteMany({ where: { locationId: { in: ids } } });
  await prisma.location.deleteMany({ where: { id: { in: ids } } });
  await prisma.npc.deleteMany({ where: { worldId, slug: { startsWith: 'test-centinela' } } });
}

describe('QA-256 — centinela: el nombre de un PRINCIPAL sin descubrir no sale ni a la jugadora ni al modelo', () => {
  const guardas: { saves: string[]; npcs: string[]; locations: string[] } = { saves: [], npcs: [], locations: [] };
  let worldId: string;
  let aliadoConPunto = false;

  beforeAll(async () => {
    // Dados al máximo, como en turn.integration.test.ts: el combate resuelve siempre igual.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.spyOn(ollama, 'ollamaGenerate').mockImplementation(async (o) => responder(o));
    vi.spyOn(ollama, 'ollamaGenerateStream').mockImplementation(async (o) => responder(o));
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    await limpiarRestos(worldId);
    // El PRINCIPAL de prueba es una copia del Orco enfurecido (mismas habilidades, para que haya `npcAbilityUsed`)
    // con otro nombre, alias y una bio/personalidad que lo nombran, como las de catálogo.
    const base = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'orco-enfurecido-hondonada' } });
    const { id: _id, ...resto } = base;
    const copia = Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== null));
    const zarghul = await prisma.npc.create({
      data: {
        ...(copia as object),
        worldId, kind: 'PRINCIPAL', slug: SLUG, name: NOMBRE_REAL, aliases: ['zarghul ojonegro', 'zarghul'], articulo: null, genero: 'M', raza: 'orcos', faction: FACCION,
        // `interactionTypes` no vacío: con él el diálogo ofrece el menú de interacción (`npcInteractionOffer`), camino por
        // el que se coló el nombre real en la oferta.
        interactionTypes: ['NPC_LORE'],
        bio: `${NOMBRE_REAL} guarda el paso. Zarghul no habla con extraños.`, personality: `Zarghul es suspicaz. ${NOMBRE_REAL} cuenta cada paso.`,
      } as never,
    });
    const aliado = await prisma.npc.create({
      data: {
        ...(copia as object),
        worldId, kind: 'PLANTILLA', slug: SLUG_ALIADO, name: 'Orco de la banda', aliases: ['orco de la banda'], articulo: 'el', genero: 'M', raza: 'orcos', faction: FACCION,
        bio: 'Un orco de la banda.', personality: 'Callado.',
      } as never,
    });
    // Otro NPC (nombre propio, ya conocido) que puede estar delante del oculto en la escena.
    const otro = await prisma.npc.create({
      data: {
        ...(copia as object),
        worldId, kind: 'PLANTILLA', slug: SLUG_OTRO, name: 'Vigilante de Prueba', aliases: ['vigilante de prueba'], articulo: 'el', genero: 'M', raza: 'orcos', faction: FACCION,
        bio: 'Un vigilante.', personality: 'Callado.',
      } as never,
    });
    guardas.npcs.push(zarghul.id, aliado.id, otro.id);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    for (const id of guardas.saves) await prisma.save.delete({ where: { id } }).catch(() => undefined);
    for (const id of guardas.locations) {
      await prisma.zonePoint.deleteMany({ where: { locationId: id } });
      await prisma.location.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.npc.deleteMany({ where: { id: { in: guardas.npcs } } });
  });

  /// Una partida con Zarghul (sin descubrir) en una zona propia; con `conBanda`, un aliado de su facción cerca.
  async function partida(nombre: string, opciones: { conBanda?: boolean; conOtro?: boolean } = {}): Promise<{ saveId: string; locationId: string }> {
    const location = await prisma.location.create({
      data: { worldId, slug: `test-centinela-${PASADA}-${guardas.locations.length}`, name: 'Zona de Prueba Centinela', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: [`zona de prueba centinela ${guardas.locations.length}`] },
    });
    guardas.locations.push(location.id);
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x',
        attributes: ATTRS, portraitInitial: 'G', currentLocationId: location.id,
      },
    });
    guardas.saves.push(save.id);
    await prisma.worldState.create({ data: { saveId: save.id, fictionalMinutes: 480 } });
    await prisma.zonePoint.create({ data: { saveId: save.id, locationId: location.id, tipo: 'NPC', targetSlug: SLUG, x: 400, y: 300 } });
    if (opciones.conBanda) {
      await prisma.zonePoint.create({ data: { saveId: save.id, locationId: location.id, tipo: 'NPC', targetSlug: SLUG_ALIADO, x: 450, y: 300 } });
      aliadoConPunto = true;
    }
    if (opciones.conOtro) await prisma.zonePoint.create({ data: { saveId: save.id, locationId: location.id, tipo: 'NPC', targetSlug: SLUG_OTRO, x: 350, y: 300 } });
    expect(await prisma.discoveredEntity.count({ where: { saveId: save.id, entityType: 'npc', entitySlug: SLUG } })).toBe(0);
    return { saveId: save.id, locationId: location.id };
  }

  async function clasificar(app: App, saveId: string, action: string, enCombate = false) {
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate } });
    expect(res.statusCode, res.body).toBe(200);
    // `npcsInScene` es la caché que el cliente devuelve tal cual a /turn/narrate (ficha completa de los NPC en escena,
    // con `nombreVisible` al lado del nombre real); no se muestra. Lo demás de la respuesta sí.
    const { npcsInScene: _cache, ...paraLaJugadora } = res.json() as Record<string, unknown>;
    vistas.push(JSON.stringify(paraLaJugadora));
    return res.json() as { classification: unknown; roll: unknown; blocked?: { narration: string } };
  }

  /// Turno completo (clasificar + narrar); devuelve la última línea del NDJSON (`done`).
  async function turno(app: App, saveId: string, action: string, enCombate = false): Promise<Record<string, unknown>> {
    const c = await clasificar(app, saveId, action, enCombate);
    if (c.blocked) return c as unknown as Record<string, unknown>;
    const res = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification: c.classification, roll: c.roll, enCombate } });
    vistas.push(res.payload);
    expect(res.statusCode, res.payload).toBe(200);
    const lineas = res.payload.trim().split('\n');
    return JSON.parse(lineas[lineas.length - 1]!);
  }

  /// `GET /saves/:id`: ficha de la partida, diario (últimas 24 h) y combate en curso.
  async function detalle(app: App, saveId: string): Promise<Record<string, any>> {
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    vistas.push(res.body);
    expect(res.statusCode, res.body).toBe(200);
    return JSON.parse(res.body);
  }

  async function diario(saveId: string) {
    const entradas = await prisma.logEntry.findMany({ where: { saveId }, select: { text: true } });
    vistas.push(...entradas.map((e) => e.text));
    return entradas.map((e) => e.text);
  }

  function nueva() {
    vistas = [];
    mock.clasificacion = { ...CHARLA };
    return { desde: marca() };
  }

  it('el comprobador detecta el nombre real y el de pila (sin esto el resto no prueba nada)', () => {
    expect(() => sinFugas(0, [`Habla ${NOMBRE_REAL}.`])).toThrow();
    expect(() => sinFugas(0, ['El orco Zarghul asiente.'])).toThrow();
    expect(() => sinFugas(marca(), ['El orco desconocido asiente.'])).not.toThrow();
  });

  it('saludo y réplica: ni la respuesta, ni el diario, ni el clasificador, el narrador o la réplica del NPC lo nombran', async () => {
    const { desde } = nueva();
    const { saveId } = await partida('Gorhorn centinela saludo');
    const app = await buildApp();
    const hecho = await turno(app, saveId, 'Saludo al orco desconocido.');
    expect(hecho.type).toBe('done');
    // Prueba de que el camino se ha recorrido: hubo clasificación, narración y la réplica dedicada del NPC.
    expect(promptsDesde(desde, 'clasificar').length).toBeGreaterThan(0);
    expect(promptsDesde(desde, 'narrar').length).toBeGreaterThan(0);
    const replicas = promptsDesde(desde, 'dialogo_npc');
    expect(replicas.length).toBeGreaterThan(0);
    expect(replicas[0]!.texto).toContain('PERSONAJE QUE ERES: Orco desconocido');
    await diario(saveId);
    await detalle(app, saveId);
    sinFugas(desde);
    await app.close();
  }, 60_000);

  it('oferta de interacción: `npcInteractionOffer` (respuesta de /turn/narrate) y `pendingNpcInteractionOffer` (GET /saves/:id) llevan el nombre visible', async () => {
    const { desde } = nueva();
    const { saveId } = await partida('Gorhorn centinela oferta');
    const app = await buildApp();
    const hecho = await turno(app, saveId, 'Saludo al orco desconocido.');
    expect((hecho.npcInteractionOffer as { npcName?: string } | null | undefined)?.npcName, 'oferta de /turn/narrate').toBe('Orco desconocido');
    const ficha = await detalle(app, saveId);
    expect(ficha.pendingNpcInteractionOffer?.npcName, 'oferta pendiente de GET /saves/:id').toBe('Orco desconocido');
    sinFugas(desde);
    await app.close();
  }, 60_000);

  it('ataque citando el nombre visible entre comillas, con otro NPC delante: se tabula contra el oculto, no contra el primero de la escena', async () => {
    const { saveId } = await partida('Gorhorn centinela comillas', { conOtro: true });
    const app = await buildApp();
    mock.clasificacion = { ...ATAQUE };
    // En combate con el Vigilante: sin el nombre citado, el objetivo sería él (`ongoingCombatTarget`).
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [SLUG_OTRO] } });
    const c = await clasificar(app, saveId, "Ataco a 'Orco desconocido'.", true);
    const razon = (c.classification as { razon?: string }).razon ?? '';
    expect(razon).toMatch(/contra el orco desconocido —/);
    expect(razon).not.toMatch(/Vigilante/i);
    await app.close();
  }, 30_000);

  it('regalo: «le doy … al orco desconocido» no tira, no nombra al orco y no lo descubre', async () => {
    const { desde } = nueva();
    const { saveId } = await partida('Gorhorn centinela regalo');
    await prisma.inventoryItem.create({ data: { saveId, name: 'Cuchillo de pedernal', description: 'x', origin: 'inicial' } });
    const app = await buildApp();
    const c = await clasificar(app, saveId, 'Le doy mi cuchillo de pedernal al orco desconocido.');
    expect(c.blocked?.narration).toMatch(/orco desconocido/i);
    await diario(saveId);
    await detalle(app, saveId);
    sinFugas(desde);
    expect(await prisma.discoveredEntity.count({ where: { saveId, entityType: 'npc', entitySlug: SLUG } })).toBe(0);
    await app.close();
  }, 30_000);

  it('ataque y combate 1v1: la insignia de habilidad (`npcAbilityUsed`), GET /saves/:id y los prompts no lo nombran', async () => {
    const { desde } = nueva();
    const { saveId } = await partida('Gorhorn centinela combate');
    const app = await buildApp();
    mock.clasificacion = { ...ATAQUE };
    await turno(app, saveId, 'Ataco al orco desconocido con el hacha.');
    let insignia: string | undefined;
    for (let i = 0; i < 4 && !insignia; i++) {
      const hecho = await turno(app, saveId, 'Ataco al orco desconocido con el hacha.', true);
      insignia = (hecho.npcAbilityUsed as { npcName?: string } | null | undefined)?.npcName;
    }
    // Sin la insignia el test no estaría mirando `npcAbilityUsed`.
    expect(insignia).toBe('Orco desconocido');
    const ficha = await detalle(app, saveId);
    expect(ficha.combateIniciado?.npcs?.[0]?.name).toBe('Orco desconocido');
    await diario(saveId);
    sinFugas(desde);
    expect(await prisma.discoveredEntity.count({ where: { saveId, entityType: 'npc', entitySlug: SLUG } })).toBe(0);
    await app.close();
  }, 60_000);

  it('combate de grupo y emboscada (modo dinámico): diario, respuesta de la ruta, GET /saves/:id, turno de combate y prompts', async () => {
    const { desde } = nueva();
    const { saveId } = await partida('Gorhorn centinela grupo', { conBanda: true });
    expect(aliadoConPunto).toBe(true);
    const app = await buildApp();
    for (const quienInicia of ['jugador', 'npc'] as const) {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [], pendingDynamicModeOffer: undefined } });
      const paso = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/interactuar`, payload: { tipo: 'NPC', targetSlug: SLUG, targetName: 'Orco desconocido', quienInicia, combateForzado: true } });
      expect(paso.statusCode, paso.body).toBe(200);
      vistas.push(paso.body);
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/modo-dinamico/responder`, payload: { respuesta: 'Combatir' } });
      expect(res.statusCode, res.body).toBe(200);
      const cuerpo = JSON.parse(res.body) as Record<string, unknown>;
      // `actionText` es la acción que el turno casa por nombre (lleva el real a propósito, ver dynamicMode.ts
      // `abrirCombateForzado`); no se muestra: lo que sí se muestra es `accionEnDiario`, el resto y el diario.
      const { actionText, ...visible } = cuerpo;
      expect(typeof actionText).toBe('string');
      vistas.push(JSON.stringify(visible));
      if (quienInicia === 'jugador') expect(cuerpo.accionEnDiario).toBe('Me enfrento al orco desconocido y a los suyos.');
      const lineas = await diario(saveId);
      // Dentro de la frase el nombre oculto lleva artículo («el orco desconocido»), no como nombre propio.
      const apertura = lineas.find((t) => t.startsWith('Comienza el combate'));
      expect(apertura, 'línea de apertura del combate de grupo').toMatch(/contra un grupo \(el orco desconocido, /);
      const ficha = await detalle(app, saveId);
      expect(ficha.combateIniciado, 'el combate de grupo debería estar en curso').toBeTruthy();
    }
    // Un turno de la jugadora dentro del combate de grupo (narrador de combate múltiple).
    mock.clasificacion = { ...ATAQUE };
    await turno(app, saveId, 'Ataco al orco desconocido con el hacha.', true);
    await diario(saveId);
    await detalle(app, saveId);
    expect(promptsDesde(desde, 'combate').length, 'el narrador del combate de grupo debería haberse llamado').toBeGreaterThan(0);
    sinFugas(desde);
    expect(await prisma.discoveredEntity.count({ where: { saveId, entityType: 'npc', entitySlug: SLUG } })).toBe(0);
    await app.close();
  }, 90_000);

  it('al contrario: una vez descubierto, su nombre real sí sale (el centinela no prohíbe el nombre siempre)', async () => {
    const { desde } = nueva();
    const { saveId } = await partida('Gorhorn centinela conocido');
    await prisma.discoveredEntity.create({ data: { saveId, entityType: 'npc', entitySlug: SLUG, fase: 'DESCUBIERTO' } });
    const app = await buildApp();
    mock.clasificacion = { ...CHARLA };
    await turno(app, saveId, `Saludo a ${NOMBRE_REAL}.`);
    expect(promptsDesde(desde, 'dialogo_npc')[0]?.texto ?? '').toContain(`PERSONAJE QUE ERES: ${NOMBRE_REAL}`);
    await app.close();
  }, 60_000);
});
