import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Grupo 3 § Mundo determinista, Capa 1 (2026-08-25) — prototipo de zonas navegables. Solo Prisma
// mockeado (mismo criterio que panels.test.ts) — `zoneMapImageUrl`/`sourceDisplayNameFor` se dejan
// sin mockear a propósito para probar la integración real con el filesystem/catálogo.
const findUniqueSave = vi.fn();
const findManyNpc = vi.fn();
// Punto del jugador en el mapa de Zona (2026-09-04) — `NpcState.findMany` resuelve posiciones ya
// asignadas/estado de ausencia; `upsert` asigna posición nueva a un dinámico visto por primera
// vez. Vacío por defecto: la mayoría de tests de este archivo no tocan NPC dinámicos con estado.
const findManyNpcState = vi.fn();
const upsertNpcState = vi.fn();
const updateNpcState = vi.fn();
// "Tirar" objetos al suelo de la Zona (2026-09-06) — vacío por defecto: la mayoría de tests de este
// archivo no tocan objetos tirados.
const findManyDroppedItem = vi.fn();
// Hallazgo 34 (revisar-partida-hallazgos.md 2026-09-07) — por defecto, los 4 slugs de
// entidad-en-mapa que ya usaban los tests preexistentes de este archivo (gesgurio/kirelon-arenoso/
// yerreo/gistera-koh) se simulan YA descubiertos, para no tener que tocar sus aserciones de
// `nombre` una a una — solo el describe nuevo de este hallazgo sobreescribe esto explícitamente
// para simular el caso "todavía sin descubrir".
const findManyDiscoveredEntity = vi.fn();
const DISCOVERED_BY_DEFAULT = [
  { entityType: 'fauna', entitySlug: 'kirelon-arenoso' },
  { entityType: 'fauna', entitySlug: 'gesgurio' },
  { entityType: 'flora', entitySlug: 'yerreo' },
  { entityType: 'npc', entitySlug: 'gistera-koh' },
];
// Gate de aparición narrativa (2026-09-09, Orco Enfurecido/Gistera Koh, ver zonePoints.ts §
// `questSlugsAceptadosPara`) — vacío por defecto (ninguna Quest aceptada todavía): no afecta a
// ningún test preexistente de este archivo, que no usa esos 2 slugs concretos como ZonePoint.
const findManyQuest = vi.fn();
// Iconos de salida de región (2026-09-17) — vacío por defecto: la mayoría de tests de este archivo
// no tocan Locations conectadas por LocationLink.
const findManyLocationLink = vi.fn();
const findManyLocationVisit = vi.fn();
// Iconos de parcela (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — vacío por defecto: la
// mayoría de tests de este archivo no prueban zonas-interior con Parcela sembrada.
const findManyParcela = vi.fn();
// Cadáveres en el mapa (Fase 5, 2026-09-28) — sin despiece de catálogo por defecto.
const findManyHarvestYield = vi.fn().mockResolvedValue([]);

// Fase 5 (B1): `zona.ts` lee los `ZonePoint` de la partida con `zonePoint.findMany` — el mock los
// sigue sacando de `currentLocation.zonePoints` del último `save` devuelto por `findUnique`.
let ultimaPartidaMock: { currentLocation?: { zonePoints?: unknown[] } | null } | null = null;
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    // Candado de clonado de ZonePoint por partida (B1) — `pg_advisory_xact_lock`, sin efecto aquí.
    $executeRaw: () => Promise.resolve(0),
    save: {
      findUnique: async (...args: unknown[]) => {
        const r = await findUniqueSave(...args);
        ultimaPartidaMock = r;
        return r;
      },
    },
    zonePoint: {
      findMany: async () => ultimaPartidaMock?.currentLocation?.zonePoints ?? [],
      createMany: async () => ({ count: 0 }),
    },
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    npcState: {
      findMany: (...args: unknown[]) => findManyNpcState(...args),
      upsert: (...args: unknown[]) => upsertNpcState(...args),
      update: (...args: unknown[]) => updateNpcState(...args),
    },
    droppedItem: { findMany: (...args: unknown[]) => findManyDroppedItem(...args) },
    discoveredEntity: { findMany: (...args: unknown[]) => findManyDiscoveredEntity(...args) },
    quest: { findMany: (...args: unknown[]) => findManyQuest(...args) },
    locationLink: { findMany: (...args: unknown[]) => findManyLocationLink(...args) },
    locationVisit: { findMany: (...args: unknown[]) => findManyLocationVisit(...args) },
    parcela: { findMany: (...args: unknown[]) => findManyParcela(...args) },
    harvestYield: { findMany: (...args: unknown[]) => findManyHarvestYield(...args) },
  },
}));

