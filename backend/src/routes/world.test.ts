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
const findManyDiscoveredEntity = vi.fn();
const findManyLocationVisit = vi.fn();
const findManyFaction = vi.fn();
const findManyHistoriaEntry = vi.fn();

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
    discoveredEntity: { findMany: (...args: unknown[]) => findManyDiscoveredEntity(...args) },
    locationVisit: { findMany: (...args: unknown[]) => findManyLocationVisit(...args) },
    // Secciones "Facciones"/"Historia" (2026-08-06).
    faction: { findMany: (...args: unknown[]) => findManyFaction(...args) },
    historiaEntry: { findMany: (...args: unknown[]) => findManyHistoriaEntry(...args) },
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
    findManyDiscoveredEntity.mockReset().mockResolvedValue([]);
    findManyLocationVisit.mockReset().mockResolvedValue([]);
    findManyFaction.mockReset().mockResolvedValue([]);
    findManyHistoriaEntry.mockReset().mockResolvedValue([]);
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
    expect(body.factions).toEqual([]);
    expect(body.historia).toEqual([]);

    // Contenido estático (berigLore.ts/classAbilities.ts/construction.ts) — no depende de la BD,
    // así que tiene que aparecer siempre, incluso con el mundo recién creado sin catálogo propio.
    expect(body.razas.length).toBeGreaterThan(0);
    expect(body.personajes.length).toBeGreaterThan(0);
    expect(body.classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'GUERRERO' }),
        expect.objectContaining({ name: 'CAZADOR' }),
        expect.objectContaining({ name: 'CHAMAN' }),
      ]),
    );
    expect(body.constructionRecipes.length).toBeGreaterThan(0);
    // Crafteo (2026-08-06): mismo criterio, contenido estático (crafting.ts), no depende de la BD.
    expect(body.craftingRecipes.length).toBeGreaterThan(0);
    // Combate (2026-08-15): mismo criterio, contenido estático (combatLore.ts), no depende de la BD.
    expect(body.combate.length).toBeGreaterThan(0);
    for (const seccion of body.combate) {
      expect(typeof seccion.slug).toBe('string');
      expect(typeof seccion.icon).toBe('string');
      expect(typeof seccion.title).toBe('string');
      expect(typeof seccion.text).toBe('string');
    }
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

  describe('sección "Historia" — candado de traducción (2026-08-06)', () => {
    it('sin requiresTranslation, descubierto = desbloqueado, con el texto real', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyHistoriaEntry.mockResolvedValue([
        { slug: 'la-caida-del-clan-maktor', title: 'La caída del Clan Maktor', era: 'comun', year: 4000, text: 'Texto real.', requiresTranslation: false, documentoItemSlug: 'tablilla-quemada-maktor', translatorNpcSlug: null },
      ]);
      findManyDiscoveredEntity.mockResolvedValue([{ entityType: 'historia', entitySlug: 'la-caida-del-clan-maktor' }]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      const entry = res.json().historia[0];

      expect(entry.discovered).toBe(true);
      expect(entry.unlocked).toBe(true);
      expect(entry.text).toBe('Texto real.');
    });

    it('con requiresTranslation, objeto descubierto pero traductor NO descubierto: bloqueado, texto nulo', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyHistoriaEntry.mockResolvedValue([
        { slug: 'escrito-semillas', title: 'Escrito de las Semillas', era: 'semillas', year: null, text: 'Texto secreto — nunca debería viajar sin desbloquear.', requiresTranslation: true, documentoItemSlug: 'tablilla-semillas', translatorNpcSlug: 'nabierus' },
      ]);
      findManyDiscoveredEntity.mockResolvedValue([{ entityType: 'historia', entitySlug: 'escrito-semillas' }]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      const entry = res.json().historia[0];

      expect(entry.discovered).toBe(true);
      expect(entry.unlocked).toBe(false);
      expect(entry.text).toBeNull();
    });

    it('con requiresTranslation, objeto Y traductor descubiertos: desbloqueado, con el texto real', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyHistoriaEntry.mockResolvedValue([
        { slug: 'escrito-semillas', title: 'Escrito de las Semillas', era: 'semillas', year: null, text: 'Texto secreto.', requiresTranslation: true, documentoItemSlug: 'tablilla-semillas', translatorNpcSlug: 'nabierus' },
      ]);
      findManyDiscoveredEntity.mockResolvedValue([
        { entityType: 'historia', entitySlug: 'escrito-semillas' },
        { entityType: 'npc', entitySlug: 'nabierus' },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      const entry = res.json().historia[0];

      expect(entry.discovered).toBe(true);
      expect(entry.unlocked).toBe(true);
      expect(entry.text).toBe('Texto secreto.');
    });

    it('sin saveId (fuera de una partida), todo sale desbloqueado aunque requiera traducción', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyHistoriaEntry.mockResolvedValue([
        { slug: 'escrito-semillas', title: 'Escrito de las Semillas', era: 'semillas', year: null, text: 'Texto secreto.', requiresTranslation: true, documentoItemSlug: 'tablilla-semillas', translatorNpcSlug: 'nabierus' },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
      const entry = res.json().historia[0];

      expect(entry.discovered).toBe(true);
      expect(entry.unlocked).toBe(true);
      expect(entry.text).toBe('Texto secreto.');
    });
  });

  describe('sección "Facciones"', () => {
    it('descubierta = true solo si su slug está en DiscoveredEntity', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyFaction.mockResolvedValue([
        { slug: 'clan-serhu', name: 'Clan Serhu', raza: 'orcos', description: 'Descripción.' },
      ]);
      findManyDiscoveredEntity.mockResolvedValue([]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      const faccion = res.json().factions[0];

      expect(faccion.discovered).toBe(false);
    });

    it('con saveId, la query de Faction pide catálogo (saveId null) + la fundada en ESA partida, nunca en otra', async () => {
      // Regresión (2026-08-06): `{ saveId: saveId ?? undefined }` dentro de un OR sería un bug real
      // — Prisma omite una condición `undefined` entera (coincide con TODO), así que sin este
      // fix concreto colarían las facciones fundadas de CUALQUIER partida.
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      const app = await buildApp();

      await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });

      expect(findManyFaction).toHaveBeenCalledWith({ where: { worldId: 'world1', OR: [{ saveId: null }, { saveId: 'save1' }] } });
    });

    it('sin saveId, la query de Faction pide solo el catálogo (saveId null) — nunca facciones fundadas de ninguna partida', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      const app = await buildApp();

      await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });

      expect(findManyFaction).toHaveBeenCalledWith({ where: { worldId: 'world1', OR: [{ saveId: null }] } });
    });

    it('la facción fundada en esta partida aparece junto a las del catálogo', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyFaction.mockResolvedValue([
        { slug: 'clan-serhu', name: 'Clan Serhu', raza: 'orcos', description: 'Del catálogo.' },
        { slug: 'maktor-save1', name: 'Maktor', raza: 'orcos', description: 'Fundada por Gorhorn.' },
      ]);
      findManyDiscoveredEntity.mockResolvedValue([
        { entityType: 'faction', entitySlug: 'maktor-save1' },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      const factions = res.json().factions;

      expect(factions).toHaveLength(2);
      const fundada = factions.find((f: { slug: string }) => f.slug === 'maktor-save1');
      expect(fundada.discovered).toBe(true);
    });
  });
});
