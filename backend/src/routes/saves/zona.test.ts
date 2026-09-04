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

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    npcState: {
      findMany: (...args: unknown[]) => findManyNpcState(...args),
      upsert: (...args: unknown[]) => upsertNpcState(...args),
    },
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
}));
vi.mock('../../services/worldFacts.js', () => ({
  loadSessionFacts: (...args: unknown[]) => loadSessionFactsMock(...args),
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
    expect(res.json()).toEqual({ disponible: false, puntos: [], dinamicos: [], jugador: null });
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
      { slug: 'gistera-koh', nombre: 'Gistera Koh', tipo: 'NPC', color: 'SIN_FACCION', x: expect.any(Number), y: expect.any(Number) },
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
          { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null },
          { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', label: null, activo: true, cantidad: 1, factionSlug: null },
          { id: 'zp3', x: 100, y: 100, tipo: 'FAUNA', targetSlug: 'gesgurio', label: 'Etiqueta a mano', activo: true, cantidad: 3, factionSlug: null },
        ],
      },
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
      { id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', nombre: 'Kirelon Arenoso', cantidad: 1, color: 'SIN_FACCION' },
      { id: 'zp2', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', nombre: expect.any(String), cantidad: 1, color: 'SIN_FACCION' },
      { id: 'zp3', x: 100, y: 100, tipo: 'FAUNA', targetSlug: 'gesgurio', nombre: 'Etiqueta a mano', cantidad: 3, color: 'SIN_FACCION' }, // label manda sobre el nombre real
    ]);
    expect(body.dinamicos).toEqual([]);
  });

  it('un NPC dinámico ya cubierto por un ZonePoint fijo no se duplica en dinamicos', async () => {
    findUniqueSave.mockResolvedValueOnce({
      id: 's1',
      worldId: 'w1',
      currentLocation: {
        id: 'loc1',
        slug: 'hondonada-del-eco',
        name: 'La Hondonada del Eco',
        zonePoints: [{ id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null }],
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
    expect(body.dinamicos).toEqual([{ slug: 'gistera-koh', nombre: 'Gistera Koh', tipo: 'NPC', color: 'SIN_FACCION', x: expect.any(Number), y: expect.any(Number) }]);
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

  it('control regional: región sin dueño de lore conocido devuelve regionControl null', async () => {
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
    expect(body.regionControl).toBeNull();
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
      expect(body.dinamicos).toEqual([{ slug: 'gistera-koh', nombre: 'Gistera Koh', tipo: 'NPC', color: 'SIN_FACCION', x: 200, y: 300 }]);
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
      expect(body.dinamicos).toEqual([{ slug: 'gistera-koh', nombre: 'Gistera Koh', tipo: 'NPC', color: 'SIN_FACCION', x: 200, y: 300 }]);
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
          zonePoints: [{ id: 'zp1', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null, activo: true, cantidad: 1, factionSlug: null }],
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
  });
});
