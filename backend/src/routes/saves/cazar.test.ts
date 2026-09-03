import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

/// Caza (revisión de partida 2026-08-08) — cobertura nueva. El foco: (1) la caza limpia sin
/// combate solo se ofrece con UNA presa débil de verdad (nivel ≤ jugador − 2), nunca con varias;
/// (2) el caso "toca pelear" (varias presas, o una sola no lo bastante débil, o la tirada de caza
/// limpia falla) NO debe tocar la base de datos — solo devuelve el texto de acción para que el
/// FRONTEND lo mande por el turno normal (narración real abre el combate, no esta ruta).
const findUniqueSave = vi.fn();
const findManyWorldPopulation = vi.fn();
const findManyNpc = vi.fn();
const findUniqueNpc = vi.fn();
const upsertNpcState = vi.fn();
// Caza en grupo (2026-08-13) — upsert DIRECTO (fuera de $transaction) que hace cazar.ts para
// pre-crear el NpcState del grupo ANTES de devolver el actionText — distinto del `upsertNpcState`
// de arriba, que solo vive DENTRO del mock de `$transaction` (caza limpia sin combate).
const upsertNpcStateDirect = vi.fn();
const updateManyWorldPopulation = vi.fn();
// Cooldown de dispersión (2026-09-02) — `tx.worldPopulation.update` (no `updateMany`, distinto del
// mock de arriba) cuando `rollGroupEngagement` da 0 de verdad para una especie.
const updateWorldPopulation = vi.fn();
// P3.6 (checklist consolidado 2026-08-27) — "Cazar" limpio ahora avanza el reloj de ficción
// (mismo patrón que Minar/Talar), nuevo `tx.worldState.update` dentro de la transacción.
const updateWorldState = vi.fn();
const createLogEntry = vi.fn();
const updateSave = vi.fn();
const transaction = vi.fn();
const loadSessionFacts = vi.fn();
const appendSessionFacts = vi.fn();
// Caza en grupo — Grupo 3 § Mundo determinista, Capa 4 (2026-08-25): iniciarCombatEncounter ya
// no escribe NpcState.groupSize directo, crea un CombatEncounter/CombatParticipant real dentro de
// la misma $transaction que antes solo usaba la caza limpia sin combate.
const createCombatEncounter = vi.fn();
const createCombatParticipant = vi.fn();
const updateCombatParticipant = vi.fn();
const updateCombatEncounter = vi.fn();
// Bug real jugando en vivo (2026-08-25): guard nuevo contra reintentar "cazar" mientras ya hay un
// CombatEncounter EN_CURSO de verdad (antes solo miraba `pendingCombatNpcSlugs`, que puede quedar
// desactualizado si el turno que lo abrió reventó antes de llegar a actualizarlo) — ver comentario
// completo en cazar.ts. Por defecto sin ninguno activo (null), cada test que sí lo necesite lo
// sobrescribe.
const findFirstCombatEncounter = vi.fn();
// Sub-partición >4v4 (checklist 2026-09-01) — con Múrgol (8 avistados), el bando ENEMIGO se parte
// en fragmentos y los sobrantes se resuelven de una sentada fuera de la transacción
// (`resolverTurnosAutonomosHastaJugadora`, sobre el `prisma` REAL, no el `tx` mockeado de arriba).
// Sin ningún JUGADOR en esos fragmentos, `avanzarYComprobarFin` los cierra RESUELTO en la primera
// vuelta (bando contrario vacío) — solo hacen falta los métodos que se leen ANTES de comprobar eso.
const findUniqueOrThrowCombatEncounter = vi.fn();
const findManyCombatParticipant = vi.fn();
const updateCombatParticipantReal = vi.fn();
const updateCombatEncounterReal = vi.fn();
const findFirstNpcReal = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    worldPopulation: { findMany: (...args: unknown[]) => findManyWorldPopulation(...args) },
    npc: {
      findMany: (...args: unknown[]) => findManyNpc(...args),
      findUnique: (...args: unknown[]) => findUniqueNpc(...args),
      findFirst: (...args: unknown[]) => findFirstNpcReal(...args),
    },
    npcState: { upsert: (...args: unknown[]) => upsertNpcStateDirect(...args), findUnique: vi.fn().mockResolvedValue(null) },
    combatEncounter: {
      findFirst: (...args: unknown[]) => findFirstCombatEncounter(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowCombatEncounter(...args),
      update: (...args: unknown[]) => updateCombatEncounterReal(...args),
    },
    combatParticipant: {
      findMany: (...args: unknown[]) => findManyCombatParticipant(...args),
      update: (...args: unknown[]) => updateCombatParticipantReal(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('../../services/worldFacts.js', () => ({
  loadSessionFacts: (...args: unknown[]) => loadSessionFacts(...args),
  appendSessionFacts: (...args: unknown[]) => appendSessionFacts(...args),
}));

const { cazarRoutes, avistadosFor, rollSightings, rollGroupEngagement, groupVarianceClause, dispersionCooldownActivo } = await import('./cazar.js');

async function buildApp() {
  const app = Fastify();
  await app.register(cazarRoutes);
  return app;
}

const SAVE_BASE = {
  id: 'save1',
  worldId: 'world1',
  characterName: 'Gorhorn',
  level: 3,
  attributes: { fuerza: 10, destreza: 12, constitucion: 10, inteligencia: 8 },
  pendingCombatNpcSlugs: [] as string[],
  currentLocation: { id: 'loc1', region: 'Las Llanuras del Viento Rojo' },
  worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
};

const MURGOL_POP = {
  targetType: 'FAUNA',
  targetSlug: 'murgol',
  poblacion: 50,
  distribucion: { 'Llanuras del Viento Rojo': 1 },
};
const MURGOL_NPC = { id: 'npc-murgol', slug: 'murgol', name: 'Múrgol', level: 1, capturablePct: 80, kind: 'PLANTILLA', attributes: { destreza: 6, inteligencia: 2 } };

const CRUZAVIENTOS_POP = {
  targetType: 'FAUNA',
  targetSlug: 'cruzavientos',
  poblacion: 20,
  distribucion: { 'Llanuras del Viento Rojo': 1 },
};
const CRUZAVIENTOS_NPC = { id: 'npc-cruzavientos', slug: 'cruzavientos', name: 'Cruzavientos', level: 5, capturablePct: 10, kind: 'PLANTILLA', attributes: { destreza: 14, inteligencia: 4 } };

describe('avistadosFor', () => {
  it('una especie común (capturablePct alto) muestra más avistados que una rara', () => {
    expect(avistadosFor(80, 500)).toBe(8);
    expect(avistadosFor(10, 500)).toBe(1);
  });

  it('nunca supera la población real restante, aunque capturablePct sea alto', () => {
    expect(avistadosFor(80, 3)).toBe(3);
  });

  it('nunca baja de 1 si hay población real (candidato ya filtrado por poblacion > 0)', () => {
    expect(avistadosFor(1, 500)).toBe(1);
  });
});

describe('rollSightings', () => {
  const A = { slug: 'a', name: 'A', level: 1, debil: true, poblacion: 10, capturablePct: 50 };
  const B = { slug: 'b', name: 'B', level: 1, debil: true, poblacion: 90, capturablePct: 50 };

  it('con la tirada de fallo superada, elige ponderando por población real', () => {
    // random=0.5 > 0.35 (no falla) — roll=0.5*100=50, resta A(10)→40, resta B(90)→-50<0 → B.
    const result = rollSightings([A, B], () => 0.5);
    expect(result.map((c) => c.slug)).toEqual(['b']);
  });

  it('con la tirada de fallo por debajo del umbral en los 3 intentos, no encuentra nada', () => {
    const result = rollSightings([A, B], () => 0.1);
    expect(result).toEqual([]);
  });
});

// Caza en grupo (2026-08-13, petición explícita: "el jugador primero debe marcar contra cuantos
// quiere combatir... con un calculo determinista puede darse que salgan menos o más de los que
// marcaste").
describe('rollGroupEngagement', () => {
  it('roll 1-2 (r bajo): uno menos que lo elegido', () => {
    expect(rollGroupEngagement(3, 10, () => 0)).toBe(2); // floor(0*6)+1=1 -> delta -1
  });

  it('roll 3-4 (r medio): exactamente lo elegido', () => {
    expect(rollGroupEngagement(3, 10, () => 0.4)).toBe(3); // floor(0.4*6)+1=3 -> delta 0
  });

  it('roll 5-6 (r alto): uno más que lo elegido', () => {
    expect(rollGroupEngagement(3, 10, () => 0.99)).toBe(4); // floor(0.99*6)+1=6 -> delta +1
  });

  // Cambiado (2026-09-02, "que narre un intento fallido"): con cantidadElegida=1 y el peor roll,
  // ahora SÍ puede dar 0 — fallo total, el grupo entero se dispersa. El tope condicionado a fauna
  // AGRESIVO/nivel del jugador vive en el CALLER (cazar.ts), no en esta función pura.
  it('con cantidadElegida=1 y el peor roll, puede dar 0 (fallo total)', () => {
    expect(rollGroupEngagement(1, 10, () => 0)).toBe(0);
  });

  it('nunca baja de 0 (el suelo real, no 1)', () => {
    expect(rollGroupEngagement(0, 10, () => 0)).toBe(0);
  });

  it('nunca supera los avistados reales aunque el roll sume', () => {
    expect(rollGroupEngagement(5, 5, () => 0.99)).toBe(5);
  });
});

describe('groupVarianceClause', () => {
  it('igual a lo elegido: sin cláusula (null)', () => {
    expect(groupVarianceClause(2, 2)).toBeNull();
  });

  it('sale MÁS de lo marcado: intrusión sorpresa', () => {
    expect(groupVarianceClause(1, 2)).toBe('aunque al acercarme, otro más se suma de repente, sin previo aviso');
    expect(groupVarianceClause(1, 3)).toBe('aunque al acercarme, 2 más se suman de repente, sin previo aviso');
  });

  it('sale MENOS de lo marcado: solo se consigue acorralar a algunos', () => {
    expect(groupVarianceClause(2, 1)).toBe('aunque al final solo consigo acorralar a uno de los que había marcado');
    expect(groupVarianceClause(4, 2)).toBe('aunque al final solo consigo acorralar a 2 de los que había marcado');
  });

  // Fallo total (2026-09-02, "que narre un intento fallido") — caso propio, distinto de "menos de
  // los marcados": no queda ni uno.
  it('fallo total (cantidadReal 0): el grupo entero se dispersa', () => {
    expect(groupVarianceClause(3, 0)).toBe('aunque al final el grupo entero se dispersa antes de que pueda acorralar a ninguno');
  });
});

describe('GET /saves/:id/cazar', () => {
  beforeEach(() => {
    findUniqueSave.mockReset().mockResolvedValue(SAVE_BASE);
    findManyWorldPopulation.mockReset().mockResolvedValue([MURGOL_POP, CRUZAVIENTOS_POP]);
    findManyNpc.mockReset().mockResolvedValue([MURGOL_NPC, CRUZAVIENTOS_NPC]);
    loadSessionFacts.mockReset().mockResolvedValue([]);
  });

  // Revisión de partida 2026-08-08 ("podría cazar cualquier presa en cualquier zona... que no sea
  // el listado completo"): ya no se devuelve toda la fauna con población real de la región sin más
  // — hace falta haberla "localizado" antes (mismo patrón que Minar/Talar).
  it('sin nada localizado en los hechos de sesión, no devuelve la lista completa — ofrece Explorar', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/cazar' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ candidates: [], puedeExplorar: true });
  });

  it('con fauna ya localizada en los hechos de sesión, la devuelve con avistados calculados (nunca la población mundial real)', async () => {
    loadSessionFacts.mockResolvedValue(['Gorhorn detecta señales de fauna cerca: 5 Múrgol.']);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/cazar' });
    const { candidates, puedeExplorar } = res.json();
    expect(puedeExplorar).toBe(false);
    expect(candidates).toEqual([
      { slug: 'murgol', name: 'Múrgol', level: 1, debil: true, avistados: avistadosFor(80, 50), dificultad: 12, dificultadLabel: 'Fácil (12)' },
    ]);
  });

  it('no ofrece nada ni "Explorar" si la región no tiene distribución real (bug de artículo ya cubierto en population.ts)', async () => {
    findManyWorldPopulation.mockResolvedValue([{ ...MURGOL_POP, distribucion: { 'Ciénaga Troncal': 1 } }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/cazar' });
    expect(res.json()).toEqual({ candidates: [], puedeExplorar: false });
  });

  // Filtro por hábitat de zona (petición explícita, 2026-08-14: "con la de peleteria en caza pues
  // dependiendo del habita de cada fauna") — Las Agujas Imán está catalogada árido/rocoso
  // (worldCatalog.ts § locationTerrainTags): Cruzavientos (rocoso, anida en Los Pilares Rotos)
  // encaja, Múrgol (vegetación, pasta en los Pastos de la Deriva) no.
  it('en una zona árida/rocosa catalogada, la fauna de hábitat vegetación queda fuera aunque esté localizada', async () => {
    findUniqueSave.mockResolvedValue({ ...SAVE_BASE, currentLocation: { id: 'loc-agujas', region: 'Las Llanuras del Viento Rojo', slug: 'agujas-iman' } });
    loadSessionFacts.mockResolvedValue(['Gorhorn detecta señales de fauna cerca: 5 Múrgol. Gorhorn detecta señales de fauna cerca: 2 Cruzavientos.']);
    // El mock de `npc.findMany` no simula el `where: { slug: { in: [...] } }` real de Prisma — se
    // deja solo el NPC que de verdad pasaría el filtro de terreno, para que el test no dependa de
    // una fidelidad de mock que no existe (mismo motivo que el resto de mocks de este archivo).
    findManyNpc.mockResolvedValue([CRUZAVIENTOS_NPC]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/cazar' });
    const { candidates } = res.json();
    expect(candidates.map((c: { slug: string }) => c.slug)).toEqual(['cruzavientos']);
  });
});

describe('POST /saves/:id/cazar/explorar', () => {
  beforeEach(() => {
    findUniqueSave.mockReset().mockResolvedValue(SAVE_BASE);
    findManyWorldPopulation.mockReset().mockResolvedValue([MURGOL_POP, CRUZAVIENTOS_POP]);
    findManyNpc.mockReset().mockResolvedValue([MURGOL_NPC, CRUZAVIENTOS_NPC]);
    loadSessionFacts.mockReset().mockResolvedValue([]);
    appendSessionFacts.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('nada que explorar si la región no tiene fauna real — vacioReal:true (bug real, 2026-09-03: antes indistinguible del caso "solo falló la tirada")', async () => {
    findManyWorldPopulation.mockResolvedValue([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/explorar' });
    expect(res.json()).toEqual({ candidates: [], vacioReal: true });
    expect(appendSessionFacts).not.toHaveBeenCalled();
  });

  it('tirada con éxito: encuentra fauna real, la registra como hecho de sesión', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no falla; pondera hacia Múrgol (más población)
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/explorar' });
    const { candidates } = res.json();
    expect(candidates).toEqual([
      { slug: 'murgol', name: 'Múrgol', level: 1, debil: true, avistados: avistadosFor(80, 50), dificultad: 12, dificultadLabel: 'Fácil (12)' },
    ]);
    expect(appendSessionFacts).toHaveBeenCalledWith('save1', [], [expect.stringContaining('Múrgol')]);
  });

  it('las 3 tiradas fallan: no encuentra nada, no registra ningún hecho de sesión (como buscar un recurso y no dar con nada) — vacioReal:false, sí hay fauna real (bug real, 2026-09-03)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // por debajo del umbral de fallo (0.35) siempre
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/explorar' });
    expect(res.json()).toEqual({ candidates: [], vacioReal: false });
    expect(appendSessionFacts).not.toHaveBeenCalled();
  });
});

describe('POST /saves/:id/cazar/confirmar', () => {
  beforeEach(() => {
    findUniqueSave.mockReset().mockResolvedValue(SAVE_BASE);
    findManyWorldPopulation.mockReset().mockResolvedValue([MURGOL_POP, CRUZAVIENTOS_POP]);
    findManyNpc.mockReset().mockResolvedValue([MURGOL_NPC, CRUZAVIENTOS_NPC]);
    findUniqueNpc.mockReset().mockResolvedValue(MURGOL_NPC);
    findFirstCombatEncounter.mockReset().mockResolvedValue(null);
    upsertNpcState.mockReset();
    upsertNpcStateDirect.mockReset();
    updateManyWorldPopulation.mockReset();
    updateWorldPopulation.mockReset().mockResolvedValue({});
    updateWorldState.mockReset();
    createLogEntry.mockReset().mockResolvedValue({ id: 'log1', createdAt: new Date('2026-08-08T12:00:00Z') });
    updateSave.mockReset();
    loadSessionFacts.mockReset().mockResolvedValue([]);
    appendSessionFacts.mockReset().mockResolvedValue(undefined);
    // Sub-partición >4v4 (checklist 2026-09-01): almacén en memoria compartido entre el `tx`
    // mockeado (crea encuentros/participantes DENTRO de la transacción) y el `prisma` real
    // mockeado (`resolverTurnosAutonomosHastaJugadora`, que corre DESPUÉS, fuera de la
    // transacción, sobre los fragmentos NO jugables) — sin esto, el segundo lado no vería nada de
    // lo que creó el primero. Solo hace falta ser coherente para el caso real de este archivo: un
    // fragmento autónomo sin JUGADOR se cierra RESUELTO en la primera vuelta (`bandoSigueEnCombate`
    // con bando JUGADOR vacío → false), así que ni `combatParticipant.update` ni un segundo
    // `combatEncounter.update` (avanzar turno/ronda) llegan a dispararse nunca en estos tests.
    let combatEncounterCounter = 0;
    let combatParticipantCounter = 0;
    const encountersById = new Map<string, { id: string; jugable: boolean }>();
    const participantsByEncounterId = new Map<string, Record<string, unknown>[]>();
    createCombatEncounter.mockReset().mockImplementation((args: { data: { jugable?: boolean } }) => {
      const id = `encounter${++combatEncounterCounter}`;
      encountersById.set(id, { id, jugable: args.data.jugable !== false });
      participantsByEncounterId.set(id, []);
      return Promise.resolve({ id });
    });
    createCombatParticipant.mockReset().mockImplementation((args: { data: Record<string, unknown> }) => {
      const participant = { id: `participant${++combatParticipantCounter}`, ...args.data };
      const list = participantsByEncounterId.get(args.data.encounterId as string) ?? [];
      list.push(participant);
      participantsByEncounterId.set(args.data.encounterId as string, list);
      return Promise.resolve(participant);
    });
    updateCombatParticipant.mockReset().mockResolvedValue({});
    updateCombatEncounter.mockReset().mockResolvedValue({});
    findManyCombatParticipant.mockReset().mockImplementation((args: { where: { encounterId: string } }) =>
      Promise.resolve(participantsByEncounterId.get(args.where.encounterId) ?? []),
    );
    findUniqueOrThrowCombatEncounter.mockReset().mockImplementation((args: { where: { id: string } }) => {
      const participantes = participantsByEncounterId.get(args.where.id) ?? [];
      return Promise.resolve({ id: args.where.id, estado: 'EN_CURSO', ordenIniciativa: participantes.map((p) => p.id as string), turnoActual: 0, esperandoEleccionJugadora: false, participantes });
    });
    updateCombatEncounterReal.mockReset().mockResolvedValue({});
    updateCombatParticipantReal.mockReset().mockResolvedValue({});
    findFirstNpcReal.mockReset().mockResolvedValue(null);
    transaction.mockReset().mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        // Condición de carrera real (auditoría de código 2026-08-25, ampliada 2026-09-01) — tanto
        // la creación del CombatEncounter (lock vacío, solo serializa antes de releer
        // `combatEncounter.findFirst`) como la caza limpia sin combate (releen
        // `pendingCombatNpcSlugs`) pasan por `lockRowForUpdate` (shared.ts), que envuelve un único
        // `$queryRaw` — por defecto sin combate activo y sin slugs pendientes, igual que
        // `SAVE_BASE.pendingCombatNpcSlugs`.
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'save1', pendingCombatNpcSlugs: [] }]),
        npcState: { upsert: (...args: unknown[]) => upsertNpcState(...args) },
        worldPopulation: {
          updateMany: (...args: unknown[]) => updateManyWorldPopulation(...args),
          update: (...args: unknown[]) => updateWorldPopulation(...args),
        },
        worldState: { update: (...args: unknown[]) => updateWorldState(...args) },
        logEntry: { create: (...args: unknown[]) => createLogEntry(...args) },
        save: { update: (...args: unknown[]) => updateSave(...args), findUniqueOrThrow: vi.fn().mockResolvedValue({ pendingCombatNpcSlugs: [] }) },
        combatEncounter: {
          create: (...args: unknown[]) => createCombatEncounter(...args),
          update: (...args: unknown[]) => updateCombatEncounter(...args),
          findFirst: (...args: unknown[]) => findFirstCombatEncounter(...args),
        },
        combatParticipant: {
          create: (...args: unknown[]) => createCombatParticipant(...args),
          update: (...args: unknown[]) => updateCombatParticipant(...args),
          // Sub-partición >4v4: `avanzarSinAtacar`/`avanzarYComprobarFin` (dentro de
          // `resolverTurnosAutonomosHastaJugadora`) abren su PROPIA `prisma.$transaction` — el
          // mismo mock de arriba, así que necesita los mismos métodos que el `prisma` real de
          // fuera, leyendo del mismo almacén compartido.
          findMany: (...args: unknown[]) => findManyCombatParticipant(...args),
        },
        npc: { findUnique: (...args: unknown[]) => findUniqueNpc(...args) },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rechaza si ya hay un combate en curso', async () => {
    findUniqueSave.mockResolvedValue({ ...SAVE_BASE, pendingCombatNpcSlugs: ['algun-npc'] });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['murgol'] } });
    expect(res.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  // Bug real (auditoría de bugs, 2026-08-21): esta ruta nunca comprobaba `save.endedAt` — con la
  // partida ya terminada por muerte definitiva, seguía dejando cazar (mutar WorldPopulation/
  // NpcState de verdad) para un personaje que la propia partida ya da por definitivamente muerto.
  it('rechaza con 409 si la partida ya ha terminado (endedAt)', async () => {
    const endedAt = new Date('2026-08-08T12:00:00Z');
    findUniqueSave.mockResolvedValue({ ...SAVE_BASE, endedAt });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['murgol'] } });
    expect(res.statusCode).toBe(409);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('varias presas seleccionadas: combate obligatorio, nunca pasa por upsertNpcStateDirect (la narración real lo abre) — pero SÍ pre-crea el CombatEncounter con el grupo de Múrgol (8 avistados)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // roll 4 -> delta 0 (rollGroupEngagement), grupo sin variación
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/cazar/confirmar',
      payload: { slugs: ['murgol', 'cruzavientos'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resuelveSinCombate).toBe(false);
    expect(body.actionText).toContain("'Múrgol'");
    expect(body.actionText).toContain("'Cruzavientos'");
    expect(upsertNpcStateDirect).not.toHaveBeenCalled();
    // Múrgol: capturablePct 80, población 50 -> avistadosFor(80,50)=8 avistados, grupo real ->
    // dispara iniciarCombatEncounter (Capa 4, 2026-08-25). Cruzavientos: capturablePct 10,
    // población 20 -> avistadosFor(10,20)=1, sin grupo, pero SÍ entra como participante solo en el
    // MISMO encounter (regla de "no mezclar" caza en grupo + solo en una misma escena).
    // Sub-partición >4v4 (checklist 2026-09-01): 9 ENEMIGO totales (8 Múrgol + 1 Cruzavientos) se
    // parten en 3 fragmentos de ≤4 — 1 `CombatEncounter` jugable (con la jugadora) + 2 autónomos,
    // cada uno resuelto de una sentada con su propia `prisma.$transaction` interna
    // (`avanzarSinAtacar`) además de la transacción principal — de ahí 3 `transaction`/
    // `createCombatEncounter`, ya no 1.
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(createCombatEncounter).toHaveBeenCalledTimes(3);
    const murgolCreates = createCombatParticipant.mock.calls.filter(([args]) => (args as { data: { npcId: string } }).data.npcId === 'npc-murgol');
    expect(murgolCreates).toHaveLength(8);
    for (const [args] of murgolCreates) {
      expect((args as { data: Record<string, unknown> }).data).toMatchObject({ bando: 'ENEMIGO', tipo: 'NPC', condicionFisicaGrupo: 'ILESO' });
    }
    const cruzavientosCreates = createCombatParticipant.mock.calls.filter(([args]) => (args as { data: { npcId: string } }).data.npcId === 'npc-cruzavientos');
    expect(cruzavientosCreates).toHaveLength(1);
    expect((cruzavientosCreates[0][0] as { data: Record<string, unknown> }).data).toMatchObject({ bando: 'ENEMIGO', tipo: 'NPC', condicionFisicaGrupo: undefined });
  });

  it('caza en grupo: cantidad elegida distinta de la resuelta añade la cláusula de variación al actionText, y el CombatEncounter se crea con el tamaño REAL del grupo', async () => {
    // Dos especies a la vez (fuerza combate, sin pasar por la caza limpia de Múrgol solo).
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // roll 6 -> delta +1 (rollGroupEngagement)
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/cazar/confirmar',
      payload: { slugs: ['murgol', 'cruzavientos'], cantidades: { murgol: 2 } },
    });
    const body = res.json();
    expect(body.actionText).toContain("Salgo a cazar y ataco a 'Múrgol', 'Cruzavientos'.");
    expect(body.actionText).toContain('otro más se suma de repente, sin previo aviso');
    const murgolCreates = createCombatParticipant.mock.calls.filter(([args]) => (args as { data: { npcId: string } }).data.npcId === 'npc-murgol');
    expect(murgolCreates).toHaveLength(3); // 2 elegidos + 1 del roll
  });

  it('una sola presa pero NO débil (Cruzavientos, nivel 5 contra jugador nivel 3): combate obligatorio, sin escribir en la base de datos (1 solo avistado, sin grupo)', async () => {
    findUniqueNpc.mockResolvedValue(CRUZAVIENTOS_NPC);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['cruzavientos'] } });
    const body = res.json();
    expect(body.resuelveSinCombate).toBe(false);
    expect(body.actionText).toContain("'Cruzavientos'");
    expect(transaction).not.toHaveBeenCalled();
    expect(upsertNpcStateDirect).not.toHaveBeenCalled();
  });

  it('una sola presa débil, tirada de caza limpia con ÉXITO: mata sin combate, depleciona población y registra el log', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // 0 < cualquier % positivo -> éxito
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['murgol'] } });
    const body = res.json();
    expect(body.resuelveSinCombate).toBe(true);
    expect(body.exito).toBe(true);
    expect(body.combate.npcs).toEqual([{ slug: 'murgol', name: 'Múrgol', condicionFisica: 'MUERTO', saqueado: false, lootedItemNames: [] }]);
    expect(upsertNpcState).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ condicionFisica: 'MUERTO' }) }),
    );
    expect(updateManyWorldPopulation).toHaveBeenCalled();
    expect(createLogEntry).toHaveBeenCalled();
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { pendingCombatNpcSlugs: ['murgol'] } });
    expect(appendSessionFacts).toHaveBeenCalled();
  });

  it('una sola presa débil, tirada de caza limpia FALLIDA: no toca la base de datos, deja el combate para el turno normal', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // por encima de cualquier % razonable -> fallo
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['murgol'] } });
    const body = res.json();
    expect(body.resuelveSinCombate).toBe(false);
    expect(body.exito).toBe(false);
    expect(body.actionText).toContain("'Múrgol'");
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rechaza cazar si ya hay un CombatEncounter real EN_CURSO, aunque pendingCombatNpcSlugs esté vacío (bug real 2026-08-25: un turno que revienta antes de sincronizar ese campo dejaba reintentar y apilar encuentros huérfanos)', async () => {
    findFirstCombatEncounter.mockResolvedValue({ id: 'encounter-huerfano', estado: 'EN_CURSO', jugable: true });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['murgol', 'cruzavientos'] } });
    expect(res.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rechaza una selección de fauna ya sin población real (se te ha adelantado alguien)', async () => {
    findManyWorldPopulation.mockResolvedValue([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['murgol'] } });
    expect(res.statusCode).toBe(400);
  });

  // Cooldown de dispersión (2026-09-02, sobre d6e8afc) — cuando `rollGroupEngagement` da 0 de
  // verdad para una especie (tras el guard de AGRESIVO), esa especie concreta debe quedar marcada
  // en `WorldPopulation` con la Location y el minuto de ficción actuales, para que
  // `candidateFaunaFor` la bloquee mientras el cooldown siga activo (ver describe aparte más abajo
  // para el filtro en sí). Múrgol no es AGRESIVO en este fixture (`MURGOL_NPC` no define
  // `temperamento`), así que el guard de la usuaria ("uno agresivo no se dispersa") no interfiere.
  it('caza en grupo con fallo total para una especie (cantidadElegida=1, peor roll): escribe el cooldown de dispersión en WorldPopulation para ESE targetSlug/Location', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // roll 1 -> delta -1: con elegido=1, cantidadReal=0
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/cazar/confirmar',
      payload: { slugs: ['murgol', 'cruzavientos'], cantidades: { murgol: 1 } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.actionText).toContain('el grupo entero se dispersa antes de que pueda acorralar a ninguno');
    expect(updateWorldPopulation).toHaveBeenCalledWith({
      where: { worldId_targetType_targetSlug: { worldId: 'world1', targetType: 'FAUNA', targetSlug: 'murgol' } },
      data: { dispersadoEnLocationId: 'loc1', dispersadoDesdeMinutes: 480 },
    });
    // Cruzavientos (único avistado, sin grupo real) no falló nada — su cooldown nunca se toca: el
    // fallo de una especie no afecta a las demás seleccionadas en la misma petición.
    expect(updateWorldPopulation).toHaveBeenCalledTimes(1);
  });

  // Guard de AGRESIVO (d6e8afc, ya cerrado): con fauna agresiva y el jugador sin superar claramente
  // su nivel, `cantidadReal` se fuerza de vuelta a 1 — nunca llega a dispersarse, así que tampoco
  // debe escribirse ningún cooldown.
  it('caza en grupo con fauna AGRESIVA forzada de vuelta a 1 (guard ya existente): NO escribe cooldown de dispersión', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // peor roll
    findManyNpc.mockResolvedValue([{ ...MURGOL_NPC, temperamento: 'AGRESIVO', levelMax: 10 }, CRUZAVIENTOS_NPC]);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/cazar/confirmar',
      payload: { slugs: ['murgol', 'cruzavientos'], cantidades: { murgol: 1 } },
    });
    expect(res.statusCode).toBe(200);
    expect(updateWorldPopulation).not.toHaveBeenCalled();
  });
});

