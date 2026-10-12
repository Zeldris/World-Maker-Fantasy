import type { AttributeBlock } from './dice.js';
import type { Banda } from './narrador.js';
import { normalizeText } from './travel.js';

export interface Produccion {
  itemName: string;
  cantidad: number;
}

export interface DurationResult {
  minutos: number;
  /// Roadmap 2026-07-19: antes esto era solo texto para el mensaje de "estará ocupado..." y
  /// nunca se materializaba de verdad en el inventario — estructurado ahora para que
  /// narrateAndPersistTurn pueda crear el InventoryItem real al resolver el turno.
  produccion?: Produccion;
}

const REST_REGEX = /descans|dormir|acampar|recuperar/;

/// docs/mecanicas/14-combate-y-muerte.md § 4.1: mismo detector que ya usa computeDuration para calcular
/// duración — se reutiliza para decidir si una acción de descanso puede fijar `lastRestLocationId`.
export function detectsRestIntent(action: string): boolean {
  return REST_REGEX.test(action.toLowerCase());
}

/// Roadmap 2026-07-20 (Fable, control de acciones): red de seguridad determinista sobre el
/// NÚMERO que devuelve el Cronista, no solo sobre la etiqueta `banda` (ese clamp ya existía en
/// turn.ts vía bandaForMinutos). Hallazgo real jugando: "Explorar la zona en busca de..." se
/// clasificó como banda "larga"/4320 min (3 días) sin que el jugador mencionara ninguna
/// duración — mismo criterio que ya usa el prompt de classifyAction para decidir cuándo la
/// duración explícita del jugador manda sobre la estimación por tipo de actividad.
const EXPLICIT_DURATION_REGEX = /\d+\s*(dia|dias|semana|semanas|hora|horas)|varios? dias?|unos? dias?|toda la noche|una semana/;

export function mentionsExplicitDuration(action: string): boolean {
  // P17: también las cifras en letra («tres horas», «un par de horas»).
  return EXPLICIT_DURATION_REGEX.test(normalizeText(action)) || duracionExplicitaMinutos(action) !== null;
}

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12,
};
const MINUTOS_POR_UNIDAD: Record<string, number> = { minuto: 1, hora: 60, dia: 1440, semana: 10080 };

