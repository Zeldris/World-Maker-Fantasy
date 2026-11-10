import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ollamaGenerate } from '../lib/ollama.js';
import { cargarMundo, modeloImagePrompt, momentoDe } from './imagePromptGenerator.js';
import type { ImagePromptContexto, ImagePromptEntityType } from './imagePromptGenerator.js';

// ============================================================
// IMG-54, paso 6: para el banner el modelo local ya no escribe un párrafo (pautas v5.3) sino el bloque `capas` de la
// ficha (receta-calidad.md, «Plantilla por capas»), y el código monta el prompt `--hibrida` de
// `image-generator/scripts/capas.py`. Las reglas (FOTO, vetadas, tope de `corto`…) viven en
// `image-generator/estilo/capas.json`, la misma fuente que lee capas.py.
// ============================================================

export type TipoCapas = 'fauna' | 'flora' | 'item' | 'construccion' | 'location' | 'raza' | 'npc';

export interface ReglasCapas {
  FOTO: Record<TipoCapas, string>;
  CLAVE: string;
  CORTO_MAX: number;
  VETADAS: { patron: string; motivo: string; alternativa: string }[];
  COLOR: string;
  CAMPOS_LAPIZ: string[];
  COLOR_PERMITIDO: string;
}

let reglasCache: ReglasCapas | null = null;

/// `IMAGE_CAPAS_JSON` para otra ruta; por defecto, el del repo (vale desde `src/` y desde `dist/`).
export function cargarReglasCapas(): ReglasCapas {
  if (reglasCache) return reglasCache;
  const ruta = process.env.IMAGE_CAPAS_JSON || fileURLToPath(new URL('../../../image-generator/estilo/capas.json', import.meta.url));
  reglasCache = JSON.parse(readFileSync(ruta, 'utf8')) as ReglasCapas;
  return reglasCache;
}

/// Tipos del backend que usan la plantilla por capas, con el tipo de `capas.py` que les toca.
const TIPO_CAPAS: Partial<Record<ImagePromptEntityType, TipoCapas>> = {
  fauna: 'fauna',
  flora: 'flora',
  item: 'item',
  crafteo: 'item',
  construccion: 'construccion',
  location: 'location',
  zona: 'location',
  raza: 'raza',
  npc: 'npc',
  personaje: 'npc',
};

export const tipoCapas = (entityType: string): TipoCapas | undefined => TIPO_CAPAS[entityType as ImagePromptEntityType];

/// Claves que escribe el modelo; las cuatro primeras son obligatorias (`viste` solo en personas y razas).
export const CLAVES_CAPAS = ['corto', 'sujeto', 'luz', 'tamano', 'forma', 'viste', 'entorno', 'color', 'repetir', 'paleta'] as const;
export const CLAVES_OBLIGATORIAS = ['corto', 'color', 'entorno', 'paleta'] as const;

export type BloqueCapas = Partial<Record<(typeof CLAVES_CAPAS)[number], string>>;

// ============================================================
// SYSTEM PROMPT
// ============================================================

const REGLAS_CAPAS = `You write the layers of an image prompt for FLUX.2 klein, a text-to-image model that paints every word it reads and gets confused by long text. Reply with ONE JSON object and nothing else: no markdown, no comments, no text around it. Every value is a string in English; use "" for a key that does not apply. Everything comes from the lore you are given. The [brackets] below show only the form of a sentence: fill them from the lore, never copy them.

Keys:
- "corto": at most 120 words of plain sentences, in this order: subject and framing; light; the one dominant feature; the body part by part, each odd part named with the real thing it looks like; colour of each material; setting.
- "sujeto": one sentence: what it is, how it is framed, where it sits in the image.
- "luz": the light as an exposure: where it comes from, what falls in shadow and what is lit. Low-key (deep shadows, light only where it falls) unless the lore says the scene is bright.
- "tamano": its size by comparison with things that are in the image.
- "forma": its shape, part by part.
- "viste": what it wears and carries, by material and cut (people and peoples only; "" for anything else).
- "entorno": the setting in layers: ground, middle distance, horizon.
- "color": the colour of every material, each with its dirt, wear or stains ("[colour] [material], [stain]").
- "repetir": only when the lore says there are many of the same: how the others look, smaller and hazier with distance; otherwise "".
- "paleta": two or three colours and one accent: "[colour], [colour] and [colour] with one accent of [colour]".

Rules:
- Write only what the eye sees in one still image: shape, material, position. A behaviour, a use, a thought or a cause stays out; if it has a visible effect, write the effect.
- Each odd feature is given as the real thing it looks like ("[feature] like [a real thing]"), once, with its difference. A body is built part by part from real animals or real things ("the [part] of [a real animal] on the [part] of [another]"). If the subject's own word is already a real thing, use that word.
- Sizes are comparisons with what is in the image ("[times] taller than [something there]"), never numbers, never pixels.
- Nothing small in the foreground: the main subject is large and fills its side of the frame.
- Colour appears ONLY in "corto", "color" and "paleta". "sujeto", "tamano", "forma", "viste" and "entorno" name no colour at all, not even grey, dark, pale or black.
- Never write a proper name of the world (people, places, factions, species): describe the thing. Translate every Spanish word into English.
- Never use a fantasy word that drags a style with it: orc, elf, dwarf, goblin, troll, golem.
- Never use: moon, moonlit, moonlight, scar, wound, crystal dust.`;

