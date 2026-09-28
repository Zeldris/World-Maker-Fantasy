import { prisma } from '../lib/prisma.js';
import { harvestSourceAliases, harvestSourceDescriptions, sourceDisplayNameFor } from '../scripts/worldCatalog.js';
import { CONSTRUCTION_RECIPES } from './construction.js';
import { CRAFTING_RECIPES } from './crafting.js';
import { allClassAbilityUnlocks, CLASE_DESCRIPTION, claseDeEspecializacion, resumenMecanicoEspecializacion } from './classAbilities.js';
import { startingAbilitiesFor } from './startingAbilities.js';
import type { Clase, Especializacion } from '@prisma/client';
import { slugify } from '../lib/slugify.js';
import { BERIG_RAZAS, BERIG_PERSONAJES } from './berigLore.js';
import {
  FAUNA_SEXO_VARIANTES,
  NPC_SEXO_VARIANTES,
  RAZA_SEXO_VARIANTES,
  RAZA_VARIANTE_SEXO_VARIANTES,
  type SexoVariantesEntry,
} from './sexDimorphism.js';
import type { ImagePromptEntityType } from './imagePromptGenerator.js';
import type { MomentoDelDia } from './worldClock.js';

export interface ImagePromptSubject {
  name: string;
  loreContext: string;
}

/// Formato Title Case desde SNAKE_CASE, mismo criterio que `especializacionLabel`/`claseLabel`
/// del frontend (lib/dice.ts) — replicado aquí en vez de compartido porque backend/frontend no
/// comparten módulos de utilidades (roadmap de UI de especialización, 2026-09-01).
function enumLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/// Imágenes de día/noche y estación (2026-08-27, docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md) — mismo
/// mecanismo de sufijo en `entitySlug` que ya usan las variantes por sexo (`stripSexoSuffix`) más
/// abajo, pero deliberadamente SIN contenido curado por entidad: a diferencia del sexo (rasgo
/// físico propio de cada especie), la luz/estación son genéricas — un bloque de texto reutilizable
/// basta, sin escribir nada nuevo por Location. Solo aplica a `location`/`zona` (el resto de tipos
/// de entidad son retratos/objetos aislados donde "de noche" no tiene sentido visual propio).
export type EstacionSlug = 'primavera' | 'verano' | 'otono' | 'invierno';
const MOMENTOS: MomentoDelDia[] = ['dia', 'noche'];
const ESTACIONES: EstacionSlug[] = ['primavera', 'verano', 'otono', 'invierno'];

const MOMENTO_TEXT: Record<MomentoDelDia, string> = {
  dia: 'Es de día: luz solar clara y directa, buena visibilidad de todos los detalles del paisaje.',
  // Helek Sirik NUNCA tiene luna convencional (genesis.md § "El cielo sin luna") — de noche el
  // cielo muestra un cinturón difuso de micro-cristales que refleja un brillo perlado y suave
  // (nunca un disco nítido como una luna real), además de estrellas normales. Sin esta corrección
  // explícita, cualquier prompt de imagen nocturna de Location/Zona podía pedir "luna" sin más.
  noche: 'Es de noche: iluminada por un brillo perlado y difuso repartido por todo el cielo (nunca un disco de luna — este mundo no tiene luna), estrellas visibles, o fuego; sombras profundas, colores apagados y fríos, sin luz solar.',
};

const ESTACION_TEXT: Record<EstacionSlug, string> = {
  primavera: 'Es primavera: vegetación en brote, colores vivos y frescos, clima templado.',
  verano: 'Es verano: calor intenso, luz dura y alta, vegetación seca o en su punto máximo según la región.',
  otono: 'Es otoño: hojas caídas y doradas donde haya vegetación, luz cálida y oblicua, primeros fríos ya notándose.',
  invierno: 'Es invierno: frío marcado, posible nieve o escarcha si la región lo permite, luz fría y apagada, vegetación reducida o desnuda.',
};

export interface LocationTimeVariant {
  baseSlug: string;
  momento: MomentoDelDia | null;
  estacion: EstacionSlug | null;
}

