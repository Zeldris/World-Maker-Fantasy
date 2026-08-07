import { completeWithFallback } from '../lib/aiProviders/orchestrator.js';

// 'faction'/'historia' (2026-08-06) — mismo literal que `DiscoveredEntity.entityType` a propósito
// (el doc comment de ese modelo en schema.prisma ya dice "mismo vocabulario que
// ImagePromptEntityType"), no 'faccion' aunque el resto de la Enciclopedia mezcle español/inglés
// libremente (raza/personaje/construccion vs. item/location) — evita dos nombres distintos para el
// mismo tipo de entidad en dos subsistemas hermanos.
export type ImagePromptEntityType = 'npc' | 'item' | 'fauna' | 'ability' | 'raza' | 'personaje' | 'location' | 'construccion' | 'faction' | 'historia' | 'crafteo';

/// Dos superficies reales de la UI, medidas contra el código (no tallas inventadas): EntryCard
/// (cuadrícula de la Enciclopedia, InventarioPanel) es un icono pequeño y cuadrado; MediaSlot
/// (DetailModal) es una banda ancha fija — `h-40` (160px) de alto por el ancho del modal
/// (`max-w-md` menos padding, ~400px), ratio ≈ 2.5:1. Petición explícita de la usuaria (2026-07-22):
/// cada perfil se genera y cachea POR SEPARADO, nunca los dos de una llamada.
export type ImagePromptSizeProfile = 'thumbnail' | 'banner';

const ENTITY_TYPE_HINT: Record<ImagePromptEntityType, string> = {
  npc: 'a character portrait',
  item: 'an item/prop illustration',
  fauna: 'a creature or plant illustration',
  ability: 'a dynamic action/skill illustration',
  raza: "a reference illustration of a typical member of this people/race (not a specific named character)",
  personaje: 'a character portrait of this specific playable protagonist',
  location: 'a wide establishing/environment illustration of this real place',
  construccion: 'an illustration of this specific building/structure',
  faction: 'a heraldic emblem/banner illustration representing this faction or clan (not a specific named character)',
  historia: 'an illustration of the historical scene or physical document described in this lore entry',
  crafteo: 'an item/prop illustration of this specific crafted result',
};

// Cadena de dimensiones EXACTA (petición explícita, 2026-07-22: "no se está especificando las
// dimensiones de las imágenes") — antes solo se sugería la proporción como guía de composición
// interna, pero el modelo podía omitirla del todo en la línea final del prompt. Ahora es un
// fragmento obligatorio y literal (igual que el estilo hiperrealista), para que cualquier
// generador externo reciba el tamaño exacto, no solo "ancho"/"cuadrado" en abstracto.
// Banner subido a 1920x768 (2026-07-22, "¿no perdemos calidad así?"): la caja del modal es
// pequeña (~400x160px), pero el banner también se ve a pantalla completa en el visor con clic
// (DetailModal.tsx, ImageLightbox) — 1536x614 se quedaba corto ahí en un monitor grande. 1920x768
// mantiene la misma proporción 2.5:1 con ancho Full HD, nítido a pantalla completa sin pasarse
// del límite típico de los generadores de imagen.
const SIZE_PROFILE_DIMENSIONS: Record<ImagePromptSizeProfile, string> = {
  thumbnail: 'square 1:1 aspect ratio, 1024x1024px',
  banner: 'wide 2.5:1 aspect ratio, 1920x768px',
};

// Estilo de arte SEPARADO por perfil (2026-07-22, "ahí no queremos imágenes realistas... sino un
// icono... una figura que represente lo que vemos, sin detalles") — antes el mandato hiperrealista
// se aplicaba por igual a los dos perfiles, contradiciendo justo lo que pedía el propio
// `SIZE_PROFILE_INSTRUCTION.thumbnail` de abajo ("bold silhouette", "minimal fine detail"): un
// render fotorrealista cinematográfico es lo opuesto de un icono simple y legible a 32px. El
// banner SÍ sigue siendo hiperrealista (esa parte nunca fue el problema).
const SIZE_PROFILE_ART_STYLE: Record<ImagePromptSizeProfile, string> = {
  thumbnail:
    'bold flat icon illustration, simple clean shapes, a single strong silhouette, minimal flat color palette, no fine texture or surface detail — must read clearly and instantly as a small icon; NEVER photorealistic, NEVER hyperrealistic, NEVER a detailed rendered scene',
  banner: 'hyperrealistic design with fantastic nuances, photorealistic rendering, cinematic detail',
};

