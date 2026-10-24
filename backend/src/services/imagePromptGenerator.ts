import { completeWithFallback } from '../lib/aiProviders/orchestrator.js';

// ============================================================
// TIPOS BASE (sin cambios)
// ============================================================

export type ImagePromptEntityType =
  | 'npc'
  | 'item'
  | 'fauna'
  /// Auditoría "revisar partida" (2026-08-30, petición explícita: "fauna y flora en carpetas
  /// separadas") — antes `fauna` cubría animal, planta Y mineral de golpe (11 fauna real + 4
  /// planta + 4 mineral mezclados en `uploads/images/fauna/`), aunque el motor ya distinguía
  /// internamente "cazable" (fauna) de "no cazable" (flora/mineral) para el TEXTO del prompt
  /// (`imagePromptContext.ts`). `flora` cubre planta+mineral juntos (decisión explícita: 2
  /// carpetas, no 3 — más simple de gestionar al subir imágenes). Criterio real de asignación:
  /// `esFauna`/`harvestSourcesThatAreFaunaWithoutNpc` (worldCatalog.ts) — un NPC real cazable, o
  /// uno de los 3 animales sin ficha (Espina del Viento/Cornante/Sombra de Kroj), va a `fauna`;
  /// cualquier otro `HarvestYield` (planta/mineral/objeto) va a `flora`.
  | 'flora'
  | 'ability'
  | 'raza'
  | 'personaje'
  | 'location'
  | 'construccion'
  | 'faction'
  | 'historia'
  | 'crafteo'
  | 'zona'
  /// Roadmap de UI de especialización (2026-09-01) — el modal de elección obligatoria a nivel 10
  /// usaba solo un icono de fallback, sin banner propio. `clase`/`especializacion` referencian los
  /// enums `Clase`/`Especializacion` (schema.prisma) directamente como `entitySlug` (p.ej.
  /// 'CAZADOR', 'INSTINTIVO') — contenido estático en código (classAbilities.ts), sin fila de BD,
  /// mismo patrón que `ability`.
  | 'clase'
  | 'especializacion';

/// `'mapa'` (Grupo 3 § Mundo determinista, 2026-08-25, Capa 1: zonas navegables) — lienzo fijo
/// 800×600, misma convención que ya usa el mapa de mundo (`frontend/src/data/map.ts`) para que el
/// overlay SVG de marcadores se pueda reutilizar tal cual. Distinto de `banner`/`thumbnail`
/// (pensados para retrato/icono, no para una vista aérea navegable).
///
/// `'icono'` (2026-08-31, "las ciudades deben tener prompt de mapa como la zona y de icono, no de
/// banner") — mismo lienzo cuadrado que `thumbnail` (1024×1024, lectura a tamaño reducido), pero
/// con el estilo PLANO tipo blasón (`ENTITY_TYPE_STYLE` condicional, ver `buildPrompt`), no el
/// retrato/paisaje pintado que usa `thumbnail` normalmente — mismo espíritu visual que ya usa
/// `faction` para sus emblemas. Pensado para asentamientos (`Location.kind === 'asentamiento'`),
/// pero el perfil en sí es genérico por si otro `entityType` lo necesita más adelante.
export type ImagePromptSizeProfile = 'thumbnail' | 'banner' | 'mapa' | 'icono';

// ============================================================
// MAPEOS — ENTITY TYPE → HINT (sin cambios)
// ============================================================

const ENTITY_TYPE_HINT: Record<ImagePromptEntityType, string> = {
  npc: 'a character portrait',
  item: 'an item/prop illustration',
  fauna: 'a creature/animal illustration',
  flora: 'a plant or mineral illustration',
  ability: 'a dynamic action/skill illustration',
  raza: 'a reference illustration of a typical member of this people/race (not a specific named character)',
  personaje: 'a character portrait of this specific playable protagonist',
  location: 'a wide establishing/environment illustration of this real place',
  construccion: 'an illustration of this specific building/structure',
  faction: 'a heraldic emblem/banner illustration representing this faction or clan (not a specific named character)',
  historia: 'an illustration of the historical scene or physical document described in this lore entry',
  crafteo: 'an item/prop illustration of this specific crafted result',
  zona: 'a top-down aerial exploration map of this real place, illustrated terrain layout with distinct landmarks, in the style of a hand-drawn fantasy game map — NOT a scenic ground-level illustration',
  clase: 'a heraldic emblem/icon illustration representing this combat class (an abstract archetype, not a specific named character)',
  especializacion: 'a heraldic emblem/icon illustration representing this specific combat specialization branch (an abstract archetype, not a specific named character)',
};