/// Sufijo compuesto SIEMPRE en el mismo orden, `-<momento>-<estacion>` (p.ej.
/// `hondonada-del-eco-noche-invierno`) — pero cada mitad es independiente y opcional, así que
/// `-noche` o `-invierno` solos también son válidos (no hace falta generar los 8 cruces de golpe).
export function stripLocationTimeVariant(entitySlug: string): LocationTimeVariant {
  let rest = entitySlug;
  let estacion: EstacionSlug | null = null;
  let momento: MomentoDelDia | null = null;
  for (const e of ESTACIONES) {
    if (rest.endsWith(`-${e}`)) {
      estacion = e;
      rest = rest.slice(0, -(`-${e}`.length));
      break;
    }
  }
  for (const m of MOMENTOS) {
    if (rest.endsWith(`-${m}`)) {
      momento = m;
      rest = rest.slice(0, -(`-${m}`.length));
      break;
    }
  }
  return { baseSlug: rest, momento, estacion };
}

function withTimeVariant(loreContext: string, momento: MomentoDelDia | null, estacion: EstacionSlug | null): string {
  const parts = [loreContext];
  if (momento) parts.push(MOMENTO_TEXT[momento]);
  if (estacion) parts.push(ESTACION_TEXT[estacion]);
  return parts.join(' ');
}

/// Variantes por sexo (2026-07-22, ver sexDimorphism.ts): el entitySlug de una variante es
/// `<slug base>-macho`/`<slug base>-hembra` — mismo esquema que las variantes regionales de raza
/// (slug propio para tener su propia imagen), pero derivado por sufijo en vez de listado aparte,
/// porque aquí el slug base YA es real en Prisma (Npc/HarvestYield) y no hace falta duplicarlo.
function stripSexoSuffix(entitySlug: string): { baseSlug: string; sexo: 'macho' | 'hembra' } | null {
  if (entitySlug.endsWith('-macho')) return { baseSlug: entitySlug.slice(0, -'-macho'.length), sexo: 'macho' };
  if (entitySlug.endsWith('-hembra')) return { baseSlug: entitySlug.slice(0, -'-hembra'.length), sexo: 'hembra' };
  return null;
}

// `sexoLabel` explícito (bug real, 2026-07-22: "el prompt no indica en ninguna parte 'female'")
// — antes solo se pasaba el rasgo físico en español (p.ej. "complexión más estilizada..."), sin
// ninguna palabra que dijera "esto es una hembra/mujer" — el modelo no tenía una señal fiable
// para escribir "female" en el prompt en inglés que genera. Ahora es una frase aparte, sin
// ambigüedad, antes de los rasgos físicos concretos.
//
// Medida y edad concretas (2026-07-22, "no tienen contexto de las otras cosas que hemos
// generado... que indique casi medidas exactas tanto en el macho como en la hembra... hacer
// símiles no me sirve"): cada imagen se genera de forma aislada, sin ver la del otro sexo, así que
// texto como "misma complexión que el macho" no aporta nada al generador — ahora se añade una
// cifra absoluta de tamaño y edad máxima, igual de explícita que el `sexoLabel`.
function withSexoVariante(general: string, variantes: Record<string, SexoVariantesEntry>, baseSlug: string, sexo: 'macho' | 'hembra'): string {
  const variante = variantes[baseSlug]?.[sexo];
  if (!variante) return general;
  const sexoLabel = sexo === 'hembra' ? 'Es de sexo hembra (mujer, femenino).' : 'Es de sexo macho (hombre, masculino).';
  const medidas = `Mide aproximadamente ${variante.medidaCm} cm, con una edad máxima de la especie/raza de ${variante.edadMaxima} años.`;
  return `${general} ${sexoLabel} ${medidas} ${variante.rasgoFisico} ${variante.description}`;
}