// NPCs presentados de forma determinista (2026-08-26, "no aparecen en la zona y sí tienen que
// salir") — mismo mecanismo que `npcsInScene` en cada turno, mockeado aparte (no es lo que este
// archivo prueba, `detectNpcsInScene`/`loadSessionFacts` ya tienen su propia cobertura).
const detectNpcsInSceneMock = vi.fn();
const loadSessionFactsMock = vi.fn();
vi.mock('../../services/npcScene.js', () => ({
  detectNpcsInScene: (...args: unknown[]) => detectNpcsInSceneMock(...args),
  // Punto del jugador en el mapa de Zona (2026-09-04) — `zona.ts` usa `scopeFor` real (pura, sin
  // Prisma) para las claves de `NpcState`; misma implementación real, no mockeada.
  scopeFor: (kind: string, currentLocationId: string | null) => (kind === 'PRINCIPAL' ? '' : (currentLocationId ?? 'itinerante')),
  // Cadáveres en el mapa (Fase 5, 2026-09-28) — misma implementación real (pura).
  hasPendingLoot: (st: { groupSize: number | null; groupDefeated: number; corpsesLooted: number; saqueado: boolean } | null | undefined) =>
    !!st && (st.groupSize ? st.corpsesLooted < st.groupDefeated : !st.saqueado),
}));
vi.mock('../../services/worldFacts.js', () => ({
  loadSessionFacts: (...args: unknown[]) => loadSessionFactsMock(...args),
}));

// Hallazgo 32 (revisar-partida-hallazgos.md 2026-09-07) — solo para el describe de estación en
// interiores: a diferencia del resto del archivo (que deja `imageAssets.js` sin mockear, contra el
// filesystem real), aquí hace falta inspeccionar CON QUÉ `estacion` se llamó `zoneMapImageUrl`
// (`null` esperado para interiores), algo que el filesystem real no puede confirmar sin depender
// de qué imágenes haya subidas en este entorno concreto.
const zoneMapImageUrlMock = vi.fn().mockReturnValue(null);
vi.mock('../../lib/imageAssets.js', () => ({
  zoneMapImageUrl: (...args: unknown[]) => zoneMapImageUrlMock(...args),
}));

const { zonaRoutes } = await import('./zona.js');

async function buildApp() {
  const app = Fastify();
  await app.register(zonaRoutes);
  return app;
}

