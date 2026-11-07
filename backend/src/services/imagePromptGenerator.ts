import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ollamaGenerate } from '../lib/ollama.js';

// ============================================================
// TIPOS BASE
// ============================================================

export type ImagePromptEntityType =
  | 'npc'
  | 'item'
  | 'fauna'
  /// Auditoría "revisar partida" (2026-08-30, petición explícita: "fauna y flora en carpetas
  /// separadas"): `flora` cubre planta y mineral juntos. Criterio real de asignación:
  /// `esFauna`/`harvestSourcesThatAreFaunaWithoutNpc` (worldCatalog.ts).
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
  /// `clase`/`especializacion` referencian los enums `Clase`/`Especializacion` (schema.prisma) como `entitySlug`.
  | 'clase'
  | 'especializacion';

/// `'mapa'`: lienzo fijo 800×600 de las zonas navegables. `'icono'`: cuadrado, para asentamientos y emblemas.
export type ImagePromptSizeProfile = 'thumbnail' | 'banner' | 'mapa' | 'icono';

export type MomentoPrompt = 'dia' | 'atardecer' | 'noche';

export interface ImagePromptContexto {
  /// Región núcleo de la entidad (`ImagePromptSubject.region`).
  region?: string | null;
  /// El lore fija la hora del día (variante `-noche` de una zona, p. ej.).
  conMomento?: boolean;
  /// Momento que fija el slug; si falta y `conMomento`, se deduce del lore.
  momento?: MomentoPrompt | null;
  /// Prompts usados (CFG-38) de otras entidades del mismo tipo.
  ejemplos?: string[];
  /// IMG-50: lore parecido por pgvector (y lo que la entidad menciona), ya en texto.
  loreRelacionado?: string[];
}

// ============================================================
// IMG-50 (usuaria, 2026-11-07): el prompt lo escribe el modelo local de OpenCode por Ollama, no las APIs, con el
// formato investigado en el generador de imágenes (`pautas.md` v5.3 de `claude/imagenes-por-fases`). Las partes
// fijas (encuadre, estilo, lente y cierre «textless») las pone el código desde `image-generator/estilo/mundo.json`,
// la misma fuente que `prompt_ficha.py`; el modelo solo escribe el cuerpo descriptivo (bloques 2-7 de §1).
// ============================================================

const MODELO_POR_DEFECTO = 'qwen35-9b-32k';
export const modeloImagePrompt = (): string => process.env.IMAGE_PROMPT_MODEL || MODELO_POR_DEFECTO;

interface Vetada {
  patron: string;
  motivo: string;
  alternativa: string;
}

interface EstiloPerfil {
  palabra?: string;
  base: string;
  luz?: Partial<Record<MomentoPrompt, string>>;
  porTipo?: Record<string, { clase?: string; acabado?: string }>;
}

export interface MundoEstilo {
  preambulo: Record<MomentoPrompt, string>;
  estilos: Record<string, EstiloPerfil | string>;
  encuadres: Record<string, string>;
  regiones: Record<string, { paisaje?: string; luz?: string | Partial<Record<MomentoPrompt, string>> }>;
  coherencia: Partial<Record<MomentoPrompt, { patron: string }>>;
  longitud: { min?: number; max?: number } & Record<string, unknown>;
  vetadas: Vetada[];
  negaciones: string;
}

let mundoCache: MundoEstilo | null = null;

/// `IMAGE_ESTILO_JSON` para otra ruta; por defecto, el del repo (vale desde `src/` y desde `dist/`).
export function cargarMundo(): MundoEstilo {
  if (mundoCache) return mundoCache;
  const ruta = process.env.IMAGE_ESTILO_JSON || fileURLToPath(new URL('../../../image-generator/estilo/mundo.json', import.meta.url));
  mundoCache = JSON.parse(readFileSync(ruta, 'utf8')) as MundoEstilo;
  return mundoCache;
}

/// El banner es la imagen grande: sale con el perfil `fotorreal` del generador (v5.3). El resto, con el suyo.
function perfilMundo(perfil: ImagePromptSizeProfile): string {
  return perfil === 'banner' ? 'fotorreal' : perfil;
}