// Cooldown de dispersión (2026-09-02) — puro, mismo patrón exacto que
// `npcRecoversFromConvaleciente` (death.ts): minutos de FICCIÓN, no reloj de pared.
describe('dispersionCooldownActivo', () => {
  it('sin dispersión previa (null), nunca bloquea', () => {
    expect(dispersionCooldownActivo(null, 1000)).toBe(false);
  });

  it('dentro de las 4h de ficción (240 min) desde que se dispersó, sigue bloqueado', () => {
    expect(dispersionCooldownActivo(480, 480 + 239)).toBe(true);
  });

  it('justo al cumplirse las 4h de ficción, deja de bloquear', () => {
    expect(dispersionCooldownActivo(480, 480 + 240)).toBe(false);
  });

  it('mucho después de las 4h, sigue sin bloquear', () => {
    expect(dispersionCooldownActivo(480, 480 + 10000)).toBe(false);
  });
});

// Filtro de cooldown de dispersión en `candidateFaunaFor` (2026-09-02) — GET /saves/:id/cazar es
// el camino más simple para probar el filtro sin pasar por toda la maquinaria de /confirmar.
describe('GET /saves/:id/cazar — cooldown de dispersión', () => {
  beforeEach(() => {
    findUniqueSave.mockReset().mockResolvedValue(SAVE_BASE);
    findManyNpc.mockReset().mockResolvedValue([MURGOL_NPC, CRUZAVIENTOS_NPC]);
    loadSessionFacts.mockReset().mockResolvedValue(['Gorhorn detecta señales de fauna cerca: 5 Múrgol. Gorhorn detecta señales de fauna cerca: 2 Cruzavientos.']);
  });

  it('una especie dispersada en ESTA Location, dentro del cooldown, queda fuera de los candidatos', async () => {
    findManyWorldPopulation.mockReset().mockResolvedValue([
      { ...MURGOL_POP, dispersadoEnLocationId: 'loc1', dispersadoDesdeMinutes: 480 - 100 }, // hace 100 min de ficción, cooldown activo (240 min)
      CRUZAVIENTOS_POP,
    ]);
    // El mock de `npc.findMany` no simula el `where: { slug: { in: [...] } }` real de Prisma (mismo
    // motivo documentado en el test de filtro de terreno, más arriba) — solo el NPC que de verdad
    // pasaría el filtro de cooldown.
    findManyNpc.mockResolvedValue([CRUZAVIENTOS_NPC]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/cazar' });
    const { candidates } = res.json();
    expect(candidates.map((c: { slug: string }) => c.slug)).toEqual(['cruzavientos']);
  });

  it('una especie dispersada en OTRA Location no queda bloqueada aquí', async () => {
    findManyWorldPopulation.mockReset().mockResolvedValue([
      { ...MURGOL_POP, dispersadoEnLocationId: 'loc-otra-zona', dispersadoDesdeMinutes: 480 - 100 },
      CRUZAVIENTOS_POP,
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/cazar' });
    const { candidates } = res.json();
    expect(candidates.map((c: { slug: string }) => c.slug).sort()).toEqual(['cruzavientos', 'murgol']);
  });

  it('una especie dispersada en esta Location, pero con el cooldown ya cumplido, vuelve a estar disponible', async () => {
    findManyWorldPopulation.mockReset().mockResolvedValue([
      { ...MURGOL_POP, dispersadoEnLocationId: 'loc1', dispersadoDesdeMinutes: 480 - 240 }, // 4h de ficción ya cumplidas
      CRUZAVIENTOS_POP,
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/cazar' });
    const { candidates } = res.json();
    expect(candidates.map((c: { slug: string }) => c.slug).sort()).toEqual(['cruzavientos', 'murgol']);
  });
});
