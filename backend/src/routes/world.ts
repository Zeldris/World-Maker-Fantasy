import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { harvestSourceAliases, harvestSourceDescriptions, harvestSourcesThatAreFaunaWithoutNpc } from '../scripts/worldCatalog.js';
import { classAbilityUnlocksForClase } from '../services/classAbilities.js';
import { startingAbilitiesFor } from '../services/startingAbilities.js';
import { CONSTRUCTION_RECIPES } from '../services/construction.js';
import { slugify } from '../lib/slugify.js';
import { generateImagePrompt, type ImagePromptEntityType, type ImagePromptSizeProfile } from '../services/imagePromptGenerator.js';
import { loreContextFor } from '../services/imagePromptContext.js';
import { imageUrlsFor } from '../lib/imageAssets.js';
import { BERIG_RAZAS, BERIG_PERSONAJES } from '../services/berigLore.js';
import {
  FAUNA_SEXO_VARIANTES,
  NPC_SEXO_VARIANTES,
  RAZA_SEXO_VARIANTES,
  RAZA_VARIANTE_SEXO_VARIANTES,
  type SexoVariantesEntry,
} from '../services/sexDimorphism.js';

/// Catálogo de ubicaciones de un mundo (docs/12-mundo-estructurado.md § "Frontend", pendiente
/// desde esa sesión): antes `frontend/src/data/map.ts` duplicaba a mano nombres/descripciones de
/// `Location` — una sola fuente de verdad ahora. Incluye `LocationLink` (con `riesgo`) para que el
/// mapa dibuje aristas reales sin repetir esa tabla también en el frontend.
export async function worldRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/world/:slug/locations', async (request, reply) => {
    const world = await prisma.world.findUnique({ where: { slug: request.params.slug } });
    if (!world) {
      return reply.status(404).send({ error: 'Mundo no encontrado' });
    }

    const [locations, links, imagePrompts] = await Promise.all([
      prisma.location.findMany({ where: { worldId: world.id } }),
      prisma.locationLink.findMany({ where: { from: { worldId: world.id } } }),
      prisma.imagePrompt.findMany({ where: { worldId: world.id, entityType: 'location' } }),
    ]);
    const slugById = new Map(locations.map((l) => [l.id, l.slug]));
    // Mismo par imagePrompts/imageUrls que /world/:slug/enciclopedia (2026-07-23): el mapa abre el
    // mismo DetailModal al pulsar un nodo, así que necesita poder generar/mostrar la misma imagen.
    const promptByKey = new Map(imagePrompts.map((p) => [`${p.entitySlug}:${p.sizeProfile}`, p.prompt]));

    return {
      locations: locations.map((l) => ({
        id: l.id,
        slug: l.slug,
        name: l.name,
        region: l.region,
        kind: l.kind,
        description: l.description,
        aliases: l.aliases,
        imagePrompts: {
          thumbnail: promptByKey.get(`${l.slug}:thumbnail`) ?? null,
          banner: promptByKey.get(`${l.slug}:banner`) ?? null,
        },
        imageUrls: imageUrlsFor('location', l.slug),
        // Este endpoint (grafo del mapa) no gatea por enciclopedia progresiva — el mapa ya tiene
        // su propia "niebla de guerra" por posesión del objeto "Mapa de las Llanuras" (MapaPanel.tsx).
        discovered: true,
      })),
      links: links.map((link) => ({
        fromSlug: slugById.get(link.fromId) ?? link.fromId,
        toSlug: slugById.get(link.toId) ?? link.toId,
        minutosBase: link.minutosBase,
        terreno: link.terreno,
        riesgo: link.riesgo,
      })),
    };
  });

  // Enciclopedia (roadmap 2026-07-21, petición explícita de la usuaria): catálogo consultable de
  // NPCs/objetos/fauna-flora, categorizado, para poder citar elementos reales del mundo en el
  // composer (mismo problema que "no sabía qué nombre usar para provocar un combate" — esto lo
  // resuelve mostrándole directamente los nombres/alias reales que el motor ya reconoce).
  app.get<{ Params: { slug: string }; Querystring: { saveId?: string } }>('/world/:slug/enciclopedia', async (request, reply) => {
    const world = await prisma.world.findUnique({ where: { slug: request.params.slug } });
    if (!world) {
      return reply.status(404).send({ error: 'Mundo no encontrado' });
    }

    const { saveId } = request.query;

    const [npcs, items, yields, locations, imagePrompts, discoveredEntities, locationVisits] = await Promise.all([
      prisma.npc.findMany({ where: { worldId: world.id } }),
      prisma.itemCatalog.findMany({ where: { worldId: world.id } }),
      prisma.harvestYield.findMany({ where: { worldId: world.id }, include: { item: true } }),
      prisma.location.findMany({ where: { worldId: world.id } }),
      prisma.imagePrompt.findMany({ where: { worldId: world.id } }),
      // Enciclopedia progresiva (sesión de diseño 2026-07-23) — sin `saveId` (p.ej. si algún día
      // se consulta el catálogo fuera del contexto de una partida concreta), no se filtra nada:
      // `discovered` sale `true` para todo, mismo comportamiento que antes de este cambio.
      saveId ? prisma.discoveredEntity.findMany({ where: { saveId } }) : Promise.resolve([]),
      saveId ? prisma.locationVisit.findMany({ where: { saveId } }) : Promise.resolve([]),
    ]);

    const isDiscovered = (entityType: string, entitySlug: string): boolean =>
      !saveId || discoveredEntities.some((d) => d.entityType === entityType && d.entitySlug === entitySlug);
    const visitedLocationIds = new Set(locationVisits.map((v) => v.locationId));
    const isLocationDiscovered = (locationId: string): boolean => !saveId || visitedLocationIds.has(locationId);

    // Prompts de imagen (checklist 2026-07-21/22, punto 7): generados bajo demanda (POST más
    // abajo) o por seedImagePrompts.ts, la Enciclopedia solo los lee y expone si ya existen. Dos
    // perfiles por entrada (thumbnail/banner, ver imagePromptGenerator.ts) — se exponen juntos en
    // un objeto para que el frontend sepa cuál de los dos le falta todavía.
    const promptByKey = new Map(imagePrompts.map((p) => [`${p.entityType}:${p.entitySlug}:${p.sizeProfile}`, p.prompt]));
    const imagePromptsFor = (entityType: ImagePromptEntityType, entitySlug: string) => ({
      thumbnail: promptByKey.get(`${entityType}:${entitySlug}:thumbnail`) ?? null,
      banner: promptByKey.get(`${entityType}:${entitySlug}:banner`) ?? null,
    });

    // Variantes por sexo (2026-07-22, ver sexDimorphism.ts): mismo slug base + sufijo -macho/
    // -hembra para su propia imagen, igual que las variantes regionales de raza — undefined si la
    // entidad no tiene entrada en el mapa (la inmensa mayoría de NPCs, todos los PRINCIPAL con
    // nombre propio, y toda la flora/mineral).
    const variantesSexoFor = (entityType: 'npc' | 'fauna' | 'raza', baseSlug: string, variantes: Record<string, SexoVariantesEntry>) => {
      const entry = variantes[baseSlug];
      if (!entry) return undefined;
      return (['macho', 'hembra'] as const).map((sexo) => ({
        sexo,
        rasgoFisico: entry[sexo].rasgoFisico,
        description: entry[sexo].description,
        medidaCm: entry[sexo].medidaCm,
        edadMaxima: entry[sexo].edadMaxima,
        imagePrompts: imagePromptsFor(entityType, `${baseSlug}-${sexo}`),
        imageUrls: imageUrlsFor(entityType, `${baseSlug}-${sexo}`),
      }));
    };

    const npcSlugs = new Set(npcs.map((n) => n.slug));
    const npcBySlug = new Map(npcs.map((n) => [n.slug, n]));
    const yieldsBySource = new Map<string, { itemName: string; cantidad: number; condicion: string | null }[]>();
    const sourceNameBySlug = new Map<string, string>();
    for (const y of yields) {
      sourceNameBySlug.set(y.sourceSlug, y.sourceName);
      const list = yieldsBySource.get(y.sourceSlug) ?? [];
      list.push({ itemName: y.item.name, cantidad: y.cantidad, condicion: y.condicion });
      yieldsBySource.set(y.sourceSlug, list);
    }
    // Hallazgo real de Fable (2026-07-21): worldCatalog.ts siembra la fauna cazable como Npc
    // PLANTILLA (`allNpcs = [...npcs, ...fauna]`) para que el motor de escena la reconozca igual
    // que a una persona — pero eso hacía que la Enciclopedia listara cada animal DOS veces (en
    // "NPCs" con su ficha de personaje y en "Fauna y flora" con sus recursos). La pestaña NPCs
    // se queda solo con los que no tienen ninguna fuente de cosecha propia.
    const npcsForEncyclopedia = npcs.filter((n) => !sourceNameBySlug.has(n.slug));

    return {
      npcs: npcsForEncyclopedia.map((n) => ({
        slug: n.slug,
        name: n.name,
        kind: n.kind,
        role: n.role,
        faction: n.faction,
        level: n.level,
        bio: n.bio,
        aliases: n.aliases,
        imagePrompts: imagePromptsFor('npc', n.slug),
        imageUrls: imageUrlsFor('npc', n.slug),
        variantesSexo: variantesSexoFor('npc', n.slug, NPC_SEXO_VARIANTES),
        discovered: isDiscovered('npc', n.slug),
      })),
      items: items.map((i) => ({
        slug: i.slug,
        name: i.name,
        category: i.category,
        description: i.description,
        statBonusAttribute: i.statBonusAttribute,
        statBonusAmount: i.statBonusAmount,
        dimensiones: i.dimensiones,
        lugarOrigen: i.lugarOrigen,
        tier: i.tier,
        requisitos: i.requisitos as Record<string, number> | null,
        imagePrompts: imagePromptsFor('item', i.slug),
        imageUrls: imageUrlsFor('item', i.slug),
        discovered: isDiscovered('item', i.slug),
      })),
      // `description` (2026-07-22, misma auditoría que destapó el bug de loreContextFor): antes
      // esta pestaña no exponía NINGÚN texto descriptivo de la criatura/planta, solo sus recursos
      // cosechables — el bio real vivía en el Npc (fauna cazable) o en harvestSourceDescriptions
      // (flora/mineral sin Npc propio, ver worldCatalog.ts) pero nunca llegaba al frontend.
      faunaFlora: Array.from(sourceNameBySlug.entries()).map(([sourceSlug, sourceName]) => ({
        sourceSlug,
        sourceName,
        aliases: harvestSourceAliases[sourceSlug] ?? [],
        // `cazable` (mecánica real, ver harvest.ts): solo true si existe Npc con este slug — no
        // tocar, condiciona si hace falta derrotarlo antes de poder despiezarlo.
        cazable: npcSlugs.has(sourceSlug),
        // `esFauna` (bug real 2026-07-22, separado a propósito de `cazable`): si es un animal de
        // verdad, tenga o no ficha de combate — Espina del Viento/Cornante/Sombra de Kroj son
        // fauna sin Npc propio (peligro ambiental o fuera del núcleo jugable), no flora/mineral.
        esFauna: npcSlugs.has(sourceSlug) || harvestSourcesThatAreFaunaWithoutNpc.has(sourceSlug),
        description: npcBySlug.get(sourceSlug)?.bio ?? harvestSourceDescriptions[sourceSlug] ?? null,
        yields: yieldsBySource.get(sourceSlug) ?? [],
        imagePrompts: imagePromptsFor('fauna', sourceSlug),
        imageUrls: imageUrlsFor('fauna', sourceSlug),
        variantesSexo: variantesSexoFor('fauna', sourceSlug, FAUNA_SEXO_VARIANTES),
        discovered: isDiscovered('fauna', sourceSlug),
      })),
      // Lugares (2026-07-23): gateado por `LocationVisit` (visita física real), no por mención en
      // narración — eje independiente de DiscoveredEntity (ver comentario del modelo en schema.prisma).
      locations: locations.map((l) => ({
        slug: l.slug,
        name: l.name,
        region: l.region,
        kind: l.kind,
        description: l.description,
        imagePrompts: imagePromptsFor('location', l.slug),
        imageUrls: imageUrlsFor('location', l.slug),
        discovered: isLocationDiscovered(l.id),
      })),
      // Razas y personajes jugables de Berig (2026-07-22): contenido estático (ver berigLore.ts),
      // mismo patrón que `classes` de abajo — no depende de ninguna tabla de este mundo en la BD.
      razas: BERIG_RAZAS.map((r) => ({
        ...r,
        imagePrompts: imagePromptsFor('raza', r.slug),
        imageUrls: imageUrlsFor('raza', r.slug),
        // Sexo (2026-07-22, "nos dejamos las razas también"): a nivel de RAZA GENERAL — solo
        // presente en razas SIN variantes regionales (Goirntes, Nabieus, Faerus). Orcos no tiene
        // entrada aquí (`RAZA_SEXO_VARIANTES` no la incluye a propósito): su sexo va cruzado con
        // la región, ver más abajo.
        variantesSexo: variantesSexoFor('raza', r.slug, RAZA_SEXO_VARIANTES),
        // Variantes regionales (2026-07-22, "al pulsar orcos aun pudiese elegir el tipo según la
        // región") — cada una con su propia imagen, mismo entityType 'raza' que la raza padre.
        // Sexo CRUZADO con región (2026-07-22, "sí, cruzar para Orcos"): cada variante regional
        // tiene su propio par macho/hembra, con imagen propia `<variante>-<sexo>`.
        variantes: r.variantes?.map((v) => ({
          ...v,
          imagePrompts: imagePromptsFor('raza', v.slug),
          imageUrls: imageUrlsFor('raza', v.slug),
          variantesSexo: variantesSexoFor('raza', v.slug, RAZA_VARIANTE_SEXO_VARIANTES),
        })),
      })),
      personajes: BERIG_PERSONAJES.map((p) => ({
        ...p,
        imagePrompts: imagePromptsFor('personaje', p.slug),
        imageUrls: imageUrlsFor('personaje', p.slug),
      })),
      // Habilidades iniciales del PERSONAJE (2026-07-22, separado de `classes` de abajo): Furia de
      // Maktor/Piel de Guerra son el kit personal de Gorhorn (nombran su clan/hacha rota a
      // propósito) — no pertenecen a ninguna de las dos clases genéricas, así que ya no viven
      // anidadas dentro de una de ellas. Cuando haya más personajes jugables, esto pasa a
      // depender de cuál esté activo, no solo 'Gorhorn'.
      startingAbilities: startingAbilitiesFor('Gorhorn')
        .filter((a) => a.category === 'combate')
        .map((a) => ({
          ...a,
          imagePrompts: imagePromptsFor('ability', slugify(a.name)),
          imageUrls: imageUrlsFor('ability', slugify(a.name)),
        })),
      // Clases (roadmap 2026-07-21, separadas en dos el 2026-07-22 — petición explícita: "Guerrero
      // es una clase y Cazador es otra con sus propias habilidades! Gorhorn es una variante
      // especial que le permite aprender las habilidades de ambas"): contenido de diseño estático,
      // no depende del mundo en la base de datos. Cada clase expone solo SU roster
      // (`classAbilityUnlocksForClase`) — Gorhorn sigue aprendiendo de las dos (ver
      // `classAbilityUnlocksFor` en el motor de turnos, sin cambios), pero la Enciclopedia ya
      // puede mostrarlas como dos árboles independientes.
      classes: (['Guerrero', 'Cazador'] as const).map((clase) => ({
        name: clase,
        description:
          clase === 'Guerrero'
            ? 'Fuerza bruta y aguante en primera línea — golpea directo, encaja el golpe y no cede terreno.'
            : 'Reflejos, puntería a distancia e instinto de rastreo — hiere antes de ser visto y remata sin errar.',
        unlocks: classAbilityUnlocksForClase(clase).map((u) => ({
          level: u.level,
          ability: {
            ...u.ability,
            imagePrompts: imagePromptsFor('ability', slugify(u.ability.name)),
            imageUrls: imageUrlsFor('ability', slugify(u.ability.name)),
          },
        })),
      })),
      // Construcciones (roadmap 2026-07-20/21): recetas con requisitos reales de materiales.
      // nounRegex es detalle interno de detección de intención, no de catálogo — no serializa
      // limpio en JSON (RegExp → "{}"), así que se omite explícitamente de la respuesta.
      constructionRecipes: CONSTRUCTION_RECIPES.map(({ key, name, description, raza, requirements }) => ({
        key,
        name,
        description,
        raza: raza ?? null,
        requirements,
        imagePrompts: imagePromptsFor('construccion', key),
        imageUrls: imageUrlsFor('construccion', key),
      })),
    };
  });

  const IMAGE_PROMPT_ENTITY_TYPES: ImagePromptEntityType[] = [
    'npc',
    'item',
    'fauna',
    'ability',
    'raza',
    'personaje',
    'location',
    'construccion',
  ];
  const IMAGE_PROMPT_SIZE_PROFILES: ImagePromptSizeProfile[] = ['thumbnail', 'banner'];

  // Generación de prompts de imagen BAJO DEMANDA (checklist 2026-07-21/22, punto 7 — petición
  // explícita de la usuaria: "hay que pedir 1 a 1 la imagen en cada petición, no que genere todos
  // los prompts a la vez"). Un solo POST = como mucho una llamada real a un proveedor cloud (o a
  // Ollama si ninguno está disponible) — nunca un lote, y nunca las dos tallas de golpe (se pide
  // sizeProfile explícito). Cacheado para siempre en ImagePrompt: si ya existe esa combinación
  // exacta, se devuelve directo sin volver a llamar a nada. seedImagePrompts.ts sigue existiendo
  // para un uso puntual por lotes, pero este endpoint es el camino principal.
  app.post<{ Params: { slug: string }; Body: { entityType: string; entitySlug: string; sizeProfile: string; regenerate?: boolean } }>(
    '/world/:slug/image-prompt',
    async (request, reply) => {
      const world = await prisma.world.findUnique({ where: { slug: request.params.slug } });
      if (!world) {
        return reply.status(404).send({ error: 'Mundo no encontrado' });
      }

      const { entityType, entitySlug, sizeProfile, regenerate } = request.body;
      if (!IMAGE_PROMPT_ENTITY_TYPES.includes(entityType as ImagePromptEntityType)) {
        return reply.status(400).send({ error: 'entityType inválido' });
      }
      if (!IMAGE_PROMPT_SIZE_PROFILES.includes(sizeProfile as ImagePromptSizeProfile)) {
        return reply.status(400).send({ error: 'sizeProfile inválido' });
      }

      // Regenerar (petición explícita de la usuaria, 2026-07-22): "si le doy a regenerar vuelve a
      // generar el prompt con la info actual de esa entrada" — se salta el caché de lectura y
      // sobrescribe la fila existente en vez de solo crearla, para que el lore ya corregido (p.ej.
      // una bio actualizada tras subir el arte real) se refleje en un prompt nuevo bajo el mismo
      // entityType+entitySlug+sizeProfile, sin duplicar filas.
      if (!regenerate) {
        const existing = await prisma.imagePrompt.findUnique({
          where: { worldId_entityType_entitySlug_sizeProfile: { worldId: world.id, entityType, entitySlug, sizeProfile } },
        });
        if (existing) {
          return { prompt: existing.prompt, provider: existing.provider, cached: true };
        }
      }

      const subject = await loreContextFor(world.id, entityType as ImagePromptEntityType, entitySlug);
      if (!subject) {
        return reply.status(404).send({ error: 'Entidad no encontrada en este mundo' });
      }

      const { prompt, provider } = await generateImagePrompt(
        entityType as ImagePromptEntityType,
        subject.name,
        subject.loreContext,
        sizeProfile as ImagePromptSizeProfile,
      );
      await prisma.imagePrompt.upsert({
        where: { worldId_entityType_entitySlug_sizeProfile: { worldId: world.id, entityType, entitySlug, sizeProfile } },
        create: { worldId: world.id, entityType, entitySlug, sizeProfile, prompt, provider },
        update: { prompt, provider },
      });
      return { prompt, provider, cached: false };
    },
  );
}
