import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría de código completa, 2026-08-07) — este endpoint no tenía NINGÚN test
/// antes. El foco es el bug real encontrado auditando `confirmar`: no validaba `selections` contra
/// `HarvestYield` (la fuente de verdad de qué objeto da cada fuente y cuánto como máximo por
/// recolección) — solo comprobaba la población total del mundo. Sin esa validación, el cliente
/// podía pedir cualquier itemSlug para cualquier sourceSlug, y `cantidad` no tenía más tope que la
/// población total (cientos de unidades), saltándose el máximo real ("3 piedras por recolección").
const findUniqueSave = vi.fn();
const updateSave = vi.fn();
const findFirstHarvestYield = vi.fn();
const findManyHarvestYield = vi.fn();
const findManyWorldPopulation = vi.fn();
const updateManyWorldPopulation = vi.fn();
const createInventoryItem = vi.fn();
const createManyInventoryItem = vi.fn();
const updateInventoryItem = vi.fn();
const findManyInventoryItem = vi.fn();
const findFirstInventoryItem = vi.fn();
const createLogEntry = vi.fn();
const loadSessionFacts = vi.fn();
const appendSessionFacts = vi.fn();
const transaction = vi.fn();
// Desuello (2026-08-09) — mockeados aparte, mismo criterio que `worldFacts.js` de abajo: son
// colaboradores de servicio, no detalle de implementación de esta ruta (detectNpcsInScene ya
// tiene su propia batería de tests en npcScene.test.ts).
const detectNpcsInScene = vi.fn();
const scopeFor = vi.fn();
const findUniqueNpcTx = vi.fn();
const updateManyNpcStateTx = vi.fn();
// Caza en grupo (2026-08-13) — lectura previa para decidir si el cadáver es de un grupo
// (corpsesLooted/groupDefeated) o solitario (saqueado); null = solitario, comportamiento de
// siempre para los tests ya existentes de esta describe.
const findUniqueNpcStateTx = vi.fn();
// Cierre de misión "conseguir Z" (auditoría 2026-08-11, bug real: closeItemQuests nunca se
// llamaba desde este endpoint) — mockeados con valor por defecto inocuo para que los tests que no
// les prestan atención no revienten si closeItemQuests llega a consultarlos.
const findManyQuestTx = vi.fn();
const updateQuestTx = vi.fn();
// Herramienta requerida por oficio (2026-08-17) — el despiece (metodoObtencion CAZA = desollador)
// ahora comprueba, dentro de la misma transacción, si el inventario trae algo marcado como
// herramienta de desollador antes de dejar tocar NpcState.
const findManyItemCatalogTx = vi.fn();
// Coste de tiempo de recolección (petición explícita, 2026-08-14) — la ruta ahora avanza
// `WorldState.fictionalMinutes` dentro de la misma transacción cuando se consigue algo de verdad.
const updateWorldStateTx = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args), update: (...args: unknown[]) => updateSave(...args) },
    harvestYield: { findMany: (...args: unknown[]) => findManyHarvestYield(...args) },
    worldPopulation: { findMany: (...args: unknown[]) => findManyWorldPopulation(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

// Registro escrito determinista de la recolección (petición explícita, 2026-08-07) — mockeado
// aparte porque `appendSessionFacts` en la vida real embebe con Ollama, no debe tocarse en un test
// unitario de esta ruta.
vi.mock('../../services/worldFacts.js', () => ({
  loadSessionFacts: (...args: unknown[]) => loadSessionFacts(...args),
  appendSessionFacts: (...args: unknown[]) => appendSessionFacts(...args),
}));

vi.mock('../../services/npcScene.js', async (importOriginal) => {
  // `hasPendingLoot` (auditoría de deuda técnica 2026-08-18) — se deja la implementación REAL en
  // vez de mockearla: es lógica pura sin dependencias externas, y así este mock nunca se
  // desincroniza si su criterio cambia.
  const actual = await importOriginal<typeof import('../../services/npcScene.js')>();
  return {
    detectNpcsInScene: (...args: unknown[]) => detectNpcsInScene(...args),
    scopeFor: (...args: unknown[]) => scopeFor(...args),
    hasPendingLoot: actual.hasPendingLoot,
  };
});

const { recolectarRoutes } = await import('./recolectar.js');

async function buildApp() {
  const app = Fastify();
  await app.register(recolectarRoutes);
  return app;
}

describe('POST /saves/:id/recolectar/confirmar', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findFirstHarvestYield.mockReset();
    updateManyWorldPopulation.mockReset();
    createInventoryItem.mockReset();
    createManyInventoryItem.mockReset().mockResolvedValue({ count: 0 });
    updateInventoryItem.mockReset();
    findManyInventoryItem.mockReset().mockResolvedValue([]);
    // Sin pila previa por defecto — cada test de acumulación la sobreescribe explícitamente.
    findFirstInventoryItem.mockReset().mockResolvedValue(null);
    createLogEntry.mockReset().mockResolvedValue({ id: 'log1', createdAt: new Date('2026-08-07T12:00:00Z') });
    loadSessionFacts.mockReset().mockResolvedValue([]);
    appendSessionFacts.mockReset().mockResolvedValue(undefined);
    findUniqueNpcTx.mockReset();
    updateManyNpcStateTx.mockReset();
    findUniqueNpcStateTx.mockReset().mockResolvedValue(null);
    scopeFor.mockReset().mockReturnValue('');
    findManyQuestTx.mockReset().mockResolvedValue([]);
    updateQuestTx.mockReset();
    updateWorldStateTx.mockReset();
    findManyItemCatalogTx.mockReset().mockResolvedValue([]);
    updateSave.mockReset().mockResolvedValue({});
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      characterName: 'Gorhorn',
      currentLocationId: 'loc1',
      attributes: { fuerza: 10, constitucion: 10 },
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
    transaction.mockReset().mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        inventoryItem: {
          findMany: (...args: unknown[]) => findManyInventoryItem(...args),
          findFirst: (...args: unknown[]) => findFirstInventoryItem(...args),
          create: (...args: unknown[]) => createInventoryItem(...args),
          createMany: (...args: unknown[]) => createManyInventoryItem(...args),
          update: (...args: unknown[]) => updateInventoryItem(...args),
        },
        logEntry: { create: (...args: unknown[]) => createLogEntry(...args) },
        harvestYield: { findFirst: (...args: unknown[]) => findFirstHarvestYield(...args) },
        worldPopulation: { updateMany: (...args: unknown[]) => updateManyWorldPopulation(...args) },
        worldState: { update: (...args: unknown[]) => updateWorldStateTx(...args) },
        npc: { findUnique: (...args: unknown[]) => findUniqueNpcTx(...args) },
        npcState: {
          updateMany: (...args: unknown[]) => updateManyNpcStateTx(...args),
          findUnique: (...args: unknown[]) => findUniqueNpcStateTx(...args),
        },
        quest: {
          findMany: (...args: unknown[]) => findManyQuestTx(...args),
          update: (...args: unknown[]) => updateQuestTx(...args),
        },
        itemCatalog: { findMany: (...args: unknown[]) => findManyItemCatalogTx(...args) },
      }),
    );
  });

  /// Helper (2026-08-17) — deja el inventario mockeado con el cuchillo de hielo sílice (arma Y
  /// herramienta de desollador/curtidor a la vez), para los tests de despiece (CAZA) que SÍ deben
  /// poder completarse. Sin llamar a esto, `findManyInventoryItem` sigue en `[]` por defecto y el
  /// despiece se bloquea por falta de herramienta (mismo criterio que canCraft, crafting.ts).
  function mockPlayerHasDesolladorTool() {
    findManyInventoryItem.mockResolvedValue([{ id: 'tool1', name: 'Cuchillo de hielo sílice', catalogSlug: 'cuchillo-hielo-silice' }]);
    findManyItemCatalogTx.mockResolvedValue([{ slug: 'cuchillo-hielo-silice', tipo: 'EQUIPABLE', category: 'arma', herramientaParaOficio: ['curtidor', 'desollador'] }]);
  }

  // Bug real (auditoría de bugs, 2026-08-21): esta ruta nunca comprobaba `save.endedAt` — con la
  // partida ya terminada por muerte definitiva, seguía dejando recolectar (mutar WorldPopulation/
  // inventario de verdad) para un personaje que la propia partida ya da por definitivamente muerto.
  it('rechaza con 409 si la partida ya ha terminado (endedAt)', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      characterName: 'Gorhorn',
      currentLocationId: 'loc1',
      attributes: { fuerza: 10, constitucion: 10 },
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
      endedAt: new Date('2026-08-07T12:00:00Z'),
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 1 }] },
    });
    expect(res.statusCode).toBe(409);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('ignora una selección cuyo itemSlug no es un HarvestYield real de ese sourceSlug (bug real, sin validar antes)', async () => {
    findFirstHarvestYield.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'hacha-guerra-orca', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(updateManyWorldPopulation).not.toHaveBeenCalled();
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('topa la cantidad al máximo real de HarvestYield.cantidad, aunque el cliente pida más (bug real: antes solo topaba la población total)', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 500 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(updateManyWorldPopulation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ poblacion: { gte: 3 } }),
        data: expect.objectContaining({ poblacion: { decrement: 3 } }),
      }),
    );
    // El nombre final (con la cantidad ya topada) se escribe en el update de cierre, no en el
    // create inicial — ver el test de acumulación de abajo para por qué está separado así.
    expect(updateInventoryItem).toHaveBeenCalledWith({ where: { id: 'item1' }, data: { name: 'Piedra (3)' } });
    expect(JSON.parse(res.body).items).toEqual([
      expect.objectContaining({ id: 'item1', name: 'Piedra (3)', catalogSlug: 'piedra', tipo: 'RECURSO' }),
    ]);
    // Registro escrito determinista (petición explícita, 2026-08-07: "un texto de narración que
    // no dependa de la AI") — sin llamar a Ollama, ni al Narrador.
    expect(createLogEntry).toHaveBeenCalledWith({
      data: expect.objectContaining({ saveId: 'save1', channel: 'CHARACTER', text: 'Gorhorn recolecta en la zona: Piedra (3).', isPlayerAction: false }),
    });
    expect(appendSessionFacts).toHaveBeenCalledWith('save1', [], ['Gorhorn recolecta en la zona: Piedra (3).']);
    expect(JSON.parse(res.body).logEntry).toEqual(expect.objectContaining({ id: 'log1', text: 'Gorhorn recolecta en la zona: Piedra (3).' }));
  });

  it('el guard de cooldown va en la misma consulta atómica que la de población', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(updateManyWorldPopulation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ lastHarvestedAt: null }, { lastHarvestedAt: { lt: expect.any(Date) } }, { lastHarvestedLocationId: { not: 'loc1' } }],
        }),
        data: expect.objectContaining({ lastHarvestedAt: expect.any(Date), lastHarvestedLocationId: 'loc1' }),
      }),
    );
  });

  // Bug real de auditoría (2026-08-13): `{ not: save.currentLocationId }` con `currentLocationId`
  // nulo se traduce en Prisma como `IS NOT NULL` — cierto para CUALQUIER fuente ya recolectada
  // antes, inutilizando el cooldown entero en vez de bloquear. Con ubicación desconocida esa rama
  // del OR debe omitirse del todo (solo tiempo puede saltar el cooldown, nunca "otra ubicación").
  it('con currentLocationId nulo, el guard NO incluye la rama de "otra ubicación" (evita el `IS NOT NULL` que invalidaría el cooldown)', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 'save1',
      worldId: 'world1',
      characterName: 'Gorhorn',
      currentLocationId: null,
      attributes: { fuerza: 10, constitucion: 10 },
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(updateManyWorldPopulation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ lastHarvestedAt: null }, { lastHarvestedAt: { lt: expect.any(Date) } }],
        }),
        data: expect.objectContaining({ lastHarvestedAt: expect.any(Date), lastHarvestedLocationId: null }),
      }),
    );
  });

  it('en cooldown (recolectado hace poco), la actualización de población no encuentra fila y no da nada', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    // El guard atómico (poblacion+cooldown en el WHERE) es lo que de verdad bloquea — se simula
    // aquí como si la fila no hubiera pasado el filtro (count: 0), mismo resultado que sin población.
    updateManyWorldPopulation.mockResolvedValue({ count: 0 });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(createLogEntry).not.toHaveBeenCalled();
    expect(appendSessionFacts).not.toHaveBeenCalled();
  });

  it('dos selecciones de la MISMA fuente en una sola petición solo comprueban el cooldown una vez (si no, la 2ª se bloquearía a sí misma)', async () => {
    findFirstHarvestYield.mockImplementation(({ where }: { where: { item: { slug: string } } }) =>
      Promise.resolve(
        where.item.slug === 'piedra' ? { cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } } : { cantidad: 2, item: { slug: 'mena-de-hierro', name: 'Mena de hierro' } },
      ),
    );
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    createInventoryItem.mockImplementation(({ data }: { data: { catalogSlug: string } }) =>
      Promise.resolve({ id: data.catalogSlug === 'piedra' ? 'item-piedra' : 'item-mena' }),
    );
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: {
        selections: [
          { sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 },
          { sourceSlug: 'roca-pilares-rotos', itemSlug: 'mena-de-hierro', cantidad: 2 },
        ],
      },
    });

    expect(updateManyWorldPopulation).toHaveBeenCalledTimes(2);
    // La 1ª comprueba cooldown (lleva OR), la 2ª (misma fuente, ya validada en esta petición) no.
    expect(updateManyWorldPopulation.mock.calls[0][0].where.OR).toBeDefined();
    expect(updateManyWorldPopulation.mock.calls[1][0].where.OR).toBeUndefined();
  });

  it('acumula sobre una pila ya existente en vez de crear una fila nueva (bug real jugando en vivo, "no acumula los items")', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    findFirstInventoryItem.mockResolvedValue({ id: 'item-viejo', name: 'Piedra (3)' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(createInventoryItem).not.toHaveBeenCalled();
    expect(updateInventoryItem).toHaveBeenCalledWith({ where: { id: 'item-viejo' }, data: { name: 'Piedra (6)' } });
    const body = JSON.parse(res.body);
    expect(body.items).toEqual([]);
    expect(body.updatedItems).toEqual([{ id: 'item-viejo', name: 'Piedra (6)' }]);
  });

  it('el texto del log usa lo cosechado ESTA vez, no el total de la pila (bug real jugando en vivo, 2026-08-13: "recolecta Piedra (6)" en vez de "(3)" con una pila previa de 3)', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    findFirstInventoryItem.mockResolvedValue({ id: 'item-viejo', name: 'Piedra (3)' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    // El nombre real del InventoryItem SÍ debe llevar el total (6) — solo el TEXTO del log debe
    // hablar de lo recién cosechado (3).
    expect(updateInventoryItem).toHaveBeenCalledWith({ where: { id: 'item-viejo' }, data: { name: 'Piedra (6)' } });
    expect(createLogEntry).toHaveBeenCalledWith({
      data: expect.objectContaining({ text: 'Gorhorn recolecta en la zona: Piedra (3).' }),
    });
  });

  it('bug real (auditoría 2026-08-11, "pruebas por API"): minar cierra sola una misión "conseguir Z" con ese objeto, cosa que antes nunca pasaba en este endpoint', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    findManyQuestTx.mockResolvedValue([
      { id: 'quest1', title: 'Conseguir piedra', targetItemName: 'Piedra', rewardItems: [], rewardXp: null, rewardRecipeKeys: [], rewardCompanion: null },
    ]);
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(findManyQuestTx).toHaveBeenCalledWith({ where: { saveId: 'save1', status: 'ACTIVA', targetItemName: { not: null } } });
    expect(updateQuestTx).toHaveBeenCalledWith({ where: { id: 'quest1' }, data: { status: 'COMPLETADA' } });
  });

  it('no crea el objeto si la población ya no alcanza (otra recolección casi simultánea se lo llevó)', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 0 });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('sin espacio libre (capacidad real, Parte D), no añade nada — topa a 0 en vez de rechazar toda la petición', async () => {
    findManyInventoryItem.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ name: `Objeto ${i}` })));
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  // Bug real jugando en vivo (2026-08-08, "podemos tener inventario infinito"): una pila ya
  // acumulada ("Piedra (38)") es UNA sola fila — antes de este fix, el gate de capacidad contaba
  // FILAS, así que esta partida (1 fila, muy por debajo del límite) podía seguir recolectando sin
  // límite real. Ahora se mide en unidades: con capacidad 40 y 38 ya acumuladas, solo caben 2 más.
  it('topa por unidades acumuladas en una pila existente, no por número de filas (bug real: inventario efectivamente infinito)', async () => {
    findManyInventoryItem.mockResolvedValue([{ name: 'Piedra (38)' }]);
    findFirstHarvestYield.mockResolvedValue({ cantidad: 5, item: { slug: 'piedra', name: 'Piedra' } });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Piedra (38)' });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 5 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(updateManyWorldPopulation).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ poblacion: { decrement: 2 } }) }));
    expect(updateInventoryItem).toHaveBeenCalledWith({ where: { id: 'item1' }, data: { name: 'Piedra (40)' } });
  });

  // Desuello (2026-08-09): un yield de método CAZA no toca WorldPopulation en absoluto — reclama
  // NpcState.saqueado de forma atómica (mismo guard-en-el-where que ya usa saqueo de NPCs con
  // nombre), y el texto determinista dice "despieza" en vez de "recolecta".
  it('un yield de método CAZA marca NpcState.saqueado en vez de tocar WorldPopulation', async () => {
    mockPlayerHasDesolladorTool();
    findFirstHarvestYield.mockResolvedValue({ cantidad: 1, metodoObtencion: 'CAZA', item: { slug: 'piel-corretolvas', name: 'Piel de Corretolvas' } });
    findUniqueNpcTx.mockResolvedValue({ id: 'npc1', kind: 'PLANTILLA' });
    scopeFor.mockReturnValue('loc1');
    updateManyNpcStateTx.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'corretolvas', itemSlug: 'piel-corretolvas', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(updateManyWorldPopulation).not.toHaveBeenCalled();
    expect(updateManyNpcStateTx).toHaveBeenCalledWith({
      where: { saveId: 'save1', npcId: 'npc1', scope: 'loc1', saqueado: false },
      data: { saqueado: true },
    });
    expect(createLogEntry).toHaveBeenCalledWith({
      data: expect.objectContaining({ text: 'Gorhorn despieza una presa cercana: Piel de Corretolvas.' }),
    });
  });

  it('sin ninguna herramienta de desollador en el inventario, el despiece no da nada (mismo criterio que canCraft)', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 1, metodoObtencion: 'CAZA', item: { slug: 'piel-corretolvas', name: 'Piel de Corretolvas' } });
    findUniqueNpcTx.mockResolvedValue({ id: 'npc1', kind: 'PLANTILLA' });
    scopeFor.mockReturnValue('loc1');
    updateManyNpcStateTx.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'corretolvas', itemSlug: 'piel-corretolvas', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(updateManyNpcStateTx).not.toHaveBeenCalled();
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  // Pico de minero (2026-08-23, Grupo 3 § HarvestYield.condicion) — a diferencia de desollador
  // (gate por OFICIO ENTERO), minero es un gate POR YIELD (`requiereHerramienta`): bloquear todo
  // el oficio dejaba sin poder minar ni Piedra común (bug real encontrado en
  // recolectar.integration.test.ts). Estos dos yields SÍ lo llevan (mena de Yerreo).
  it('sin pico de minero en el inventario, un yield con requiereHerramienta no da nada', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 2, metodoObtencion: 'MINERIA', requiereHerramienta: true, item: { slug: 'mena-yerreo', name: 'Mena de Yerreo' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'yerreo', itemSlug: 'mena-yerreo', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(updateManyWorldPopulation).not.toHaveBeenCalled();
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('con el pico de minero en el inventario, un yield con requiereHerramienta sí da el objeto', async () => {
    findManyInventoryItem.mockResolvedValue([{ id: 'tool1', name: 'Pico de minero', catalogSlug: 'pico-minero' }]);
    findManyItemCatalogTx.mockResolvedValue([{ slug: 'pico-minero', tipo: 'EQUIPABLE', category: 'herramienta', herramientaParaOficio: ['minero'] }]);
    findFirstHarvestYield.mockResolvedValue({ cantidad: 2, metodoObtencion: 'MINERIA', requiereHerramienta: true, item: { slug: 'mena-yerreo', name: 'Mena de Yerreo' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'yerreo', itemSlug: 'mena-yerreo', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).not.toEqual([]);
    expect(updateManyWorldPopulation).toHaveBeenCalled();
  });

  // Guard directo del bug real de arriba (auditoría 2026-08-23, confirmado en
  // recolectar.integration.test.ts): un yield de minero SIN requiereHerramienta (Piedra común)
  // tiene que seguir dando sin ninguna herramienta en el inventario.
  it('un yield de minero SIN requiereHerramienta (ej. Piedra) da sin ninguna herramienta en el inventario', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, metodoObtencion: 'MINERIA', requiereHerramienta: false, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).not.toEqual([]);
    expect(updateManyWorldPopulation).toHaveBeenCalled();
  });

  it('un cadáver ya despiezado (saqueado:true) no da nada — el guard atómico lo bloquea', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 1, metodoObtencion: 'CAZA', item: { slug: 'piel-corretolvas', name: 'Piel de Corretolvas' } });
    findUniqueNpcTx.mockResolvedValue({ id: 'npc1', kind: 'PLANTILLA' });
    scopeFor.mockReturnValue('loc1');
    updateManyNpcStateTx.mockResolvedValue({ count: 0 });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'corretolvas', itemSlug: 'piel-corretolvas', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('dos yields del mismo cadáver en una sola petición solo reclaman NpcState.saqueado una vez', async () => {
    mockPlayerHasDesolladorTool();
    findFirstHarvestYield.mockImplementation(({ where }: { where: { item: { slug: string } } }) =>
      Promise.resolve(
        where.item.slug === 'piel-corretolvas'
          ? { cantidad: 1, metodoObtencion: 'CAZA', item: { slug: 'piel-corretolvas', name: 'Piel de Corretolvas' } }
          : { cantidad: 1, metodoObtencion: 'CAZA', item: { slug: 'hueso-ligero', name: 'Hueso ligero' } },
      ),
    );
    findUniqueNpcTx.mockResolvedValue({ id: 'npc1', kind: 'PLANTILLA' });
    scopeFor.mockReturnValue('loc1');
    updateManyNpcStateTx.mockResolvedValue({ count: 1 });
    createInventoryItem.mockImplementation(({ data }: { data: { catalogSlug: string } }) =>
      Promise.resolve({ id: data.catalogSlug === 'piel-corretolvas' ? 'item-piel' : 'item-hueso' }),
    );
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: {
        selections: [
          { sourceSlug: 'corretolvas', itemSlug: 'piel-corretolvas', cantidad: 1 },
          { sourceSlug: 'corretolvas', itemSlug: 'hueso-ligero', cantidad: 1 },
        ],
      },
    });

    expect(updateManyNpcStateTx).toHaveBeenCalledTimes(1);
  });

  // Caza en grupo (2026-08-13) — con `groupSize` puesto, el despiece consume UN cadáver real
  // (`corpsesLooted < groupDefeated`) en vez del booleano `saqueado`, que solo tiene sentido para
  // un individuo solitario.
  describe('Caza en grupo: despiece consume corpsesLooted/groupDefeated en vez de saqueado', () => {
    it('con cadáveres reales disponibles (groupDefeated > corpsesLooted), reclama uno y NO toca saqueado', async () => {
      mockPlayerHasDesolladorTool();
      findFirstHarvestYield.mockResolvedValue({ cantidad: 1, metodoObtencion: 'CAZA', item: { slug: 'piel-corretolvas', name: 'Piel de Corretolvas' } });
      findUniqueNpcTx.mockResolvedValue({ id: 'npc1', kind: 'PLANTILLA' });
      scopeFor.mockReturnValue('loc1');
      findUniqueNpcStateTx.mockResolvedValue({ groupSize: 5, groupDefeated: 2, corpsesLooted: 0 });
      updateManyNpcStateTx.mockResolvedValue({ count: 1 });
      createInventoryItem.mockResolvedValue({ id: 'item1' });
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/saves/save1/recolectar/confirmar',
        payload: { selections: [{ sourceSlug: 'corretolvas', itemSlug: 'piel-corretolvas', cantidad: 1 }] },
      });

      expect(res.statusCode).toBe(200);
      expect(updateManyNpcStateTx).toHaveBeenCalledWith({
        where: { saveId: 'save1', npcId: 'npc1', scope: 'loc1', corpsesLooted: { lt: 2 } },
        data: { corpsesLooted: { increment: 1 } },
      });
    });

    it('sin cadáveres reales disponibles (corpsesLooted ya alcanzó groupDefeated), el guard atómico bloquea aunque el grupo siga en pie', async () => {
      findFirstHarvestYield.mockResolvedValue({ cantidad: 1, metodoObtencion: 'CAZA', item: { slug: 'piel-corretolvas', name: 'Piel de Corretolvas' } });
      findUniqueNpcTx.mockResolvedValue({ id: 'npc1', kind: 'PLANTILLA' });
      scopeFor.mockReturnValue('loc1');
      findUniqueNpcStateTx.mockResolvedValue({ groupSize: 5, groupDefeated: 1, corpsesLooted: 1 });
      updateManyNpcStateTx.mockResolvedValue({ count: 0 }); // corpsesLooted(1) < groupDefeated(1) es falso en la BD real
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/saves/save1/recolectar/confirmar',
        payload: { selections: [{ sourceSlug: 'corretolvas', itemSlug: 'piel-corretolvas', cantidad: 1 }] },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).items).toEqual([]);
      expect(createInventoryItem).not.toHaveBeenCalled();
    });
  });

  it('rechaza sin ninguna selección', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/confirmar', payload: { selections: [] } });

    expect(res.statusCode).toBe(400);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/nope/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /saves/:id/recolectar/:oficio', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyHarvestYield.mockReset().mockResolvedValue([]);
    findManyWorldPopulation.mockReset().mockResolvedValue([]);
    detectNpcsInScene.mockReset().mockResolvedValue([]);
    updateSave.mockReset().mockResolvedValue({});
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc1',
      currentLocation: { region: 'Las Llanuras del Viento Rojo' },
      // Tirada de Explorar/Desollar (rediseño de recolección, 2026-08-22): fuerza/destreza a 20
      // garantiza grado 'claro' o mejor incluso con el peor d20 posible (1 + floor(20/2) + 0 = 11,
      // igual a la dificultad por defecto de un yield sin tier, 10+1), así que estos tests no
      // dependen del azar de `Math.random`.
      attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
      secondaryAttributes: { suerte: 0 },
      inventoryItems: [],
      professionProgress: [],
    });
  });

  it('rechaza un oficio que no es recolector (herrero es creador, no tiene "explorar")', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/herrero-orco-llanuras' });

    expect(res.statusCode).toBe(400);
  });

  // Desuello (2026-08-09, petición explícita: "que al usar la habilidad de profesión de desollar
  // funcione como el resto y explore la zona con los cadáveres derrotados") — a diferencia del
  // resto, ya NO rechaza CAZA: busca fauna derrotada y sin despiezar en la escena.
  it('desollador (CAZA) devuelve como fuente una fauna derrotada y sin despiezar en escena', async () => {
    detectNpcsInScene.mockResolvedValue([
      { slug: 'corretolvas', name: 'Corretolvas', ataqueNatural: 'Muerde', condicionFisica: 'MUERTO', saqueado: false },
    ]);
    findManyHarvestYield.mockResolvedValue([
      { sourceSlug: 'corretolvas', sourceCategory: 'fauna', item: { slug: 'piel-corretolvas', name: 'Piel de Corretolvas' }, cantidad: 1 },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/desollador-orcos-llanuras' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sources).toEqual([
      {
        sourceCategory: 'fauna',
        sourceCategoryName: 'Fauna',
        yields: [{ sourceSlug: 'corretolvas', itemSlug: 'piel-corretolvas', itemName: 'Piel de Corretolvas', cantidadMaxima: 1, disponible: 1 }],
      },
    ]);
    // Nunca "Explorar" para desuello: o el cadáver ya está en escena, o no hay nada que buscar.
    expect(body.puedeExplorar).toBe(false);
    // Tirada visible (rediseño de recolección, 2026-08-22) — Destreza es el atributo de desollador.
    expect(body.roll.attribute).toBe('destreza');
  });

  it('desollador (CAZA): un despiece con dificultad inalcanzable ni con el mejor d20 posible no aparece (fallo)', async () => {
    detectNpcsInScene.mockResolvedValue([
      { slug: 'corretolvas', name: 'Corretolvas', ataqueNatural: 'Muerde', condicionFisica: 'MUERTO', saqueado: false },
    ]);
    findManyHarvestYield.mockResolvedValue([
      { sourceSlug: 'corretolvas', sourceCategory: 'fauna', item: { slug: 'piel-corretolvas', name: 'Piel de Corretolvas', tier: 20 }, cantidad: 1 },
    ]);
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc1',
      currentLocation: { region: 'Las Llanuras del Viento Rojo' },
      attributes: { fuerza: 0, destreza: 0, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
      secondaryAttributes: { suerte: 0 },
      inventoryItems: [],
      professionProgress: [],
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/desollador-orcos-llanuras' });

    expect(JSON.parse(res.body).sources).toEqual([]);
  });

  it('desollador (CAZA) ignora fauna todavía viva (condicionFisica ILESO/HERIDO/GRAVE)', async () => {
    detectNpcsInScene.mockResolvedValue([
      { slug: 'corretolvas', name: 'Corretolvas', ataqueNatural: 'Muerde', condicionFisica: 'HERIDO', saqueado: false },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/desollador-orcos-llanuras' });

    expect(JSON.parse(res.body).sources).toEqual([]);
  });

  // Bug real jugando en vivo (2026-08-22, "he matado a un buitre pero desollar no detecta el
  // cadáver"): en caza en grupo, `condicionFisica` sigue ILESO (refleja al individuo siguiente del
  // grupo, no a los ya caídos) aunque `groupDefeated > corpsesLooted` diga que sí hay un cadáver
  // real sin despiezar — antes esto se descartaba solo por mirar `condicionFisica`.
  it('desollador (CAZA) SÍ detecta un cadáver de un grupo con condicionFisica todavía ILESO (groupDefeated > corpsesLooted)', async () => {
    // Grado 'claro' garantizado (mismo criterio que otros tests de esta tirada) — la cantidad
    // exacta no es lo que se comprueba aquí, solo que el cadáver aparece en absoluto.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    detectNpcsInScene.mockResolvedValue([
      {
        slug: 'buitre-cenizo',
        name: 'Buitre Cenizo',
        ataqueNatural: 'Picotea y araña',
        condicionFisica: 'ILESO',
        saqueado: false,
        groupSize: 5,
        groupDefeated: 1,
        corpsesLooted: 0,
      },
    ]);
    findManyHarvestYield.mockResolvedValue([
      { sourceSlug: 'buitre-cenizo', sourceCategory: 'fauna', item: { slug: 'pluma-buitre-cenizo', name: 'Pluma de Buitre Cenizo' }, cantidad: 2 },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/desollador-orcos-llanuras' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].yields).toEqual([{ sourceSlug: 'buitre-cenizo', itemSlug: 'pluma-buitre-cenizo', itemName: 'Pluma de Buitre Cenizo', cantidadMaxima: 2, disponible: 2 }]);
    vi.restoreAllMocks();
  });

  it('desollador (CAZA) ignora un cadáver ya despiezado (saqueado:true)', async () => {
    detectNpcsInScene.mockResolvedValue([
      { slug: 'corretolvas', name: 'Corretolvas', ataqueNatural: 'Muerde', condicionFisica: 'MUERTO', saqueado: true },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/desollador-orcos-llanuras' });

    expect(JSON.parse(res.body).sources).toEqual([]);
  });

  it('desollador (CAZA) ignora NPCs humanoides (ataqueNatural null) aunque estén derrotados', async () => {
    detectNpcsInScene.mockResolvedValue([{ slug: 'hagar', name: 'Hagar', ataqueNatural: null, condicionFisica: 'MUERTO', saqueado: false }]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/desollador-orcos-llanuras' });

    expect(JSON.parse(res.body).sources).toEqual([]);
  });

  it('minero/talador siguen sin tocar detectNpcsInScene ni npcState — solo desollador (CAZA) lo usa', async () => {
    const app = await buildApp();

    await app.inject({ method: 'GET', url: '/saves/save1/recolectar/minero-llanuras' });

    expect(detectNpcsInScene).not.toHaveBeenCalled();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/nope/recolectar/minero-llanuras' });

    expect(res.statusCode).toBe(404);
  });

  // Filtro por terreno de la zona (petición explícita, 2026-08-14: "en una misma zona me sale
  // todo esto al recolectar... en zonas aridas no deberia haber muchas plantas") — Roca de Los
  // Pilares Rotos está catalogada de afinidad 'rocoso' (worldCatalog.ts § harvestSourceTerrainTag).
  // Se comprueba vía /explorar (no GET): GET exige que la fuente ya esté "localizada" en hechos de
  // sesión, un filtro aparte que no es el que se está probando aquí — /explorar devuelve
  // `candidateSourcesFor` directamente, sin esa capa extra.
  it('en una zona húmeda catalogada, una fuente de minería con afinidad rocoso queda fuera al explorar', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc-pozo',
      currentLocation: { region: 'Las Llanuras del Viento Rojo', slug: 'pozo-cauce-viejo' },
    });
    findManyHarvestYield.mockResolvedValue([
      { sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', item: { slug: 'piedra', name: 'Piedra' }, cantidad: 3 },
    ]);
    findManyWorldPopulation.mockResolvedValue([
      { targetSlug: 'roca-pilares-rotos', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

    expect(JSON.parse(res.body).sources).toEqual([]);
  });

  it('en una zona árida/rocosa catalogada, esa misma fuente de minería sí aparece al explorar', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc-agujas',
      currentLocation: { region: 'Las Llanuras del Viento Rojo', slug: 'agujas-iman' },
      attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
      secondaryAttributes: { suerte: 0 },
      inventoryItems: [],
      professionProgress: [],
    });
    findManyHarvestYield.mockResolvedValue([
      { sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', item: { slug: 'piedra', name: 'Piedra' }, cantidad: 3 },
    ]);
    findManyWorldPopulation.mockResolvedValue([
      { targetSlug: 'roca-pilares-rotos', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

    expect(JSON.parse(res.body).sources).toHaveLength(1);
  });

  // Tirada visible (rediseño de recolección, 2026-08-22, petición explícita: "para los recursos
  // que obtenemos por región cuando exploras, hay que añadirle una tirada visual con dado").
  describe('tirada de rollGathering en /explorar', () => {
    it('el resultado de la tirada viaja en la respuesta, no solo los sources', async () => {
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [],
      });
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', item: { slug: 'piedra', name: 'Piedra', tier: 1 }, cantidad: 3 },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'roca-pilares-rotos', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

      const body = JSON.parse(res.body);
      expect(body.roll.attribute).toBe('fuerza');
      expect(body.roll.result).toBeGreaterThanOrEqual(1);
      expect(typeof body.roll.advantage).toBe('boolean');
    });

    it('un recurso con dificultad inalcanzable ni con el mejor d20 posible no aparece (fallo)', async () => {
      // fuerza 0 + bonusOficio 0 + mejor d20 (20) = 20, dificultad = 10+tier(20) = 30 — nunca llega,
      // determinista sin necesidad de mockear Math.random.
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 0, destreza: 0, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [],
      });
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', item: { slug: 'piedra', name: 'Piedra', tier: 20 }, cantidad: 3 },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'roca-pilares-rotos', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

      const body = JSON.parse(res.body);
      expect(body.sources).toEqual([]);
      expect(body.roll.result).toBeLessThan(30);
    });

    // sinTirada (2026-08-23, Grupo 3 § HarvestYield.condicion) — mismo montaje que el test de
    // arriba (fuerza 0 + tier 20 = fallo garantizado con cualquier d20), pero con sinTirada:true
    // el yield debe aparecer igualmente, sin comparar contra la dificultad.
    it('un yield con sinTirada:true aparece siempre, aunque la dificultad sea inalcanzable', async () => {
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 0, destreza: 0, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [],
      });
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'salvia-del-polvo', sourceCategory: 'planta', item: { slug: 'manojo-salvia-polvo', name: 'Manojo de salvia del polvo', tier: 20 }, cantidad: 1, sinTirada: true },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'salvia-del-polvo', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/herborista-llanuras/explorar' });

      const body = JSON.parse(res.body);
      expect(body.sources).not.toEqual([]);
      expect(body.sources[0].yields[0].cantidadMaxima).toBe(1);
    });

    // Gate de estación (2026-08-24, Grupo 3 § Sistema de estaciones, ver
    // docs/rpgtarkor/estaciones.md) — filtra ANTES de la tirada, distinto de sinTirada: fuera de
    // su estación, el recurso ni siquiera cuenta como candidato.
    it('un yield con estacionRequerida distinta a la actual no aparece, aunque la tirada sea buena', async () => {
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [],
        worldState: { fictionalMinutes: 0 }, // Día 1 = Ur'gathek (Primavera)
      });
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'boungo', sourceCategory: 'planta', item: { slug: 'boungo', name: 'Boungo', tier: 1 }, cantidad: 3, estacionRequerida: 'OTONO' },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'boungo', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/herborista-llanuras/explorar' });

      expect(JSON.parse(res.body).sources).toEqual([]);
    });

    it('un yield con estacionRequerida que coincide con la actual sí aparece', async () => {
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        // herborista tira por Voluntad, no Fuerza (attributeForOficio) — con 20 aquí, el peor d20
        // posible (1) da 1+10+0 = 11, igual a la dificultad (10+tier(1)), éxito garantizado.
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 20, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [],
        worldState: { fictionalMinutes: 1440 * 60 }, // Día 61 = Vungrat (Otoño)
      });
      // P1.1 (checklist consolidado 2026-08-27): 'boungo' tiene harvestSourceHomeLocationSlug real
      // en worldCatalog.ts desde que ese campo se generalizó a MINERIA/TALA/EXTRACCION — este test
      // prueba el gate de ESTACIÓN, no el de ubicación, así que se usa un slug inventado sin
      // entrada real en el catálogo (el fixture es 100% mockeado, no depende de datos reales) para
      // no acoplar un test de estación a un detalle de anclaje irrelevante aquí.
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'planta-test-estacion', sourceCategory: 'planta', item: { slug: 'planta-test-estacion', name: 'Planta de prueba', tier: 1 }, cantidad: 3, estacionRequerida: 'OTONO' },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'planta-test-estacion', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/herborista-llanuras/explorar' });

      expect(JSON.parse(res.body).sources).not.toEqual([]);
    });

    // Gate de clima (2026-08-24, Grupo 3 § Eventos de clima puntuales, ver
    // docs/rpgtarkor/clima-tormentas.md) — umbral de severidad MÍNIMA, distinto de estación
    // (igualdad exacta): filtra ANTES de la tirada, mismo punto que el gate de estación.
    it('un yield con climaRequerido por encima del clima actual no aparece', async () => {
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [],
        worldState: { fictionalMinutes: 1440 * 1 }, // Día 2 = Sek'tar (Viento Fuerte)
      });
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'arena-iman', sourceCategory: 'mineral', item: { slug: 'punado-arena-iman', name: 'Puñado de arena imán', tier: 1 }, cantidad: 1, climaRequerido: 'TORMENTA_GRANDE' },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'arena-iman', poblacion: 500, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

      expect(JSON.parse(res.body).sources).toEqual([]);
    });

    it('con un clima igual o por encima del requerido sí aparece (umbral "al menos", no igualdad exacta)', async () => {
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [],
        worldState: { fictionalMinutes: 1440 * 9 }, // Día 10 = Rok'ithek (Tormenta Extrema), por encima de Tormenta Grande
      });
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'arena-iman', sourceCategory: 'mineral', item: { slug: 'punado-arena-iman', name: 'Puñado de arena imán', tier: 1 }, cantidad: 1, climaRequerido: 'TORMENTA_GRANDE' },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'arena-iman', poblacion: 500, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

      expect(JSON.parse(res.body).sources).not.toEqual([]);
    });

    it('el nivel del oficio (alivioForLevel) llega correctamente al roll de la respuesta', async () => {
      // fuerza 20 garantiza éxito con el peor d20 posible (ver comentario del beforeEach); lo que
      // se comprueba aquí es que el nivel 5 de professionProgress (alivioForLevel = 4) se plumbea
      // de verdad hasta `roll.bonusOficio` — la aritmética exacta de la suma ya la cubre
      // dice.test.ts § rollGathering sin depender de una petición HTTP completa.
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [{ professionId: 'minero-llanuras', nivel: 5 }],
      });
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', item: { slug: 'piedra', name: 'Piedra', tier: 1 }, cantidad: 3 },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'roca-pilares-rotos', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

      const body = JSON.parse(res.body);
      expect(body.roll.bonusOficio).toBe(4);
      expect(body.sources).toHaveLength(1);
    });

    it('Suerte por encima del umbral tira con ventaja (dos d20 en la respuesta)', async () => {
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 12 },
        inventoryItems: [],
        professionProgress: [],
      });
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', item: { slug: 'piedra', name: 'Piedra', tier: 1 }, cantidad: 3 },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'roca-pilares-rotos', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

      const body = JSON.parse(res.body);
      expect(body.roll.advantage).toBe(true);
      expect(body.roll.rolls).toHaveLength(2);
    });

    // Tirada congelada (petición explícita, 2026-08-22: "para poder ver algo siempre deberías
    // pasar por esta tirada... al menos una vez y ya se guarda") — /explorar persiste el resultado
    // YA recortado en Save.harvestRollCache, para que reabrir el panel no ofrezca una oportunidad
    // gratis de volver a tirar por un resultado mejor.
    it('congela el resultado en Save.harvestRollCache tras explorar, con la cantidad ya recortada', async () => {
      // d20 al máximo (20) — grado 'claro' garantizado (resultado 30 vs dificultad 11), para que
      // `cantidadMaxima` sea determinista (completa, no la mitad de un 'con_coste').
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', item: { slug: 'piedra', name: 'Piedra', tier: 1 }, cantidad: 3 },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'roca-pilares-rotos', poblacion: 40, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      const app = await buildApp();

      await app.inject({ method: 'POST', url: '/saves/save1/recolectar/minero-llanuras/explorar' });

      expect(updateSave).toHaveBeenCalledWith({
        where: { id: 'save1' },
        data: {
          harvestRollCache: {
            'minero-llanuras': {
              locationId: 'loc1',
              sources: [
                {
                  sourceSlug: 'roca-pilares-rotos',
                  sourceCategory: 'mineral',
                  disponible: 40,
                  yields: [{ itemSlug: 'piedra', itemName: 'Piedra', cantidadMaxima: 3, tier: 1, sinTirada: undefined }],
                },
              ],
            },
          },
        },
      });
      vi.restoreAllMocks();
    });

    // Bug real jugando en vivo (2026-08-25/26, "profesiones que me deja usarlas varias veces y
    // repite las tiradas mostrando items diferentes"): antes de este fix, `harvestRollCache` era un
    // único slot por partida — explorar un SEGUNDO oficio pisaba entero el JSON, borrando la tirada
    // ya congelada del primero sin avisar. Ahora es un mapa `oficio → entrada`: explorar Talador no
    // debe tocar la entrada ya guardada de Minero.
    it('explorar un oficio no invalida la caché ya congelada de otro oficio distinto', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // P1.1 (checklist consolidado 2026-08-27): 'lucre-blanco' tiene harvestSourceHomeLocationSlug
      // real ('pilares-rotos') en worldCatalog.ts — este test no prueba anclaje de ubicación, así
      // que se usa un slug inventado sin entrada real en el catálogo.
      findManyHarvestYield.mockResolvedValue([
        { sourceSlug: 'madera-test-cache', sourceCategory: 'madera', item: { slug: 'madera-test-cache', name: 'Madera de prueba', tier: 1 }, cantidad: 2 },
      ]);
      findManyWorldPopulation.mockResolvedValue([
        { targetSlug: 'madera-test-cache', poblacion: 20, distribucion: { 'Llanuras del Viento Rojo': 1 }, lastHarvestedAt: null, lastHarvestedLocationId: null },
      ]);
      // Simula que Minero ya se exploró antes y su tirada quedó congelada — el `save` que carga
      // ESTA petición (Talador) ya trae esa entrada previa en `harvestRollCache`, tal y como la
      // dejaría persistida la petición anterior.
      findUniqueSave.mockResolvedValue({
        id: 'save1',
        worldId: 'world1',
        currentLocationId: 'loc1',
        currentLocation: { region: 'Las Llanuras del Viento Rojo' },
        attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        secondaryAttributes: { suerte: 0 },
        inventoryItems: [],
        professionProgress: [],
        harvestRollCache: {
          'minero-llanuras': { locationId: 'loc1', sources: [{ sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', disponible: 40, yields: [{ itemSlug: 'piedra', itemName: 'Piedra', cantidadMaxima: 3, tier: 1 }] }] },
        },
      });
      const app = await buildApp();

      await app.inject({ method: 'POST', url: '/saves/save1/recolectar/talador-llanuras/explorar' });

      const lastCall = updateSave.mock.calls.at(-1)?.[0];
      expect(Object.keys(lastCall.data.harvestRollCache)).toEqual(['minero-llanuras', 'talador-llanuras']);
      expect(lastCall.data.harvestRollCache['minero-llanuras'].sources[0].sourceSlug).toBe('roca-pilares-rotos');
      vi.restoreAllMocks();
    });
  });

  // Tirada congelada, lado de lectura (mismo rediseño de arriba) — un GET con caché válida para
  // este oficio/ubicación devuelve la foto ya tirada SIN volver a consultar `HarvestYield`/
  // `WorldPopulation`: reabrir el panel no debe poder re-tirar.
  it('GET con caché válida devuelve la foto ya tirada sin recalcular candidatos ni tirar de nuevo', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc1',
      currentLocation: { region: 'Las Llanuras del Viento Rojo' },
      attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
      secondaryAttributes: { suerte: 0 },
      inventoryItems: [],
      professionProgress: [],
      harvestRollCache: {
        'minero-llanuras': {
          locationId: 'loc1',
          sources: [{ sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', disponible: 40, yields: [{ itemSlug: 'piedra', itemName: 'Piedra', cantidadMaxima: 2, tier: 1 }] }],
        },
      },
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/minero-llanuras' });

    const body = JSON.parse(res.body);
    expect(body.puedeExplorar).toBe(false);
    expect(body.sources).toEqual([
      { sourceCategory: 'mineral', sourceCategoryName: 'Mineral', yields: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', itemName: 'Piedra', cantidadMaxima: 2, disponible: 40 }] },
    ]);
    // Ni se consultó la fuente de verdad ni se escribió una tirada nueva — se sirvió la caché tal cual.
    expect(findManyHarvestYield).not.toHaveBeenCalled();
    expect(findManyWorldPopulation).not.toHaveBeenCalled();
    expect(updateSave).not.toHaveBeenCalled();
  });

  // Caché de una UBICACIÓN/oficio distintos no debe filtrarse a otro — mismo criterio location-
  // aware que ya usa el cooldown real de `candidateSourcesFor`.
  it('la caché de otra ubicación no se reutiliza — se recalcula desde cero', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc2',
      currentLocation: { region: 'Las Llanuras del Viento Rojo' },
      attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
      secondaryAttributes: { suerte: 0 },
      inventoryItems: [],
      professionProgress: [],
      harvestRollCache: { 'minero-llanuras': { locationId: 'loc1', sources: [{ sourceSlug: 'x', sourceCategory: 'mineral', disponible: 1, yields: [] }] } },
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/minero-llanuras' });

    const body = JSON.parse(res.body);
    expect(body.sources).toEqual([]);
    expect(body.puedeExplorar).toBe(false); // sin candidatos reales (mocks a vacío por defecto)
    expect(findManyHarvestYield).toHaveBeenCalled();
  });

  // Agrupado automático por categoría (2026-08-15, petición explícita: "que sea automático, lo que
  // meta en el enum y lo que linke en el item... que aparezcan los items categorizados en el front
  // bajo esa categoría nueva") — dos sourceSlug DISTINTOS que comparten sourceCategory salen bajo
  // una sola tarjeta, cada yield conservando su propio sourceSlug/disponible para poder
  // seleccionarlo y consumirlo correctamente después. "Ya localizado" ahora es "ya tirado, en
  // caché" (rediseño de recolección, 2026-08-22) — ya no depende de `loadSessionFacts`, se
  // comprueba directamente mockeando `Save.harvestRollCache`.
  it('agrupa automáticamente dos fuentes distintas de la misma categoría bajo una sola tarjeta', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc1',
      currentLocation: { region: 'Las Llanuras del Viento Rojo' },
      attributes: { fuerza: 20, destreza: 20, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
      secondaryAttributes: { suerte: 0 },
      inventoryItems: [],
      professionProgress: [],
      harvestRollCache: {
        'minero-llanuras': {
          locationId: 'loc1',
          sources: [
            { sourceSlug: 'roca-pilares-rotos', sourceCategory: 'mineral', disponible: 40, yields: [{ itemSlug: 'piedra', itemName: 'Piedra', cantidadMaxima: 3, tier: null }] },
            {
              sourceSlug: 'veta-hierro-pilares-rotos',
              sourceCategory: 'mineral',
              disponible: 10,
              yields: [{ itemSlug: 'mena-de-hierro', itemName: 'Mena de hierro', cantidadMaxima: 2, tier: null }],
            },
          ],
        },
      },
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/minero-llanuras' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).sources).toEqual([
      {
        sourceCategory: 'mineral',
        sourceCategoryName: 'Mineral',
        yields: [
          { sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', itemName: 'Piedra', cantidadMaxima: 3, disponible: 40 },
          { sourceSlug: 'veta-hierro-pilares-rotos', itemSlug: 'mena-de-hierro', itemName: 'Mena de hierro', cantidadMaxima: 2, disponible: 10 },
        ],
      },
    ]);
  });
});