const ENCUADRE_CAPAS: Record<TipoCapas, string> = {
  location: 'Framing for this place: a landscape in layers (foreground, middle distance, horizon) with what lies on the left and what lies on the right, human eye height, no single subject.',
  fauna: 'Framing for this animal: the whole animal, from profile to three-quarters, only one animal in the frame (others only in "repetir").',
  npc: 'Framing for this person: the figure from the thighs up, at three-quarters, in the left part of the image.',
  raza: 'Framing for this people: one figure from the thighs up, at three-quarters, in the left part of the image.',
  item: 'Framing for this object: the object in the place where it is used, large in the frame, with the setting softly behind it.',
  flora: 'Framing for this plant: the plant in its own landscape, large in the frame, with the landscape behind it.',
  construccion: 'Framing for this building: the whole building on its site, seen from human eye height, with the landscape around it.',
};

// ============================================================
// IMG-56: perfil Qwen-Image 2.1 (opt-in con IMAGE_PROMPT_PLANTILLA=qwen21; abrir-enciclopedia.sh qwen21). Mismo bloque `capas`,
// otras instrucciones (image-generator/estilo/agente-qwen21.md), sin tope de 120 palabras en `corto` (era de FLUX klein) y otro
// montaje: el arranque de panorama delante y, antes de «textless», la integración, la irregularidad y el estilo (ronda r36, 9/10).
// Sin la variable, todo sigue igual que antes.
// ============================================================

export type PlantillaCapas = 'flux' | 'qwen21';
export const plantillaCapas = (): PlantillaCapas => (process.env.IMAGE_PROMPT_PLANTILLA === 'qwen21' ? 'qwen21' : 'flux');

const PANORAMA_QWEN21 = 'Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame';
/// La «foto» del perfil qwen21, por tipo: el arranque de los prompts r36 (cuernahoja 9/10 a 1920x768, nota del usuario).
export const FOTO_QWEN21: Record<TipoCapas, string> = {
  fauna: `${PANORAMA_QWEN21}, of an invented creature that does not exist in nature`,
  flora: `${PANORAMA_QWEN21}, of an invented plant that does not exist in nature`,
  raza: `${PANORAMA_QWEN21}, of an invented fantasy figure`,
  npc: `${PANORAMA_QWEN21}, of an invented fantasy figure`,
  item: `${PANORAMA_QWEN21}, of an invented handmade object`,
  construccion: `${PANORAMA_QWEN21}, of an invented building in its landscape`,
  location: 'Wide cinematic panorama at eye level, layered depth from textured ground to hazy horizon, of an otherworldly landscape',
};
/// Contra el efecto «pegatina» (nota del usuario a r36): el sujeto, dentro de la luz y el aire de la escena.
export const INTEGRAR_QWEN21: Record<TipoCapas, string> = {
  fauna:
    "The creatures belong to the scene, not pasted on top of it: their feet press into the ground and kick up a little dust, each casts a long soft shadow that matches the sun, the same warm hazy light and drifting dust wrap around their bodies, the ground's colour bounces onto their undersides, and the farther ones fade softly into the haze like the land behind them.",
  location:
    'Every rock and spire sits in the same air and light as the land around it: soft contact shadows, drifting dust at their feet, and the farther ones fading softly into the haze.',
  flora: 'The plant belongs to the scene, not pasted on top of it: it grows out of the ground with soft contact shadows, casts a shadow that matches the sun, and the same hazy light and drifting dust wrap around it.',
  raza: "The figure belongs to the scene, not pasted on top of it: feet planted in the ground, a shadow that matches the sun, the same hazy light and drifting dust around the body, and the ground's colour bouncing onto it.",
  npc: "The figure belongs to the scene, not pasted on top of it: feet planted in the ground, a shadow that matches the sun, the same hazy light and drifting dust around the body, and the ground's colour bouncing onto it.",
  item: 'The object belongs to the scene, not pasted on top of it: it rests on the ground with soft contact shadows, its shadow matches the light, and the same hazy air wraps around it.',
  construccion: 'The building belongs to the scene, not pasted on top of it: its base sits in the ground with dust and growth at its foot, its shadow matches the sun, and the same hazy light wraps around it.',
};
export const IRREGULAR_QWEN21 = 'Everything is rough, weathered, dusty and irregular, never symmetrical or tidy.';
/// El cierre de estilo de r14/r36 (las notas más altas del usuario: 12/10 y 9/10).
export const ESTILO_QWEN21 =
  'Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with a 35mm lens.';