/// P17 (QA-27): la duración que la jugadora pone en el texto, sin depender del modelo. Antes solo
/// el clasificador la leía (el prompt lo pide) y, si fallaba, «descanso un par de horas» duraba 5
/// minutos. `null` si el texto no dice ninguna duración concreta.
export function duracionExplicitaMinutos(action: string): number | null {
  const t = normalizeText(action);
  if (/\btoda la noche\b/.test(t)) return 480;
  if (/\bmedia hora\b/.test(t)) return 30;
  // Solo cifras concretas: «varios días» o «unas horas» las sigue estimando el clasificador.
  if (/\b(unos|unas|varios|varias)\s+(minuto|hora|dia|semana)s\b/.test(t)) return null;
  const m = t.match(/\b(un par de|\d+|una|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\s+(minuto|hora|dia|semana)s?\b/);
  if (!m) return null;
  // «la carne que cacé hace dos días» habla del pasado, no de cuánto dura la acción.
  if (/\bhace\s+$/.test(t.slice(0, m.index))) return null;
  const [, cuanto, unidad] = m;
  const n = cuanto === 'un par de' ? 2 : /^\d+$/.test(cuanto) ? Number(cuanto) : NUMEROS[cuanto];
  if (!n) return null;
  return n * MINUTOS_POR_UNIDAD[unidad];
}

/// Fórmulas deterministas de duración/producción (docs/mecanicas/08-acciones-por-tiempo.md § 4) — el
/// backend calcula esto con una fórmula sobre atributos, nunca la IA (misma disciplina que el
/// motor de dados). Empieza con las 3 acciones típicas que sugiere el propio diseño; el resto
/// de acciones por tiempo usan la estimación del clasificador tal cual.
/// P17 (QA-27): la duración explícita del texto que manda sobre la del clasificador (y sobre su
/// banda). No en lo que se dice («le digo que vuelvo en una hora»), y en una acción que el
/// clasificador ve instantánea, solo si es descansar o esperar. La ruta de clasificar la aplica a la
/// clasificación para que la banda que decide si la acción es por tiempo sea coherente.
export function duracionExplicitaDeLaAccion(action: string, banda: Banda): number | null {
  const esHabla = /["«»]|\b(digo|dice|pregunto|respondo|contesto|grito|susurro)\b/.test(normalizeText(action));
  const esEspera = REST_REGEX.test(action.toLowerCase()) || /\b(espero|aguardo)\b/.test(normalizeText(action));
  return esHabla || (banda === 'instantanea' && !esEspera) ? null : duracionExplicitaMinutos(action);
}

export function computeDuration(action: string, banda: Banda, attributes: AttributeBlock, duracionEstimadaMinutosClasificador: number): DurationResult {
  const explicita = duracionExplicitaDeLaAccion(action, banda);
  const duracionEstimadaMinutos = explicita ?? duracionEstimadaMinutosClasificador;
  if (explicita) banda = explicita <= 30 ? 'corta' : explicita < 1440 ? 'extendida' : 'larga';

  // Suelo de 1 minuto en vez de 0 (auditoría 2026-08-02, "revisar partida" — reportado como "una de
  // las cosas más graves": un combate real de varios intercambios seguidos, cada uno banda
  // "instantánea", dejaba el reloj de ficción clavado en el mismo minuto turno tras turno). Un
  // intercambio de combate/diálogo sigue narrándose como algo casi inmediato (1 min, no una espera
  // real), pero una pelea larga ahora sí acumula minutos de verdad en vez de sentirse congelada.
  if (banda === 'instantanea') return { minutos: 1 };

  const lower = action.toLowerCase();

  // Mismo patrón/fórmula que la leña genérica (worldCatalog.ts: "la cantidad real la calcula la
  // fórmula de leña ya existente") — solo cambia el nombre del ítem. Se comprueba ANTES que la
  // leña genérica porque una acción real ("recojo leña del matorral de cuerno") puede mencionar
  // ambas palabras a la vez.
  if (/matorral.*cuerno|cuerno.*matorral/.test(lower)) {
    const maderaPorMinuto = 1 + Math.floor(attributes.fuerza / 4);
    const minutos = duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : 15;
    return { minutos, produccion: { itemName: 'Leña de matorral de cuerno', cantidad: maderaPorMinuto * minutos } };
  }

  // worldCatalog.ts: "1 por hora de recolección" — a diferencia de la leña, no escala con
  // atributos, es una tasa fija por tiempo dedicado.
  if (/espiga.*roj|grano.*espiga/.test(lower)) {
    const minutos = duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : 60;
    const cantidad = Math.max(1, Math.round(minutos / 60));
    return { minutos, produccion: { itemName: 'Grano de espiga roja', cantidad } };
  }

  if (/le[ñn]a|le[ñn]ador/.test(lower)) {
    const maderaPorMinuto = 1 + Math.floor(attributes.fuerza / 4);
    const minutos = duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : 15;
    return { minutos, produccion: { itemName: 'Leña', cantidad: maderaPorMinuto * minutos } };
  }

  if (/viaj|camin|desplaz|ruta|tramo/.test(lower)) {
    const base = duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : 60;
    const minutos = Math.max(1, Math.round(base / (1 + attributes.destreza / 20)));
    return { minutos };
  }

  if (REST_REGEX.test(lower)) {
    const minutos = duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : banda === 'extendida' ? 240 : 480;
    return { minutos };
  }

  const fallback: Record<Banda, number> = { instantanea: 0, corta: 15, extendida: 180, larga: 1440 };
  return { minutos: duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : fallback[banda] };
}
