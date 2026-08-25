import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (deuda técnica 2026-07-30, auditoría técnica: "detail.ts... tiene 0 tests pese
/// a ser el ensamblado más grande del split de saves.ts"). Alcance: 404 de partida no encontrada,
/// y sobre todo el cruce Location/Npc que resuelve `targetLocationSlug` por misión — la MISMA
/// lógica se acaba de duplicar en turnResolution.ts (bug real, auditoría 2026-07-30: el turno
/// devolvía siempre null y borraba el marcador del mapa) y merece quedar fijada aquí, la
/// implementación de referencia.
const findUniqueWorldState = vi.fn();
const findUniqueSave = vi.fn();
const findManyItemCatalog = vi.fn();
const findManyLocation = vi.fn();
const findManyNpc = vi.fn();
const findManyNpcState = vi.fn();
const findManyLogEntry = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    worldState: { findUnique: (...args: unknown[]) => findUniqueWorldState(...args) },
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    itemCatalog: { findMany: (...args: unknown[]) => findManyItemCatalog(...args) },
    location: { findMany: (...args: unknown[]) => findManyLocation(...args) },
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    npcState: { findMany: (...args: unknown[]) => findManyNpcState(...args) },
    logEntry: { findMany: (...args: unknown[]) => findManyLogEntry(...args) },
  },
}));

const { detailRoutes } = await import('./detail.js');

async function buildApp() {
  const app = Fastify();
  await app.register(detailRoutes);
  return app;
}

const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

function baseSave(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'save1',
    worldId: 'world1',
    world: { slug: 'helek-sirik', name: 'Helek Sirik' },
    worldState: { fictionalDateLabel: 'Día 1, mañana', factionsStatus: {} },
    characterName: 'Gorhorn',
    characterArchetype: 'a',
    characterOrigin: 'b',
    characterMotivation: 'c',
    attributes: ATTRS,
    secondaryAttributes: {},
    portraitInitial: 'G',
    logEntries: [],
    inventoryItems: [],
    companions: [],
    level: 1,
    xp: 0,
    pendingAttributePoints: 0,
    kingdomName: null,
    territories: [],
    buildings: [],
    subjects: [],
    almacenItems: [],
    plantillasEquipo: [],
    lastAteAtMinutes: null,
    lastDrankAtMinutes: null,
    characterTransit: null,
    savedActions: [],
    profession: null,
    professionProgress: [],
    kingdomStats: null,
    currentLocation: null,
    currentLocationId: null,
    condicionFisica: 'ILESO',
    salud: 100,
    energia: 100,
    dificultad: 'MEDIO',
    deathCount: 0,
    endedAt: null,
    quests: [],
    sessionSummaries: [],
    pendingCombatNpcSlugs: null,
    ...overrides,
  };
}