let agenteQwen21Cache: string | null = null;

/// Las instrucciones del agente: `image-generator/estilo/agente-qwen21.md` sin su comentario HTML de cabecera
/// (`IMAGE_AGENTE_QWEN21_MD` para otra ruta; vale desde `src/` y desde `dist/`).
export function cargarAgenteQwen21(): string {
  if (agenteQwen21Cache) return agenteQwen21Cache;
  const ruta = process.env.IMAGE_AGENTE_QWEN21_MD || fileURLToPath(new URL('../../../image-generator/estilo/agente-qwen21.md', import.meta.url));
  agenteQwen21Cache = readFileSync(ruta, 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim();
  return agenteQwen21Cache;
}

export function systemCapas(tipo: TipoCapas, plantilla: PlantillaCapas = 'flux'): string {
  const reglas = plantilla === 'qwen21' ? cargarAgenteQwen21() : REGLAS_CAPAS;
  return `${reglas}\n\n${ENCUADRE_CAPAS[tipo]}${tipo === 'npc' || tipo === 'raza' ? '' : '\nThis is not a person: leave "viste" as "".'}`;
}

// ============================================================
// VALIDADOR
// ============================================================

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const texto = (v: unknown): string => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(' ') : typeof v === 'string' ? v : '');

const palabras = (t: string): number => t.split(/\s+/).filter(Boolean).length;

/// Motivos por los que el bloque rompe una regla; vacío si vale. Las reglas de `capas.json` (como `comprobar` de
/// capas.py) y las `vetadas` de `mundo.json`.
export function validarCapas(capas: unknown, opciones: { nombre: string; reglas?: ReglasCapas }): string[] {
  const reglas = opciones.reglas ?? cargarReglasCapas();
  if (!capas || typeof capas !== 'object' || Array.isArray(capas)) return ['is not a JSON object'];
  const c = capas as Record<string, unknown>;
  const motivos: string[] = [];
  for (const k of CLAVES_OBLIGATORIAS) {
    if (!texto(c[k]).trim()) motivos.push(`lacks the key "${k}"`);
  }
  for (const [campo, v] of Object.entries(c)) {
    if (campo === 'variantes' || campo === 'notas') continue;
    const t = texto(v);
    // Las negaciones («No spires, no castles.») sí valen.
    const sinNegar = t.replace(/\b[Nn]o [^.]*\./g, '');
    for (const v2 of reglas.VETADAS) {
      const m = new RegExp(v2.patron, 'i').exec(sinNegar);
      if (m) motivos.push(`"${campo}" uses «${m[0]}» (${v2.motivo}); write instead: ${v2.alternativa}`);
    }
    if (campo === 'corto' && palabras(t) > reglas.CORTO_MAX) {
      motivos.push(`"corto" has ${palabras(t)} words, more than the maximum of ${reglas.CORTO_MAX}; shorten it`);
    }
    // Sin la regla de «color en capa de lápiz» de capas.py: la híbrida es foto desde P1 y el color en `entorno` o
    // `forma` no arrastra a dibujo. Con ella, qwen 9B no pasaba ninguna ficha (2026-11-09: «yellow» en entorno).
  }
  const todo = Object.entries(c)
    .filter(([k]) => k !== 'variantes' && k !== 'notas')
    .map(([, v]) => texto(v))
    .join(' ');
  for (const v of cargarMundo().vetadas) {
    const m = new RegExp(v.patron, 'i').exec(todo);
    if (m) motivos.push(`uses «${m[0]}» (${v.motivo}); write instead: ${v.alternativa}`);
  }
  const nombre = opciones.nombre.trim();
  if (nombre && new RegExp(`(^|[^\\p{L}])${escapar(nombre)}($|[^\\p{L}])`, 'iu').test(todo)) {
    motivos.push(`contains the proper name «${nombre}»; the image model does not know it, describe the thing instead`);
  }
  return motivos;
}

