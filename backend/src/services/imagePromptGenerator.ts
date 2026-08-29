import { completeWithFallback } from '../lib/aiProviders/orchestrator.js';

// ============================================================
// TIPOS BASE (sin cambios)
// ============================================================

export type ImagePromptEntityType =
  | 'npc'
  | 'item'
  | 'fauna'
  | 'ability'
  | 'raza'
  | 'personaje'
  | 'location'
  | 'construccion'
  | 'faction'
  | 'historia'
  | 'crafteo'
  | 'zona';

/// `'mapa'` (Grupo 3 § Mundo determinista, 2026-08-25, Capa 1: zonas navegables) — lienzo fijo
/// 800×600, misma convención que ya usa el mapa de mundo (`frontend/src/data/map.ts`) para que el
/// overlay SVG de marcadores se pueda reutilizar tal cual. Distinto de `banner`/`thumbnail`
/// (pensados para retrato/icono, no para una vista aérea navegable).
export type ImagePromptSizeProfile = 'thumbnail' | 'banner' | 'mapa';

// ============================================================
// MAPEOS — ENTITY TYPE → HINT (sin cambios)
// ============================================================

const ENTITY_TYPE_HINT: Record<ImagePromptEntityType, string> = {
  npc: 'a character portrait',
  item: 'an item/prop illustration',
  fauna: 'a creature or plant illustration',
  ability: 'a dynamic action/skill illustration',
  raza: 'a reference illustration of a typical member of this people/race (not a specific named character)',
  personaje: 'a character portrait of this specific playable protagonist',
  location: 'a wide establishing/environment illustration of this real place',
  construccion: 'an illustration of this specific building/structure',
  faction: 'a heraldic emblem/banner illustration representing this faction or clan (not a specific named character)',
  historia: 'an illustration of the historical scene or physical document described in this lore entry',
  crafteo: 'an item/prop illustration of this specific crafted result',
  zona: 'a top-down aerial exploration map of this real place, illustrated terrain layout with distinct landmarks, in the style of a hand-drawn fantasy game map — NOT a scenic ground-level illustration',
};

// ============================================================
// MAPEOS — ESTILOS POR TIPO (NUEVO, INTERNO)
// ============================================================

