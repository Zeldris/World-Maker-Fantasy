import { npcDeLaPartida } from '../services/mundoPartida.js';
import type { FastifyInstance } from 'fastify';
import type { AttributeBlock, Attribute } from '../services/dice.js';
import { prisma } from '../lib/prisma.js';
import {
  harvestSourceAliases,
  harvestSourceDescriptions,
  harvestSourcesThatAreFaunaWithoutNpc,
  harvestSourceRegion,
  harvestSourceFloraCategoria,
  sourceDisplayNameFor,
} from '../scripts/worldCatalog.js';
import { coreRegionOf } from '../services/discovery.js';
import { allClassAbilityUnlocks, CLASE_DESCRIPTION } from '../services/classAbilities.js';
import { faunaCategoriaAbilityUnlocksFor, type FaunaCategoria } from '../services/faunaAbilities.js';
import { CONSTRUCTION_RECIPES } from '../services/construction.js';
import { CRAFTING_RECIPES } from '../services/crafting.js';
import { allProfessionAbilityUnlocks } from '../services/professionAbilities.js';
import { slugify } from '../lib/slugify.js';
import { generateImagePrompt, type ImagePromptEntityType, type ImagePromptSizeProfile } from '../services/imagePromptGenerator.js';
import { loreContextFor } from '../services/imagePromptContext.js';
import { imageUrlsFor, zoneMapImageUrl, iconoUrlFor } from '../lib/imageAssets.js';
import { BERIG_RAZAS, BERIG_PERSONAJES } from '../services/berigLore.js';
import { COMBAT_LORE_SECTIONS } from '../services/combatLore.js';
import { REPUTATION_LORE_SECTIONS } from '../services/reputationLore.js';
import { baseAttackFor } from '../services/baseAttack.js';
import {
  FAUNA_SEXO_VARIANTES,
  NPC_SEXO_VARIANTES,
  RAZA_SEXO_VARIANTES,
  RAZA_VARIANTE_SEXO_VARIANTES,
  type SexoVariantesEntry,
} from '../services/sexDimorphism.js';
import type { Npc } from '@prisma/client';

interface VarianteSexoOut {
  sexo: 'macho' | 'hembra';
  rasgoFisico: string;
  description: string;
  medidaCm: number;
  edadMaxima: number;
  imagePrompts: { thumbnail: string | null; banner: string | null };
  imageUrls: { thumbnail: string | null; banner: string | null };
}

/// Día/noche/estación (2026-08-27, docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md) — a diferencia de
/// `VarianteSexoOut`, sin ningún texto curado por entidad: la luz/estación son genéricas, así que
/// las 8 combinaciones se listan siempre igual para CUALQUIER Location, nunca desde una tabla de
/// contenido propia (ver `imagePromptContext.ts` § MOMENTO_TEXT/ESTACION_TEXT). `mapaImagePrompt`/
/// `mapaImageUrl` viajan aparte (entityType 'zona', sizeProfile 'mapa') porque el botón "Mapa" de
/// la Enciclopedia vive junto al de Location pero genera/guarda bajo ese otro entityType.
interface VarianteTiempoOut {
  momento: 'dia' | 'noche';
  estacion: 'primavera' | 'verano' | 'otono' | 'invierno';
  imagePrompts: { thumbnail: string | null; banner: string | null };
  imageUrls: { thumbnail: string | null; banner: string | null };
  mapaImagePrompt: string | null;
  mapaImageUrl: string | null;
}

/// Deuda técnica (2026-07-30, auditoría técnica: "el handler de /world/:slug/enciclopedia
/// ensambla ~280 líneas de secciones de tipo de entidad SIN RELACIÓN entre sí, todo en un único
/// cuerpo de función"). Agrupa todos los closures/mapas ya calculados que las 8 secciones de la
/// respuesta comparten — un solo objeto en vez de repetir la misma lista larga de parámetros en
/// cada `buildXSection`.
interface EnciclopediaBuildContext {
  imagePromptsFor: (entityType: ImagePromptEntityType, entitySlug: string) => { thumbnail: string | null; banner: string | null };
  /// Asentamientos (2026-08-31) — icono (entityType 'location', sizeProfile 'icono'), ver
  /// comentario junto a su implementación real más abajo.
  asentamientoImagesFor: (locationSlug: string) => { iconoPrompt: string | null; iconoUrl: string | null };
  variantesSexoFor: (
    entityType: 'npc' | 'fauna' | 'flora' | 'raza',
    baseSlug: string,
    variantes: Record<string, SexoVariantesEntry>,
  ) => VarianteSexoOut[] | undefined;
  variantesTiempoFor: (locationSlug: string) => VarianteTiempoOut[];
  isDiscovered: (entityType: string, entitySlug: string) => boolean;
  discoveryFaseFor: (entityType: string, entitySlug: string) => 'NO_DESCUBIERTO' | 'CITADO' | 'DESCUBIERTO';
  isLocationDiscovered: (locationId: string) => boolean;
  ataqueBaseFor: (n: { id: string; attributes: unknown; ataqueNatural: string | null }) => ReturnType<typeof baseAttackFor>;
  regionFor: (sourceSlug: string) => string | null;
  npcBySlug: Map<string, Npc>;
  npcSlugs: Set<string>;
  yieldsBySource: Map<string, { itemName: string; cantidad: number; condicion: string | null }[]>;
  sourceDisplayNameBySlug: Map<string, string>;
  /// Loadout saqueable (petición explícita, 2026-07-30: "que al saquear pueda marcar los objetos
  /// que me quiero quedar") — antes deliberadamente NUNCA se exponía este dato crudo al frontend
  /// (ver comentario histórico de `npcItems` más abajo); el modal de saqueo lo necesita para
  /// enseñar de antemano qué lleva encima cada NPC, sin esperar a que el saqueo ya haya ocurrido.
  /// Es contenido de CATÁLOGO (Npc/NpcItem no dependen de la partida), así que vale la pena
  /// exponerlo aquí en vez de en un endpoint nuevo por partida.
  lootableItemsByNpcId: Map<string, { name: string; cantidad: number; notas: string | null }[]>;
}