beforeEach(() => {
  findManyNpcState.mockReset().mockResolvedValue([]);
  upsertNpcState.mockReset().mockResolvedValue({});
  findManyDroppedItem.mockReset().mockResolvedValue([]);
  zoneMapImageUrlMock.mockReset().mockReturnValue(null);
  findManyDiscoveredEntity.mockReset().mockResolvedValue(DISCOVERED_BY_DEFAULT);
  findManyQuest.mockReset().mockResolvedValue([]);
  findManyLocationLink.mockReset().mockResolvedValue([]);
  findManyLocationVisit.mockReset().mockResolvedValue([]);
  findManyParcela.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /saves/:id/zona', () => {
  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValueOnce(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/x/zona' });
    expect(res.statusCode).toBe(404);
  });

  it('sin currentLocation: no disponible', async () => {
    findUniqueSave.mockResolvedValueOnce({ id: 's1', worldId: 'w1', currentLocation: null, zonaPosX: null, zonaPosY: null });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    expect(res.json()).toEqual({ disponible: false, puntos: [], dinamicos: [], jugador: null, salidas: [], parcelas: [] });
  });

  it('con Location pero sin ZonePoint sembrado y sin NPC dinámico: no disponible', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1', worldId: 'w1',
      currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', zonePoints: [] },
    });
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.disponible).toBe(false);
    expect(body.puntos).toEqual([]);
    expect(body.dinamicos).toEqual([]);
  });

  it('sin ZonePoint sembrado pero CON un NPC dinámico en escena: sí disponible, con posición asignada', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
      currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', zonePoints: [] },
    });
    loadSessionFactsMock.mockResolvedValueOnce(['Gistera Koh anda cerca, perseguida.']);
    detectNpcsInSceneMock.mockResolvedValueOnce([
      { id: 'npc-gistera', slug: 'gistera-koh', name: 'Gistera Koh', kind: 'PRINCIPAL', condicionFisica: 'ILESO', faction: null },
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.disponible).toBe(true);
    expect(body.puntos).toEqual([]);
    expect(body.dinamicos).toEqual([
      { slug: 'gistera-koh', nombre: 'Gistera Koh', tipo: 'NPC', color: 'SIN_FACCION', x: expect.any(Number), y: expect.any(Number), descubierto: true },
    ]);
    // Asignación perezosa (2026-09-04) — primera vez que se ve, se persiste su posición nueva.
    expect(upsertNpcState).toHaveBeenCalledWith(expect.objectContaining({ where: { saveId_npcId_scope: { saveId: 's1', npcId: 'npc-gistera', scope: '' } } }));
  });

  it('con ZonePoints reales: resuelve nombres de FAUNA/RECURSO y devuelve posiciones', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: {
        id: 'loc1',
        slug: 'hondonada-del-eco',
        name: 'La Hondonada del Eco',
        zonePoints: [
          { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null, lastUpdatedAtMinutes: 480 },
          { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', label: null, activo: true, cantidad: 1, factionSlug: null },
          { id: 'zp3', x: 100, y: 100, tipo: 'FAUNA', targetSlug: 'gesgurio', label: 'Etiqueta a mano', activo: true, cantidad: 3, factionSlug: null, lastUpdatedAtMinutes: 480 },
        ],
      },
      // Kirelon Arenoso es fauna nocturna (`faunaMomentoDelDia`, worldCatalog.ts) — 1320 = 22h,
      // de noche, para que este test siga cubriendo el caso "sí aparece" tras el fix del
      // hallazgo 31 (2026-09-06, "fauna diurna y nocturna mezclada siendo de día").
      worldState: { fictionalMinutes: 1320, factionsStatus: null, agenda: null },
    });
    findManyNpc.mockResolvedValueOnce([
      { slug: 'kirelon-arenoso', name: 'Kirelon Arenoso' },
      { slug: 'gesgurio', name: 'Gesgurio' },
    ]);
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.disponible).toBe(true);
    expect(body.locationSlug).toBe('hondonada-del-eco');
    // 2026-08-30: ya hay un PNG real subido para hondonada-del-eco (imageAssets.ts lee el
    // filesystem real, sin mockear) — antes se asumía `null` porque el archivo no existía en el
    // entorno de test, pero eso dependía de estado externo, no de la lógica de esta ruta.
    // Comprobamos el patrón esperado en vez de un valor fijo, sea cual sea el estado del archivo.
    expect(body.imageUrl === null || body.imageUrl === '/images/zona/hondonada-del-eco-mapa.png').toBe(true);
    expect(body.puntos).toEqual([
      { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', nombre: 'Kirelon Arenoso', cantidad: 1, color: 'SIN_FACCION', descubierto: true },
      // RECURSO nunca tiene facción por diseño (2026-09-09) — INERTE (gris), no SIN_FACCION
      // (naranja, reservado a NPC/FAUNA/EDIFICIO independientes) — ver zonePointColorFor.
      { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', nombre: expect.any(String), cantidad: 1, color: 'INERTE', descubierto: true },
      { id: 'zp3', x: 100, y: 100, tipo: 'FAUNA', targetSlug: 'gesgurio', nombre: 'Etiqueta a mano', cantidad: 3, color: 'SIN_FACCION', descubierto: true }, // label manda sobre el nombre real
    ]);
    expect(body.dinamicos).toEqual([]);
  });

  it('un ZonePoint de fauna nocturna no se muestra de día (hallazgo 2026-09-06)', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: {
        id: 'loc1',
        slug: 'hondonada-del-eco',
        name: 'La Hondonada del Eco',
        zonePoints: [
          { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null, lastUpdatedAtMinutes: 480 },
          { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', label: null, activo: true, cantidad: 1, factionSlug: null },
        ],
      },
      // 480 = 8h, de día — kirelon-arenoso es fauna nocturna ('noche' en `faunaMomentoDelDia`).
      worldState: { fictionalMinutes: 480, factionsStatus: null, agenda: null },
    });
    findManyNpc.mockResolvedValueOnce([{ slug: 'kirelon-arenoso', name: 'Kirelon Arenoso' }]);
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.puntos).toEqual([
      { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', nombre: expect.any(String), cantidad: 1, color: 'INERTE', descubierto: true },
    ]);
  });

  it('un objeto tirado (DroppedItem) de la Location actual aparece en dinamicos con tipo OBJETO y posición fija (hallazgo 2026-09-06)', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', zonePoints: [] },
    });
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([]);
    findManyDroppedItem.mockResolvedValueOnce([
      { id: 'drop1', saveId: 's1', locationId: 'loc1', x: 250, y: 300, name: 'Cuchillo de hielo sílice', description: 'x', catalogSlug: null, statBonuses: null, createdAt: new Date() },
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.dinamicos).toEqual([
      { slug: 'drop1', nombre: 'Cuchillo de hielo sílice', tipo: 'OBJETO', color: 'INERTE', x: 250, y: 300, droppedItemId: 'drop1', descubierto: true },
    ]);
    expect(findManyDroppedItem).toHaveBeenCalledWith({ where: { saveId: 's1', locationId: 'loc1' } });
  });

  it('un NPC dinámico ya cubierto por un ZonePoint fijo no se duplica en dinamicos', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: {
        id: 'loc1',
        slug: 'hondonada-del-eco',
        name: 'La Hondonada del Eco',
        zonePoints: [{ id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null, lastUpdatedAtMinutes: 480 }],
      },
    });
    findManyNpc.mockResolvedValueOnce([{ id: 'npc-kirelon', slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', kind: 'PLANTILLA' }]);
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([
      { id: 'npc-kirelon', slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', kind: 'PLANTILLA', condicionFisica: 'ILESO', faction: null },
      { id: 'npc-gistera', slug: 'gistera-koh', name: 'Gistera Koh', kind: 'PRINCIPAL', condicionFisica: 'ILESO', faction: null },
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.dinamicos).toEqual([{ slug: 'gistera-koh', nombre: 'Gistera Koh', tipo: 'NPC', color: 'SIN_FACCION', x: expect.any(Number), y: expect.any(Number), descubierto: true }]);
  });

  it('control regional (2026-08-27, Pieza 5): región con dueño de lore expone regionControl, región desconocida da null', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', region: 'Cristal Helado', zonePoints: [] },
      worldState: { fictionalMinutes: 480, factionsStatus: {}, agenda: [] },
    });
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.regionControl).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Clan Helsig' });
  });

  // Tanda OpenCode 2026-09-27/28 (A-02/A-04): El Margen Silencioso deja de ser SIN_DUENO — Keseg
  // Sael y Feg Tusha son sus dos dueñas mecánicas. Las 5 regiones reales de Berig tienen ya alguna
  // facción dueña, así que "sin dueño de lore conocido" solo puede probarse con una región fuera
  // del mapa real (nombre inventado, no una de las 5 regiones jugables).
  it('control regional: región sin dueño de lore conocido devuelve regionControl null', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', region: 'Una Región Que No Existe', zonePoints: [] },
      worldState: { fictionalMinutes: 480, factionsStatus: {}, agenda: [] },
    });
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.regionControl).toBeNull();
  });

  it('control regional: El Margen Silencioso expone su primera dueña (Keseg Sael) de las dos reales', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', region: 'El Margen Silencioso', zonePoints: [] },
      worldState: { fictionalMinutes: 480, factionsStatus: {}, agenda: [] },
    });
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const body = res.json();
    expect(body.regionControl).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Keseg Sael' });
  });

  it('un NPC dinámico MUERTO no aparece', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', zonePoints: [] },
    });
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([
      { slug: 'orco-enfurecido-hondonada', name: 'Orco Enfurecido', kind: 'PLANTILLA', condicionFisica: 'MUERTO' },
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    expect(res.json().dinamicos).toEqual([]);
  });

  // Cadáveres en el mapa (Fase 5, 2026-09-28) — un MUERTO con botín pendiente en esta Location se
  // pinta como `CADAVER`; sin posición, se le asigna una celda libre junto al jugador y se guarda.
  it('un cadáver con botín pendiente aparece como CADAVER junto al jugador, con Desollar si tiene despiece', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1', worldId: 'w1', zonaPosX: 425, zonaPosY: 425,
      currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', zonePoints: [] },
    });
    loadSessionFactsMock.mockResolvedValueOnce([]);
    detectNpcsInSceneMock.mockResolvedValueOnce([]);
    findManyNpcState.mockImplementation(async (args: { where?: { condicionFisica?: string } }) =>
      args?.where?.condicionFisica === 'MUERTO'
        ? [{ id: 'st1', npcId: 'n1', scope: 'loc1', condicionFisica: 'MUERTO', saqueado: false, groupSize: null, groupDefeated: 0, corpsesLooted: 0, zonaPosX: null, zonaPosY: null, zonaLocationId: null }]
        : [],
    );
    findManyNpc.mockImplementation(async (args: { where?: { id?: unknown } }) =>
      args?.where?.id ? [{ id: 'n1', slug: 'ruptidar', name: 'Ruptidar', kind: 'PLANTILLA', ataqueNatural: 'No ataca' }] : [],
    );
    findManyHarvestYield.mockResolvedValueOnce([{ sourceSlug: 'ruptidar' }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
    const cadaver = res.json().dinamicos.find((d: { tipo: string }) => d.tipo === 'CADAVER');
    expect(cadaver).toMatchObject({ nombre: 'Cadáver de Ruptidar', cadaver: { npcSlug: 'ruptidar', saqueable: true, desollable: true } });
    // Nunca en la misma celda que el jugador (425,425), pero pegado a él.
    expect(cadaver.x === 425 && cadaver.y === 425).toBe(false);
    expect(Math.abs(cadaver.x - 425)).toBeLessThanOrEqual(50);
    expect(Math.abs(cadaver.y - 425)).toBeLessThanOrEqual(50);
    expect(updateNpcState).toHaveBeenCalledWith({ where: { id: 'st1' }, data: { zonaPosX: cadaver.x, zonaPosY: cadaver.y, zonaLocationId: 'loc1' } });
  });

  // Punto del jugador en el mapa de Zona (2026-09-04) — el resto de esta suite.
  describe('jugador', () => {
    it('Save.zonaPosX/Y presentes: se exponen como jugador', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: 123.5, zonaPosY: 456.5,
        currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', zonePoints: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      expect(res.json().jugador).toEqual({ x: 123.5, y: 456.5 });
    });
  });

  describe('NPC dinámico: posición y ausencia', () => {
    it('con posición ya asignada (misma Location), la reutiliza sin volver a llamar a upsert', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', zonePoints: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([
        { id: 'npc-gistera', slug: 'gistera-koh', name: 'Gistera Koh', kind: 'PRINCIPAL', condicionFisica: 'ILESO', faction: null },
      ]);
      findManyNpcState.mockResolvedValueOnce([
        { npcId: 'npc-gistera', scope: '', zonaPosX: 200, zonaPosY: 300, zonaLocationId: 'loc1', zonaAusenteHastaMinutes: null },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      expect(body.dinamicos).toEqual([{ slug: 'gistera-koh', nombre: 'Gistera Koh', tipo: 'NPC', color: 'SIN_FACCION', x: 200, y: 300, descubierto: true }]);
      expect(upsertNpcState).not.toHaveBeenCalled();
    });

    it('ausente dentro de la ventana de 6h en la MISMA Location: no aparece en dinamicos', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', zonePoints: [] },
        worldState: { fictionalMinutes: 1000, factionsStatus: {}, agenda: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([
        { id: 'npc-gistera', slug: 'gistera-koh', name: 'Gistera Koh', kind: 'PRINCIPAL', condicionFisica: 'ILESO', faction: null },
      ]);
      findManyNpcState.mockResolvedValueOnce([
        { npcId: 'npc-gistera', scope: '', zonaPosX: 200, zonaPosY: 300, zonaLocationId: 'loc1', zonaAusenteHastaMinutes: 1360 },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      expect(res.json().dinamicos).toEqual([]);
    });

    it('ausente pero ya pasó el minuto de reaparición: sí aparece, reutilizando la posición vieja', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', zonePoints: [] },
        worldState: { fictionalMinutes: 2000, factionsStatus: {}, agenda: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([
        { id: 'npc-gistera', slug: 'gistera-koh', name: 'Gistera Koh', kind: 'PRINCIPAL', condicionFisica: 'ILESO', faction: null },
      ]);
      findManyNpcState.mockResolvedValueOnce([
        { npcId: 'npc-gistera', scope: '', zonaPosX: 200, zonaPosY: 300, zonaLocationId: 'loc1', zonaAusenteHastaMinutes: 1360 },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      expect(body.dinamicos).toEqual([{ slug: 'gistera-koh', nombre: 'Gistera Koh', tipo: 'NPC', color: 'SIN_FACCION', x: 200, y: 300, descubierto: true }]);
    });

    it('ausente pero en OTRA Location (zonaLocationId distinto): no aplica el filtro, se reasigna posición', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: { id: 'loc1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', zonePoints: [] },
        worldState: { fictionalMinutes: 1000, factionsStatus: {}, agenda: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([
        { id: 'npc-gistera', slug: 'gistera-koh', name: 'Gistera Koh', kind: 'PRINCIPAL', condicionFisica: 'ILESO', faction: null },
      ]);
      findManyNpcState.mockResolvedValueOnce([
        { npcId: 'npc-gistera', scope: '', zonaPosX: 200, zonaPosY: 300, zonaLocationId: 'loc-otra', zonaAusenteHastaMinutes: 9999 },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      expect(body.dinamicos).toHaveLength(1);
      expect(body.dinamicos[0].slug).toBe('gistera-koh');
      // Posición vieja (de loc-otra) no se reutiliza tal cual — se genera una nueva para loc1.
      expect(upsertNpcState).toHaveBeenCalled();
    });

    it('un ZonePoint real de tipo NPC con NpcState ausente vigente queda fuera de puntos', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: {
          id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco',
          zonePoints: [{ id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null, lastUpdatedAtMinutes: 480 }],
        },
        worldState: { fictionalMinutes: 1000, factionsStatus: {}, agenda: [] },
      });
      findManyNpc.mockResolvedValueOnce([{ id: 'npc-kirelon', slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', kind: 'PLANTILLA' }]);
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      findManyNpcState.mockResolvedValueOnce([{ npcId: 'npc-kirelon', scope: 'loc1', zonaPosX: null, zonaPosY: null, zonaLocationId: 'loc1', zonaAusenteHastaMinutes: 1360 }]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      expect(body.puntos).toEqual([]);
      expect(body.disponible).toBe(true);
    });

    // Bug real jugando en vivo (2026-09-20, Álvaro: "al vencer al orco... no desaparecía
    // correctamente y me bloqueaba la partida") — a diferencia de fauna genérica (test de arriba),
    // un NPC único (`kind: 'PRINCIPAL'`) MUERTO nunca debe reaparecer en el pin del mapa, NI SIQUIERA
    // pasada la ventana normal de 6h de "ausente por combate ganado" (`zonaAusenteHastaMinutes`
    // ya vencido). Ver `zonePointNpcMuertoParaSiempre`, zonePoints.ts.
    it('un ZonePoint de un NPC ÚNICO (kind: PRINCIPAL) MUERTO queda fuera de puntos, incluso con la ventana de 6h ya vencida', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: {
          id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco',
          zonePoints: [{ id: 'zp1', x: 400, y: 130, tipo: 'NPC', targetSlug: 'orco-enfurecido-hondonada', label: null, activo: true, cantidad: 1, factionSlug: null }],
        },
        worldState: { fictionalMinutes: 100000, factionsStatus: {}, agenda: [] },
      });
      findManyNpc.mockResolvedValueOnce([{ id: 'npc-orco', slug: 'orco-enfurecido-hondonada', name: 'Orco Enfurecido', kind: 'PRINCIPAL' }]);
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      // scope de un PRINCIPAL es '' (ver mock de scopeFor arriba) — zonaAusenteHastaMinutes muy por
      // debajo del reloj actual (100000): la ventana de 6h ya venció hace tiempo.
      findManyQuest.mockResolvedValueOnce([{ questSlug: 'orco-enfurecido-hondonada-gistera' }]);
      findManyNpcState.mockResolvedValueOnce([
        { npcId: 'npc-orco', scope: '', zonaPosX: null, zonaPosY: null, zonaLocationId: 'loc1', zonaAusenteHastaMinutes: 500, condicionFisica: 'MUERTO' },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      expect(body.puntos).toEqual([]);
    });
  });

  // Hallazgo 32 (revisar-partida-hallazgos.md 2026-09-07) — los interiores de campamento
  // (`kind: 'interior'`) no deben tener variante de estación: bajo techo, el paso de las estaciones
  // no se nota. `zoneMapImageUrl` mockeada (ver cabecera del archivo) para inspeccionar con qué
  // `estacion` se llamó de verdad, en vez de depender del filesystem real.
  describe('Variante de estación (hallazgo 32, 2026-09-07)', () => {
    it('un interior (kind: "interior") pide la imagen SIN estación, aunque la ficción esté en una estación real', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1',
        worldId: 'w1',
        currentLocation: { id: 'loc1', slug: 'campamento-serhu-interior', name: 'Ketg\'lukar', kind: 'interior', zonePoints: [] },
        // 1440*120 días de ficción, muy avanzado — cualquier estación menos PRIMAVERA (Día 1) para
        // que el test no dependa de coincidir por azar con el valor por defecto.
        worldState: { fictionalMinutes: 1440 * 120, factionsStatus: null, agenda: null },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      expect(res.statusCode).toBe(200);
      expect(zoneMapImageUrlMock).toHaveBeenCalledWith('campamento-serhu-interior', expect.anything(), null);
    });

    it('una Location exterior (kind distinto de "interior") sí pide la estación real', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1',
        worldId: 'w1',
        currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', kind: 'refugio', zonePoints: [] },
        worldState: { fictionalMinutes: 1440 * 120, factionsStatus: null, agenda: null },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      expect(res.statusCode).toBe(200);
      const estacionUsada = zoneMapImageUrlMock.mock.calls[0]?.[2];
      expect(estacionUsada).not.toBeNull();
    });
  });

  // Hallazgo 34 (revisar-partida-hallazgos.md 2026-09-07) — un ZonePoint/dinámico revelaba su
  // nombre real y su botón de Enciclopedia sin mirar si la partida ya lo descubrió en la ficción.
  describe('Descubrimiento (hallazgo 34, 2026-09-07)', () => {
    it('un ZonePoint FAUNA aún no descubierto sale con nombre "???" y descubierto:false', async () => {
      findManyDiscoveredEntity.mockReset().mockResolvedValue([]); // nada descubierto todavía
      findUniqueSave.mockResolvedValueOnce({
        id: 's1',
        worldId: 'w1',
        currentLocation: {
          id: 'loc1',
          slug: 'hondonada-del-eco',
          name: 'La Hondonada del Eco',
          zonePoints: [{ id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null, lastUpdatedAtMinutes: 480 }],
        },
        // kirelon-arenoso es fauna nocturna (faunaMomentoDelDia) — 1320 = 22h, de noche.
        worldState: { fictionalMinutes: 1320, factionsStatus: null, agenda: null },
      });
      findManyNpc.mockResolvedValueOnce([{ slug: 'kirelon-arenoso', name: 'Kirelon Arenoso' }]);
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      expect(body.puntos).toEqual([
        { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', nombre: '???', cantidad: 1, color: 'SIN_FACCION', descubierto: false },
      ]);
    });

    it('un ZonePoint RECURSO aún no descubierto sale con nombre "???", pero uno ya descubierto sale con su nombre real', async () => {
      findManyDiscoveredEntity.mockReset().mockResolvedValue([{ entityType: 'flora', entitySlug: 'yerreo' }]); // solo yerreo descubierto
      findUniqueSave.mockResolvedValueOnce({
        id: 's1',
        worldId: 'w1',
        currentLocation: {
          id: 'loc1',
          slug: 'hondonada-del-eco',
          name: 'La Hondonada del Eco',
          zonePoints: [
            { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null, lastUpdatedAtMinutes: 480 },
            { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', label: null, activo: true, cantidad: 1, factionSlug: null },
          ],
        },
        // kirelon-arenoso es fauna nocturna (faunaMomentoDelDia) — 1320 = 22h, de noche.
        worldState: { fictionalMinutes: 1320, factionsStatus: null, agenda: null },
      });
      findManyNpc.mockResolvedValueOnce([{ slug: 'kirelon-arenoso', name: 'Kirelon Arenoso' }]);
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      const zp1 = body.puntos.find((p: { id: string }) => p.id === 'zp1');
      const zp2 = body.puntos.find((p: { id: string }) => p.id === 'zp2');
      expect(zp1.nombre).toBe('???');
      expect(zp1.descubierto).toBe(false);
      expect(zp2.nombre).not.toBe('???');
      expect(zp2.descubierto).toBe(true);
    });

    it('un ZonePoint EDIFICIO siempre sale descubierto, aunque no haya ninguna DiscoveredEntity', async () => {
      findManyDiscoveredEntity.mockReset().mockResolvedValue([]);
      findUniqueSave.mockResolvedValueOnce({
        id: 's1',
        worldId: 'w1',
        currentLocation: {
          id: 'loc1',
          slug: 'campamento-serhu',
          name: 'Campamento del Clan Serhu',
          zonePoints: [{ id: 'zp1', x: 400, y: 300, tipo: 'EDIFICIO', targetSlug: 'karot-vekhad', label: null, activo: true, cantidad: 1, factionSlug: null }],
        },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      expect(body.puntos[0].descubierto).toBe(true);
      expect(body.puntos[0].nombre).not.toBe('???');
    });

    it('un objeto tirado (dinámico OBJETO) siempre sale descubierto, es una instancia real ya en el suelo', async () => {
      findManyDiscoveredEntity.mockReset().mockResolvedValue([]);
      findUniqueSave.mockResolvedValueOnce({
        id: 's1',
        worldId: 'w1',
        currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', zonePoints: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      findManyDroppedItem.mockResolvedValueOnce([
        { id: 'drop1', saveId: 's1', locationId: 'loc1', x: 250, y: 300, name: 'Cuchillo de hielo sílice', description: 'x', catalogSlug: null, statBonuses: null, createdAt: new Date() },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const body = res.json();
      expect(body.dinamicos[0].descubierto).toBe(true);
      expect(body.dinamicos[0].nombre).toBe('Cuchillo de hielo sílice');
    });
  });

  // Iconos de salida de región (2026-09-17, petición explícita de Álvaro: "cada salida debe estar
  // ubicada en su posición correcta hacia el camino que se indica en el mapa... si está al sur para
  // ir a Pilares Rotos, pues la salida al sur") — una por cada LocationLink real, posicionada según
  // la dirección cardinal real entre ambas Locations (mismo cálculo que la Aguja de Cardo Brújula).
  describe('salidas de región', () => {
    it('sin coordenadas x/y en la Location actual, no calcula ninguna salida (falla cerrado)', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', zonePoints: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      findManyLocationLink.mockResolvedValueOnce([
        { from: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: null, y: null, teaser: null, description: 'x' }, to: { id: 'loc2', slug: 'pilares-rotos', name: 'Paso de los Pilares Rotos', x: 10, y: 10, teaser: 't', description: 'y' } },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      expect(res.json().salidas).toEqual([]);
      // Sin coordenadas, ni siquiera hace falta consultar LocationVisit — no hay nada que resolver.
      expect(findManyLocationVisit).not.toHaveBeenCalled();
    });

    it('con coordenadas reales, calcula la dirección cardinal real y la posición de borde correspondiente', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: 0, y: 0, zonePoints: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      // Destino puesto al NORTE (x=este/y=norte, mismo convenio que travel.ts): +y en coordenadas
      // reales de mundo es norte, así el icono debe caer en el borde superior del lienzo (y pequeño).
      findManyLocationLink.mockResolvedValueOnce([
        {
          from: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: 0, y: 0, teaser: null, description: 'x' },
          to: { id: 'loc2', slug: 'pilares-rotos', name: 'Paso de los Pilares Rotos', x: 0, y: 10, teaser: 'Tres columnas erosionadas se recortan contra el cielo, unidas por puentes que nadie ha visto de cerca.', description: 'Descripción completa real.' },
        },
      ]);
      findManyLocationVisit.mockResolvedValueOnce([]); // aún no visitada
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const salidas = res.json().salidas;
      expect(salidas).toHaveLength(1);
      expect(salidas[0].locationId).toBe('loc2');
      expect(salidas[0].slug).toBe('pilares-rotos');
      expect(salidas[0].visitada).toBe(false);
      // No visitada: teaser presente, description/imageUrl null (nunca revela contenido real).
      expect(salidas[0].teaser).toContain('columnas erosionadas');
      expect(salidas[0].description).toBeNull();
      expect(salidas[0].imageUrl).toBeNull();
      // Norte real → borde superior del lienzo (y pequeño, centro horizontal).
      expect(salidas[0].y).toBeLessThan(300);
      expect(salidas[0].x).toBe(400);
    });

    it('una Location ya visitada expone description/imageUrl reales, no el teaser', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: 0, y: 0, zonePoints: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      findManyLocationLink.mockResolvedValueOnce([
        {
          from: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: 0, y: 0, teaser: null, description: 'x' },
          to: { id: 'loc2', slug: 'pilares-rotos', name: 'Paso de los Pilares Rotos', x: 0, y: 10, teaser: 'breve', description: 'Descripción completa real.' },
        },
      ]);
      findManyLocationVisit.mockResolvedValueOnce([{ locationId: 'loc2' }]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      const salidas = res.json().salidas;
      expect(salidas[0].visitada).toBe(true);
      expect(salidas[0].description).toBe('Descripción completa real.');
      expect(salidas[0].teaser).toBe('breve'); // se devuelve igual, el frontend decide cuál mostrar
    });

    // Umbral de proximidad (2026-09-20, petición explícita de Álvaro: "la salida de una zona debe
    // estar representada en el mapa con un icono y al estar a una celda si pulsas el icono saca el
    // modal para poder darle a viajar") — antes se podía "Viajar" desde cualquier punto del mapa sin
    // comparar nunca contra `zonaPosX/Y` real. Mismo criterio EXACTO que colisión NPC/fauna/recurso
    // (`celdaAdyacenteOMisma`): misma celda o cualquiera de las 8 vecinas de la celda de la salida.
    describe('alcanzable (proximidad real del jugador, 2026-09-20)', () => {
      const currentLocationConNorte = {
        id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: 0, y: 0, zonePoints: [],
      };
      const linkNorte = [
        {
          from: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: 0, y: 0, teaser: null, description: 'x' },
          to: { id: 'loc2', slug: 'pilares-rotos', name: 'Paso de los Pilares Rotos', x: 0, y: 10, teaser: 't', description: 'y' },
        },
      ];

      it('jugador justo en la celda de la salida (x:400,y<300): alcanzable true', async () => {
        findUniqueSave.mockResolvedValueOnce({ id: 's1', worldId: 'w1', zonaPosX: 400, zonaPosY: 25, currentLocation: currentLocationConNorte });
        loadSessionFactsMock.mockResolvedValueOnce([]);
        detectNpcsInSceneMock.mockResolvedValueOnce([]);
        findManyLocationLink.mockResolvedValueOnce(linkNorte);
        findManyLocationVisit.mockResolvedValueOnce([]);
        const app = await buildApp();
        const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
        expect(res.json().salidas[0].alcanzable).toBe(true);
      });

      it('jugador en el otro extremo del lienzo: alcanzable false', async () => {
        findUniqueSave.mockResolvedValueOnce({ id: 's1', worldId: 'w1', zonaPosX: 775, zonaPosY: 575, currentLocation: currentLocationConNorte });
        loadSessionFactsMock.mockResolvedValueOnce([]);
        detectNpcsInSceneMock.mockResolvedValueOnce([]);
        findManyLocationLink.mockResolvedValueOnce(linkNorte);
        findManyLocationVisit.mockResolvedValueOnce([]);
        const app = await buildApp();
        const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
        expect(res.json().salidas[0].alcanzable).toBe(false);
      });

      it('sin posición de jugador conocida (zonaPosX/Y null): alcanzable true, fallback permisivo', async () => {
        findUniqueSave.mockResolvedValueOnce({ id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null, currentLocation: currentLocationConNorte });
        loadSessionFactsMock.mockResolvedValueOnce([]);
        detectNpcsInSceneMock.mockResolvedValueOnce([]);
        findManyLocationLink.mockResolvedValueOnce(linkNorte);
        findManyLocationVisit.mockResolvedValueOnce([]);
        const app = await buildApp();
        const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
        expect(res.json().salidas[0].alcanzable).toBe(true);
      });
    });

    it('una Location conectada sin coordenadas propias se excluye (falla cerrado, no inventa dirección)', async () => {
      findUniqueSave.mockResolvedValueOnce({
        id: 's1', worldId: 'w1', zonaPosX: null, zonaPosY: null,
        currentLocation: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: 0, y: 0, zonePoints: [] },
      });
      loadSessionFactsMock.mockResolvedValueOnce([]);
      detectNpcsInSceneMock.mockResolvedValueOnce([]);
      findManyLocationLink.mockResolvedValueOnce([
        {
          from: { id: 'loc1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', x: 0, y: 0, teaser: null, description: 'x' },
          to: { id: 'loc2', slug: 'campamento-serhu-interior', name: 'Hogar Ketg', x: null, y: null, teaser: null, description: 'y' },
        },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/saves/s1/zona' });
      expect(res.json().salidas).toEqual([]);
    });
  });
});
