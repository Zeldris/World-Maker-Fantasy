import type { CondicionFisica } from '@prisma/client';
import { normalizeText, levenshtein } from './travel.js';
import { baseNameOf } from './ingredients.js';

/// Tolerancia a plural simple (bug real jugando en vivo, 2026-09-01: "aplicando cataplasmas de
/// salvia del polvo" nunca matcheaba contra "Cataplasma de salvia del polvo" del catálogo — el
/// nombre real está en singular, la narración lo pluralizó, y `.includes()` de substring exacto no
/// tolera ni una letra de más). Regla española básica, no un stemmer genérico: el singular con una
/// "s"/"es" añadida al final de la PRIMERA palabra (la que de verdad se pluraliza en el uso real,
/// "cataplasmas de salvia" no "cataplasma de salvias") — evita falsos positivos de plurales
/// irregulares o de palabras cortas donde añadir letras cambia el sentido.
export function withSimplePluralVariant(normalizedName: string): string[] {
  const [firstWord, ...rest] = normalizedName.split(' ');
  if (!firstWord || firstWord.length < 4) return [normalizedName];
  const pluralFirstWord = /[aeiou]$/.test(firstWord) ? `${firstWord}s` : `${firstWord}es`;
  const pluralName = [pluralFirstWord, ...rest].join(' ');
  return [normalizedName, pluralName];
}

export function includesNameOrPlural(haystack: string, normalizedName: string): boolean {
  return withSimplePluralVariant(normalizedName).some((variant) => haystack.includes(variant));
}

/// Palabras de objeto genéricas que un jugador puede pedir mirar/usar/revisar sin nombrarlo
/// exactamente como en su inventario (roadmap 2026-07-19: "mirar el mapa" sin tener uno debía
/// narrar que no lo tiene, no inventarlo ni ignorar el hecho en silencio). Lista CURADA a
/// propósito, no un regex genérico de "mi X" — así no dispara en falso con "mi pasado", "mi
/// familia", "mi objetivo" ni nada que no sea un objeto físico real.
const COMMON_ITEM_NOUNS = [
  'mapa', 'antorcha', 'brujula', 'cuerda', 'pocion', 'llave', 'vendaje', 'manta',
  'cantimplora', 'provisiones', 'racion', 'raciones', 'moneda', 'monedas', 'oro',
  'herramienta', 'cuchillo', 'espada', 'hacha', 'arco', 'flecha', 'flechas', 'escudo',
  'armadura', 'casco', 'anillo', 'amuleto', 'pergamino', 'libro', 'carta', 'pico',
  'odre', 'yesca', 'pedernal', 'saco', 'mochila',
];

/// Raíces de verbo que implican comprobar algo que ya se llevaría encima (mirar/revisar/
/// consultar/sacar/usar/coger/tener) — deliberadamente sin "busco/buscar" (demasiado genérico,
/// ya usado por harvest.ts/npcScene.ts para fauna/NPCs/lugares, se solaparía en falso).
const CHECK_VERB_REGEX = /\b(mir|revis|consult|sac|us|coj|tien)/;

export interface ItemReferenceCheck {
  noun: string;
  posee: boolean;
}

/// Detecta si la acción menciona posiblemente un objeto concreto de la lista curada y, si es
/// así, si el personaje lo tiene de verdad en su inventario actual — puro, sin IA, mismo patrón
/// determinista que el resto de detectores (harvest.ts, npcScene.ts).
export function detectItemReference(action: string, inventoryNames: string[]): ItemReferenceCheck | null {
  const normalized = normalizeText(action);
  if (!CHECK_VERB_REGEX.test(normalized)) return null;

  const words = normalized.split(/[^a-zñáéíóúü]+/);
  // Tolerancia a erratas (roadmap 2026-07-20, P0 de Fable — auditoría de detectores tras el bug
  // real de matchNpcAliases): solo para sustantivos de 5+ letras, mismo umbral que el resto de
  // detectores — evita falsos positivos en sustantivos cortos como "oro" o "arco".
  const noun =
    COMMON_ITEM_NOUNS.find((n) => words.includes(n)) ??
    COMMON_ITEM_NOUNS.find((n) => n.length >= 5 && words.some((w) => w.length >= 5 && levenshtein(w, n) <= 2));
  if (!noun) return null;

  const normalizedInventory = inventoryNames.map(normalizeText);
  const posee = normalizedInventory.some((name) => name.includes(noun));
  return { noun, posee };
}

/// Bloque de prompt para cuando NO lo tiene — cierra la puerta a que el modelo invente que sí lo
/// lleva encima o que lo encuentra de repente.
export function missingItemBlockFor(check: ItemReferenceCheck): string {
  return `EL PERSONAJE NO TIENE "${check.noun}" ENTRE SUS PERTENENCIAS ahora mismo: narra que lo busca, lo considera o palpa su equipo y se da cuenta de que no lo tiene — nunca que sí lo tiene, ni que lo encuentra de repente, ni que aparece uno nuevo.`;
}

/// Detecta si la acción usa de verdad un objeto médico concreto del inventario (2026-07-29,
/// reglas de curación: "si usas material médico sí puedes curarte" — nunca el modelo decide si
/// "curó del todo", el objeto que de verdad lleve el jugador es la única fuente de verdad).
/// Determinista por nombre real del objeto (no un sustantivo genérico como detectItemReference
/// arriba) — el jugador lo referencia tal cual sale en su inventario, mismo patrón que ya usan
/// los objetivos de combate entre comillas. Si varios objetos médicos coinciden, se queda con el
/// de mayor tope de curación (ILESO > HERIDO > GRAVE) — usar el mejor que de verdad nombró. GRAVE
/// añadido (2026-08-13) — el objeto de primeros auxilios de tier 1 tiene curaHasta: GRAVE.
const CURA_HASTA_ORDER: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE'];