// ============================================================
// ESTILO, ACABADO Y LUZ POR TIPO
// ============================================================

// CFG-39 (usuaria, 2026-10-24, banco del múrgol en
// docs/arquitectura/reutilizables/01-generacion-imagenes-local.md): FLUX lee lenguaje natural, no
// listas de etiquetas. El estilo abre el prompt y el acabado (cámara, textura) lo cierra; en medio,
// sujeto → encuadre → entorno → luz. Antes iba todo en una sola lista separada por comas.
interface EstiloTipo {
  estilo: string;
  acabado: string;
  luz: string;
}

const FOTO = 'natural muted colours, subtle filmic grade';
const LUZ_DORADA = 'late-afternoon sun low in the sky, warm golden rim light, soft long shadows';
const PINTURA: EstiloTipo = {
  estilo: 'Oil painting with visible brushstrokes and rich impasto, atmospheric fantasy landscape art',
  acabado: 'Soft painterly edges and rich layered colour',
  luz: 'soft diffuse daylight through atmospheric haze',
};
const ICONO: EstiloTipo = {
  estilo: 'Bold flat icon illustration with simple clean shapes, a single strong silhouette and a minimal flat colour palette, never photorealistic',
  acabado: 'Clean vector-like finish that reads instantly at a small size',
  luz: 'even flat lighting',
};
const RETRATO: EstiloTipo = {
  estilo: `Cinematic fantasy portrait photograph, ${FOTO}`,
  acabado: 'Shot on a full-frame camera with an 85mm lens, ultra detailed skin, cloth and leather texture',
  luz: LUZ_DORADA,
};

const ENTITY_TYPE_STYLE: Record<ImagePromptEntityType, EstiloTipo> = {
  npc: RETRATO,
  personaje: RETRATO,
  raza: RETRATO,
  item: {
    estilo: `Cinematic still-life photograph of a handmade fantasy object, ${FOTO}`,
    acabado: 'Shot with a 100mm macro lens, sharp focus on materials, wear and tool marks',
    luz: 'warm side light from a low window, soft falloff into shadow',
  },
  crafteo: {
    estilo: `Cinematic still-life photograph of a handmade fantasy object, ${FOTO}`,
    acabado: 'Shot with a 100mm macro lens, sharp focus on crafted materials and tool marks',
    luz: 'warm side light from a low window, soft falloff into shadow',
  },
  fauna: {
    estilo: `Cinematic wildlife photograph, ${FOTO}`,
    acabado: 'Shot on a full-frame camera with a 35mm lens, ultra detailed fur, hide and scale texture',
    // Banco del múrgol: la versión que más se acercó al original tenía el sol bajo en el horizonte y nubes de
    // ocaso; con solo «golden light» sale un cielo lavado.
    luz: 'low sun just above the horizon, dramatic sunset clouds filling the sky, warm golden rim light on the fur and hide',
  },
  flora: {
    estilo: `Cinematic nature photograph, ${FOTO}`,
    acabado: 'Shot with a 100mm macro lens, ultra detailed botanical and mineral texture',
    luz: 'soft morning light with gentle backlight',
  },
  construccion: {
    estilo: `Cinematic architectural photograph, ${FOTO}`,
    acabado: 'Shot on a full-frame camera with a 24mm lens, detailed stone, timber and weathering',
    luz: LUZ_DORADA,
  },
  location: PINTURA,
  historia: { ...PINTURA, estilo: `${PINTURA.estilo}, a historical scene` },
  ability: {
    estilo: 'Dark fantasy illustration with heavy shadows, dramatic chiaroscuro and ink-wash textures',
    acabado: 'Moody and atmospheric, with gothic undertones',
    luz: 'a single hard light source carving deep shadows',
  },
  faction: ICONO,
  clase: ICONO,
  especializacion: ICONO,
  // Hallazgo real (2026-08-26): la primera imagen de prueba trajo título y leyenda incrustados. La app pinta sus
  // pines (`ZonePoint`) encima, así que el mapa tiene que salir sin texto: lo dice el estilo y lo repite el cierre.
  zona: {
    estilo: 'Hand-illustrated fantasy cartography, a painterly top-down map with a muted natural colour palette, a completely textless illustration',
    acabado: 'Terrain and landmarks read purely through illustrated shape and colour',
    luz: 'even daylight with no dramatic focal point',
  },
};

