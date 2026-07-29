import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría 2026-07-22): `world.ts` tenía 0% de test pese a ser el endpoint que
/// más ha cambiado esta sesión (razas/fauna/NPCs por sexo, medidas, objetos con dimensiones...).
/// Alcance acotado a GET /world/:slug/enciclopedia: que responda 404 si el mundo no existe, y que
/// la forma de la respuesta con catálogos vacíos incluya el contenido estático (razas, clases,
/// habilidades iniciales, recetas de construcción) sin reventar — el resto de combinaciones
/// (NPCs/objetos/fauna reales, prompts de imagen) ya se ejercitan indirectamente jugando la
/// partida real y quedan fuera de este test acotado.
const findUniqueWorld = vi.fn();
const findManyNpc = vi.fn();
const findManyItemCatalog = vi.fn();
const findManyHarvestYield = vi.fn();
const findManyLocation = vi.fn();
const findManyImagePrompt = vi.fn();
const findManyNpcItem = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    world: { findUnique: (...args: unknown[]) => findUniqueWorld(...args) },
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    itemCatalog: { findMany: (...args: unknown[]) => findManyItemCatalog(...args) },
    harvestYield: { findMany: (...args: unknown[]) => findManyHarvestYield(...args) },
    location: { findMany: (...args: unknown[]) => findManyLocation(...args) },
    imagePrompt: { findMany: (...args: unknown[]) => findManyImagePrompt(...args) },
    // Rediseño de la vista de combate (2026-07-28): "Ataque base" se calcula en el propio backend
    // a partir del loadout de arma(s) de cada NPC, ver npcItem.findMany en world.ts.
    npcItem: { findMany: (...args: unknown[]) => findManyNpcItem(...args) },
  },
}));

const { worldRoutes } = await import('./world.js');

async function buildApp() {
  const app = Fastify();
  await app.register(worldRoutes);
  return app;
}

describe('GET /world/:slug/enciclopedia', () => {
  beforeEach(() => {
    findUniqueWorld.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyItemCatalog.mockReset().mockResolvedValue([]);
    findManyHarvestYield.mockReset().mockResolvedValue([]);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyImagePrompt.mockReset().mockResolvedValue([]);
    findManyNpcItem.mockReset().mockResolvedValue([]);
  });

  it('404 si el mundo no existe', async () => {
    findUniqueWorld.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/world/no-existe/enciclopedia' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Mundo no encontrado' });
  });

  it('con catálogos vacíos, devuelve igualmente el contenido estático completo', async () => {
    findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.npcs).toEqual([]);
    expect(body.items).toEqual([]);
    expect(body.faunaFlora).toEqual([]);
    expect(body.locations).toEqual([]);

    // Contenido estático (berigLore.ts/classAbilities.ts/construction.ts) — no depende de la BD,
    // así que tiene que aparecer siempre, incluso con el mundo recién creado sin catálogo propio.
    expect(body.razas.length).toBeGreaterThan(0);
    expect(body.personajes.length).toBeGreaterThan(0);
    expect(body.classes).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Guerrero' }), expect.objectContaining({ name: 'Cazador' })]),
    );
    expect(body.constructionRecipes.length).toBeGreaterThan(0);
  });

  it('cada raza con variantes regionales expone su propio sexo cruzado con región', async () => {
    findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
    const body = res.json();

    const orcos = body.razas.find((r: { slug: string }) => r.slug === 'orcos');
    expect(orcos.variantes.length).toBeGreaterThan(0);
    for (const variante of orcos.variantes) {
      expect(variante.variantesSexo).toEqual(
        expect.arrayContaining([expect.objectContaining({ sexo: 'macho' }), expect.objectContaining({ sexo: 'hembra' })]),
      );
      for (const sexoVariante of variante.variantesSexo) {
        expect(typeof sexoVariante.medidaCm).toBe('number');
        expect(typeof sexoVariante.edadMaxima).toBe('number');
      }
    }
  });
});