/// Bug real jugando en vivo (2026-08-07, "he consumido una ración de comida y no ha desaparecido
/// del inventario" — pasaba también en combate): el efecto mecánico (curar/restaurar energía) SÍ
/// se aplicaba, pero ningún sitio sabía QUÉ fila de InventoryItem consumir para borrarla/reducirla
/// — `detectMedicalItemUse`/`detectEnergyItemUse` solo devolvían el valor derivado (curaHasta/
/// curaEnergia), nunca qué objeto concreto lo produjo. Ahora devuelven también el `id` real de la
/// fila que matcheó, para que turnResolution.ts pueda consumirla de verdad (ver `consumedItemIds`).
export interface MedicalItemMatch {
  id: string;
  curaHasta: CondicionFisica;
  /// Primeros auxilios (2026-08-13) — ver ItemCatalog.curaUnPaso/healCeilingFor (death.ts).
  curaUnPaso: boolean;
}

export function detectMedicalItemUse(
  action: string,
  medicalItems: { id: string; name: string; curaHasta: CondicionFisica; curaUnPaso: boolean }[],
): MedicalItemMatch | null {
  const normalized = normalizeText(action);
  // `baseNameOf` (bug real jugando en vivo, 2026-08-13: "usé el vendaje y no se consumió del
  // inventario") — con una pila de 2+ ("Vendaje improvisado (2)"), el jugador cita el objeto por
  // su nombre SIN el sufijo de cantidad ("Uso 'Vendaje improvisado'"), así que un `.includes()`
  // contra el nombre CON sufijo nunca matcheaba con una pila de 2 o más — el objeto no se detectaba
  // como usado, y por tanto tampoco se consumía. Con una única unidad (sin sufijo) sí coincidía.
  const matches = medicalItems.filter((item) => includesNameOrPlural(normalized, normalizeText(baseNameOf(item.name))));
  if (matches.length === 0) return null;
  const best = matches.sort((a, b) => CURA_HASTA_ORDER.indexOf(a.curaHasta) - CURA_HASTA_ORDER.indexOf(b.curaHasta))[0];
  return { id: best.id, curaHasta: best.curaHasta, curaUnPaso: best.curaUnPaso };
}

export interface EnergyItemMatch {
  id: string;
  curaEnergia: number;
}

/// Detecta si la acción usa de verdad un objeto que restaura energía (2026-07-29, sistema de
/// fatiga) — mismo criterio determinista que detectMedicalItemUse arriba (nombre real del
/// inventario, nunca un sustantivo genérico). Si varios coinciden, se queda con el que más
/// restaura — a diferencia de curaHasta (un enum con orden fijo), curaEnergia ya es un número, así
/// que "mejor" es simplemente "más alto".
export function detectEnergyItemUse(action: string, energyItems: { id: string; name: string; curaEnergia: number }[]): EnergyItemMatch | null {
  const normalized = normalizeText(action);
  // Mismo fix que `detectMedicalItemUse` de arriba — `baseNameOf` para no romper el match contra
  // una pila de 2+ unidades.
  const matches = energyItems.filter((item) => includesNameOrPlural(normalized, normalizeText(baseNameOf(item.name))));
  if (matches.length === 0) return null;
  const best = matches.sort((a, b) => b.curaEnergia - a.curaEnergia)[0];
  return { id: best.id, curaEnergia: best.curaEnergia };
}

export interface CompassItemMatch {
  id: string;
}

/// Detecta si la acción usa de verdad la Aguja de Cardo Brújula (2026-08-15, feature de
/// exploración: narración determinista de rumbos, ver turnResolution.ts). Mismo patrón que
/// `detectEnergyItemUse` (nombre real del objeto equipado/en inventario, normalizeText +
/// baseNameOf), pero además contra los ALIASES del catálogo (mismo criterio que
/// `detectItemReference`) — el nombre completo "Aguja de Cardo Brújula" es largo, y el jugador
/// dirá simplemente "uso la brújula" mucho más a menudo que el nombre entero.
export function detectsCompassUse(action: string, compassItems: { id: string; name: string; aliases: string[] }[]): CompassItemMatch | null {
  const normalized = normalizeText(action);
  const match = compassItems.find((item) => [baseNameOf(item.name), ...item.aliases].some((candidate) => normalized.includes(normalizeText(candidate))));
  return match ? { id: match.id } : null;
}

/// Detecta si la acción cita, entre comillas simples, el nombre EXACTO de un objeto que el
/// personaje ya lleva en su inventario — mismo patrón que `explicitTarget` (turn.ts/
/// turnResolution.ts) para NPCs objetivo. Bug real (auditoría 2026-07-30, "revisar partida"):
/// "Cosumo 'Raciones de viaje (5 días)'" se clasificó como banda "larga" — el clasificador pequeño
/// puede leer cualquier número/palabra suelta del propio NOMBRE del objeto (el "(5 días)") como si
/// fuera la duración de la acción. Usar/consultar/consumir un objeto propio es SIEMPRE una acción
/// rápida, nunca de horas — mismo espíritu que forzar "instantanea" en ataque/diálogo (turn.ts). No
/// exige ningún verbo concreto (a diferencia de `detectItemReference` arriba): citar el nombre
/// EXACTO y completo de un objeto propio entre comillas ya es una señal lo bastante específica.
export function detectsOwnedItemQuote(action: string, inventoryNames: string[]): boolean {
  const quoted = action.match(/'([^']+)'/);
  if (!quoted) return false;
  const target = normalizeText(quoted[1]);
  return inventoryNames.some((name) => normalizeText(name) === target);
}