// ============================================================
// ESCENARIO Y LUZ POR REGIÓN
// ============================================================

// CFG-40 (usuaria, 2026-10-24): el paisaje y la luz de cada región, en inglés, sacados del canon resumido
// (docs/canon-opencode/regiones/). Banco del múrgol: con escena y luz explícitas la imagen de referencia se
// transfiere bien; sin ellas (cuernahoja) apenas. Claves = `REGION_CORE_NAMES` (discovery.ts).
const REGION_ESCENA: Record<string, { paisaje: string; luz: string }> = {
  'Llanuras del Viento Rojo': {
    paisaje: 'a vast red clay steppe with tufts of dry orange grass, scattered savanna scrub and low volcanic peaks far off in the haze, fine red dust drifting on the wind',
    luz: 'low sun just above the horizon through a haze of red dust, dramatic sunset clouds, warm golden rim light',
  },
  'Cristal Helado': {
    paisaje: 'high ice-capped mountains above a tundra of dark volcanic rock patched with snow, glaciers and sheer sea cliffs',
    luz: 'pale low arctic sun, cold blue shadows, crisp clear air glinting with ice crystals',
  },
  'Ciénaga Troncal': {
    paisaje: 'a dense swamp of tangled trunks and climbing vines, dark standing water and flat muddy clearings',
    luz: 'soft humid light filtered green through the canopy, warm haze rising off the water',
  },
  // El canon lo dice expresamente: en el Margen no hay niebla; el follaje absorbe el sonido.
  'Margen Silencioso': {
    paisaje: 'a temperate rainforest of black-wooded conifers and dense dark foliage over marshy ground, the air clear and perfectly still',
    luz: 'dim green light under a thick canopy pierced by a few sharp shafts of sun, deep shadows',
  },
  'Meseta del Orden': {
    paisaje: 'a grey stone desert of flat slabs and stepped terraces laid out with unnatural symmetry, sparse iron-grey grass, distant fortress walls of polished stone and black iron',
    luz: 'harsh high sun on grey stone, crisp hard shadows, a clear pale sky',
  },
};

export interface ImagePromptContexto {
  /// Región núcleo de la entidad (`ImagePromptSubject.region`).
  region?: string | null;
  /// El lore fija la hora del día: la luz sale de ahí, no de la región ni del tipo.
  conMomento?: boolean;
  /// Prompts usados (CFG-38) de otras entidades del mismo tipo.
  ejemplos?: string[];
}

// ============================================================
// INFERENCIA DE TONO DESDE EL CONTEXTO (NUEVO, INTERNO)
// ============================================================