const SIZE_PROFILE_INSTRUCTION: Record<ImagePromptSizeProfile, string> = {
  thumbnail: `Target a small SQUARE thumbnail/icon (${SIZE_PROFILE_DIMENSIONS.thumbnail}) shown at grid-icon size: a single centered subject with generous headroom (top of head/subject clearly inside the frame, never touching or crossing the edge), simple or plain background, bold silhouette that stays readable when scaled down, minimal fine detail. Mandatory art style for this profile: "${SIZE_PROFILE_ART_STYLE.thumbnail}".`,
  banner: `Target a WIDE banner illustration (${SIZE_PROFILE_DIMENSIONS.banner}) shown large in a detail view: full scene with environment/background, cinematic composition, rich detail. The main subject must be fully contained within frame with clear headroom above it (never cropped at the top or any edge) — center it horizontally or place it slightly off-center, but always leave breathing room around it so the top of the composition can be safely trimmed without cutting into the subject. Mandatory art style for this profile: "${SIZE_PROFILE_ART_STYLE.banner}".`,
};

const SYSTEM_PROMPT = `You write concise, vivid English prompts for AI text-to-image generators, illustrating assets for a
gritty, low-fantasy RPG (dusty plains, iron-age tech, no high-magic clichés). You receive a short
lore description in Spanish and must return ONLY the image prompt in English — a single line of
comma-separated descriptive fragments (subject, physical appearance/material, clothing or texture,
setting, lighting, art style, framing/composition, exact output dimensions). The "Framing" instruction
below gives you, for THIS specific size profile, the mandatory art-style fragment AND the mandatory
dimensions fragment — copy BOTH verbatim, word for word, each as its own comma-separated fragment near
the end of the line: never omit them, never rephrase them, never invent different numbers, and never
mix up the two profiles (a thumbnail/icon prompt must NEVER say photorealistic/hyperrealistic/cinematic;
a banner prompt must NEVER say flat icon/silhouette/simple shapes). If the lore states the subject's
sex ("hembra"/"mujer"/"femenino" or "macho"/"hombre"/"masculino"), the subject fragment MUST explicitly
say "female" or "male" in plain English — never leave it implicit or ambiguous, this is as mandatory as
the art-style and dimensions fragments. If the lore gives an approximate size/height and a maximum age
("Mide aproximadamente...", "Medidas:"), fold that exact number into the subject fragment as a concrete
visual cue (build/proportions/wear-and-tear implied by age) — never restate the raw number verbatim as
a separate fragment, and never invent a different one. CRITICAL — every image is generated in total
isolation, with NO knowledge of any other prompt/image generated before or after it for this game: NEVER
write a comparison to another sex, character, species, region, or object that relies on the reader
already knowing what that other thing looks like (e.g. "same build as the male", "same markings as the
Margen clan", "identical cloak to Gorhorn's", "larger than average for its kind"). Every visual trait
must be stated as a standalone, absolute description usable with zero outside context. Named places or
factions may appear only as plain setting/origin context (e.g. "from the Iron Concordia", "a swamp
dwelling"), never as an implied visual reference to another entity's unseen appearance. No quotes, no
explanations, no line breaks, max ~70 words.`;

export async function generateImagePrompt(
  entityType: ImagePromptEntityType,
  name: string,
  loreContext: string,
  sizeProfile: ImagePromptSizeProfile,
): Promise<{ prompt: string; provider: string }> {
  const userContent = `Type: ${ENTITY_TYPE_HINT[entityType]}\nName: ${name}\nLore (Spanish): ${loreContext}\nFraming: ${SIZE_PROFILE_INSTRUCTION[sizeProfile]}`;
  const { text, provider } = await completeWithFallback(SYSTEM_PROMPT, userContent, 220);
  return { prompt: text, provider };
}
