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
const updateManyWorldPopulation = vi.fn();
const createLogEntry = vi.fn();
const updateSave = vi.fn();
const transaction = vi.fn();
const loadSessionFacts = vi.fn();
const appendSessionFacts = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    worldPopulation: { findMany: (...args: unknown[]) => findManyWorldPopulation(...args) },
    npc: {
      findMany: (...args: unknown[]) => findManyNpc(...args),
      findUnique: (...args: unknown[]) => findUniqueNpc(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('../../services/worldFacts.js', () => ({
  loadSessionFacts: (...args: unknown[]) => loadSessionFacts(...args),
  appendSessionFacts: (...args: unknown[]) => appendSessionFacts(...args),
}));

const { cazarRoutes, avistadosFor, rollSightings } = await import('./cazar.js');

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
  attributes: { fuerza: 10, destreza: 12, constitucion: 10 },
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
const MURGOL_NPC = { id: 'npc-murgol', slug: 'murgol', name: 'Múrgol', level: 1, capturablePct: 80, kind: 'PLANTILLA' };

const CRUZAVIENTOS_POP = {
  targetType: 'FAUNA',
  targetSlug: 'cruzavientos',
  poblacion: 20,
  distribucion: { 'Llanuras del Viento Rojo': 1 },
};
const CRUZAVIENTOS_NPC = { id: 'npc-cruzavientos', slug: 'cruzavientos', name: 'Cruzavientos', level: 5, capturablePct: 10, kind: 'PLANTILLA' };

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
    expect(candidates).toEqual([{ slug: 'murgol', name: 'Múrgol', level: 1, debil: true, avistados: avistadosFor(80, 50) }]);
  });

  it('no ofrece nada ni "Explorar" si la región no tiene distribución real (bug de artículo ya cubierto en population.ts)', async () => {
    findManyWorldPopulation.mockResolvedValue([{ ...MURGOL_POP, distribucion: { 'Ciénaga Troncal': 1 } }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/cazar' });
    expect(res.json()).toEqual({ candidates: [], puedeExplorar: false });
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

  it('nada que explorar si la región no tiene fauna real', async () => {
    findManyWorldPopulation.mockResolvedValue([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/explorar' });
    expect(res.json()).toEqual({ candidates: [] });
    expect(appendSessionFacts).not.toHaveBeenCalled();
  });

  it('tirada con éxito: encuentra fauna real, la registra como hecho de sesión', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no falla; pondera hacia Múrgol (más población)
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/explorar' });
    const { candidates } = res.json();
    expect(candidates).toEqual([{ slug: 'murgol', name: 'Múrgol', level: 1, debil: true, avistados: avistadosFor(80, 50) }]);
    expect(appendSessionFacts).toHaveBeenCalledWith('save1', [], [expect.stringContaining('Múrgol')]);
  });

  it('las 3 tiradas fallan: no encuentra nada, no registra ningún hecho de sesión (como buscar un recurso y no dar con nada)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // por debajo del umbral de fallo (0.35) siempre
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/explorar' });
    expect(res.json()).toEqual({ candidates: [] });
    expect(appendSessionFacts).not.toHaveBeenCalled();
  });
});

describe('POST /saves/:id/cazar/confirmar', () => {
  beforeEach(() => {
    findUniqueSave.mockReset().mockResolvedValue(SAVE_BASE);
    findManyWorldPopulation.mockReset().mockResolvedValue([MURGOL_POP, CRUZAVIENTOS_POP]);
    findManyNpc.mockReset().mockResolvedValue([MURGOL_NPC, CRUZAVIENTOS_NPC]);
    findUniqueNpc.mockReset().mockResolvedValue(MURGOL_NPC);
    upsertNpcState.mockReset();
    updateManyWorldPopulation.mockReset();
    createLogEntry.mockReset().mockResolvedValue({ id: 'log1', createdAt: new Date('2026-08-08T12:00:00Z') });
    updateSave.mockReset();
    loadSessionFacts.mockReset().mockResolvedValue([]);
    appendSessionFacts.mockReset().mockResolvedValue(undefined);
    transaction.mockReset().mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        npcState: { upsert: (...args: unknown[]) => upsertNpcState(...args) },
        worldPopulation: { updateMany: (...args: unknown[]) => updateManyWorldPopulation(...args) },
        logEntry: { create: (...args: unknown[]) => createLogEntry(...args) },
        save: { update: (...args: unknown[]) => updateSave(...args) },
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

  it('varias presas seleccionadas: combate obligatorio, NUNCA escribe en la base de datos (la narración real lo abre)', async () => {
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
    expect(transaction).not.toHaveBeenCalled();
  });

  it('una sola presa pero NO débil (Cruzavientos, nivel 5 contra jugador nivel 3): combate obligatorio, sin escribir en la base de datos', async () => {
    findUniqueNpc.mockResolvedValue(CRUZAVIENTOS_NPC);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['cruzavientos'] } });
    const body = res.json();
    expect(body.resuelveSinCombate).toBe(false);
    expect(body.actionText).toContain("'Cruzavientos'");
    expect(transaction).not.toHaveBeenCalled();
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

  it('rechaza una selección de fauna ya sin población real (se te ha adelantado alguien)', async () => {
    findManyWorldPopulation.mockResolvedValue([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/saves/save1/cazar/confirmar', payload: { slugs: ['murgol'] } });
    expect(res.statusCode).toBe(400);
  });
});
