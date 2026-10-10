import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Harness de integración real (mismo criterio que turn.integration.test.ts — sin LLM de por
/// medio en /restart, así que aquí ni hace falta mockear nada, Postgres local basta) para el bug
/// real jugando en vivo (2026-08-01, "al reiniciar la partida me empieza en combate"):
/// `Save.pendingCombatNpcSlugs`/`pendingNpcAttack` son la única fuente de la que GET /saves/:id
/// reconstruye el aviso de "Combatir" tras una resincronización (ver saves/detail.ts) — antes
/// `/restart` no los tocaba, así que un combate sin cerrar de la partida ANTERIOR sobrevivía
/// entero a un reinicio que por lo demás dejaba todo limpio (Día 1, ILESO, inventario de serie).
const { creationRoutes } = await import('./creation.js');

async function buildApp() {
  const app = Fastify();
  await app.register(creationRoutes);
  return app;
}

describe('POST /saves/:id/restart limpia el combate pendiente de la partida anterior', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (restart)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        condicionFisica: 'CONVALECIENTE',
        // Simula justo lo que se encontró en la partida real: un combate que nunca llegó a
        // cerrarse (el slug de un NPC ya derrotado/saqueado, atascado desde la sesión anterior).
        pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('deja pendingCombatNpcSlugs vacío y pendingNpcAttack null tras reiniciar', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/restart`, payload: {} });
    expect(res.statusCode).toBe(200);

    const restarted = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(restarted.pendingCombatNpcSlugs).toEqual([]);
    expect(restarted.pendingNpcAttack).toBeNull();
    expect(restarted.condicionFisica).toBe('ILESO');
  }, 15_000);
});

// Bug real jugando en vivo (2026-09-22, confirmado con Playwright + curl directo contra la partida
// de prueba): mover al jugador por el mapa de Zona persiste `Save.zonaPosX`/`zonaPosY`, pero
// `restartSaveTransactionBody` nunca los tocaba — reiniciar una partida dejaba TODO lo demás limpio
// (Día 1, ILESO, inventario de serie) salvo la posición en el mapa, que se quedaba exactamente donde
// el jugador la había dejado en la partida ANTERIOR. `creation.ts` (partida nueva) ya fijaba
// `zonaPosX/Y` + `zonaPosEntradaX/Y` a la esquina noroeste calibrada (75,75) desde 2026-09-17 — este
// segundo camino (reinicio) nunca replicó ese fix, mismo patrón de bug ya visto 2 veces en este
// mismo archivo (combate pendiente / Faction de reino sobreviviendo al reinicio).
describe('POST /saves/:id/restart también reinicia la posición del jugador en el mapa de Zona', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (restart-zona)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        // Simula al jugador ya movido lejos del punto de entrada, como tras varios turnos reales.
        zonaPosX: 375,
        zonaPosY: 125,
        zonaPosEntradaX: 325,
        zonaPosEntradaY: 125,
        // Trayecto a medias y último encuentro de Zona (2026-09-28) — tampoco deben sobrevivir.
        zonaCaminoPendiente: [{ x: 425, y: 125 }],
        zonaUltimoEncuentro: { targetSlug: 'gesgurio', locationId: 'x' },
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('devuelve zonaPosX/Y y zonaPosEntradaX/Y al punto de entrada de serie tras reiniciar', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/restart`, payload: {} });
    expect(res.statusCode).toBe(200);

    const restarted = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(restarted.zonaPosX).toBe(75);
    expect(restarted.zonaPosY).toBe(75);
    expect(restarted.zonaPosEntradaX).toBe(75);
    expect(restarted.zonaPosEntradaY).toBe(75);
    expect(restarted.zonaCaminoPendiente).toBeNull();
    expect(restarted.zonaUltimoEncuentro).toBeNull();
  }, 15_000);
});