// Auditoría de Enciclopedia (2026-08-27): comerciablePct/reclutablePct/domesticablePct/
// capturablePct/cortejablePct y atributoResistencia ya existían en el modelo (sistema de
// compañeros y supervivencia) pero nunca viajaban a la Enciclopedia — el jugador no tenía ninguna
// pista in-game de qué NPC/fauna admite alguna de estas interacciones antes de intentarlo.
// `undefined` (no un objeto con todo a 0) cuando ninguna está calibrada, para no añadir ruido a la
// mayoría de entradas sin ninguna interacción especial.
function interaccionFor(n: {
  comerciablePct: number;
  reclutablePct: number;
  domesticablePct: number;
  capturablePct: number;
  cortejablePct: number;
  atributoResistencia: string | null;
}) {
  const { comerciablePct, reclutablePct, domesticablePct, capturablePct, cortejablePct, atributoResistencia } = n;
  if (comerciablePct === 0 && reclutablePct === 0 && domesticablePct === 0 && capturablePct === 0 && cortejablePct === 0) {
    return undefined;
  }
  return { comerciablePct, reclutablePct, domesticablePct, capturablePct, cortejablePct, atributoResistencia };
}

function buildNpcsSection(npcsForEncyclopedia: Npc[], ctx: EnciclopediaBuildContext) {
  return npcsForEncyclopedia.map((n) => ({
    slug: n.slug,
    name: n.name,
    kind: n.kind,
    role: n.role,
    faction: n.faction,
    level: n.level,
    bio: n.bio,
    aliases: n.aliases,
    imagePrompts: ctx.imagePromptsFor('npc', n.slug),
    imageUrls: imageUrlsFor('npc', n.slug),
    variantesSexo: ctx.variantesSexoFor('npc', n.slug, NPC_SEXO_VARIANTES),
    discovered: ctx.isDiscovered('npc', n.slug),
    fase: ctx.discoveryFaseFor('npc', n.slug),
    // Rediseño de la vista de combate (2026-07-28): `attributes` ya existía en el modelo, solo
    // faltaba exponerlo; `raza`/`clase` enganchan la ficha con `razas`/`classes` de más abajo.
    attributes: n.attributes as AttributeBlock,
    raza: n.raza,
    clase: n.clase,
    ataqueBase: ctx.ataqueBaseFor(n),
    items: ctx.lootableItemsByNpcId.get(n.id) ?? [],
    interaccion: interaccionFor(n),
  }));
}

function buildItemsSection(items: Awaited<ReturnType<typeof prisma.itemCatalog.findMany>>, ctx: EnciclopediaBuildContext) {
  return items.map((i) => ({
    slug: i.slug,
    name: i.name,
    aliases: i.aliases,
    category: i.category,
    // Categorización mecánica (2026-07-29) — ver itemTaxonomy.ts.
    tipo: i.tipo,
    description: i.description,
    statBonuses: i.statBonuses,
    dimensiones: i.dimensiones,
    lugarOrigen: i.lugarOrigen,
    tier: i.tier,
    requisitos: i.requisitos as Record<string, number> | null,
    effectKey: i.effectKey,
    effectDescription: i.effectDescription,
    // Auditoría de Enciclopedia (2026-08-27) — antes invisible pese a que el propio comentario del
    // schema lo marca como "petición explícita": qué oficios requieren este objeto como herramienta.
    herramientaParaOficio: i.herramientaParaOficio,
    imagePrompts: ctx.imagePromptsFor('item', i.slug),
    imageUrls: imageUrlsFor('item', i.slug),
    discovered: ctx.isDiscovered('item', i.slug),
    fase: ctx.discoveryFaseFor('item', i.slug),
  }));
}