/// Tipo de `porTipo` (la lente) para cada tipo de entidad del backend.
const TIPO_MUNDO: Partial<Record<ImagePromptEntityType, string>> = {
  fauna: 'fauna',
  flora: 'flora',
  location: 'location',
  zona: 'location',
  construccion: 'location',
  item: 'item',
  crafteo: 'item',
  npc: 'npc',
  raza: 'npc',
  personaje: 'npc',
};

function estiloDe(mundo: MundoEstilo, perfil: string): EstiloPerfil {
  let e = mundo.estilos[perfil];
  if (typeof e === 'string') e = mundo.estilos[e];
  if (!e || typeof e === 'string') throw new Error(`mundo.json: el perfil «${perfil}» no tiene estilo`);
  return e;
}

const TEXTLESS = 'The image is completely textless.';

/// Línea de estilo y cierre: `base` con su clase y la luz del momento, el acabado del tipo y, fuera de
/// `fotorreal`, el preámbulo del momento (como `prompt_ficha.py`). Siempre acaba en «textless».
export function colaFija(mundo: MundoEstilo, perfil: ImagePromptSizeProfile, entityType: ImagePromptEntityType, momento: MomentoPrompt): string {
  const p = perfilMundo(perfil);
  const e = estiloDe(mundo, p);
  const tipo = TIPO_MUNDO[entityType] ?? '';
  const porTipo = e.porTipo?.[tipo] ?? {};
  const base = e.base
    .replace('{clase}', porTipo.clase ?? 'fantasy')
    .replace('{luz}', e.luz?.[momento] ?? '')
    .replace(/\s+/g, ' ')
    .replace(' ,', ',')
    .trim();
  const partes = [base, porTipo.acabado ?? ''];
  if (p !== 'fotorreal') partes.push(mundo.preambulo[momento]);
  const cola = partes.filter(Boolean).join(' ');
  return cola.includes(TEXTLESS) ? cola : `${cola} ${TEXTLESS}`;
}

export function encuadreFijo(mundo: MundoEstilo, perfil: ImagePromptSizeProfile): string {
  return mundo.encuadres[perfilMundo(perfil)];
}

function topeLongitud(mundo: MundoEstilo, perfil: ImagePromptSizeProfile): number {
  const propio = mundo.longitud[perfilMundo(perfil)] as { max?: number } | undefined;
  return propio?.max ?? mundo.longitud.max ?? Number.POSITIVE_INFINITY;
}

// ============================================================
// VALIDADOR (reglas 3, 4, 5, 7 y 9 de la plantilla, con los patrones de mundo.json)
// ============================================================

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/// Motivos por los que el prompt rompe una regla; vacío si vale. Un prompt corto no es error (regla 7: solo se avisa).
export function validarPrompt(
  prompt: string,
  opciones: { nombre: string; momento: MomentoPrompt; perfil: ImagePromptSizeProfile; mundo?: MundoEstilo },
): string[] {
  const mundo = opciones.mundo ?? cargarMundo();
  const motivos: string[] = [];
  for (const v of mundo.vetadas) {
    const m = new RegExp(v.patron, 'i').exec(prompt);
    if (m) motivos.push(`uses «${m[0]}» (${v.motivo}); write instead: ${v.alternativa}`);
  }
  const neg = new RegExp(mundo.negaciones, 'i').exec(prompt);
  if (neg) motivos.push(`uses the negation «${neg[0].trim()}»; describe only what is there, in positive terms`);
  const nombre = opciones.nombre.trim();
  if (nombre && new RegExp(`(^|[^\\p{L}])${escapar(nombre)}($|[^\\p{L}])`, 'iu').test(prompt)) {
    motivos.push(`contains the proper name «${nombre}»; the image model does not know it, describe the thing instead`);
  }
  const coherencia = mundo.coherencia[opciones.momento];
  if (coherencia) {
    const c = new RegExp(coherencia.patron, 'i').exec(prompt);
    if (c) motivos.push(`names «${c[0]}», which does not fit the time of day (${opciones.momento})`);
  }
  const palabras = prompt.split(/\s+/).filter(Boolean).length;
  const tope = topeLongitud(mundo, opciones.perfil);
  if (palabras > tope) motivos.push(`has ${palabras} words, more than the maximum of ${tope}; shorten the description`);
  return motivos;
}