/// Construye el nombre + contexto de lore de UNA entidad concreta, para generarle su prompt de
/// imagen bajo demanda (checklist 2026-07-21/22, punto 7 — "pedir 1 a 1 en cada petición", no
/// todo de golpe). Misma lógica por tipo que antes vivía solo en seedImagePrompts.ts (el script
/// de siembra por lotes sigue existiendo para uso puntual, pero ya no es el único punto de
/// entrada) — null si la entidad no existe en este mundo.
export async function loreContextFor(worldId: string, entityType: ImagePromptEntityType, entitySlug: string): Promise<ImagePromptSubject | null> {
  if (entityType === 'npc') {
    // Variante por sexo (2026-07-22, ver sexDimorphism.ts): solo aplica a NPC PLANTILLA genéricos
    // (soldado/oficial de la Concordia hoy) — nunca a individuos únicos con nombre propio, que ya
    // tienen un sexo fijo en su propio lore y no están en NPC_SEXO_VARIANTES.
    const sexoMatch = stripSexoSuffix(entitySlug);
    const npc = await prisma.npc.findUnique({ where: { worldId_slug: { worldId, slug: sexoMatch?.baseSlug ?? entitySlug } } });
    if (!npc) return null;
    const general = `${npc.role}${npc.faction ? `, ${npc.faction}` : ''}. ${npc.bio} ${npc.personality}`;
    return {
      name: npc.name,
      loreContext: sexoMatch ? withSexoVariante(general, NPC_SEXO_VARIANTES, sexoMatch.baseSlug, sexoMatch.sexo) : general,
    };
  }

  if (entityType === 'item') {
    const item = await prisma.itemCatalog.findUnique({ where: { worldId_slug: { worldId, slug: entitySlug } } });
    if (!item) return null;
    // Medidas y origen (2026-07-22, "para los objetos sus medidas y su lugar de origen... que eso
    // se refleje en los prompts") — mismo motivo que medidaCm/edadMaxima en sexDimorphism.ts: cada
    // imagen se genera sola, así que el tamaño real del objeto tiene que ir como cifra explícita en
    // vez de dejar que el generador la adivine o la deje ambigua.
    const medidas = item.dimensiones ? ` Medidas: ${item.dimensiones}` : '';
    const origen = item.lugarOrigen ? ` Origen: ${item.lugarOrigen}` : '';
    return { name: item.name, loreContext: `Categoría: ${item.category}. ${item.description}${medidas}${origen}` };
  }

  // Auditoría "revisar partida" (2026-08-30, "fauna y flora en carpetas separadas") — `'fauna'` y
  // `'flora'` comparten exactamente esta misma lógica (el criterio real, `cazable`, ya distinguía
  // internamente animal de planta/mineral desde 2026-07-22); solo cambia dónde se guarda/busca el
  // archivo de imagen (`imageAssets.ts`), decidido ya en el punto de llamada (`buildFaunaFloraSection`).
  if (entityType === 'fauna' || entityType === 'flora') {
    // Variante por sexo (2026-07-22, ver sexDimorphism.ts): solo fauna de verdad tiene entrada en
    // FAUNA_SEXO_VARIANTES — flora/mineral nunca matchea, así que sigue igual que antes para ellos.
    const sexoMatch = stripSexoSuffix(entitySlug);
    const baseSlug = sexoMatch?.baseSlug ?? entitySlug;
    const [yieldRow, npc] = await Promise.all([
      prisma.harvestYield.findFirst({ where: { worldId, sourceSlug: baseSlug } }),
      prisma.npc.findUnique({ where: { worldId_slug: { worldId, slug: baseSlug } } }),
    ]);
    if (!yieldRow) return null;
    const aliases = harvestSourceAliases[baseSlug] ?? [];
    const cazable = !!npc;
    // Bug real (2026-07-22, encontrado auditando por qué los prompts de fauna/flora salían tan
    // genéricos): esto nunca leía la descripción física real de la entrada — ni el `bio` del Npc
    // para fauna cazable, ni nada para flora/mineral (HarvestYield no tiene columna description).
    // `harvestSourceDescriptions` cubre las fuentes sin Npc propio (ver worldCatalog.ts).
    const description = npc?.bio ?? harvestSourceDescriptions[baseSlug];
    const general = `${cazable ? 'Fauna cazable' : 'Flora o material recolectable'} de las Llanuras del Viento Rojo.${
      description ? ` ${description}` : ''
    }${aliases.length ? ` También conocido como: ${aliases.join(', ')}.` : ''}`;
    return {
      name: sourceDisplayNameFor(baseSlug, npc?.name),
      loreContext: sexoMatch ? withSexoVariante(general, FAUNA_SEXO_VARIANTES, baseSlug, sexoMatch.sexo) : general,
    };
  }

  if (entityType === 'raza') {
    // Variante por sexo (2026-07-22, "nos dejamos las razas también"): a nivel de RAZA GENERAL,
    // independiente de las variantes regionales de abajo — el slug es `<raza>-macho`/`<raza>-hembra`,
    // nunca cruza con una región (p.ej. no existe 'orcos-llanuras-macho').
    const sexoMatch = stripSexoSuffix(entitySlug);
    const razaBase = sexoMatch ? BERIG_RAZAS.find((r) => r.slug === sexoMatch.baseSlug) : undefined;
    if (razaBase && sexoMatch) {
      const general = `${razaBase.rasgoFisico} ${razaBase.rasgoCaracter} ${razaBase.description}`;
      return { name: razaBase.name, loreContext: withSexoVariante(general, RAZA_SEXO_VARIANTES, sexoMatch.baseSlug, sexoMatch.sexo) };
    }
    // Sexo DENTRO de una variante regional (2026-07-22, "sí, cruzar para Orcos"): el slug base del
    // sufijo es el de la VARIANTE (p.ej. 'orcos-llanuras'), no el de la raza — combina general de
    // la raza + específico de la región + específico del sexo, los tres niveles a la vez.
    if (sexoMatch) {
      for (const r of BERIG_RAZAS) {
        const variante = r.variantes?.find((v) => v.slug === sexoMatch.baseSlug);
        if (variante) {
          const general = `${r.rasgoFisico} ${r.rasgoCaracter} ${r.description} ${variante.rasgoFisico} ${variante.description}`;
          // Bug real (2026-07-22, "Goirntes hembra de Meseta del Orden no indica female en
          // ninguna parte"): esta variante regional concreta puede no tener su propio par
          // macho/hembra en RAZA_VARIANTE_SEXO_VARIANTES (hoy solo Orcos lo tiene) — antes eso
          // hacía que `withSexoVariante` devolviera el texto general SIN NINGÚN rastro del sexo
          // pedido, en vez de caer al sexo GENERAL de la raza padre (`r.slug`, no el de la
          // variante). Ahora sí cae ahí cuando la variante no tiene su propio par.
          const loreContext = RAZA_VARIANTE_SEXO_VARIANTES[sexoMatch.baseSlug]
            ? withSexoVariante(general, RAZA_VARIANTE_SEXO_VARIANTES, sexoMatch.baseSlug, sexoMatch.sexo)
            : withSexoVariante(general, RAZA_SEXO_VARIANTES, r.slug, sexoMatch.sexo);
          return { name: variante.name, loreContext };
        }
      }
      return null;
    }

    const raza = BERIG_RAZAS.find((r) => r.slug === entitySlug);
    if (raza) {
      return { name: raza.name, loreContext: `${raza.rasgoFisico} ${raza.rasgoCaracter} ${raza.description}` };
    }
    // Variante regional (2026-07-22, "al pulsar orcos aun pudiese elegir el tipo según la
    // región") — mismo entityType 'raza', slug propio de la variante (p.ej. 'orcos-llanuras'),
    // para poder generarle/subirle su propia imagen distinta de la ficha general de la raza.
    for (const r of BERIG_RAZAS) {
      const variante = r.variantes?.find((v) => v.slug === entitySlug);
      if (variante) {
        // Petición explícita (2026-07-22): el prompt de una variante regional necesita la
        // descripción GENERAL de la raza (antes se perdía por completo) + lo específico de este
        // aspecto — para que la IA tenga la información completa, no solo el fragmento del clan.
        return {
          name: variante.name,
          loreContext: `${r.rasgoFisico} ${r.rasgoCaracter} ${r.description} ${variante.rasgoFisico} ${variante.description}`,
        };
      }
    }
    return null;
  }

  if (entityType === 'location') {
    // Día/noche/estación (2026-08-27) — sufijo opcional en el slug, ver stripLocationTimeVariant.
    const { baseSlug, momento, estacion } = stripLocationTimeVariant(entitySlug);
    const location = await prisma.location.findUnique({ where: { worldId_slug: { worldId, slug: baseSlug } } });
    if (!location) return null;
    const general = `Región: ${location.region}. Tipo: ${location.kind}. ${location.description}`;
    return { name: location.name, loreContext: withTimeVariant(general, momento, estacion) };
  }

  if (entityType === 'zona') {
    // Grupo 3 § Mundo determinista, Capa 1 (2026-08-25) — mismo Location que 'location' arriba,
    // pero pensado para el mapa navegable de la zona (sizeProfile 'mapa'), no para un retrato
    // ambiental. Se listan los puntos reales ya calibrados (ZonePoint) para que la imagen generada
    // tenga referencias concretas de qué hay en cada rincón, no solo la descripción general.
    // Día/noche/estación (2026-08-27), mismo sufijo que 'location' — el mapa de zona también
    // puede variar (nieve, oscuridad) sin perder los puntos de referencia calibrados.
    const { baseSlug, momento, estacion } = stripLocationTimeVariant(entitySlug);
    const location = await prisma.location.findUnique({ where: { worldId_slug: { worldId, slug: baseSlug } }, include: { zonePoints: { where: { saveId: null } } } });
    if (!location) return null;
    const puntos = location.zonePoints.length
      ? ` Elementos reales presentes en la zona (referencia, no listar como texto en la imagen): ${location.zonePoints.map((p) => p.label ?? p.targetSlug).join(', ')}.`
      : '';
    const general = `Región: ${location.region}. Tipo: ${location.kind}. ${location.description}${puntos}`;
    return { name: location.name, loreContext: withTimeVariant(general, momento, estacion) };
  }

  if (entityType === 'faction') {
    const faction = await prisma.faction.findUnique({ where: { worldId_slug: { worldId, slug: entitySlug } } });
    if (!faction) return null;
    return { name: faction.name, loreContext: `Raza dominante: ${faction.raza}. ${faction.description}` };
  }

  if (entityType === 'historia') {
    // Sin candado de traducción aquí a propósito (2026-08-06): esta función lee directo de la BD,
    // fuera del filtro de `/world/:slug/enciclopedia` — el candado real está en `world.ts`, que
    // solo expone `entityType`/`entitySlug` al frontend (y por tanto solo deja pulsar "generar
    // imagen") cuando la entrada ya está `unlocked`. Si nunca se llega a pedir el prompt para una
    // entrada bloqueada, esta rama nunca se ejecuta para ella — no hace falta duplicar el candado.
    const entry = await prisma.historiaEntry.findUnique({ where: { worldId_slug: { worldId, slug: entitySlug } } });
    if (!entry) return null;
    return { name: entry.title, loreContext: entry.text };
  }

  if (entityType === 'construccion') {
    // Contenido estático en código (construction.ts), sin fila de BD — mismo patrón que 'ability'
    // más abajo: se busca por `key` (o por `imageSlug` si la receta define uno propio para
    // imágenes, ver comentario del campo en construction.ts), el mismo slug que ya expone
    // /world/:slug/enciclopedia.
    const recipe = CONSTRUCTION_RECIPES.find((r) => r.key === entitySlug || r.imageSlug === entitySlug);
    if (!recipe) return null;
    return { name: recipe.name, loreContext: recipe.description };
  }

  if (entityType === 'crafteo') {
    // Contenido estático en código (crafting.ts), mismo patrón que 'construccion' — se busca por
    // `key` (2026-08-06, sección "Crafteo" de la Enciclopedia).
    const recipe = CRAFTING_RECIPES.find((r) => r.key === entitySlug);
    if (!recipe) return null;
    return { name: recipe.resultName, loreContext: recipe.resultDescription };
  }

  if (entityType === 'personaje') {
    const personaje = BERIG_PERSONAJES.find((p) => p.slug === entitySlug);
    if (!personaje) return null;
    return {
      name: personaje.name,
      loreContext: `Raza: ${personaje.raza}. ${personaje.personalidad} ${personaje.facultades} ${personaje.historia}`,
    };
  }

  // clase/especializacion: contenido estático en código (classAbilities.ts), sin fila de BD —
  // roadmap de UI de especialización (2026-09-01). `entitySlug` es el propio valor del enum
  // (p.ej. 'CAZADOR', 'INSTINTIVO'), no un slug kebab-case — mismo criterio usado ya en el modal
  // del frontend, sin conversión de casing extra en ningún punto del flujo.
  if (entityType === 'clase') {
    const clase = entitySlug as Clase;
    const description = CLASE_DESCRIPTION[clase];
    if (!description) return null;
    return { name: enumLabel(clase), loreContext: description };
  }
  if (entityType === 'especializacion') {
    const especializacion = entitySlug as Especializacion;
    const clase = claseDeEspecializacion(especializacion);
    if (!clase) return null;
    return {
      name: enumLabel(especializacion),
      loreContext: `Rama de la clase ${enumLabel(clase)}. ${resumenMecanicoEspecializacion(clase, especializacion)}`,
    };
  }

  // ability: contenido estático en código (classAbilities.ts/startingAbilities.ts), sin fila de
  // BD — se busca por slug del nombre, igual que seedImagePrompts.ts.
  const startingAbilities = startingAbilitiesFor('Gorhorn').map((a) => ({ ability: a, levelLabel: 'Habilidad inicial de Gorhorn' }));
  const classUnlocks = allClassAbilityUnlocks().map((u) => ({ ability: u.ability, levelLabel: `Habilidad de clase ${u.clase}, nivel ${u.level}` }));
  const match = [...startingAbilities, ...classUnlocks].find(({ ability }) => slugify(ability.name) === entitySlug);
  if (!match) return null;
  return {
    name: match.ability.name,
    loreContext: `${match.levelLabel}. ${match.ability.description} — "${match.ability.promptText}"`,
  };
}