// `description` (2026-07-22, misma auditoría que destapó el bug de loreContextFor): antes esta
// pestaña no exponía NINGÚN texto descriptivo de la criatura/planta, solo sus recursos
// cosechables — el bio real vivía en el Npc (fauna cazable) o en harvestSourceDescriptions
// (flora/mineral sin Npc propio, ver worldCatalog.ts) pero nunca llegaba al frontend.
function buildFaunaFloraSection(ctx: EnciclopediaBuildContext) {
  // Auditoría "revisar partida" (2026-08-30, "fauna y flora en carpetas separadas") — mismo
  // criterio real que `esFauna` (abajo), extraído aparte porque hace falta ANTES de calcular esa
  // fila para resolver `entityType` en las 4 llamadas de imagen.
  const imageEntityTypeFor = (sourceSlug: string): 'fauna' | 'flora' =>
    ctx.npcSlugs.has(sourceSlug) || harvestSourcesThatAreFaunaWithoutNpc.has(sourceSlug) ? 'fauna' : 'flora';
  return Array.from(ctx.sourceDisplayNameBySlug.entries()).map(([sourceSlug, sourceName]) => ({
    sourceSlug,
    sourceName,
    aliases: harvestSourceAliases[sourceSlug] ?? [],
    // `cazable` (mecánica real, ver harvest.ts): solo true si existe Npc con este slug — no
    // tocar, condiciona si hace falta derrotarlo antes de poder despiezarlo.
    cazable: ctx.npcSlugs.has(sourceSlug),
    // `esFauna` (bug real 2026-07-22, separado a propósito de `cazable`): si es un animal de
    // verdad, tenga o no ficha de combate — Espina del Viento/Cornante/Sombra de Kroj son
    // fauna sin Npc propio (peligro ambiental o fuera del núcleo jugable), no flora/mineral.
    //
    // Auditoría "revisar partida" (2026-08-30, "fauna y flora en carpetas separadas"): antes las
    // 4 líneas de imagen de abajo usaban el literal 'fauna' siempre, aunque `esFauna` (esta misma
    // fila) YA calculaba el criterio real — animal vs. planta/mineral se pintaban con el mismo
    // `entityType`, mezclando ambos en la misma carpeta de disco. Ahora reutiliza `esFauna` para
    // resolver dinámicamente 'fauna' o 'flora'.
    esFauna: ctx.npcSlugs.has(sourceSlug) || harvestSourcesThatAreFaunaWithoutNpc.has(sourceSlug),
    // Zona de origen (2026-07-29, colapsables de fauna/flora por zona en la Enciclopedia).
    region: ctx.regionFor(sourceSlug),
    description: ctx.npcBySlug.get(sourceSlug)?.bio ?? harvestSourceDescriptions[sourceSlug] ?? null,
    yields: ctx.yieldsBySource.get(sourceSlug) ?? [],
    imagePrompts: ctx.imagePromptsFor(imageEntityTypeFor(sourceSlug), sourceSlug),
    imageUrls: imageUrlsFor(imageEntityTypeFor(sourceSlug), sourceSlug),
    variantesSexo: ctx.variantesSexoFor(imageEntityTypeFor(sourceSlug), sourceSlug, FAUNA_SEXO_VARIANTES),
    discovered: ctx.isDiscovered(imageEntityTypeFor(sourceSlug), sourceSlug),
    fase: ctx.discoveryFaseFor(imageEntityTypeFor(sourceSlug), sourceSlug),
    // Rediseño de la vista de combate (2026-07-28): solo presentes si hay Npc real detrás
    // (`cazable`) — flora/mineral sin ficha de combate se queda con los cinco en null/vacío.
    // `level` (2026-07-29, indicador de dificultad antes de Combatir): sin esto, la fauna no
    // tenía forma de participar en `difficultyHintFor` desde el frontend, a diferencia de los
    // NPCs humanoides (`EnciclopediaNpcInfo.level` ya existía).
    level: ctx.npcBySlug.get(sourceSlug)?.level ?? null,
    attributes: (ctx.npcBySlug.get(sourceSlug)?.attributes as AttributeBlock | undefined) ?? null,
    ataqueNatural: ctx.npcBySlug.get(sourceSlug)?.ataqueNatural ?? null,
    habilidadesRaciales: (ctx.npcBySlug.get(sourceSlug)?.habilidadesRaciales as unknown as
      { icon: string; name: string; description: string; categoria: 'ataque' | 'defensa' | 'utilidad'; preferredAttribute: Attribute }[]) ?? [],
    ataqueBase: (() => {
      const faunaNpc = ctx.npcBySlug.get(sourceSlug);
      return faunaNpc ? ctx.ataqueBaseFor(faunaNpc) : null;
    })(),
    // Auditoría de Enciclopedia (2026-08-27) — mismo campo que buildNpcsSection, ver interaccionFor.
    interaccion: (() => {
      const faunaNpc = ctx.npcBySlug.get(sourceSlug);
      return faunaNpc ? interaccionFor(faunaNpc) : undefined;
    })(),
    // Géneros de fauna/flora (2026-09-04, docs/rpgtarkor/lore-mundo/genesis.md § Florial/Ferios/Tarkor) —
    // hasta ahora `faunaCategoria` (schema.prisma) vivía solo en la BD, sin llegar nunca al
    // frontend/Enciclopedia pese a existir desde 2026-09-02 — mismo hueco que se cierra aquí para
    // ambos a la vez, junto con `floraCategoria` (worldCatalog.ts, sin tabla propia). Mutuamente
    // excluyentes según `esFauna` — nunca los dos a la vez para el mismo sourceSlug.
    faunaCategoria: ctx.npcBySlug.get(sourceSlug)?.faunaCategoria ?? null,
    floraCategoria: harvestSourceFloraCategoria[sourceSlug] ?? null,
    // Roster de habilidades DE LA CATEGORÍA con su nivel de desbloqueo (2026-09-15, cierre de
    // deuda técnica: `faunaCategoria` en sí ya se exponía desde 2026-09-04, pero el roster que
    // desbloquea nunca llegaba al frontend — mismo criterio que `unlocks` en buildClassesSection,
    // "TODOS los huecos de la categoría", no filtrado por nivel de ningún individuo concreto).
    // Vacío para flora/mineral (sin faunaCategoria real) y para fauna sin categoría asignada
    // todavía en el catálogo.
    faunaCategoriaUnlocks: (() => {
      const categoria = ctx.npcBySlug.get(sourceSlug)?.faunaCategoria as FaunaCategoria | null | undefined;
      if (!categoria) return [];
      return faunaCategoriaAbilityUnlocksFor(categoria).map((u) => ({
        level: u.level,
        ability: {
          ...u.ability,
          imagePrompts: ctx.imagePromptsFor('ability', slugify(u.ability.name)),
          imageUrls: imageUrlsFor('ability', slugify(u.ability.name)),
        },
      }));
    })(),
    // Vínculo Companion↔dueño (auditoría de contenido de Enciclopedia, 2026-09-15): `Npc.
    // companionOfNpcSlug` ya vinculaba a Gisoki/Gogorath con su dueño desde su siembra, pero nunca
    // llegaba al frontend — la ficha de fauna los mostraba como fauna suelta, sin indicar que son
    // el compañero vinculado de un NPC concreto. `null` para el resto (la inmensa mayoría).
    companionOfNpc: (() => {
      const companionOfSlug = ctx.npcBySlug.get(sourceSlug)?.companionOfNpcSlug ?? null;
      if (!companionOfSlug) return null;
      const dueno = ctx.npcBySlug.get(companionOfSlug);
      return dueno ? { slug: companionOfSlug, name: dueno.name } : null;
    })(),
  }));
}