const ENTITY_TYPE_STYLE: Record<ImagePromptEntityType, string> = {
  npc: 'hyperrealistic design with fantastic nuances, photorealistic rendering, cinematic detail, rich textures, dramatic lighting',
  item: 'hyperrealistic design with fantastic nuances, photorealistic rendering, cinematic detail, sharp focus on materials and texture',
  fauna: 'hyperrealistic design with fantastic nuances, photorealistic rendering, cinematic detail, animal anatomy and environmental integration',
  ability: 'dark fantasy illustration style, heavy shadows, dramatic chiaroscuro, moody and atmospheric, ink-wash textures, gothic undertones',
  raza: 'hyperrealistic design with fantastic nuances, photorealistic rendering, cinematic detail, anthropological reference quality',
  personaje: 'hyperrealistic design with fantastic nuances, photorealistic rendering, cinematic detail, character portrait with personality and presence',
  location: 'painterly style with visible brushstrokes, rich impasto textures, atmospheric lighting, soft edges, oil painting aesthetic, fantasy art quality',
  construccion: 'hyperrealistic design with fantastic nuances, photorealistic rendering, cinematic detail, architectural precision and weathering',
  faction: 'bold flat icon illustration, simple clean shapes, a single strong silhouette, minimal flat color palette, no fine texture or surface detail — must read clearly and instantly as a small icon; NEVER photorealistic',
  historia: 'painterly style with visible brushstrokes, rich impasto textures, atmospheric lighting, soft edges, oil painting aesthetic, fantasy art quality, historical scene',
  crafteo: 'hyperrealistic design with fantastic nuances, photorealistic rendering, cinematic detail, sharp focus on crafted materials and tool marks',
  // Reforzado (2026-08-26, hallazgo real: la primera imagen de prueba trajo título y leyenda en
  // inglés incrustados pese a que "no text or labels" ya estaba aquí) — la app pinta sus propios
  // pines reales (`ZonePoint`) encima de esta imagen, así que cualquier texto/leyenda/cartucho
  // horneado en el propio PNG siempre queda descolocado o duplicado. `generateImagePrompt` instruye
  // al LLM a "copiar" este estilo literal (no resumirlo), así que la prohibición sobrevive el
  // refinado — pero la herramienta EXTERNA de generación es la que puede seguir ignorándolo: una
  // sola cláusula al final ("no text or labels") se pierde fácil entre el resto de la descripción,
  // así que aquí va repetida, explícita y en mayúsculas donde más pesa.
  zona: 'hand-illustrated fantasy cartography style, painterly top-down map, muted natural color palette, clearly readable terrain features and landmarks purely through illustrated shape and color — ABSOLUTELY NO TEXT ANYWHERE IN THE IMAGE: no title, no legend, no cartouche, no compass rose, no scale bar, no labels, no captions, no lettering, no numbers, no watermark, no UI elements of any kind, a completely textless illustration',
};

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
  // Añadidos 2026-08-27 (docs/rpgtarkor/imagenes-prompts.md, auditoría de calidad de prompts) —
  // vocabulario real y frecuente en worldCatalog.ts que antes caía siempre al fallback neutro
  // (sin ningún tono inferido): "ceniza" aparece 12 veces, "volcánic-" 5, "helada" 4, "desiert-" 2,
  // "sagrad-" 2 — grepeado contra el catálogo real, no inventado, para no añadir buckets que nunca
  // vayan a disparar en la práctica.
  if (lower.includes('ceniza') || lower.includes('volcáni') || lower.includes('volcani') || lower.includes('lava') || lower.includes('ígne') || lower.includes('igne')) {
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
// DIMENSIONES EXACTAS (sin cambios)
// ============================================================

const SIZE_PROFILE_DIMENSIONS: Record<ImagePromptSizeProfile, string> = {
  thumbnail: 'square 1:1 aspect ratio, 1024x1024px',
  banner: 'wide 2.5:1 aspect ratio, 1920x768px',
  mapa: 'wide 4:3 aspect ratio, 800x600px',
};

// ============================================================
// HEADROOM INSTRUCTION (mejorada)
// ============================================================

const HEADROOM_INSTRUCTION: Record<ImagePromptSizeProfile, string> = {
  thumbnail:
    'top of head/subject clearly inside frame with at least 10% empty space above; single centered subject with simple or plain background, bold silhouette readable when scaled down, minimal fine detail',

  banner:
    'clear headroom above the main subject — the top of the composition must have at least 15% of the image height as open sky, mist, or empty background before the subject begins, to allow safe cropping for UI overlays without cutting into the focal point; center horizontally or place slightly off-center, but always leave breathing room around it; never crop the top or any edge of the subject',
  mapa:
    'the entire navigable area must be visible within frame, evenly lit with no single dramatic focal point, consistent scale and perspective across the whole image so landmarks can be located precisely, no vignetting or heavy framing at the edges',
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
  // Añadir bloque de seguridad al final si no está ya presente
  if (!sanitized.includes('no explicit gore')) {
    sanitized += ', no explicit gore, no nudity, no open wounds, no graphic violence, no anatomical detail, no sexual content';
  }
  return sanitized;
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
// CONSTRUCCIÓN DEL PROMPT (NUEVA ESTRUCTURA INTERNA)
// ============================================================

function buildPrompt(
  entityType: ImagePromptEntityType,
  name: string,
  loreContext: string,
  sizeProfile: ImagePromptSizeProfile,
): string {
  const hint = ENTITY_TYPE_HINT[entityType];
  const dimensions = SIZE_PROFILE_DIMENSIONS[sizeProfile];
  const style = ENTITY_TYPE_STYLE[entityType];
  const headroom = HEADROOM_INSTRUCTION[sizeProfile];
  const tone = inferToneFromLore(loreContext);

  let subject = `${name} — ${hint}`;
  subject = ensureSexExplicit(loreContext, subject);

  const parts: string[] = [
    subject,
    loreContext,
  ];

  if (tone) parts.push(tone);
  parts.push(headroom);
  parts.push(style);
  parts.push(dimensions);

  let fullPrompt = parts.join(', ');
  fullPrompt = sanitizePrompt(fullPrompt);

  return fullPrompt;
}

// ============================================================
// FUNCIÓN PRINCIPAL — API EXACTAMENTE IGUAL
// ============================================================

export async function generateImagePrompt(
  entityType: ImagePromptEntityType,
  name: string,
  loreContext: string,
  sizeProfile: ImagePromptSizeProfile,
): Promise<{ prompt: string; provider: string }> {
  // Construir el prompt estructurado sin llamar al LLM (porque ya tenemos toda la lógica interna:
  // hint por tipo, estilo por tipo, tono inferido del lore, encuadre por perfil, dimensiones).
  const structuredPrompt = buildPrompt(
    entityType,
    name,
    loreContext,
    sizeProfile,
  );

  // Bug real (2026-08-27, auditoría de calidad de prompts): `structuredPrompt` se calculaba pero
  // NUNCA llegaba al LLM — `userContent` solo mandaba Type/Name/Lore/Profile en bruto, así que
  // toda la maquinaria de arriba (estilo por tipo, tono inferido, encuadre, dimensiones exactas)
  // quedaba muerta; el system prompt le pedía al modelo "usa el tono inferido del lore"/"copia el
  // estilo apropiado" SIN DARLE ese tono/estilo en ningún sitio — tenía que adivinarlos de cero.
  // Ahora el borrador estructurado viaja como base real a pulir, tal como el comentario de arriba
  // siempre dijo que pasaba.
  const userContent = `
Type: ${ENTITY_TYPE_HINT[entityType]}
Name: ${name}
Lore (Spanish): ${loreContext}
Profile: ${SIZE_PROFILE_DIMENSIONS[sizeProfile]}

Structured draft (already includes the correct tone, framing/headroom, art style and exact pixel dimensions for this type of image — polish it into natural, vivid, flowing English; NEVER drop or rewrite the art style or the exact dimensions it already states):
${structuredPrompt}
`;

  const systemPrompt = `You are a prompt engineer for a text-to-image AI. You receive a lore description in Spanish plus an already-correct structured draft prompt, and must refine that draft into a concise, vivid English image prompt. Follow this exact structure for your output (single line, comma-separated):
  1. Subject (with sex explicitly stated if provided)
  2. Physical appearance / material description
  3. Clothing, armor, or textures
  4. Props, weapons, or equipment
  5. Setting / environment / background
  6. Lighting and atmosphere (use the tone already given in the structured draft, never invent a different one)
  7. Framing and composition (use the headroom instruction already given in the structured draft)
  8. Art style (copy the art style already given in the structured draft, word for word — never substitute it)
  9. Dimensions (copy the exact dimensions for the profile)

  CRITICAL:
  - Every image is generated in total isolation — NEVER compare to another sex, character, species, region, or object.
  - Every visual trait must be a standalone, absolute description.
  - Named places/factions may appear only as setting/origin context.
  - No quotes, no explanations, no line breaks, max ~70 words.
  - Return ONLY the prompt.`;

  const { text, provider } = await completeWithFallback(
    systemPrompt,
    userContent,
    220,
  );

  // Sanitizar la salida del LLM por si acaso
  const finalPrompt = sanitizePrompt(text);

  return { prompt: finalPrompt, provider };
}

// ============================================================
// FUNCIÓN ADICIONAL — NEGATIVE PROMPT (OPCIONAL, NUEVA)
// ============================================================

export function buildNegativePrompt(entityType: ImagePromptEntityType): string {
  const style = ENTITY_TYPE_STYLE[entityType];
  const base =
    'deformed, bad anatomy, disfigured, poorly drawn face, mutation, mutated, extra limb, ugly, missing limb, floating limbs, disconnected limbs, malformed hands, out of focus, blurry, lowres, bad proportions, cloned face, duplicate, morbid, mutilated';

  const styleSpecific: Record<string, string> = {
    'hyperrealistic': 'cartoon, 3d render, watercolor, stylized, surreal, anime, sketch, flat color, low detail',
    'painterly': 'photorealistic, hyperrealistic, flat, vector, digital sharp, low-poly, 3d render',
    'dark fantasy illustration': 'cartoon, bright, colorful, cheerful, photorealistic, flat, low contrast',
    'flat icon': 'photorealistic, hyperdetailed, shadow, gradient, 3d, texture, realism, fine detail, brushstrokes',
  };

  let styleKey = 'hyperrealistic';
  if (style.includes('painterly')) styleKey = 'painterly';
  else if (style.includes('dark fantasy')) styleKey = 'dark fantasy illustration';
  else if (style.includes('flat icon')) styleKey = 'flat icon';

  const specific = styleSpecific[styleKey] || styleSpecific['hyperrealistic'];
  return `${base}, ${specific}`;
}