// Bug real jugando en vivo (2026-09-22, hallazgo mientras se probaba el fix de zonaPos de arriba):
// un `CombatEncounter` EN_CURSO (combate múltiple real, motor N-way) nunca se borraba al reiniciar —
// mismo patrón que los 2 bugs de arriba (Faction/pendingCombatNpcSlugs), un dato que este flujo
// desconocía. `GET /saves/:id` (detail.ts) reconstruye `combateIniciado` con un `findFirst` filtrado
// solo por `saveId` — como `/restart` reutiliza el mismo `saveId` (no crea partida nueva), un
// combate viejo reaparecía de inmediato tras reiniciar, con la partida ya "reiniciada" (Día 1,
// ILESO) mostrando de todos modos "⚔️ COMBATIR / HUIR" contra un rival de la partida ANTERIOR — sin
// ninguna vía de UI para salir de ese estado (ni siquiera reiniciar otra vez lo arregla, confirmado
// jugando: el `CombatEncounter` sobrevive a reinicios sucesivos). Las 4 ofertas "pending" de modo
// dinámico/misión/interacción (`pendingDynamicMode`/`pendingDynamicModeOffer`/
// `pendingQuestOfferInfo`/`pendingNpcInteractionOffer`) tenían el mismo hueco exacto.
describe('POST /saves/:id/restart limpia un CombatEncounter y las ofertas pending de la partida anterior', () => {
  let saveId: string;
  let encounterId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (restart-combate)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'gesgurio', targetName: 'Gesgurio', quienInicia: 'npc' },
        pendingDynamicMode: { targetSlug: 'gesgurio', vuelta: 1 },
        pendingQuestOfferInfo: { title: 'Misión de prueba', description: 'x' },
        pendingNpcInteractionOffer: { npcSlug: 'gesgurio', npcName: 'Gesgurio', options: ['Aprender oficio'] },
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    const encounter = await prisma.combatEncounter.create({ data: { saveId, jugable: true } });
    encounterId = encounter.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('borra el CombatEncounter y limpia las 4 ofertas pending tras reiniciar', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/restart`, payload: {} });
    expect(res.statusCode).toBe(200);

    expect(await prisma.combatEncounter.findUnique({ where: { id: encounterId } })).toBeNull();
    const restarted = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(restarted.pendingDynamicModeOffer).toBeNull();
    expect(restarted.pendingDynamicMode).toBeNull();
    expect(restarted.pendingQuestOfferInfo).toBeNull();
    expect(restarted.pendingNpcInteractionOffer).toBeNull();
  }, 15_000);
});

// Bug real (auditoría de bugs, 2026-08-21): `Faction` (fundar reino, reino.ts) es `saveId`-scoped
// pero /restart no la borraba — fundar un reino, reiniciar y volver a fundar OTRO reino con el
// MISMO nombre exacto chocaba contra `@@unique([worldId, slug])` de la fila fantasma de la partida
// anterior (`factionSlug = slugify(nombre)-${save.id}`, mismo saveId en las dos), y `POST
// /reino/fundar` respondía "Ya has fundado tu reino" (P2002) para una partida que en realidad
// vuelve a Día 1.
describe('POST /saves/:id/restart borra la Faction de un reino fundado en la partida anterior', () => {
  let saveId: string;
  let worldId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (restart-faction)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        raza: 'orcos',
        kingdomName: 'Reino de Prueba',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.faction.create({
      data: {
        worldId: world.id,
        saveId,
        slug: `reino-de-prueba-${saveId}`,
        name: 'Reino de Prueba',
        raza: 'orcos',
        description: 'Facción de la partida anterior, antes de reiniciar.',
      },
    });
  });

  afterAll(async () => {
    await prisma.faction.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la Faction de la partida anterior desaparece tras reiniciar, liberando el slug', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/restart`, payload: {} });
    expect(res.statusCode).toBe(200);

    const remaining = await prisma.faction.findMany({ where: { worldId, slug: `reino-de-prueba-${saveId}` } });
    expect(remaining).toEqual([]);
  }, 15_000);
});

// Bug real jugando en vivo (2026-08-13, "las estadísticas del inventario inicial no salen"):
// `startingInventoryFor` enlaza cada objeto a su ItemCatalog vía `catalogSlug`, pero nunca
// rellenaba `statBonuses` — a diferencia del saqueo/crafteo real, que sí lo copian del catálogo al
// crear la InventoryItem. `characterName` tiene que ser EXACTAMENTE "Gorhorn" (no un sufijo de
// prueba) — `startingInventoryFor` solo devuelve el kit real para ese nombre exacto.
describe('POST /saves/:id/restart rellena statBonuses del inventario inicial desde el catálogo', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el hacha de guerra inicial trae su bonificador de fuerza del catálogo', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/restart`, payload: {} });
    expect(res.statusCode).toBe(200);

    const hacha = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, name: 'Hacha de guerra rota' } });
    expect(hacha.catalogSlug).toBe('hacha-guerra-maktor-rota');
    expect(hacha.statBonuses).toEqual({ fuerza: 1 });
  }, 15_000);
});

// CR-6 (hito 0.2): la partida nace con su copia del mundo, y el reinicio la rehace desde el
// catálogo (sin duplicar copias).
describe('Mundo por partida al crear y al reiniciar (CR-6)', () => {
  let saveId: string | undefined;

  afterAll(async () => {
    if (saveId) await prisma.save.delete({ where: { id: saveId } });
  });

  it('POST /saves clona el mundo; /restart lo vuelve a clonar sin duplicar', async () => {
    const app = await buildApp();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const res = await app.inject({
      method: 'POST',
      url: '/saves',
      payload: {
        worldSlug: 'helek-sirik',
        characterName: 'Gorhorn de prueba (mundo por partida)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        portraitInitial: 'G',
        introCharacterText: 'Intro del personaje.',
        introWorldText: 'Intro del mundo.',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
      },
    });
    expect(res.statusCode).toBe(200);
    saveId = JSON.parse(res.body).id as string;

    const faccionesCatalogo = await prisma.faction.count({ where: { worldId: world.id, saveId: null } });
    const poblacionCatalogo = await prisma.worldPopulation.count({ where: { worldId: world.id, saveId: null } });
    const estado = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(estado.mundoClonadoEn).not.toBeNull();
    expect(await prisma.faction.count({ where: { saveId, origenSlug: { not: null } } })).toBe(faccionesCatalogo);
    expect(await prisma.worldPopulation.count({ where: { saveId } })).toBe(poblacionCatalogo);

    // QA-37: el rencor de un NPC de la partida anterior no sobrevive al reinicio.
    const gistera = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'gistera-koh' } });
    await prisma.recuerdo.create({ data: { saveId, npcId: gistera.id, sobreTipo: 'PERSONAJE', sobreId: saveId, sucesoId: 'suceso-de-la-partida-anterior', sentimiento: -6, importancia: 7, desdeMinutes: 480 } });

    const reinicio = await app.inject({ method: 'POST', url: `/saves/${saveId}/restart`, payload: {} });
    expect(reinicio.statusCode).toBe(200);
    expect(await prisma.recuerdo.count({ where: { saveId } })).toBe(0);
    const estadoTras = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(estadoTras.mundoClonadoEn).not.toBeNull();
    expect(await prisma.faction.count({ where: { saveId, origenSlug: { not: null } } })).toBe(faccionesCatalogo);
    expect(await prisma.worldPopulation.count({ where: { saveId } })).toBe(poblacionCatalogo);
  }, 30_000);
});