function inferToneFromLore(lore: string): string {
  const lower = lore.toLowerCase();
  if (lower.includes('épico') || lower.includes('epic') || lower.includes('grandioso') || lower.includes('monumental')) {
    return 'epic scale, monumental presence, awe-inspiring atmosphere, vastness and grandeur';
  }
  if (lower.includes('oscuro') || lower.includes('tenebroso') || lower.includes('dark') || lower.includes('terrorífico')) {
    return 'oppressive atmosphere, shadow-drenched, foreboding and grim, suffocating dread';
  }
  if (lower.includes('misterio') || lower.includes('bruma') || lower.includes('niebla') || lower.includes('mysterious')) {
    return 'veiled in mist, ethereal glow, secrets hidden in shadow, otherworldly and unknown';
  }
  if (lower.includes('salvaje') || lower.includes('brutal') || lower.includes('feroz') || lower.includes('savage')) {
    return 'brutal and primal, raw violence, untamed ferocity, wild and feral energy';
  }
  if (lower.includes('melancolía') || lower.includes('ruina') || lower.includes('olvido') || lower.includes('melancholic')) {
    return 'lonely, wind-swept, faded glory, quiet sorrow, haunting beauty';
  }
  if (lower.includes('antiguo') || lower.includes('anciano') || lower.includes('ruinas') || lower.includes('millenios')) {
    return 'worn by millennia, weathered and eroded, ruins of a forgotten age, time-scarred';
  }
  // Añadidos 2026-08-27 (docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md, auditoría de calidad de prompts) —
  // vocabulario real y frecuente en worldCatalog.ts que antes caía siempre al fallback neutro
  // (sin ningún tono inferido): "ceniza" aparece 12 veces, "volcánic-" 5, "helada" 4, "desiert-" 2,
  // "sagrad-" 2 — grepeado contra el catálogo real, no inventado, para no añadir buckets que nunca
  // vayan a disparar en la práctica.
  // Bug real (2026-08-31): "ceniza" también aparece en nombres propios sin relación con terreno
  // volcánico — "Ketg'lukar, el Salón del Colmillo Ceniza" (Location, cuya propia descripción
  // menciona además "el humo" de los talleres de oficio) y "tótem... Gargantúa de Ceniza tallada"
  // (Faction Clan Serhu) — ambos en Las Llanuras del Viento Rojo, sin volcán real en su lore, pero
  // el prompt les metía "volcanic haze, cracked scorched ground". "humo"/"humean" se probaron como
  // señal de coocurrencia y fallaron (disparaban con CUALQUIER fogata/taller/fragua, no solo
  // volcanes) — se exige vocabulario inequívocamente volcánico/ígneo en la misma frase; "volcáni-"/
  // "lava"/"ígne-" nunca aparecen fuera de ese contexto, así que se quedan sin cambios.
  const cenizaDeTerrenoReal = /\bceniza\b/.test(lower) && /volc[aá]n|lava|magma|erupci[oó]n|cráter|crater/.test(lower);
  if (cenizaDeTerrenoReal || lower.includes('volcáni') || lower.includes('volcani') || lower.includes('lava') || lower.includes('ígne') || lower.includes('igne')) {
    return 'ash-choked air, volcanic haze, cracked scorched ground, embers glowing in the distance';
  }
  if (lower.includes('desiert') || lower.includes('árido') || lower.includes('arido')) {
    return 'harsh arid expanse, heat shimmer, cracked dry earth, relentless sun-bleached horizon';
  }
  if (lower.includes('helad') || lower.includes('hielo') || lower.includes('gélid') || lower.includes('gelid') || lower.includes('nieve')) {
    return 'biting cold, frost-rimed surfaces, pale wintry light, breath visible in the air';
  }
  if (lower.includes('sagrad') || lower.includes('prohibid')) {
    return 'reverent hushed stillness, sense of the sacred or forbidden, light falling as if consecrated';
  }
  return ''; // neutral
}

// ============================================================
// ENCUADRE POR PERFIL
// ============================================================

// CFG-39: sin píxeles ni proporción en el texto (FLUX los ignora o los pinta); el tamaño va en los parámetros
// del generador. Aquí solo cómo se compone la imagen para cada hueco de la interfaz.
const FRAMING: Record<ImagePromptSizeProfile, string> = {
  thumbnail:
    'Close, centred framing of a single subject with clear space above the top of it and a plain, softly blurred background, so the silhouette still reads when small',
  banner:
    'Wide panoramic framing with open sky or mist across the top sixth of the image, the subject slightly off-centre with room around it and nothing cropped at the edges',
  mapa:
    'Empty terrain seen from straight above: ground, vegetation, paths and natural landmarks, with open ground where buildings, characters and creatures will later be placed as separate markers; the whole navigable area in frame at one consistent scale and perspective, without vignetting at the edges',
  icono:
    'A single centred emblem or landmark silhouette filling most of the frame on a plain flat background',
};