// Lugares (2026-07-23): gateado por `LocationVisit` (visita física real), no por mención en
// narración — eje independiente de DiscoveredEntity (ver comentario del modelo en schema.prisma).
function buildLocationsSection(locations: Awaited<ReturnType<typeof prisma.location.findMany>>, ctx: EnciclopediaBuildContext) {
  return locations.map((l) => ({
    slug: l.slug,
    name: l.name,
    aliases: l.aliases,
    region: l.region,
    kind: l.kind,
    description: l.description,
    imagePrompts: ctx.imagePromptsFor('location', l.slug),
    imageUrls: imageUrlsFor('location', l.slug),
    discovered: ctx.isLocationDiscovered(l.id),
    variantesTiempo: ctx.variantesTiempoFor(l.slug),
    // Asentamientos (2026-08-31) — mapa+icono en vez de banner, undefined para el resto (hitos,
    // cruces...) para no añadir ruido a Locations que no lo necesitan.
    asentamiento: l.kind === 'asentamiento' ? ctx.asentamientoImagesFor(l.slug) : undefined,
  }));
}

// Facciones (Enciclopedia § "Facciones", 2026-08-06) — catálogo real (Faction), gateado por
// DiscoveredEntity igual que npc/fauna/item (ver cascada en entityDiscovery.ts: descubrir un NPC
// de la facción descubre la facción). Imagen bajo demanda igual que raza/location (2026-08-06,
// auditoría de la Enciclopedia: "revisa que todo tiene banner/icono") — mismo entityType 'faction'
// que ya usa DiscoveredEntity, ver imagePromptContext.ts.
function buildFactionsSection(
  factionRows: (Awaited<ReturnType<typeof prisma.faction.findMany>>[number] & { liderNpc: { slug: string; name: string } | null })[],
  ctx: EnciclopediaBuildContext,
) {
  return factionRows.map((f) => ({
    slug: f.slug,
    name: f.name,
    raza: f.raza,
    description: f.description,
    // Líder de GOBIERNO (§ 7.2, 2026-09-21) — null = sin líder real sembrado todavía (nunca
    // inventado en servicio, mismo criterio que el resto del campo `liderNpcId` en el schema).
    liderNpc: f.liderNpc ? { slug: f.liderNpc.slug, name: f.liderNpc.name } : null,
    discovered: ctx.isDiscovered('faction', f.slug),
    // 3 fases (2026-09-08) — una facción nunca tiene "presencia en escena" propia, la cascada de
    // entityDiscovery.ts siempre la deja en CITADO como mucho (ver comentario ahí) — se expone
    // igual por coherencia de shape con el resto de secciones, el frontend no necesita lógica
    // especial: nunca verá 'DESCUBIERTO' aquí hoy.
    fase: ctx.discoveryFaseFor('faction', f.slug),
    imagePrompts: ctx.imagePromptsFor('faction', f.slug),
    imageUrls: imageUrlsFor('faction', f.slug),
  }));
}

// Historia (Enciclopedia § "Historia", 2026-08-06) — catálogo real (HistoriaEntry), enganchado a
// un objeto físico (`documentoItemSlug`) que la descubre (cascada en entityDiscovery.ts). Doble
// candado: `discovered` (objeto encontrado, controla si la tarjeta se ve) y `unlocked` (además,
// si `requiresTranslation`, el NPC traductor también descubierto — controla si el TEXTO real
// viaja al frontend). `unlocked` se calcula aquí, en tiempo de lectura, nunca se guarda.
//
// Imagen bajo demanda (2026-08-06, auditoría de la Enciclopedia) SOLO si `unlocked` — igual que el
// texto real, `imagePrompts`/`imageUrls` se quedan en null mientras la entrada no esté traducida:
// generar/mostrar una imagen de una escena que el texto todavía oculta sería otra forma de fugar
// justo el contenido que el candado de traducción existe para proteger.
function buildHistoriaSection(historiaRows: Awaited<ReturnType<typeof prisma.historiaEntry.findMany>>, ctx: EnciclopediaBuildContext) {
  return historiaRows.map((h) => {
    const discovered = ctx.isDiscovered('historia', h.slug);
    const unlocked = discovered && (!h.requiresTranslation || ctx.isDiscovered('npc', h.translatorNpcSlug ?? ''));
    return {
      slug: h.slug,
      title: h.title,
      era: h.era,
      year: h.year,
      requiresTranslation: h.requiresTranslation,
      discovered,
      fase: ctx.discoveryFaseFor('historia', h.slug),
      unlocked,
      // Nunca se manda el texto real si no está desbloqueado — no solo se oculta en pantalla, no
      // viaja por la red hasta que corresponde (petición explícita: escrito en idioma de las
      // Semillas, ilegible hasta encontrar traductor).
      text: unlocked ? h.text : null,
      imagePrompts: unlocked ? ctx.imagePromptsFor('historia', h.slug) : { thumbnail: null, banner: null },
      imageUrls: unlocked ? imageUrlsFor('historia', h.slug) : { thumbnail: null, banner: null },
    };
  });
}

// Razas y personajes jugables de Berig (2026-07-22): contenido estático (ver berigLore.ts),
// mismo patrón que `classes` de abajo — no depende de ninguna tabla de este mundo en la BD.
function buildRazasSection(ctx: EnciclopediaBuildContext) {
  return BERIG_RAZAS.map((r) => ({
    ...r,
    imagePrompts: ctx.imagePromptsFor('raza', r.slug),
    imageUrls: imageUrlsFor('raza', r.slug),
    // Sexo (2026-07-22, "nos dejamos las razas también"): a nivel de RAZA GENERAL — solo
    // presente en razas SIN variantes regionales (Goirntes, Nabieus, Faerus). Orcos no tiene
    // entrada aquí (`RAZA_SEXO_VARIANTES` no la incluye a propósito): su sexo va cruzado con
    // la región, ver más abajo.
    variantesSexo: ctx.variantesSexoFor('raza', r.slug, RAZA_SEXO_VARIANTES),
    // Variantes regionales (2026-07-22, "al pulsar orcos aun pudiese elegir el tipo según la
    // región") — cada una con su propia imagen, mismo entityType 'raza' que la raza padre.
    // Sexo CRUZADO con región (2026-07-22, "sí, cruzar para Orcos"): cada variante regional
    // tiene su propio par macho/hembra, con imagen propia `<variante>-<sexo>`.
    variantes: r.variantes?.map((v) => ({
      ...v,
      imagePrompts: ctx.imagePromptsFor('raza', v.slug),
      imageUrls: imageUrlsFor('raza', v.slug),
      variantesSexo: ctx.variantesSexoFor('raza', v.slug, RAZA_VARIANTE_SEXO_VARIANTES),
    })),
  }));
}

