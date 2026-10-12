import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-21): estos tres endpoints (paneles
/// "Volver al campamento"/"Viajar"/"Saquear", 2026-08-17) nunca tuvieron ningún test pese a tener
/// lógica real no trivial — filtrado por `scope` (bug real ya documentado en el propio panels.ts:
/// un PRINCIPAL siempre tiene `scope: ''`), revelado de destinos por posesión del "Mapa de las
/// Llanuras", y cálculo de tiempo de viaje real por el mismo grafo que usa `resolveTravel`. Los
/// servicios que usan (npcScene.ts, travel.ts) se dejan SIN mockear a propósito — solo se mockea
/// Prisma — para que el test también verifique la integración real con `scopeFor`/`hasPendingLoot`/
/// `buildAdjacency`/`shortestPath`, no solo que panels.ts los llame.
const findUniqueSave = vi.fn();
const findManyBuilding = vi.fn();
const findManyItemCatalog = vi.fn();
const findManyLocationVisit = vi.fn();
const findManyLocation = vi.fn();
const findManyLocationLink = vi.fn();
const findManyNpcState = vi.fn();
const findManyNpc = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    building: { findMany: (...args: unknown[]) => findManyBuilding(...args) },
    itemCatalog: { findMany: (...args: unknown[]) => findManyItemCatalog(...args) },
    locationVisit: { findMany: (...args: unknown[]) => findManyLocationVisit(...args) },
    location: { findMany: (...args: unknown[]) => findManyLocation(...args) },
    locationLink: { findMany: (...args: unknown[]) => findManyLocationLink(...args) },
    npcState: { findMany: (...args: unknown[]) => findManyNpcState(...args) },
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
  },
}));

const { panelsRoutes } = await import('./panels.js');

async function buildApp() {
  const app = Fastify();
  await app.register(panelsRoutes);
  return app;
}

beforeEach(() => {
  findUniqueSave.mockReset();
  findManyBuilding.mockReset();
  findManyItemCatalog.mockReset().mockResolvedValue([]);
  findManyLocationVisit.mockReset().mockResolvedValue([]);
  findManyLocation.mockReset().mockResolvedValue([]);
  findManyLocationLink.mockReset().mockResolvedValue([]);
  findManyNpcState.mockReset().mockResolvedValue([]);
  findManyNpc.mockReset().mockResolvedValue([]);
});

describe('GET /saves/:id/campamentos', () => {
  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/campamentos' });
    expect(res.statusCode).toBe(404);
  });

  it('solo lista campamentos con Location real, descarta los que no la tienen', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1' });
    findManyBuilding.mockResolvedValue([
      { location: { slug: 'hondonada', name: 'La Hondonada del Eco', region: 'Las Llanuras del Viento Rojo' } },
      { location: null },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/campamentos' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      camps: [{ locationSlug: 'hondonada', locationName: 'La Hondonada del Eco', region: 'Las Llanuras del Viento Rojo' }],
    });
    // Filtro real de la query — solo ACTIVO/campamento/con locationId (deuda técnica: verificar
    // que el `where` no se rompe silenciosamente en un refactor futuro).
    expect(findManyBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ where: { saveId: 'save1', recipeKey: 'campamento', status: 'ACTIVO', locationId: { not: null } } }),
    );
  });
});

