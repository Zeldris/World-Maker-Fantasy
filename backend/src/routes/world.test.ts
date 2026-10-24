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
const findUniqueImagePrompt = vi.fn();
const updateImagePrompt = vi.fn();
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
    imagePrompt: {
      findMany: (...args: unknown[]) => findManyImagePrompt(...args),
      findUnique: (...args: unknown[]) => findUniqueImagePrompt(...args),
      update: (...args: unknown[]) => updateImagePrompt(...args),
    },
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
    // Reputación (auditoría de contenido de Enciclopedia, 2026-09-15): mismo criterio, contenido
    // estático (reputationLore.ts), no depende de la BD.
    expect(body.reputacion.length).toBeGreaterThan(0);
    for (const seccion of body.reputacion) {
      expect(typeof seccion.slug).toBe('string');
      expect(typeof seccion.icon).toBe('string');
      expect(typeof seccion.title).toBe('string');
      expect(typeof seccion.text).toBe('string');
    }
  });

  // Bug real jugando en vivo (2026-09-03, "fauna interactuada no se desbloquea en la
  // Enciclopedia"): `buildFaunaFloraSection` solo iteraba fuentes con HarvestYield propio —
  // fauna real combatible SIN drops de despiece (Ruptidar, Nuente...) nunca aparecía en la
  // pestaña Fauna, ni bloqueada ni desbloqueada. `faunaCategoria` (schema.prisma) solo se
  // rellena en fauna real, no en NPCs humanoides — criterio real usado en el fix.
  it('fauna real sin HarvestYield propio (faunaCategoria) SÍ aparece en faunaFlora', async () => {
    findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
    findManyNpc.mockResolvedValue([
      {
        id: 'npc-ruptidar',
        slug: 'ruptidar',
        name: 'Ruptidar',
        kind: 'PLANTILLA',
        role: 'Limpiador de arena',
        faction: null,
        level: 1,
        bio: 'Reptil serpentiforme que filtra materia orgánica bajo la arena.',
        aliases: ['ruptidar'],
        attributes: { fuerza: 1, destreza: 4, constitucion: 3, inteligencia: 1, magia: 0, carisma: 1, voluntad: 2 },
        raza: null,
        clase: null,
        ataqueNatural: 'No ataca.',
        habilidadesRaciales: [],
        homeLocationSlug: null,
        faunaCategoria: 'ESCAMADOS',
        nucleoJugable: true,
        comerciablePct: 0,
        reclutablePct: 0,
        domesticablePct: 0,
        capturablePct: 0,
        cortejablePct: 0,
        atributoResistencia: 'destreza',
      },
    ]);
    findManyDiscoveredEntity.mockResolvedValue([{ entityType: 'npc', entitySlug: 'ruptidar' }]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
    const body = res.json();

    const ruptidar = body.faunaFlora.find((e: { sourceSlug: string }) => e.sourceSlug === 'ruptidar');
    expect(ruptidar).toBeDefined();
    expect(ruptidar.esFauna).toBe(true);
    expect(ruptidar.cazable).toBe(true);
    expect(ruptidar.discovered).toBe(true);
    expect(ruptidar.yields).toEqual([]);
    // No debe duplicarse en la pestaña NPCs — mismo criterio ya existente para fauna CON
    // HarvestYield (comentario histórico de `npcsForEncyclopedia`).
    expect(body.npcs.find((n: { slug: string }) => n.slug === 'ruptidar')).toBeUndefined();

    // Deuda técnica cerrada (2026-09-15): `faunaCategoria` ya se exponía desde 2026-09-04, pero
    // el roster de habilidades que desbloquea esa categoría (con su nivel real) nunca llegaba al
    // frontend — `faunaCategoriaAbilityUnlocksFor` existía sin ningún consumidor real.
    expect(ruptidar.faunaCategoriaUnlocks.length).toBeGreaterThan(0);
    expect(ruptidar.faunaCategoriaUnlocks[0]).toMatchObject({ level: expect.any(Number), ability: expect.objectContaining({ name: expect.any(String) }) });
  });

  // Auditoría de contenido de Enciclopedia (2026-09-15): `Npc.companionOfNpcSlug` ya vinculaba a
  // Gogorath con su dueña Ulkha Ketg desde su siembra, pero el vínculo nunca llegaba al frontend.
  it('companionOfNpc: Gogorath expone el vínculo con su dueña Ulkha Ketg', async () => {
    findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
    findManyNpc.mockResolvedValue([
      {
        id: 'npc-gogorath',
        slug: 'gogorath',
        name: 'Gogorath',
        kind: 'PRINCIPAL',
        role: 'Gargantúa domada de Ulkha Ketg',
        faction: null,
        level: 10,
        bio: 'Macho Gargantúa adulto, cicatriz en el ojo izquierdo.',
        aliases: ['gogorath'],
        attributes: { fuerza: 20, destreza: 6, constitucion: 20, inteligencia: 2, magia: 0, carisma: 2, voluntad: 10 },
        raza: null,
        clase: null,
        ataqueNatural: 'Embestida',
        habilidadesRaciales: [],
        homeLocationSlug: null,
        faunaCategoria: 'GARGANTUAS',
        companionOfNpcSlug: 'ulkha-ketg',
        nucleoJugable: true,
        comerciablePct: 0,
        reclutablePct: 0,
        domesticablePct: 0,
        capturablePct: 0,
        cortejablePct: 0,
        atributoResistencia: null,
      },
      {
        id: 'npc-ulkha-ketg',
        slug: 'ulkha-ketg',
        name: 'Ulkha Ketg',
        kind: 'PRINCIPAL',
        role: "Terk'ikar del Clan Serhu",
        faction: 'Clan Serhu',
        level: 24,
        bio: 'Orca del Clan Serhu.',
        aliases: ['ulkha ketg'],
        attributes: { fuerza: 16, destreza: 28, constitucion: 14, inteligencia: 20, magia: 0, carisma: 15, voluntad: 16 },
        raza: 'orcos',
        clase: 'CAZADOR',
        ataqueNatural: null,
        habilidadesRaciales: [],
        homeLocationSlug: 'campamento-serhu',
        faunaCategoria: null,
        nucleoJugable: true,
        comerciablePct: 0,
        reclutablePct: 0,
        domesticablePct: 0,
        capturablePct: 0,
        cortejablePct: 0,
        atributoResistencia: 'voluntad',
      },
    ]);
    findManyDiscoveredEntity.mockResolvedValue([{ entityType: 'npc', entitySlug: 'gogorath' }]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
    const body = res.json();

    const gogorath = body.faunaFlora.find((e: { sourceSlug: string }) => e.sourceSlug === 'gogorath');
    expect(gogorath).toBeDefined();
    expect(gogorath.companionOfNpc).toEqual({ slug: 'ulkha-ketg', name: 'Ulkha Ketg' });
  });

  // Auditoría de contenido de Enciclopedia (2026-09-15): los 3 NPC de prueba por raza
  // (worldCatalog.ts, "NPC DE PRUEBA POR RAZA") son andamiaje de QA, no lore real — se mezclaban
  // sin distinción junto a personajes reales en la pestaña NPCs.
  it('NPC de prueba técnica (goirnte-renegado) NO aparece en la pestaña NPCs de la Enciclopedia', async () => {
    findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
    findManyNpc.mockResolvedValue([
      {
        id: 'npc-goirnte-renegado',
        slug: 'goirnte-renegado',
        name: 'Goirnte Renegado',
        kind: 'PLANTILLA',
        role: 'NPC de prueba — Goirnte hostil sin trama, para verificar mecánica de raza/clase en vivo',
        faction: null,
        level: 1,
        bio: 'Un Goirnte expulsado de la Meseta del Orden por una deuda de honor que nunca reconoció.',
        aliases: ['goirnte renegado'],
        attributes: { fuerza: 10, destreza: 8, constitucion: 12, inteligencia: 8, magia: 2, carisma: 6, voluntad: 8 },
        raza: 'goirntes',
        clase: 'CABALLERO',
        ataqueNatural: null,
        habilidadesRaciales: [],
        homeLocationSlug: null,
        faunaCategoria: null,
        nucleoJugable: false,
        comerciablePct: 0,
        reclutablePct: 0,
        domesticablePct: 0,
        capturablePct: 0,
        cortejablePct: 0,
        atributoResistencia: 'inteligencia',
      },
      {
        id: 'npc-torgash-ketg',
        slug: 'torgash-ketg',
        name: 'Torgash Ketg',
        kind: 'PRINCIPAL',
        role: "Kort'ikar del Clan Serhu",
        faction: 'Clan Serhu',
        level: 20,
        bio: 'Orco del Clan Serhu, de las Llanuras del Viento Rojo.',
        aliases: ['Torgash Ketg'],
        attributes: { fuerza: 26, destreza: 14, constitucion: 32, inteligencia: 12, magia: 8, carisma: 12, voluntad: 22 },
        raza: 'orcos',
        clase: 'GUERRERO',
        ataqueNatural: null,
        habilidadesRaciales: [],
        homeLocationSlug: 'campamento-serhu',
        faunaCategoria: null,
        nucleoJugable: true,
        comerciablePct: 0,
        reclutablePct: 0,
        domesticablePct: 0,
        capturablePct: 0,
        cortejablePct: 0,
        atributoResistencia: 'voluntad',
      },
    ]);
    findManyDiscoveredEntity.mockResolvedValue([]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
    const body = res.json();

    expect(body.npcs.find((n: { slug: string }) => n.slug === 'goirnte-renegado')).toBeUndefined();
    expect(body.npcs.find((n: { slug: string }) => n.slug === 'torgash-ketg')).toBeDefined();
  });

  it('fauna sin faunaCategoria asignada todavía en el catálogo: faunaCategoriaUnlocks vacío, sin reventar', async () => {
    // `faunaCategoria: null` solo es alcanzable en `faunaFlora` por el camino de HarvestYield
    // propio (el bucle de fauna-sin-yield de world.ts exige `n.faunaCategoria` truthy antes de
    // añadirla) — mismo patrón de fixture que el test de "Leche de Múrgol" de abajo, con un NPC
    // real detrás del sourceSlug esta vez.
    findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
    findManyNpc.mockResolvedValue([
      {
        id: 'npc-sin-categoria',
        slug: 'fauna-sin-categoria',
        name: 'Fauna sin categoría',
        kind: 'PLANTILLA',
        role: 'x',
        faction: null,
        level: 1,
        bio: 'x',
        aliases: ['fauna sin categoria'],
        attributes: { fuerza: 1, destreza: 1, constitucion: 1, inteligencia: 1, magia: 0, carisma: 1, voluntad: 1 },
        raza: null,
        clase: null,
        ataqueNatural: 'No ataca.',
        habilidadesRaciales: [],
        homeLocationSlug: null,
        faunaCategoria: null,
        nucleoJugable: true,
        comerciablePct: 0,
        reclutablePct: 0,
        domesticablePct: 0,
        capturablePct: 0,
        cortejablePct: 0,
        atributoResistencia: 'destreza',
      },
    ]);
    findManyHarvestYield.mockResolvedValue([
      {
        id: 'hy-sin-categoria',
        worldId: 'world1',
        sourceSlug: 'fauna-sin-categoria',
        sourceCategory: 'fauna',
        itemId: 'item-sin-categoria',
        cantidad: 1,
        condicion: null,
        metodoObtencion: 'CAZA',
        sinTirada: false,
        requiereHerramienta: false,
        estacionRequerida: null,
        climaRequerido: null,
        item: { id: 'item-sin-categoria', worldId: 'world1', slug: 'item-sin-categoria', name: 'Ítem de prueba', aliases: [] },
      },
    ]);
    findManyDiscoveredEntity.mockResolvedValue([]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const entry = body.faunaFlora.find((e: { sourceSlug: string }) => e.sourceSlug === 'fauna-sin-categoria');
    expect(entry).toBeDefined();
    expect(entry.faunaCategoriaUnlocks).toEqual([]);
  });

  // Bug real (hallazgo 22, revisar-partida-hallazgos.md 2026-09-07): "Leche de Múrgol" salía con
  // icono/etiqueta de flora ("Múrgoles domados" bajo un icono de hoja) pese a ser producto animal
  // — misma causa raíz que Cornante/Espina del Viento/Sombra de Kroj (`harvestSourcesThatAreFaunaWithoutNpc`,
  // worldCatalog.ts): el `sourceSlug` real de esta HarvestYield es `murgoles-domados-campamento`
  // (a propósito, DISTINTO del Npc `murgol`, por la invariante de metodoObtencion compartido —
  // ver comentario junto a su ficha en worldCatalog.ts), así que `ctx.npcSlugs.has(sourceSlug)`
  // siempre daba `false` sin el Set de excepción.
  it('leche de Múrgol (sourceSlug sin Npc propio) SÍ se categoriza como fauna en faunaFlora', async () => {
    findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
    findManyHarvestYield.mockResolvedValue([
      {
        id: 'hy-murgol-leche',
        worldId: 'world1',
        sourceSlug: 'murgoles-domados-campamento',
        sourceCategory: 'fauna',
        itemId: 'item-leche-murgol',
        cantidad: 3,
        condicion: null,
        metodoObtencion: 'PASIVO',
        sinTirada: false,
        requiereHerramienta: false,
        estacionRequerida: null,
        climaRequerido: null,
        item: {
          id: 'item-leche-murgol',
          worldId: 'world1',
          slug: 'leche-murgol',
          name: 'Leche de Múrgol',
          aliases: ['leche de murgol'],
          category: 'alimento',
          tipo: 'RECURSO',
          valorGoirnos: 1,
          description: 'Leche del recinto de Múrgol domados del Campamento del Clan Serhu.',
        },
      },
    ]);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
    const body = res.json();

    const murgol = body.faunaFlora.find((e: { sourceSlug: string }) => e.sourceSlug === 'murgoles-domados-campamento');
    expect(murgol).toBeDefined();
    expect(murgol.esFauna).toBe(true);
    // P162 (QA-27): el nombre de su punto en el mapa también es alias, para enlazarlo entero.
    expect(murgol.aliases).toContain('recinto de múrgoles domados');
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

  // P41 (QA-27): la Capital de la jugadora («Hogar de Maktor», alias «maktor») enlazaba cada
  // «Maktor» del texto como lugar; y se pedían también los lugares de otras partidas.
  describe('P41 — lugares de la partida en la Enciclopedia', () => {
    it('pide solo los del catálogo y los de esta partida, y los de la partida van sin alias', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyLocation.mockResolvedValue([
        { id: 'l1', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', aliases: ['ruinas de maktor'], region: 'Llanuras', kind: 'hito', description: 'x', saveId: null },
        { id: 'l2', slug: 'hogar-de-maktor-save1', name: 'Hogar de Maktor', aliases: ['maktor'], region: 'Llanuras', kind: 'interior', description: 'x', saveId: 'save1' },
      ]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      expect(findManyLocation).toHaveBeenCalledWith({ where: { worldId: 'world1', OR: [{ saveId: null }, { saveId: 'save1' }] } });
      const porSlug = Object.fromEntries((res.json().locations as { slug: string; aliases: string[] }[]).map((l) => [l.slug, l.aliases]));
      expect(porSlug['restos-de-maktor']).toEqual(['ruinas de maktor']);
      expect(porSlug['hogar-de-maktor-save1']).toEqual([]);
    });
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

      expect(findManyFaction).toHaveBeenCalledWith({
        where: { worldId: 'world1', OR: [{ saveId: null }, { saveId: 'save1', origenSlug: null }] },
        include: { liderNpc: { select: { slug: true, name: true } } },
      });
    });

    it('sin saveId, la query de Faction pide solo el catálogo (saveId null) — nunca facciones fundadas de ninguna partida', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      const app = await buildApp();

      await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });

      expect(findManyFaction).toHaveBeenCalledWith({
        where: { worldId: 'world1', OR: [{ saveId: null }] },
        include: { liderNpc: { select: { slug: true, name: true } } },
      });
    });

    // Líder de GOBIERNO (§ 7.2, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md, 2026-09-21) — el campo existía en
    // el schema (Faction.liderNpcId, FK real) desde la sesión anterior, pero nunca se serializaba
    // al cliente. Cierra ese hueco.
    it('serializa liderNpc (slug/name) cuando la Faction tiene un líder real sembrado', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyFaction.mockResolvedValue([
        { slug: 'clan-serhu', name: 'Clan Serhu', raza: 'orcos', description: 'x', liderNpc: { slug: 'ulkha-ketg', name: 'Ulkha Ketg' } },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });

      expect(res.json().factions[0].liderNpc).toEqual({ slug: 'ulkha-ketg', name: 'Ulkha Ketg' });
    });

    it('liderNpc es null cuando la Faction todavía no tiene líder sembrado', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyFaction.mockResolvedValue([
        { slug: 'clan-goshg', name: 'Clan Goshg', raza: 'orcos', description: 'x', liderNpc: null },
      ]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });

      expect(res.json().factions[0].liderNpc).toBeNull();
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

  // Deuda técnica cerrada (2026-09-15, auditoría): `discoveryFaseFor` (rediseño de 3 fases,
  // 2026-09-08) nunca tuvo test directo pese a tener ramas no triviales — la contraparte de
  // ESCRITURA (entityDiscovery.test.ts, qué fase grabar) sí estaba bien cubierta, pero la
  // LECTURA que sirve esa fase al frontend, con su propio caso especial `nucleoJugable`
  // duplicado, no tenía cobertura directa. Usa la sección "Facciones" como vehículo (ya expone
  // `fase` en su respuesta) por ser el fixture más simple del archivo, sin relación real con
  // Facciones en sí — cualquier sección serviría igual, `discoveryFaseFor` es genérica.
  describe('discoveryFaseFor (rediseño de 3 fases, 2026-09-08)', () => {
    it('sin fila en DiscoveredEntity: NO_DESCUBIERTO', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyFaction.mockResolvedValue([{ slug: 'clan-serhu', name: 'Clan Serhu', raza: 'orcos', description: 'x' }]);
      findManyDiscoveredEntity.mockResolvedValue([]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      expect(res.json().factions[0].fase).toBe('NO_DESCUBIERTO');
    });

    it('con fila fase CITADO: CITADO tal cual, no se sube sola a DESCUBIERTO', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyFaction.mockResolvedValue([{ slug: 'clan-serhu', name: 'Clan Serhu', raza: 'orcos', description: 'x' }]);
      findManyDiscoveredEntity.mockResolvedValue([{ entityType: 'faction', entitySlug: 'clan-serhu', fase: 'CITADO' }]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      expect(res.json().factions[0].fase).toBe('CITADO');
    });

    it('con fila fase DESCUBIERTO: DESCUBIERTO tal cual', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyFaction.mockResolvedValue([{ slug: 'clan-serhu', name: 'Clan Serhu', raza: 'orcos', description: 'x' }]);
      findManyDiscoveredEntity.mockResolvedValue([{ entityType: 'faction', entitySlug: 'clan-serhu', fase: 'DESCUBIERTO' }]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      expect(res.json().factions[0].fase).toBe('DESCUBIERTO');
    });

    it('sin saveId (fuera de partida): siempre DESCUBIERTO, aunque no haya ninguna fila', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyFaction.mockResolvedValue([{ slug: 'clan-serhu', name: 'Clan Serhu', raza: 'orcos', description: 'x' }]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia' });
      expect(res.json().factions[0].fase).toBe('DESCUBIERTO');
    });

    it('NPC con nucleoJugable: false: siempre DESCUBIERTO, aunque no haya ninguna fila (caso especial duplicado con isDiscovered)', async () => {
      findUniqueWorld.mockResolvedValue({ id: 'world1', slug: 'helek-sirik' });
      findManyNpc.mockResolvedValue([
        {
          id: 'npc-fuera-nucleo',
          slug: 'sella-marn',
          name: 'Sella Marn',
          kind: 'PRINCIPAL',
          role: 'x',
          faction: null,
          level: 5,
          bio: 'x',
          aliases: ['sella marn'],
          attributes: { fuerza: 5, destreza: 5, constitucion: 5, inteligencia: 5, magia: 0, carisma: 5, voluntad: 5 },
          raza: 'orcos',
          clase: null,
          ataqueNatural: null,
          habilidadesRaciales: [],
          homeLocationSlug: null,
          faunaCategoria: null,
          nucleoJugable: false,
          comerciablePct: 0,
          reclutablePct: 0,
          domesticablePct: 0,
          capturablePct: 0,
          cortejablePct: 0,
          atributoResistencia: 'voluntad',
        },
      ]);
      findManyDiscoveredEntity.mockResolvedValue([]);
      const app = await buildApp();

      const res = await app.inject({ method: 'GET', url: '/world/helek-sirik/enciclopedia?saveId=save1' });
      const npc = res.json().npcs.find((n: { slug: string }) => n.slug === 'sella-marn');
      expect(npc.fase).toBe('DESCUBIERTO');
    });
  });
});

describe('CFG-38 — prompt de imagen usado', () => {
  const clave = { entityType: 'fauna', entitySlug: 'murgol-macho', sizeProfile: 'banner' };
  const fila = { prompt: 'base generada', promptUsado: null, promptUsadoAt: null };
  beforeEach(() => {
    findUniqueWorld.mockReset().mockResolvedValue({ id: 'w1', slug: 'berig' });
    findUniqueImagePrompt.mockReset();
    updateImagePrompt.mockReset().mockImplementation(async ({ data }) => ({ ...fila, ...data }));
  });

  it('GET devuelve el base y el usado de la fila', async () => {
    const at = new Date('2026-10-24T18:00:00Z');
    findUniqueImagePrompt.mockResolvedValue({ ...fila, promptUsado: 'mi versión', promptUsadoAt: at });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/world/berig/image-prompt', query: clave });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ prompt: 'base generada', promptUsado: 'mi versión', promptUsadoAt: at.toISOString() });
  });

  it('GET sin fila devuelve todo a null, y con clave mala da 400 con el motivo', async () => {
    findUniqueImagePrompt.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/world/berig/image-prompt', query: clave });
    expect(res.json()).toEqual({ prompt: null, promptUsado: null, promptUsadoAt: null });
    const mala = await app.inject({ method: 'GET', url: '/world/berig/image-prompt', query: { ...clave, sizeProfile: 'gigante' } });
    expect(mala.statusCode).toBe(400);
    expect(mala.json().error).toBe('sizeProfile inválido');
  });

  it('PUT guarda el usado recortado, con fecha, sin tocar el prompt base', async () => {
    findUniqueImagePrompt.mockResolvedValue(fila);
    const app = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/world/berig/image-prompt/usado', payload: { ...clave, promptUsado: '  mi versión  ' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().promptUsado).toBe('mi versión');
    const { data } = updateImagePrompt.mock.calls[0][0];
    expect(data.promptUsado).toBe('mi versión');
    expect(data.promptUsadoAt).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty('prompt');
  });

  it('PUT con texto vacío borra el usado y su fecha', async () => {
    findUniqueImagePrompt.mockResolvedValue({ ...fila, promptUsado: 'vieja', promptUsadoAt: new Date() });
    const app = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/world/berig/image-prompt/usado', payload: { ...clave, promptUsado: '   ' } });
    expect(res.json()).toEqual({ promptUsado: null, promptUsadoAt: null });
    expect(updateImagePrompt.mock.calls[0][0].data).toEqual({ promptUsado: null, promptUsadoAt: null });
  });

  it('PUT sin prompt base da 404 y no escribe nada', async () => {
    findUniqueImagePrompt.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/world/berig/image-prompt/usado', payload: { ...clave, promptUsado: 'x' } });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/prompt base/);
    expect(updateImagePrompt).not.toHaveBeenCalled();
  });
});