// ============================================================
// SANITIZACIÓN AUTOMÁTICA (NUEVA, INTERNA)
// ============================================================

const SAFE_SUBSTITUTIONS: Record<string, string> = {
  blood: 'dark stains',
  bleeding: 'stained',
  wound: 'scar',
  wounds: 'scars',
  gore: 'battle-worn',
  violent: 'fierce',
  corpse: 'fallen remains',
  corpses: 'remains',
  skull: 'bone',
  skulls: 'bones',
  'torn flesh': 'tattered hide',
  'raw meat': 'cured meat',
  'bare chest': 'exposed chest',
  naked: 'bare',
  nudity: 'exposed skin',
  breast: 'chest',
  breasts: 'chest',
  'graphic violence': 'intense action',
  slaughter: 'battle',
  massacre: 'battle',
};

function sanitizePrompt(prompt: string): string {
  let sanitized = prompt;
  for (const [unsafe, safe] of Object.entries(SAFE_SUBSTITUTIONS)) {
    sanitized = sanitized.replace(new RegExp(`\\b${unsafe}\\b`, 'gi'), safe);
  }
  return sanitized;
}

// CFG-39: antes se añadía al final una lista «no explicit gore, no nudity…»; en FLUX nombrar lo que no se quiere
// lo acerca a la imagen, así que el saneado se queda en las sustituciones de arriba y el prompt cierra siempre
// con esta línea, la única negativa que se ha visto funcionar (firmas y textos incrustados).
const CIERRE = 'No text, no signature, no watermark.';

const MEDIDAS = [
  /\b(?:square|wide|tall|portrait|landscape)?\s*\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?\s*(?:aspect ratio)?/gi,
  /\b\d{3,4}\s*[x×]\s*\d{3,4}\s*(?:px|pixels)?/gi,
  /\b\d{3,4}\s*(?:px|pixels)\b/gi,
  /\baspect ratio\b/gi,
];

