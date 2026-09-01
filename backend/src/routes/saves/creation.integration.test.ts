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