// ============================================================
// MONTAJE (igual que `prompts_hibrida` de capas.py)
// ============================================================

/// Prompt `--hibrida`: tipo de foto + `corto` + tamaño, forma, ropa, entorno, color y repetición + paleta + «textless».
export function montarHibrida(
  tipo: string,
  capas: BloqueCapas & { foto?: string },
  reglas: ReglasCapas = cargarReglasCapas(),
  plantilla: PlantillaCapas = 'flux',
): string {
  const t = tipoCapas(tipo) ?? (tipo in reglas.FOTO ? (tipo as TipoCapas) : undefined);
  if (!t) throw new Error(`La plantilla por capas no tiene el tipo «${tipo}»`);
  const c = capas as Record<string, unknown>;
  if (!texto(c.corto)) throw new Error('El bloque «capas» no tiene «corto»');
  const foto = texto(c.foto) || (plantilla === 'qwen21' ? FOTO_QWEN21[t] : reglas.FOTO[t]);
  const primero = `${foto.slice(0, 1).toUpperCase()}${foto.slice(1)}. ${texto(c.corto)}`.replace(' The image is completely textless.', '');
  const resto = ['tamano', 'forma', 'viste', 'entorno', 'color', 'repetir'].map((k) => texto(c[k]));
  if (texto(c.paleta)) resto.push(`A limited, muted palette of ${texto(c.paleta)}.`);
  const cierre = plantilla === 'qwen21' ? [INTEGRAR_QWEN21[t], IRREGULAR_QWEN21, ESTILO_QWEN21] : [];
  return [primero, ...resto.filter(Boolean), ...cierre, 'The image is completely textless.'].join(' ');
}

// ============================================================
// GENERACIÓN
// ============================================================