// Combate (Enciclopedia § "Combate", 2026-08-15, petición explícita: "expliquemos con claridad...
// las mecánicas de las tiradas y cómo funcionan los combates") — contenido estático puro, mismo
// criterio que Razas/Clases: documentación de reglas, no lore de mundo ni secreto narrativo, así
// que nunca lleva gateo de descubrimiento ni depende del contexto (`ctx`) de esta petición.
function buildCombateSection() {
  return COMBAT_LORE_SECTIONS;
}

// Sistemas del mundo (Enciclopedia § "Sistemas", auditoría de contenido 2026-09-15: temperamento,
// reputación, territorio, captura/interacción, fases de descubrimiento) — mismo criterio que
// Combate: documentación de reglas estática, sin gateo ni dependencia de `ctx`. Campo de respuesta
// sigue llamándose `reputacion` (mismo criterio que reputationLore.ts) por no romper el tipo.
function buildReputacionSection() {
  return REPUTATION_LORE_SECTIONS;
}

function buildPersonajesSection(ctx: EnciclopediaBuildContext) {
  return BERIG_PERSONAJES.map((p) => ({
    ...p,
    imagePrompts: ctx.imagePromptsFor('personaje', p.slug),
    imageUrls: imageUrlsFor('personaje', p.slug),
  }));
}

// Clases (roadmap 2026-07-21, separadas en dos el 2026-07-22 — petición explícita: "Guerrero es
// una clase y Cazador es otra con sus propias habilidades! Gorhorn es una variante especial que
// le permite aprender las habilidades de ambas"): contenido de diseño estático, no depende del
// mundo en la base de datos. Ampliado a las 9 clases (2026-08-24, Grupo 3 § Sistema de clases,
// segunda pasada el mismo día — "aplícalo ya todo") salvo MAGO, que sigue siendo solo identidad
// narrativa sin tabla de niveles en clases.md. Muestra TODOS los huecos de la clase (tronco + las
// N especializaciones), no el roster de una especialización concreta — para eso está
// `classAbilityUnlocksForClase(clase, especializacion)`, pensado para el motor de turnos/un NPC en
// particular, no para esta vista de referencia.
function buildClassesSection(ctx: EnciclopediaBuildContext) {
  return (['GUERRERO', 'CAZADOR', 'CHAMAN', 'ARQUERO', 'CABALLERO', 'SEGADOR', 'ASESINO', 'DRUIDA'] as const).map((clase) => ({
    name: clase,
    description: CLASE_DESCRIPTION[clase],
    unlocks: allClassAbilityUnlocks()
      .filter((u) => u.clase === clase)
      .map((u) => ({
        level: u.level,
        especializacion: u.especializacion ?? null,
        ability: {
          ...u.ability,
          imagePrompts: ctx.imagePromptsFor('ability', slugify(u.ability.name)),
          imageUrls: imageUrlsFor('ability', slugify(u.ability.name)),
        },
      })),
  }));
}

// Construcciones (roadmap 2026-07-20/21): recetas con requisitos reales de materiales. nounRegex
// es detalle interno de detección de intención, no de catálogo — no serializa limpio en JSON
// (RegExp → "{}"), así que se omite explícitamente de la respuesta.
// `oficio`/`tier` sumados 2026-08-13 (petición explícita: "las habilidades de las cuales no
// tengamos suficiente nivel en profesión que no salgan [en Habilidades]... si quieres consultar
// el listado por nivel vas a la enciclopedia") — Habilidades ahora solo muestra lo YA desbloqueado
// (HabilidadesPanel.tsx), así que la Enciclopedia pasa a ser el único sitio que enseña el roster
// completo con su requisito de nivel.
function buildConstructionRecipesSection(ctx: EnciclopediaBuildContext) {
  return CONSTRUCTION_RECIPES.map(({ key, imageSlug, name, description, raza, oficio, tier, requirements }) => ({
    // `imageSlug ?? key` a propósito (2026-08-15): el frontend usa este `key` tanto para pedir la
    // imagen ya subida como para pedir generar un prompt nuevo — los dos caminos tienen que usar
    // el MISMO slug o "Regenerar" en la Enciclopedia crearía una fila de ImagePrompt bajo un slug
    // distinto al que `imageUrlsFor` mira de verdad.
    key: imageSlug ?? key,
    name,
    description,
    raza: raza ?? null,
    oficio: oficio ?? null,
    tier: tier ?? null,
    requirements,
    imagePrompts: ctx.imagePromptsFor('construccion', imageSlug ?? key),
    imageUrls: imageUrlsFor('construccion', imageSlug ?? key),
  }));
}

// Crafteo (Enciclopedia § "Crafteo", 2026-08-06) — recetas de crafting.ts, mismo patrón que
// Construcciones (contenido estático, sin fila de BD, sin gateo de descubrimiento). `oficio` en
// vez de `raza` como eje de agrupado en el frontend. `nounRegex`/`verbRegex` se omiten igual que
// `nounRegex` de construcciones (detalle interno de detección, no serializa limpio en JSON).
// `tier` sumado 2026-08-13, mismo motivo que en Construcciones (arriba).
function buildCraftingRecipesSection(ctx: EnciclopediaBuildContext) {
  return CRAFTING_RECIPES.map(({ key, resultName, resultDescription, oficio, tier, ingredients }) => ({
    key,
    name: resultName,
    description: resultDescription,
    oficio: oficio ?? null,
    tier: tier ?? null,
    requirements: ingredients,
    imagePrompts: ctx.imagePromptsFor('crafteo', key),
    imageUrls: imageUrlsFor('crafteo', key),
  }));
}