// ============================================================
// SANEADO DEL CUERPO QUE DEVUELVE EL MODELO
// ============================================================

// Sustituciones de contenido explícito. Ya no se cambia «wound» por «scar»: las dos están vetadas en mundo.json
// (pintan heridas abiertas) y el validador pide «pale healed streaks».
const SAFE_SUBSTITUTIONS: Record<string, string> = {
  blood: 'dark stains',
  bleeding: 'stained',
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

const MEDIDAS = [
  /\b(?:square|wide|tall|portrait|landscape)?\s*\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?\s*(?:aspect ratio)?/gi,
  /\b\d{3,4}\s*[x×]\s*\d{3,4}\s*(?:px|pixels)?/gi,
  /\b\d{3,4}\s*(?:px|pixels)\b/gi,
  /\baspect ratio\b/gi,
];

/// Deja el cuerpo en un párrafo: sin comillas, etiquetas, medidas ni partes fijas que el modelo haya repetido.
export function limpiarCuerpo(text: string): string {
  let out = text.trim().replace(/^["'“”]+|["'“”]+$/g, '');
  for (const [unsafe, safe] of Object.entries(SAFE_SUBSTITUTIONS)) {
    out = out.replace(new RegExp(`\\b${unsafe}\\b`, 'gi'), safe);
  }
  for (const medida of MEDIDAS) out = out.replace(medida, '');
  out = out
    .replace(/^\s*(?:prompt|subject|setting|light|description)\s*:\s*/gim, '')
    .replace(/\bStyle:[\s\S]*$/i, '')
    .replace(/The image is completely textless\.?/gi, '')
    .replace(/\s*,(\s*,)+/g, ',')
    .replace(/\s+([,.])/g, '$1')
    .replace(/,\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,\s]+$/, '');
  if (out && !/[.!?]$/.test(out)) out += '.';
  return out;
}

// ============================================================
// SYSTEM PROMPT (pautas v5.3)
// ============================================================

const REGLAS_COMUNES = `You write the descriptive body of a prompt for FLUX.2, a text-to-image model that reads long natural English sentences and paints every word it reads. The framing sentence, the style line and the camera are added by code before and after your text: never write them.

Write one paragraph, in this fixed order:
1. The subject: what it is, with its real-world anchor and its structural proportions in relative numbers.
2. Its shape features, in the order the eye reads them.
3. Its pose.
4. Company, only if the lore gives it.
5. The setting in layers: ground, then middle distance, then horizon.
6. Light and time of day.

Rules:
- Everything about the subject comes from its lore: its build, size, colours and features. The [brackets] below show only the form of a sentence; fill them from the lore.
- The first sentence says what the subject is, with the plain English word for the common noun its lore uses: that kind of thing, never a neighbouring kind and never what it gets used as.
- Write only what the eye sees in this one still image: shape, material, colour and position. A behaviour, a use, a thought or a cause stays out; if it has a visible effect, write the effect.
- Proportions are measured against the subject's own body ("[part] about [times] the length of [other part]"), and they keep the build the lore gives; never pixel sizes or aspect ratios.
- A continuous feature says where it starts and where it ends ("[feature] running from [start] to [end]").
- Colour goes by material ("[colour] [material]").
- The real-world anchor appears once, with its difference ("the build of [a real thing with the same silhouette as the lore describes], only [its difference]"). If the subject's own word is already a real thing, that word is the anchor: give only its difference.
- No counts of repeated parts: "a row of", "many", "a few".
- Light by direction and quality ("[quality] light [direction]"), taken from the region light when it is given; never the word "sun". If the scene is dark, say so in the first sentence of the setting.
- Fractions of the frame start from an explicit edge ("the lower third, from the bottom edge").
- Everything in positive terms: never write no, not, without, never, none, nothing, nobody or n't. What must be absent is simply left out.
- Never write a proper name of the world (people, places, factions, species): describe the thing. A common noun inside a name stays, translated. Translate every Spanish word into English.
- Never use: moon, moonlit, moonlight, crystal dust, heavens, scar, scarred, wound, gash, fossilised sand. Healed marks are "pale healed streaks".
- Return ONLY the paragraph: no title, no labels, no quotes, no line breaks.`;

const PAUTAS_TIPO: Record<string, string> = {
  fauna: `Creature: show the whole animal. A quadruped stands with its body in profile and its head turned three-quarters towards the camera, both eyes and both ears showing, weight on one side or mid-stride. A bird is shown perched in profile with the wings half open; a fish or water creature side-on in the water; a serpent in a loose S-curve with the head raised; an arthropod at a low three-quarter view with all legs on the ground; an amphibian crouched at three-quarters. Only one animal: never ask for the herd or the pack. A body part is never compared with another animal, and a material never with a man-made object: say the material grows from the skin.`,
  flora: `Plant or mineral: show it in its own landscape, in three layers given as fractions of the height from the bottom edge. Give the proportion between its parts (stem, leaves, flower, roots, or crystal and matrix). Another plant serves as anchor only for the bud or flower shape.`,
  location: `Place: there is no single subject and no anchor. Open with the horizon and give the layers as fractions of the image height from the bottom edge, naming three layers (foreground ground, middle distance, horizon). Keep the human trace minimal: a path, a cairn, a distant wall at most.`,
  item: `Object: a still life resting on a surface of the world (stone, hide, rough wood), the camera low at three-quarters and the background softly blurred. Name one emblematic material and describe it by form and texture.`,
  npc: `Person or people: the whole figure in the left third of the image, at full height, in a low, grounded stance, the camera at chest height. Proportions in head-heights ("about [number] heads tall", "shoulders [number] heads wide"). The anchor is the kind of creature ("built like [a kind of creature], only [its difference]"). Clothing and gear come from the lore or fit the trade it gives, described as material with shape ("a [material] [garment] cut to [length], [how it fastens]"). A body part is never compared with another animal, and a material never with a man-made object: say the material grows from the skin.`,
  emblema: `Emblem: one clear symbolic subject with a strong readable silhouette, centred, on a plain painted background. Describe its shapes, materials and colours.`,
  escena: `Scene: one readable moment with a clear main figure or object, then the setting in layers.`,
  mapa: `Map: terrain seen straight from above. Describe the ground, vegetation, water, paths and natural landmarks and where they lie in the frame, from an explicit edge. Light is even and soft.`,
};

function pautaDe(entityType: ImagePromptEntityType, perfil: ImagePromptSizeProfile): string {
  if (perfil === 'mapa') return PAUTAS_TIPO.mapa;
  if (entityType === 'faction' || entityType === 'clase' || entityType === 'especializacion') return PAUTAS_TIPO.emblema;
  if (entityType === 'ability' || entityType === 'historia') return PAUTAS_TIPO.escena;
  if (entityType === 'location' && perfil === 'icono') return PAUTAS_TIPO.emblema;
  return PAUTAS_TIPO[TIPO_MUNDO[entityType] ?? 'escena'] ?? PAUTAS_TIPO.escena;
}

const SEXO_HEMBRA = /\b(hembra|mujer|femenin[oa])\b/i;
const SEXO_MACHO = /\b(macho|hombre|masculin[oa])\b/i;

function momentoDe(lore: string, contexto: ImagePromptContexto): MomentoPrompt {
  if (contexto.momento) return contexto.momento;
  if (!contexto.conMomento) return 'dia';
  if (/\bEs de noche\b|nocturn/i.test(lore)) return 'noche';
  if (/atardecer|ocaso|crep[uú]sculo/i.test(lore)) return 'atardecer';
  return 'dia';
}

function luzRegion(mundo: MundoEstilo, region: string | null | undefined, momento: MomentoPrompt): string {
  const luz = mundo.regiones[region ?? '']?.luz;
  if (!luz) return '';
  return typeof luz === 'string' ? luz : (luz[momento] ?? '');
}

/// Lo que recibe el modelo: el lore de la entidad, el relacionado (RAG), la región y los ejemplos aprobados.
function contenidoUsuario(
  entityType: ImagePromptEntityType,
  name: string,
  loreContext: string,
  perfil: ImagePromptSizeProfile,
  contexto: ImagePromptContexto,
  mundo: MundoEstilo,
  momento: MomentoPrompt,
): string {
  const region = contexto.region ? mundo.regiones[contexto.region] : undefined;
  const sexo = SEXO_HEMBRA.test(loreContext) ? 'female' : SEXO_MACHO.test(loreContext) ? 'male' : '';
  const ejemplos = (contexto.ejemplos ?? []).map((e) => e.replace(/^Use the reference image[^:]*:\s*/i, '').trim()).filter(Boolean);
  const tope = topeLongitud(mundo, perfil);
  const fijas = `${encuadreFijo(mundo, perfil)} ${colaFija(mundo, perfil, entityType, momento)}`.split(/\s+/).length;
  const maxCuerpo = Math.max(80, Math.min(260, tope - fijas - 10));
  return [
    `Subject (never write this name in the prompt): ${name}`,
    // «fauna» es un nombre interno: el modelo escribía «a faunal creature» y FLUX pinta cada palabra.
    `Kind: ${entityType === 'fauna' ? 'animal' : entityType}${sexo ? `, ${sexo}` : ''}`,
    `Time of day: ${momento === 'dia' ? 'day' : momento === 'atardecer' ? 'dusk' : 'night'}`,
    `Image: ${perfil === 'banner' ? 'a wide cinematic banner' : perfil === 'mapa' ? 'a top-down map' : 'a small square icon'}; the framing sentence before your text is: "${encuadreFijo(mundo, perfil)}"`,
    region?.paisaje ? `Region landscape: ${region.paisaje}` : '',
    luzRegion(mundo, contexto.region, momento) ? `Region light at this time: ${luzRegion(mundo, contexto.region, momento)}` : '',
    '',
    `Lore of the subject (Spanish):\n${loreContext}`,
    contexto.loreRelacionado?.length ? `\nRelated lore (Spanish, for the setting and the things it mentions; never describe these as the subject):\n${contexto.loreRelacionado.join('\n')}` : '',
    ejemplos.length ? `\nApproved prompts for other subjects of this kind (match their detail, never their subjects or scenery):\n${ejemplos.map((e, i) => `${i + 1}. ${e}`).join('\n')}` : '',
    '',
    `Write the paragraph now, between ${Math.min(90, maxCuerpo)} and ${maxCuerpo} words.`,
  ]
    .filter((l, i, arr) => l !== '' || (arr[i - 1] ?? '') !== '')
    .join('\n');
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
  const mundo = cargarMundo();
  const momento = momentoDe(loreContext, contexto);
  const model = modeloImagePrompt();
  const system = `${REGLAS_COMUNES}\n\n${pautaDe(entityType, sizeProfile)}`;
  const base = contenidoUsuario(entityType, name, loreContext, sizeProfile, contexto, mundo, momento);
  const montar = (cuerpo: string) => [encuadreFijo(mundo, sizeProfile), cuerpo, colaFija(mundo, sizeProfile, entityType, momento)].filter(Boolean).join(' ');

  let peticion = base;
  let motivos: string[] = [];
  // Un reintento con los motivos: el 9B corrige bien cuando se le dice qué regla rompió.
  for (let intento = 1; intento <= 2; intento++) {
    const { text } = await ollamaGenerate({
      model,
      system,
      prompt: peticion,
      // Se carga para este trabajo y se descarga al acabar: la cola de IMG-50 no deja el modelo abierto.
      keepAlive: '0',
      numCtx: 32768,
      temperature: 0.6,
      maxTokens: 900,
      timeoutMs: 900_000,
      tarea: 'image-prompt',
      intento,
    });
    const cuerpo = limpiarCuerpo(text);
    const prompt = montar(cuerpo);
    motivos = cuerpo ? validarPrompt(prompt, { nombre: name, momento, perfil: sizeProfile, mundo }) : ['is empty'];
    if (motivos.length === 0) return { prompt, provider: `ollama:${model}` };
    peticion = `${base}\n\nYour previous paragraph broke these rules:\n${motivos.map((m) => `- It ${m}.`).join('\n')}\nPrevious paragraph:\n${cuerpo}\n\nRewrite it fixing every point and keeping everything else.`;
  }
  throw new Error(`El prompt no cumple las reglas de mundo.json: ${motivos.join('; ')}`);
}