/// Saca el objeto JSON de la respuesta, aunque venga con ```json``` o texto alrededor. `null` si no hay.
export function parsearCapas(text: string): Record<string, unknown> | null {
  const limpio = text.replace(/```(?:json)?/gi, '');
  const a = limpio.indexOf('{');
  const b = limpio.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const v = JSON.parse(limpio.slice(a, b + 1)) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/// Deja solo las claves conocidas, como texto (una lista se une con espacios).
function normalizar(c: Record<string, unknown>): BloqueCapas {
  const out: BloqueCapas = {};
  for (const k of CLAVES_CAPAS) {
    const t = texto(c[k]).replace(/\s+/g, ' ').trim();
    if (t) out[k] = t;
  }
  return out;
}

/// Si `corto` se pasa del tope, se quitan frases del final mientras quede al menos una: el orden pone el entorno al
/// final, lo que menos pesa. El 9B se pasaba por poco (123 y 130 palabras, orcos, 2026-11-09) aun con el reintento.
export function recortarCorto(capas: BloqueCapas, max: number = cargarReglasCapas().CORTO_MAX): BloqueCapas {
  let corto = capas.corto ?? '';
  let frases: string[] = corto.match(/[^.!?]+[.!?]+/g) ?? [];
  while (palabras(corto) > max && frases.length > 1) {
    frases = frases.slice(0, -1);
    corto = frases.join('').trim();
  }
  return corto === capas.corto ? capas : { ...capas, corto };
}

const SEXO_HEMBRA = /\b(hembra|mujer|femenin[oa])\b/i;
const SEXO_MACHO = /\b(macho|hombre|masculin[oa])\b/i;

function contenidoUsuario(entityType: ImagePromptEntityType, name: string, lore: string, contexto: ImagePromptContexto, tipo: TipoCapas): string {
  const mundo = cargarMundo();
  const momento = momentoDe(lore, contexto);
  const region = contexto.region ? mundo.regiones[contexto.region] : undefined;
  const luzRegion = typeof region?.luz === 'string' ? region.luz : (region?.luz?.[momento] ?? '');
  const sexo = SEXO_HEMBRA.test(lore) ? 'female' : SEXO_MACHO.test(lore) ? 'male' : '';
  return [
    `Subject (never write this name): ${name}`,
    `Kind: ${tipo === 'fauna' ? 'animal' : entityType}${sexo ? `, ${sexo}` : ''}`,
    `Time of day: ${momento === 'dia' ? 'day' : momento === 'atardecer' ? 'dusk' : 'night'}`,
    region?.paisaje ? `Region landscape: ${region.paisaje}` : '',
    luzRegion ? `Region light at this time: ${luzRegion}` : '',
    '',
    `Lore of the subject (Spanish):\n${lore}`,
    contexto.loreRelacionado?.length ? `\nRelated lore (Spanish, for the setting and the things it mentions; never describe these as the subject):\n${contexto.loreRelacionado.join('\n')}` : '',
    '',
    'Write the JSON object now.',
  ]
    .filter((l, i, arr) => l !== '' || (arr[i - 1] ?? '') !== '')
    .join('\n');
}

/// El modelo local escribe el bloque `capas`; el código lo valida (un reintento con los motivos) y monta `--hibrida`.
export async function generarCapas(
  entityType: ImagePromptEntityType,
  name: string,
  lore: string,
  contexto: ImagePromptContexto = {},
): Promise<{ capas: BloqueCapas; prompt: string; provider: string }> {
  const tipo = tipoCapas(entityType);
  if (!tipo) throw new Error(`La plantilla por capas no tiene el tipo «${entityType}»`);
  const model = modeloImagePrompt();
  const plantilla = plantillaCapas();
  const system = systemCapas(tipo, plantilla);
  // qwen21: `corto` sin tope de palabras (el de 120 era de FLUX klein)
  const reglas = plantilla === 'qwen21' ? { ...cargarReglasCapas(), CORTO_MAX: Number.POSITIVE_INFINITY } : undefined;
  const base = contenidoUsuario(entityType, name, lore, contexto, tipo);
  let peticion = base;
  let motivos: string[] = [];
  for (let intento = 1; intento <= 2; intento++) {
    const { text } = await ollamaGenerate({
      model,
      system,
      prompt: peticion,
      // Se carga para este trabajo y se descarga al acabar: la cola de IMG-50 no deja el modelo abierto.
      keepAlive: '0',
      numCtx: 32768,
      temperature: 0.6,
      maxTokens: plantilla === 'qwen21' ? 2200 : 1400,
      timeoutMs: 900_000,
      tarea: 'image-prompt',
      intento,
    });
    const crudo = parsearCapas(text);
    if (!crudo) {
      motivos = ['is not a valid JSON object; reply with the JSON object only'];
      peticion = `${base}\n\nYour previous reply was not valid JSON.\nPrevious reply:\n${text.slice(0, 1500)}\n\nReply again with ONLY the JSON object, with every key.`;
      continue;
    }
    const capas = recortarCorto(normalizar(crudo), reglas?.CORTO_MAX);
    motivos = validarCapas(capas, { nombre: name, reglas });
    if (motivos.length === 0) return { capas, prompt: montarHibrida(tipo, capas, undefined, plantilla), provider: `ollama:${model}${plantilla === 'qwen21' ? ' (qwen21)' : ''}` };
    peticion = `${base}\n\nYour previous JSON broke these rules:\n${motivos.map((m) => `- It ${m}.`).join('\n')}\nPrevious JSON:\n${JSON.stringify(capas)}\n\nReply again with the whole JSON object, fixing every point and keeping everything else.`;
  }
  throw new Error(`Las capas no cumplen las reglas de capas.json: ${motivos.join('; ')}`);
}