/// Catálogo de ubicaciones de un mundo (docs/mecanicas/12-mundo-estructurado.md § "Frontend", pendiente
/// desde esa sesión): antes `frontend/src/data/map.ts` duplicaba a mano nombres/descripciones de
/// `Location` — una sola fuente de verdad ahora. Incluye `LocationLink` (con `riesgo`) para que el
/// mapa dibuje aristas reales sin repetir esa tabla también en el frontend.
export async function worldRoutes(app: FastifyInstance) {
  // Rediseño de profesiones (2026-08-07): roster COMPLETO de recetas de oficio (desbloqueadas o
  // no) — estático, independiente de mundo/partida, así que no vive bajo /world/:slug. Habilidades
  // > Profesiones lo usa para mostrar TODAS las recetas de una profesión creadora siempre, no solo
  // las ya desbloqueadas (bloqueadas con el motivo si el nivel de oficio no llega todavía).
  app.get('/profession-recipes', async () => allProfessionAbilityUnlocks());

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
        // Asentamientos (2026-08-31) — mismo criterio que /world/:slug/enciclopedia, ver
        // comentario de `asentamientoImagesFor` más abajo en este mismo archivo.
        asentamiento:
          l.kind === 'asentamiento'
            ? { iconoPrompt: promptByKey.get(`${l.slug}:icono`) ?? null, iconoUrl: iconoUrlFor('location', l.slug) }
            : undefined,
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

    const [npcs, items, yields, locations, imagePrompts, discoveredEntities, locationVisits, npcItems, factionRows, historiaRows] = await Promise.all([
      // CR-13: los nacidos en otras partidas no existen aquí (sin partida, solo el catálogo).
      prisma.npc.findMany({ where: { worldId: world.id, ...(saveId ? npcDeLaPartida(saveId) : { saveId: null }) } }),
      prisma.itemCatalog.findMany({ where: { worldId: world.id } }),
      prisma.harvestYield.findMany({ where: { worldId: world.id }, include: { item: true } }),
      prisma.location.findMany({ where: { worldId: world.id } }),
      prisma.imagePrompt.findMany({ where: { worldId: world.id } }),
      // Enciclopedia progresiva (sesión de diseño 2026-07-23) — sin `saveId` (p.ej. si algún día
      // se consulta el catálogo fuera del contexto de una partida concreta), no se filtra nada:
      // `discovered` sale `true` para todo, mismo comportamiento que antes de este cambio.
      saveId ? prisma.discoveredEntity.findMany({ where: { saveId } }) : Promise.resolve([]),
      saveId ? prisma.locationVisit.findMany({ where: { saveId } }) : Promise.resolve([]),
      // Rediseño de la vista de combate (2026-07-28) — arma(s) del loadout de cada NPC, para
      // calcular su "Ataque base" (baseAttack.ts) aquí en el backend. También alimenta el modal
      // de saqueo selectivo (2026-07-30, ver `lootableItemsByNpcId` más abajo) — mismo dato crudo,
      // ya no se descarta después de calcular las armas.
      prisma.npcItem.findMany({ where: { npc: { worldId: world.id } }, include: { item: true } }),
      // Secciones "Facciones"/"Historia" (2026-08-06) — ver buildFactionsSection/buildHistoriaSection.
      // `factions`: catálogo del mundo (saveId null) + la fundada en ESTA partida al fundar el
      // reino, si la hay (reino.ts) — nunca la de otra partida distinta del mismo mundo. Ojo:
      // `{ saveId: saveId ?? undefined }` en el OR sería un bug real — un valor `undefined` hace
      // que Prisma OMITA la condición entera (coincide con TODO), así que sin `saveId` en la query
      // colarían las facciones fundadas de cualquier partida. La rama solo se añade si hay `saveId`.
      // `liderNpc` (§ 7.2, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md) — hueco cerrado 2026-09-21: el campo
      // ya existía en el schema (Faction.liderNpcId, FK real) pero nunca se serializaba al
      // cliente. `select` mínimo (nunca el Npc completo) — el frontend solo necesita nombre/slug
      // para mostrar "liderada por X" y enlazar a su ficha si algún día la tiene.
      prisma.faction.findMany({
        where: { worldId: world.id, OR: saveId ? [{ saveId: null }, { saveId, origenSlug: null }] : [{ saveId: null }] },
        include: { liderNpc: { select: { slug: true, name: true } } },
      }),
      prisma.historiaEntry.findMany({ where: { worldId: world.id } }),
    ]);

    const weaponNamesByNpcId = new Map<string, string[]>();
    const lootableItemsByNpcId = new Map<string, { name: string; cantidad: number; notas: string | null }[]>();
    for (const npcItem of npcItems) {
      if (npcItem.item.category === 'arma') {
        const list = weaponNamesByNpcId.get(npcItem.npcId) ?? [];
        list.push(npcItem.item.name);
        weaponNamesByNpcId.set(npcItem.npcId, list);
      }
      const lootList = lootableItemsByNpcId.get(npcItem.npcId) ?? [];
      lootList.push({ name: npcItem.item.name, cantidad: npcItem.cantidad, notas: npcItem.notas });
      lootableItemsByNpcId.set(npcItem.npcId, lootList);
    }
    const ataqueBaseFor = (n: { id: string; attributes: unknown; ataqueNatural: string | null }) =>
      baseAttackFor({
        attributes: n.attributes as AttributeBlock,
        weaponNames: weaponNamesByNpcId.get(n.id) ?? [],
        ataqueNatural: n.ataqueNatural,
      });

    // Auditoría de Enciclopedia (2026-08-27): los NPC `nucleoJugable: false` (Yovenne Tal, Vrask
    // Ombra...) están documentados en worldCatalog.ts como "referencia de la Enciclopedia, no NPCs
    // encontrables en la partida" — `entityDiscovery.ts` los excluye a propósito de la cascada de
    // descubrimiento (nunca deben poder aparecer en escena/combate por un match de alias corto),
    // pero eso significa que en partida real (`saveId` presente) `discovered` no podía llegar a
    // `true` jamás: quedaban en la lista pero bloqueados sin ninguna vía de desbloqueo, contra la
    // intención documentada de que fueran visibles. Mismo criterio que razas/personajes/clases
    // (catálogo de referencia pura, sin gateo) para este subconjunto concreto de NPC.
    const isDiscovered = (entityType: string, entitySlug: string): boolean => {
      if (entityType === 'npc' && npcs.find((n) => n.slug === entitySlug)?.nucleoJugable === false) return true;
      return !saveId || discoveredEntities.some((d) => d.entityType === entityType && d.entitySlug === entitySlug);
    };
    // 3 fases (2026-09-08, rediseño de Álvaro: "no descubierto, citado o avistado") —
    // 'NO_DESCUBIERTO' (sin fila, `isDiscovered` sería false) / 'CITADO' (fila real con
    // `fase: CITADO`) / 'DESCUBIERTO' (fila real con `fase: DESCUBIERTO`, o cualquiera de los
    // "siempre visibles" que `isDiscovered` ya trata como true sin fila real — sin catálogo, sin
    // saveId, o el subconjunto `nucleoJugable: false`, todos merecen la ficha completa de una vez,
    // nunca quedarse a medias en CITADO). Convive con `isDiscovered` (no se retira, 6+ secciones
    // ya lo consumen tal cual) — este es el dato NUEVO que añade el tercer estado.
    const discoveryFaseFor = (entityType: string, entitySlug: string): 'NO_DESCUBIERTO' | 'CITADO' | 'DESCUBIERTO' => {
      if (entityType === 'npc' && npcs.find((n) => n.slug === entitySlug)?.nucleoJugable === false) return 'DESCUBIERTO';
      if (!saveId) return 'DESCUBIERTO';
      const row = discoveredEntities.find((d) => d.entityType === entityType && d.entitySlug === entitySlug);
      if (!row) return 'NO_DESCUBIERTO';
      return row.fase;
    };
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

    // Asentamientos (2026-08-31, "las ciudades deben tener prompt de mapa como la zona y de icono,
    // no de banner") — icono nuevo (entityType 'location', sizeProfile 'icono'). El mapa YA se
    // ofrecía para cualquier Location vía `variantesTiempoFor`/`mapaImagePrompt` (entityType
    // 'zona', DetailModal.tsx) — no duplicado aquí. Función aparte de `imagePromptsFor` de arriba
    // para no tocar el shape fijo thumbnail/banner que ya usan 12+ secciones de la Enciclopedia.
    const asentamientoImagesFor = (locationSlug: string) => ({
      iconoPrompt: promptByKey.get(`location:${locationSlug}:icono`) ?? null,
      iconoUrl: iconoUrlFor('location', locationSlug),
    });

    // Día/noche/estación (2026-08-27, docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md) — las 8 combinaciones se
    // listan siempre igual para CUALQUIER Location (sin tabla de contenido curado, ver comentario
    // de `VarianteTiempoOut`); cada una es un `entitySlug` propio (`<base>-<momento>-<estacion>`,
    // mismo convenio de sufijo que `variantesSexoFor`) con su propio `ImagePrompt`/imagen subida.
    const MOMENTOS = ['dia', 'noche'] as const;
    const ESTACIONES = ['primavera', 'verano', 'otono', 'invierno'] as const;
    const variantesTiempoFor = (locationSlug: string): VarianteTiempoOut[] =>
      MOMENTOS.flatMap((momento) =>
        ESTACIONES.map((estacion) => {
          const slug = `${locationSlug}-${momento}-${estacion}`;
          return {
            momento,
            estacion,
            imagePrompts: imagePromptsFor('location', slug),
            imageUrls: imageUrlsFor('location', slug),
            mapaImagePrompt: promptByKey.get(`zona:${slug}:mapa`) ?? null,
            mapaImageUrl: zoneMapImageUrl(slug),
          };
        }),
      );

    // Variantes por sexo (2026-07-22, ver sexDimorphism.ts): mismo slug base + sufijo -macho/
    // -hembra para su propia imagen, igual que las variantes regionales de raza — undefined si la
    // entidad no tiene entrada en el mapa (la inmensa mayoría de NPCs, todos los PRINCIPAL con
    // nombre propio, y toda la flora/mineral).
    const variantesSexoFor = (entityType: 'npc' | 'fauna' | 'flora' | 'raza', baseSlug: string, variantes: Record<string, SexoVariantesEntry>) => {
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
    const locationBySlug = new Map(locations.map((l) => [l.slug, l]));
    const yieldsBySource = new Map<string, { itemName: string; cantidad: number; condicion: string | null }[]>();
    const sourceDisplayNameBySlug = new Map<string, string>();
    // Zona de origen por fuente (2026-07-29, colapsables de fauna/flora por zona en la
    // Enciclopedia) — mismo criterio ya validado en discovery.ts: región real de su
    // `homeLocationSlug` si es fauna con Npc propio, o `lugarOrigen` del primer objeto que da si
    // es flora/mineral sin Npc — se queda en null si ninguna de las dos señales dice nada (fauna
    // itinerante sin hogar fijo, o un lugarOrigen sin ninguna región reconocible).
    const lugarOrigenBySource = new Map<string, string>();
    for (const y of yields) {
      sourceDisplayNameBySlug.set(y.sourceSlug, sourceDisplayNameFor(y.sourceSlug, npcBySlug.get(y.sourceSlug)?.name));
      const list = yieldsBySource.get(y.sourceSlug) ?? [];
      list.push({ itemName: y.item.name, cantidad: y.cantidad, condicion: y.condicion });
      yieldsBySource.set(y.sourceSlug, list);
      if (y.item.lugarOrigen && !lugarOrigenBySource.has(y.sourceSlug)) {
        lugarOrigenBySource.set(y.sourceSlug, y.item.lugarOrigen);
      }
    }
    const regionFor = (sourceSlug: string): string | null => {
      // Override explícito primero (2026-07-29, confirmado por la usuaria) — cubre fauna sin
      // homeLocationSlug fijo (itinerante) y fuentes cuyo primer objeto es genérico/compartido
      // entre especies (ej. "Ración de carne fresca"), donde el lugarOrigen del objeto no puede
      // decir de qué fuente concreta viene.
      if (harvestSourceRegion[sourceSlug]) return coreRegionOf(harvestSourceRegion[sourceSlug]);
      const homeLocationSlug = npcBySlug.get(sourceSlug)?.homeLocationSlug;
      const npcRegion = homeLocationSlug ? locationBySlug.get(homeLocationSlug)?.region : null;
      return coreRegionOf(npcRegion) ?? coreRegionOf(lugarOrigenBySource.get(sourceSlug));
    };
    // Bug real jugando en vivo (2026-09-03, "fauna interactuada no se desbloquea en la
    // Enciclopedia"): `buildFaunaFloraSection` (más abajo) solo itera `sourceDisplayNameBySlug`
    // (fuentes con HarvestYield propio) — cualquier fauna real combatible SIN drops de despiece
    // (Nuente, Ruptidar, Imanio, Benusa Pesquera...) nunca aparecía en la pestaña Fauna, ni
    // bloqueada ni desbloqueada. `faunaCategoria` (schema.prisma) solo se rellena en fauna real —
    // confirmado por script real que separa bien a estos candidatos de NPCs humanoides genéricos
    // (Cazador/a Serhu, Mercader de paso...), que se quedan sin valor y siguen fuera de Fauna.
    for (const n of npcs) {
      if (n.faunaCategoria && !sourceDisplayNameBySlug.has(n.slug)) {
        sourceDisplayNameBySlug.set(n.slug, n.name);
      }
    }
    // Hallazgo real de Fable (2026-07-21): worldCatalog.ts siembra la fauna cazable como Npc
    // PLANTILLA (`allNpcs = [...npcs, ...fauna]`) para que el motor de escena la reconozca igual
    // que a una persona — pero eso hacía que la Enciclopedia listara cada animal DOS veces (en
    // "NPCs" con su ficha de personaje y en "Fauna y flora" con sus recursos). La pestaña NPCs
    // se queda solo con los que no tienen ninguna fuente de cosecha propia.
    // Auditoría de contenido de Enciclopedia (2026-09-15) — los 3 NPC de prueba por raza
    // (worldCatalog.ts, sección "NPC DE PRUEBA POR RAZA") son andamiaje de QA, no lore real: se
    // veían mezclados sin distinción junto a personajes reales como Torgash Ketg o Kael Dorn. El
    // motor de escena/combate sigue reconociéndolos con normalidad (no se tocó su `nucleoJugable`
    // ni ningún otro campo); solo se excluyen de esta consulta de referencia.
    const NPC_SLUGS_DE_PRUEBA_TECNICA = new Set(['goirnte-renegado', 'faerus-erratico', 'nabieus-enloquecido']);
    const npcsForEncyclopedia = npcs.filter((n) => !sourceDisplayNameBySlug.has(n.slug) && !NPC_SLUGS_DE_PRUEBA_TECNICA.has(n.slug));

    const ctx: EnciclopediaBuildContext = {
      imagePromptsFor,
      asentamientoImagesFor,
      variantesSexoFor,
      variantesTiempoFor,
      isDiscovered,
      discoveryFaseFor,
      isLocationDiscovered,
      ataqueBaseFor,
      regionFor,
      npcBySlug,
      npcSlugs,
      yieldsBySource,
      sourceDisplayNameBySlug,
      lootableItemsByNpcId,
    };

    return {
      npcs: buildNpcsSection(npcsForEncyclopedia, ctx),
      items: buildItemsSection(items, ctx),
      faunaFlora: buildFaunaFloraSection(ctx),
      locations: buildLocationsSection(locations, ctx),
      razas: buildRazasSection(ctx),
      personajes: buildPersonajesSection(ctx),
      classes: buildClassesSection(ctx),
      constructionRecipes: buildConstructionRecipesSection(ctx),
      craftingRecipes: buildCraftingRecipesSection(ctx),
      factions: buildFactionsSection(factionRows, ctx),
      historia: buildHistoriaSection(historiaRows, ctx),
      combate: buildCombateSection(),
      reputacion: buildReputacionSection(),
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
    'faction',
    'historia',
    'crafteo',
    'zona',
    'clase',
    'especializacion',
  ];
  const IMAGE_PROMPT_SIZE_PROFILES: ImagePromptSizeProfile[] = ['thumbnail', 'banner', 'mapa', 'icono'];

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
      // Bug real (auditoría 2026-07-28): sin este chequeo, un entitySlug ausente/no-string llegaba
      // intacto a la clave compuesta de Prisma de más abajo y reventaba con un 500 genérico en vez
      // de un 400 claro.
      if (!entitySlug || typeof entitySlug !== 'string') {
        return reply.status(400).send({ error: 'entitySlug inválido' });
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

      // Bug real jugando en vivo (2026-09-06, "no está funcionando la generación de prompts" —
      // el frontend solo mostraba "No se pudo generar", sin distinguir un fallo real de todos los
      // proveedores de IA de cualquier otro error): sin este try/catch, un fallo aquí llegaba como
      // 500 genérico de Fastify, sin `body.error` legible que el frontend pudiera mostrar.
      let prompt: string;
      let provider: string;
      try {
        ({ prompt, provider } = await generateImagePrompt(
          entityType as ImagePromptEntityType,
          subject.name,
          subject.loreContext,
          sizeProfile as ImagePromptSizeProfile,
        ));
      } catch (err) {
        app.log.error({ err, entityType, entitySlug, sizeProfile }, '[image-prompt] todos los proveedores de IA fallaron');
        return reply.status(502).send({ error: 'Los proveedores de generación de imágenes no respondieron — inténtalo de nuevo en unos minutos.' });
      }
      await prisma.imagePrompt.upsert({
        where: { worldId_entityType_entitySlug_sizeProfile: { worldId: world.id, entityType, entitySlug, sizeProfile } },
        create: { worldId: world.id, entityType, entitySlug, sizeProfile, prompt, provider },
        update: { prompt, provider },
      });
      return { prompt, provider, cached: false };
    },
  );
}
