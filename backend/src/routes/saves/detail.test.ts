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
// Identificador de combatientes duplicados (2026-08-27) — `detail.ts` ahora consulta el
// `CombatEncounter` de grupo real activo (además de `pendingCombatNpcSlugs`, el mecanismo viejo)
// para reconstruir `combateIniciado` con `participantId`/`instanceNumber`. `findFirstCombatEncounter`
// devuelve `null` por defecto en cada test (sin `CombatEncounter` de grupo activo) salvo que un
// test concreto lo sobrescriba — cae al comportamiento viejo (`pendingCombatNpcSlugs`) tal cual.
const findFirstCombatEncounter = vi.fn();
const findManyCombatParticipant = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    worldState: { findUnique: (...args: unknown[]) => findUniqueWorldState(...args) },
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    itemCatalog: { findMany: (...args: unknown[]) => findManyItemCatalog(...args) },
    location: { findMany: (...args: unknown[]) => findManyLocation(...args) },
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    npcState: { findMany: (...args: unknown[]) => findManyNpcState(...args) },
    logEntry: { findMany: (...args: unknown[]) => findManyLogEntry(...args) },
    combatEncounter: { findFirst: (...args: unknown[]) => findFirstCombatEncounter(...args) },
    combatParticipant: { findMany: (...args: unknown[]) => findManyCombatParticipant(...args) },
  },
}));

const { detailRoutes } = await import('./detail.js');

async function buildApp() {
  const app = Fastify();
  await app.register(detailRoutes);
  return app;
}