describe('GET /saves/:id', () => {
  beforeEach(() => {
    findUniqueWorldState.mockReset().mockResolvedValue(null);
    findUniqueSave.mockReset();
    findManyItemCatalog.mockReset().mockResolvedValue([]);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findManyLogEntry.mockReset().mockResolvedValue([]);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/no-existe' });
    expect(res.statusCode).toBe(404);
  });

  it('resuelve targetLocationSlug de una misión que apunta a un Location directamente', async () => {
    findUniqueSave.mockResolvedValue(
      baseSave({ quests: [{ id: 'q1', title: 'Explora', description: 'd', status: 'ACTIVA', objetivo: null, rewardXp: null, rewardItems: [], targetLocationId: 'loc1', targetNpcId: null }] }),
    );
    findManyLocation.mockResolvedValue([{ id: 'loc1', slug: 'hondonada-del-eco' }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().quests[0].targetLocationSlug).toBe('hondonada-del-eco');
  });

  it('resuelve targetLocationSlug de una misión que apunta a un Npc, vía su homeLocationSlug', async () => {
    findUniqueSave.mockResolvedValue(
      baseSave({ quests: [{ id: 'q1', title: 'Derrota al Orco', description: 'd', status: 'ACTIVA', objetivo: null, rewardXp: null, rewardItems: [], targetLocationId: null, targetNpcId: 'npc1' }] }),
    );
    findManyNpc.mockResolvedValue([{ id: 'npc1', homeLocationSlug: 'hondonada-del-eco' }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().quests[0].targetLocationSlug).toBe('hondonada-del-eco');
  });

  // Cobertura nueva (2026-08-14, barra de atributos jugables con tramo de bonus de equipo aparte
  // de la base — petición explícita: "en color claro la parte de los attr base y en más oscuro
  // lo que aumentan lo que llevas equipado").
  it('attributeBonuses viaja vacío sin equipo puesto', async () => {
    findUniqueSave.mockResolvedValue(baseSave());
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.json().attributeBonuses).toEqual({});
  });

  it('attributeBonuses suma solo el bonus de objetos EQUIPADOS, sin tocar attributes (la base)', async () => {
    findUniqueSave.mockResolvedValue(
      baseSave({
        inventoryItems: [
          { id: 'i1', name: 'Amuleto de fuerza', slot: 'ANILLO_1', statBonuses: { fuerza: 3 } },
          { id: 'i2', name: 'Poción en la mochila', slot: null, statBonuses: { fuerza: 99 } },
        ],
      }),
    );
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const body = res.json();
    expect(body.attributeBonuses).toEqual({ fuerza: 3 });
    expect(body.attributes).toEqual(ATTRS); // la base nunca se toca
  });

  it('sin target de ningún tipo, targetLocationSlug es null', async () => {
    findUniqueSave.mockResolvedValue(
      baseSave({ quests: [{ id: 'q1', title: 'Libre', description: 'd', status: 'ACTIVA', objetivo: null, rewardXp: null, rewardItems: [], targetLocationId: null, targetNpcId: null }] }),
    );
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().quests[0].targetLocationSlug).toBeNull();
  });

  // Cobertura nueva (2026-08-01, "revisa bien en todos los sitios que pendingCombatNpcSlugs se
  // actualiza bien" — bug real: "el orco que metí volvió a aparecer" / "al reiniciar me empieza
  // en combate"): este endpoint es la última línea de defensa, se dispara en cada apertura/
  // recarga de partida — un NPC ya saqueado del todo en `pendingCombatNpcSlugs` (dato persistido
  // desactualizado, de antes de los fixes de origen) no debe reabrir el aviso de "Combatir".
  it('un NPC ya saqueado del todo en pendingCombatNpcSlugs no reabre combateIniciado', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'] }));
    findManyNpc.mockResolvedValue([{ id: 'npc1', slug: 'orco-enfurecido-hondonada', name: 'Orco Enfurecido', kind: 'SECUNDARIO' }]);
    findManyNpcState.mockResolvedValue([{ npcId: 'npc1', scope: 'itinerante', condicionFisica: 'MUERTO', saqueado: true, lootedItemNames: ['Maza orca'] }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().combateIniciado).toBeNull();
  });

  it('un NPC CONVALECIENTE/MUERTO todavía sin saquear del todo sí reabre combateIniciado, con lootedItemNames', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'] }));
    findManyNpc.mockResolvedValue([{ id: 'npc1', slug: 'orco-enfurecido-hondonada', name: 'Orco Enfurecido', kind: 'SECUNDARIO' }]);
    findManyNpcState.mockResolvedValue([{ npcId: 'npc1', scope: 'itinerante', condicionFisica: 'MUERTO', saqueado: false, lootedItemNames: ['Maza orca'] }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().combateIniciado).toEqual({
      npcs: [{ slug: 'orco-enfurecido-hondonada', name: 'Orco Enfurecido', condicionFisica: 'MUERTO', saqueado: false, lootedItemNames: ['Maza orca'], analizado: false }],
    });
  });
});