/// Hace cumplir las reglas sobre la salida del LLM: sin medidas, con el saneado y con la línea de cierre una vez.
function finalizePrompt(text: string): string {
  let out = sanitizePrompt(text.trim().replace(/^["'“”]+|["'“”]+$/g, ''));
  for (const medida of MEDIDAS) out = out.replace(medida, '');
  out = out.replace(/no text,\s*no signature,\s*no watermark\.?/gi, '');
  out = out
    .replace(/\s*,(\s*,)+/g, ',')
    .replace(/\s+([,.])/g, '$1')
    .replace(/,\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,\s]+$/, '');
  if (out && !/[.!?]$/.test(out)) out += '.';
  return out ? `${out} ${CIERRE}` : CIERRE;
}

// ============================================================
// SEXO EXPLÍCITO (sin cambios)
// ============================================================

function ensureSexExplicit(lore: string, subject: string): string {
  const hasFemale = /hembra|mujer|femenino|female/i.test(lore);
  const hasMale = /macho|hombre|masculino|male/i.test(lore);
  if (hasFemale && !/\bfemale\b/i.test(subject)) {
    return subject.replace(/^/, 'female ');
  }
  if (hasMale && !/\bmale\b/i.test(subject)) {
    return subject.replace(/^/, 'male ');
  }
  return subject;
}

// ============================================================
// CONSTRUCCIÓN DEL BORRADOR
// ============================================================

/// Borrador en el orden que pide FLUX: estilo → sujeto (con el lore) → encuadre → luz → acabado → cierre.
/// El LLM lo convierte en frases naturales en inglés con el entorno concreto que saque del lore.
function buildPrompt(
  entityType: ImagePromptEntityType,
  name: string,
  loreContext: string,
  sizeProfile: ImagePromptSizeProfile,
  contexto: ImagePromptContexto,
): string {
  // Icono de asentamiento (2026-08-31): mismo estilo plano que los emblemas de facción, para leerse a tamaño reducido.
  const tipo = entityType === 'location' && sizeProfile === 'icono' ? ENTITY_TYPE_STYLE.faction : ENTITY_TYPE_STYLE[entityType];
  const tone = inferToneFromLore(loreContext);
  const subject = ensureSexExplicit(loreContext, `${name}, ${ENTITY_TYPE_HINT[entityType]}`);
  // Un emblema plano no tiene escenario; el mapa de zona sí toma el terreno, pero su luz sigue siendo uniforme.
  const escena = tipo === ICONO ? undefined : REGION_ESCENA[contexto.region ?? ''];
  const luzRegion = escena && entityType !== 'zona' && entityType !== 'ability' ? escena.luz : undefined;
  const luz = contexto.conMomento ? 'the time of day and season given in the lore' : (luzRegion ?? tipo.luz);

  return [
    `${tipo.estilo}.`,
    `Subject: ${subject}. ${loreContext}`,
    `${FRAMING[sizeProfile]}.`,
    ...(escena ? [`Setting: ${escena.paisaje}.`] : []),
    `Light: ${luz}${tone ? `; atmosphere: ${tone}` : ''}.`,
    `${tipo.acabado}.`,
    CIERRE,
  ].join('\n');
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

export async function generateImagePrompt(
  entityType: ImagePromptEntityType,
  name: string,
  loreContext: string,
  sizeProfile: ImagePromptSizeProfile,
  contexto: ImagePromptContexto = {},
): Promise<{ prompt: string; provider: string }> {
  // Un prompt usado con imagen de referencia empieza por la instrucción para esa imagen: como ejemplo no sirve.
  const ejemplos = (contexto.ejemplos ?? []).map((e) => e.replace(/^Use the reference image[^:]*:\s*/i, '').trim()).filter(Boolean);
  const seccionEjemplos = ejemplos.length
    ? `\nApproved examples (prompts the art director wrote for other subjects of this kind):\n${ejemplos.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`
    : '';
  // Bug real (2026-08-27): el borrador estructurado se calculaba pero no llegaba al LLM. Viaja aquí como base.
  const userContent = `
Type: ${ENTITY_TYPE_HINT[entityType]}
Name: ${name}
Lore (Spanish): ${loreContext}

Draft:
${buildPrompt(entityType, name, loreContext, sizeProfile, contexto)}
${seccionEjemplos}`;

  const systemPrompt = `You write prompts for FLUX, a text-to-image model that reads natural English sentences, not keyword lists. You receive a lore description in Spanish and an English draft. Rewrite the draft as one paragraph of natural English sentences, in this order:
  1. Style: the draft's first sentence, kept as it is.
  2. Subject: what it is (with its sex if the draft gives one) and how it looks — size, build, shape, colours and textures. Invent concrete similes that fit this subject, taken only from nature and raw materials — wood, stone, clay, roots, bark — never from clothing or man-made objects, which the image model paints onto the subject (the kind of "skin cracked like dry riverbed clay" — never reuse this example). Convey size with words of weight and build (massive, towering, broad, slight), never with numbers. Describe every part positively: never write what it is not or what it does not look like, because the image model draws whatever is named.
  3. Pose and framing: follow the draft's framing sentence.
  4. Environment: a concrete scene — ground, vegetation, background, weather — from the draft's setting if it has one, otherwise from the lore. Named places and factions only as setting.
  5. Light: time of day, where the sun or light source is and how it falls; use the draft's light and atmosphere.
  6. Finish: the draft's finish sentence, kept as it is.
  7. End with exactly: "${CIERRE}"

  Rules:
  - Each image is made on its own: never compare with another sex, species, character, region or object; describe every trait on its own terms.
  - Write every word in English: translate every Spanish word from the lore (cuernos → horns, cuello → neck, felino → feline); only the subject's proper name stays as it is.
  - No pixel sizes, resolutions or aspect ratios.
  - No lists of things to avoid.
  - If approved examples are given, match their level of detail, concreteness and richness of light, but never copy their subjects, names or scenery.
  - 90 to 160 words, no quotes, no explanations, no line breaks.
  - Return ONLY the prompt.`;

  const { text, provider } = await completeWithFallback(systemPrompt, userContent, 320);

  return { prompt: finalizePrompt(text), provider };
}