const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

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
    pendingDynamicMode: null,
    pendingDynamicModeOffer: null,
    raza: null,
    clase: null,
    especializacion: null,
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
    findFirstCombatEncounter.mockReset().mockResolvedValue(null);
    findManyCombatParticipant.mockReset().mockResolvedValue([]);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/no-existe' });
    expect(res.statusCode).toBe(404);
  });

  it('pendingDynamicMode null por defecto', async () => {
    findUniqueSave.mockResolvedValue(baseSave());
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.json().pendingDynamicMode).toBeNull();
  });

  it('A.3 (checklist frontend 2026-08-27) — pendingDynamicMode se reconstruye tras recargar, igual que combateIniciado, incluida la última narración/opciones', async () => {
    const pending = {
      tipo: 'NPC',
      targetSlug: 'gistera-koh',
      targetName: 'Gistera Koh',
      vuelta: 2,
      iniciadoAtMinutes: 480,
      narration: 'Gistera Koh insiste en su petición.',
      opciones: ['Aceptar ayudarla', 'Rechazar de nuevo'],
    };
    findUniqueSave.mockResolvedValue(baseSave({ pendingDynamicMode: pending }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.json().pendingDynamicMode).toEqual(pending);
  });

  it('pendingDynamicModeOffer null por defecto', async () => {
    findUniqueSave.mockResolvedValue(baseSave());
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.json().pendingDynamicModeOffer).toBeNull();
  });

  it('bug real 2026-08-28 ("oferta de modo dinámico no sobrevive a una recarga") — pendingDynamicModeOffer se reconstruye tras recargar, mismo criterio que pendingDynamicMode', async () => {
    const offer = { tipo: 'FAUNA', targetSlug: 'gesgurio', targetName: 'Gesgurio' };
    findUniqueSave.mockResolvedValue(baseSave({ pendingDynamicModeOffer: offer }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.json().pendingDynamicModeOffer).toEqual(offer);
  });

  it('B.14 (checklist frontend 2026-08-27) — condicionFisica de compañero con capa mecánica real (attributes no null) se expone; sin ella, null', async () => {
    findUniqueSave.mockResolvedValue(
      baseSave({
        companions: [
          {
            id: 'c1', name: 'Múrgol', role: 'aliado', notes: 'x', tipo: 'FAUNA', felicidad: 80,
            lastFedAtMinutes: null, lastWateredAtMinutes: null, esSlotDomador: false, rolReino: null,
            plantillaEquipoId: null, attributes: { fuerza: 10 }, condicionFisica: 'GRAVE',
          },
          {
            id: 'c2', name: 'Compañero de quest', role: 'aliado', notes: 'x', tipo: 'NPC', felicidad: null,
            lastFedAtMinutes: null, lastWateredAtMinutes: null, esSlotDomador: false, rolReino: null,
            plantillaEquipoId: null, attributes: null, condicionFisica: 'ILESO',
          },
        ],
      }),
    );
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const companions = res.json().companions;
    expect(companions[0].condicionFisica).toBe('GRAVE');
    expect(companions[1].condicionFisica).toBeNull();
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
    findManyNpc.mockResolvedValue([{ id: 'npc1', slug: 'orco-enfurecido-hondonada', name: 'Orco Enfurecido', kind: 'SECUNDARIO', atributoResistencia: 'voluntad' }]);
    findManyNpcState.mockResolvedValue([{ npcId: 'npc1', scope: 'itinerante', condicionFisica: 'MUERTO', saqueado: false, lootedItemNames: ['Maza orca'] }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().combateIniciado).toEqual({
      npcs: [{ slug: 'orco-enfurecido-hondonada', name: 'Orco Enfurecido', condicionFisica: 'MUERTO', saqueado: false, lootedItemNames: ['Maza orca'], analizado: false, capturable: true, activeEffects: [] }],
    });
  });

  // BUG REAL CERRADO (2026-08-29, reverificación en vivo con Playwright, ver detail.ts para la
  // causa raíz completa): fauna MUERTA sin saquear ('Saquear todo' del resumen de combate solo
  // cuenta NPCs humanoides, no fauna — Desollar es un mecanismo aparte) dejaba `combateIniciado`
  // poblado para siempre, y el aviso pasivo de Desollar exige `!combateIniciado` para aparecer —
  // candado circular sin ninguna vía de UI. Fauna nunca debe reabrir combateIniciado por sí sola.
  it('un Kirelon Arenoso (fauna, ataqueNatural real) MUERTO sin saquear NO reabre combateIniciado', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ pendingCombatNpcSlugs: ['kirelon-arenoso'] }));
    findManyNpc.mockResolvedValue([
      { id: 'npc1', slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', kind: 'PLANTILLA', ataqueNatural: 'Envuelve a su presa y la asfixia.' },
    ]);
    findManyNpcState.mockResolvedValue([{ npcId: 'npc1', scope: 'itinerante', condicionFisica: 'MUERTO', saqueado: false, lootedItemNames: [] }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().combateIniciado).toBeNull();
  });

  // BUG REAL CERRADO (2026-09-03, "combate fantasma" — reverificando en vivo con Playwright tras
  // el fix de reveal ambiental de la misma sesión): un Ruptidar (fauna, `ataqueNatural: "No
  // ataca."`) golpeado en combate REAL EN CURSO (tirada exitosa, XP concedido, jugando de verdad)
  // desaparecía de `combateIniciado` igual que si ya estuviera MUERTO — el filtro viejo trataba
  // `ataqueNatural` (texto, siempre truthy si no está vacío) como un booleano de "ya resuelto", sin
  // mirar la condición real. Con `NpcState` vacío (`[]`, combate en curso, ningún estado creado
  // todavía) el combate DEBE seguir apareciendo — es la misma fauna del test de arriba, pero VIVA.
  it('un Ruptidar (fauna, ataqueNatural real) sin NpcState (combate real en curso, no muerto) SÍ reabre combateIniciado', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ pendingCombatNpcSlugs: ['ruptidar'] }));
    findManyNpc.mockResolvedValue([
      { id: 'npc1', slug: 'ruptidar', name: 'Ruptidar', kind: 'PLANTILLA', ataqueNatural: 'No ataca.', atributoResistencia: 'destreza' },
    ]);
    findManyNpcState.mockResolvedValue([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().combateIniciado).toEqual({
      npcs: [{ slug: 'ruptidar', name: 'Ruptidar', condicionFisica: 'ILESO', saqueado: false, lootedItemNames: [], analizado: false, capturable: true, activeEffects: [] }],
    });
  });

  it('un Ruptidar HERIDO (combate real en curso) SÍ reabre combateIniciado', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ pendingCombatNpcSlugs: ['ruptidar'] }));
    findManyNpc.mockResolvedValue([
      { id: 'npc1', slug: 'ruptidar', name: 'Ruptidar', kind: 'PLANTILLA', ataqueNatural: 'No ataca.', atributoResistencia: 'destreza' },
    ]);
    findManyNpcState.mockResolvedValue([{ npcId: 'npc1', scope: 'itinerante', condicionFisica: 'HERIDO', saqueado: false, lootedItemNames: [] }]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().combateIniciado?.npcs).toHaveLength(1);
    expect(res.json().combateIniciado?.npcs[0].condicionFisica).toBe('HERIDO');
  });
});