describe('GET /saves/:id/destinos-viaje', () => {
  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/destinos-viaje' });
    expect(res.statusCode).toBe(404);
  });

  it('sin el mapa de las Llanuras, solo lista destinos ya visitados (excluyendo la ubicación actual)', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc-actual',
      attributes: { destreza: 10 },
      inventoryItems: [],
    });
    findManyLocationVisit.mockResolvedValue([
      { location: { id: 'loc-actual', slug: 'actual', name: 'Actual', region: 'R' } },
      { location: { id: 'loc-b', slug: 'b', name: 'B', region: 'R' } },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/destinos-viaje' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.hasMap).toBe(false);
    expect(body.destinations.map((d: { locationSlug: string }) => d.locationSlug)).toEqual(['b']);
  });

  // P45 (QA-27): un interior se alcanza por su exterior, no como destino de viaje propio.
  it('no lista interiores (ni visitados ni del mapa)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', worldId: 'world1', currentLocationId: 'loc-actual', attributes: { destreza: 10 }, inventoryItems: [{ catalogSlug: 'mapa-llanuras' }] });
    findManyItemCatalog.mockResolvedValue([{ effectKey: 'reveal-map-llanuras' }]);
    findManyLocationVisit.mockResolvedValue([
      { location: { id: 'loc-ketg', slug: 'ketg-lukar', name: "Hogar Ketg - Ketg'lukar", region: 'Las Llanuras del Viento Rojo', kind: 'interior' } },
      { location: { id: 'loc-b', slug: 'b', name: 'B', region: 'Las Llanuras del Viento Rojo', kind: 'hito' } },
    ]);
    findManyLocation.mockResolvedValue([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/destinos-viaje' });
    expect(JSON.parse(res.body).destinations.map((d: { locationSlug: string }) => d.locationSlug)).toEqual(['b']);
    expect(findManyLocation).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ kind: { not: 'interior' } }) }));
  });

  it('con el mapa de las Llanuras (effectKey reveal-map-llanuras), añade TODAS las ubicaciones de esa región', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc-actual',
      attributes: { destreza: 10 },
      inventoryItems: [{ catalogSlug: 'mapa-llanuras' }],
    });
    findManyItemCatalog.mockResolvedValue([{ effectKey: 'reveal-map-llanuras' }]);
    findManyLocationVisit.mockResolvedValue([]);
    findManyLocation.mockResolvedValue([
      { id: 'loc-actual', slug: 'actual', name: 'Actual', region: 'Las Llanuras del Viento Rojo' },
      { id: 'loc-c', slug: 'c', name: 'C', region: 'Las Llanuras del Viento Rojo' },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/destinos-viaje' });

    const body = JSON.parse(res.body);
    expect(body.hasMap).toBe(true);
    // La propia ubicación actual nunca aparece como destino de sí misma.
    expect(body.destinations.map((d: { locationSlug: string }) => d.locationSlug)).toEqual(['c']);
  });

  // QA-27 (P43/P44, 2026-10-09, jugando): el mapa ofrecía «Hogar de Maktor», el interior de la
  // Capital de otra partida.
  it('con el mapa, solo pide los lugares de esta partida (los interiores de otras se colaban)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', worldId: 'world1', currentLocationId: 'loc-actual', attributes: { destreza: 10 }, inventoryItems: [{ catalogSlug: 'mapa-llanuras' }] });
    findManyItemCatalog.mockResolvedValue([{ effectKey: 'reveal-map-llanuras' }]);
    findManyLocationVisit.mockResolvedValue([]);
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/saves/save1/destinos-viaje' });
    expect(findManyLocation).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: [{ saveId: null }, { saveId: 'save1' }] }) }));
  });

  it('calcula el tiempo real por el grafo (mismo criterio que resolveTravel) para un destino conectado, y null si no hay camino', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      currentLocationId: 'loc-a',
      attributes: { destreza: 0 },
      inventoryItems: [],
    });
    findManyLocationVisit.mockResolvedValue([
      { location: { id: 'loc-b', slug: 'b', name: 'B', region: 'R' } },
      { location: { id: 'loc-aislada', slug: 'aislada', name: 'Aislada', region: 'R' } },
    ]);
    findManyLocationLink.mockResolvedValue([{ fromId: 'loc-a', toId: 'loc-b', minutosBase: 60 }]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/destinos-viaje' });

    const body = JSON.parse(res.body);
    const byId = new Map(body.destinations.map((d: { locationSlug: string; minutos: number | null; banda: string | null }) => [d.locationSlug, d]));
    // destreza 0 → minutosConDestreza no reduce el tiempo base. bandaForMinutos(60) → 'corta'
    // (2026-09-04: el límite superior de cada banda es inclusivo, `<=`, no `<`).
    expect(byId.get('b')).toMatchObject({ minutos: 60, banda: 'corta' });
    // Sin ningún LocationLink que la conecte, se lista igual pero sin tiempo (nunca se oculta).
    expect(byId.get('aislada')).toMatchObject({ minutos: null, banda: null });
  });
});

describe('GET /saves/:id/saquear-zona', () => {
  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/saquear-zona' });
    expect(res.statusCode).toBe(404);
  });

  it('sin ubicación actual, no hay candidatos (nada que barrer)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', worldId: 'world1', currentLocationId: null });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1/saquear-zona' });
    expect(JSON.parse(res.body)).toEqual({ candidates: [] });
    expect(findManyNpcState).not.toHaveBeenCalled();
  });

  it('filtra por scope real (bug histórico: un PRINCIPAL siempre tiene scope vacío, uno normal solo si coincide con la ubicación actual)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', worldId: 'world1', currentLocationId: 'loc-a' });
    findManyNpcState.mockResolvedValue([
      // PRINCIPAL: scope real siempre '' (scopeFor ignora currentLocationId para PRINCIPAL).
      { npcId: 'npc-principal', scope: '', condicionFisica: 'MUERTO', saqueado: false, groupSize: null, groupDefeated: 0, corpsesLooted: 0 },
      // NPC normal en la ubicación ACTUAL: scope coincide, debe entrar. MUERTO (2026-08-26,
      // CONVALECIENTE deja de ser saqueable) — el mock no aplica el `where` real de Prisma, pero
      // la fixture debe seguir siendo honesta sobre qué es saqueable de verdad.
      { npcId: 'npc-aqui', scope: 'loc-a', condicionFisica: 'MUERTO', saqueado: false, groupSize: null, groupDefeated: 0, corpsesLooted: 0 },
      // NPC normal en OTRA ubicación: scope no coincide, debe quedar fuera.
      { npcId: 'npc-alli', scope: 'loc-b', condicionFisica: 'MUERTO', saqueado: false, groupSize: null, groupDefeated: 0, corpsesLooted: 0 },
      // Ya saqueado del todo: sin loot pendiente, debe quedar fuera aunque el scope coincida.
      { npcId: 'npc-vacio', scope: 'loc-a', condicionFisica: 'MUERTO', saqueado: true, groupSize: null, groupDefeated: 0, corpsesLooted: 0 },
    ]);
    findManyNpc.mockResolvedValue([
      { id: 'npc-principal', slug: 'principal', kind: 'PRINCIPAL', name: 'El Jefe', items: [] },
      { id: 'npc-aqui', slug: 'aqui', kind: 'NORMAL', name: 'Aquí', items: [] },
      { id: 'npc-alli', slug: 'alli', kind: 'NORMAL', name: 'Allí', items: [] },
      { id: 'npc-vacio', slug: 'vacio', kind: 'NORMAL', name: 'Vacío', items: [] },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/saquear-zona' });

    const body = JSON.parse(res.body);
    const slugs = body.candidates.map((c: { slug: string }) => c.slug).sort();
    expect(slugs).toEqual(['aqui', 'principal']);
  });
});