// Roadmap de UI de especialización (2026-09-01) — `raza`/`clase`/`especializacion` no viajaban en
// absoluto antes de esto; `pendingEspecializacionChoice` es el flag derivado que bloquea el
// composer del frontend, mismo criterio que `esperandoDefensaJugador`.
describe('GET /saves/:id — raza/clase/especialización', () => {
  beforeEach(() => {
    findUniqueWorldState.mockReset().mockResolvedValue(null);
    findUniqueSave.mockReset();
    findManyItemCatalog.mockReset().mockResolvedValue([]);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findManyLogEntry.mockReset().mockResolvedValue([]);
    findFirstCombatEncounter.mockReset().mockResolvedValue(null);
    findManyCombatParticipant.mockReset().mockResolvedValue([]);
  });

  it('raza/clase/especialización viajan tal cual, null por defecto', async () => {
    findUniqueSave.mockResolvedValue(baseSave());
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const body = res.json();
    expect(body.raza).toBeNull();
    expect(body.clase).toBeNull();
    expect(body.especializacion).toBeNull();
  });

  it('con clase asignada y nivel <10, pendingEspecializacionChoice es false y no manda especializacionesDisponibles', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ raza: 'orcos', clase: 'CHAMAN', level: 3 }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const body = res.json();
    expect(body.clase).toBe('CHAMAN');
    expect(body.pendingEspecializacionChoice).toBe(false);
    expect(body.especializacionesDisponibles).toBeUndefined();
  });

  it('con clase asignada, nivel >=10 y sin especialización, pendingEspecializacionChoice es true y manda las especializaciones con hueco real', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ clase: 'CHAMAN', level: 16 }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const body = res.json();
    expect(body.pendingEspecializacionChoice).toBe(true);
    expect(body.especializacionesDisponibles).toEqual(
      expect.arrayContaining([expect.objectContaining({ especializacion: 'TOTEMICO', resumenMecanico: expect.any(String) })]),
    );
    expect(body.especializacionesDisponibles.map((e: { especializacion: string }) => e.especializacion).sort()).toEqual(
      ['TOTEMICO', 'RUNICO', 'CONVOCADOR', 'OPRESOR'].sort(),
    );
  });

  it('con clase y especialización ya asignadas, pendingEspecializacionChoice vuelve a false', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ clase: 'CHAMAN', level: 16, especializacion: 'OPRESOR' }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const body = res.json();
    expect(body.especializacion).toBe('OPRESOR');
    expect(body.pendingEspecializacionChoice).toBe(false);
    expect(body.especializacionesDisponibles).toBeUndefined();
  });

  it('sin clase asignada, aunque el nivel ya sea >=10, pendingEspecializacionChoice es false', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ clase: null, level: 16 }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    expect(res.json().pendingEspecializacionChoice).toBe(false);
  });

  // Fix de bug real (auditoría en 6 agentes, 2026-09-01): un personaje custom se quedaba con
  // `clase: null` para siempre — `PATCH /saves/:id/clase` existía pero ningún punto de la UI lo
  // llamaba nunca. `pendingClaseChoice`/`clasesDisponibles` son el mecanismo nuevo, mismo patrón
  // derivado que `pendingEspecializacionChoice`.
  it('sin clase asignada, pendingClaseChoice es true y manda las clases disponibles filtradas por raza', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ raza: 'orcos', clase: null }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const body = res.json();
    expect(body.pendingClaseChoice).toBe(true);
    const clases = body.clasesDisponibles.map((c: { clase: string }) => c.clase).sort();
    expect(clases).toEqual(['ARQUERO', 'ASESINO', 'CAZADOR', 'CHAMAN', 'GUERRERO'].sort());
    expect(clases).not.toContain('CABALLERO'); // exclusiva de goirntes, no de orcos
    expect(clases).not.toContain('MAGO'); // sin tronco real construido
  });

  it('sin raza asignada (personaje custom sin raza fijada aún), pendingClaseChoice sigue true con las 5 clases libres', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ raza: null, clase: null }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const body = res.json();
    expect(body.pendingClaseChoice).toBe(true);
    expect(body.clasesDisponibles.map((c: { clase: string }) => c.clase).sort()).toEqual(
      ['ARQUERO', 'ASESINO', 'CAZADOR', 'GUERRERO'].sort(),
    );
  });

  it('con clase ya asignada, pendingClaseChoice es false y no manda clasesDisponibles', async () => {
    findUniqueSave.mockResolvedValue(baseSave({ clase: 'CAZADOR' }));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/save1' });
    const body = res.json();
    expect(body.pendingClaseChoice).toBe(false);
    expect(body.clasesDisponibles).toBeUndefined();
  });
});
