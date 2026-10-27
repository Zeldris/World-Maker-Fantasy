/// Servicio de progresión (docs/mecanicas/10-niveles-xp-reino.md) — reversión de la decisión de mecánicas 4.
/// Todo determinista, sin IA: el modelo nunca decide cuánta XP se gana, igual que nunca decide
/// si una tirada tiene éxito.
import { WEAPON_ABILITY_LEVEL_AVANZADA } from './weaponAbilities.js';
import type { Attribute, AttributeBlock } from './dice.js';
import type { Clase } from './classAbilities.js';

/// Rediseño de escalado por nivel (2026-08-21, "quiero afinar el tema de los niveles... como el
/// wow: ampliaremos los niveles según saquemos zonas nuevas"): tope real HOY, no un límite de
/// diseño — sube este número sin más cuando haya lore/zonas para sostenerlo (objetivo declarado:
/// 100). La curva de XP/ASI/tope de atributo se extiende sola a partir de aquí (ver
/// `buildLevelThresholds`/`buildAsiLevels`/`attributeCapForLevel`), nunca hace falta tocarlas a
/// mano al subir este tope.
const MAX_LEVEL = 40;

/// Tabla de XP por nivel 1-20 — valores EXACTOS de D&D 5e (§ 2), sin tocar: cambiar estos números
/// desplazaría de nivel a partidas ya en curso. Más allá del 20 no hay tabla D&D que copiar (ahí
/// termina el juego base), así que la extensión (`buildLevelThresholds`) es una curva propia.
const DND_LEVEL_THRESHOLDS: number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
  165000, 195000, 225000, 265000, 305000, 355000,
];

/// Continúa la tabla D&D más allá del nivel 20 con un incremento que crece de forma lineal
/// (delta 60000 en el 21, +10000 por nivel) — mantiene el mismo tipo de curva "cada vez cuesta
/// más" que ya tenía la tabla original, sin necesidad de inventar un umbral a mano por nivel cada
/// vez que se sube `MAX_LEVEL`.
function buildLevelThresholds(maxLevel: number): number[] {
  const thresholds = [...DND_LEVEL_THRESHOLDS];
  for (let level = thresholds.length + 1; level <= maxLevel; level++) {
    const delta = 50000 + (level - 20) * 10000;
    thresholds.push(thresholds[thresholds.length - 1] + delta);
  }
  return thresholds.slice(0, maxLevel);
}

const LEVEL_THRESHOLDS: number[] = buildLevelThresholds(MAX_LEVEL);

/// Niveles de ascenso de atributo (ASI) — 4/8/12/16/19 son la tabla D&D original (el hueco de 19
/// a 20, no 20 a 24, es una rareza real de esa tabla, se deja tal cual). Más allá del 20 seguimos
/// el mismo ritmo "cada 4 niveles" que el resto de la tabla (decisión explícita de la usuaria:
/// "mismo ritmo, cada 4 niveles" → 24/28/32/36/40...).
function buildAsiLevels(maxLevel: number): Set<number> {
  const levels = new Set([4, 8, 12, 16, 19]);
  for (let level = 24; level <= maxLevel; level += 4) levels.add(level);
  return levels;
}

const ASI_LEVELS = buildAsiLevels(MAX_LEVEL);

/// Tope de atributo alcanzable con los 5 ascensos originales (niveles 4-19) — igual que antes del
/// rediseño, ningún personaje por debajo del nivel 24 ve cambiar su tope real de 18.
const BASE_ATTRIBUTE_CAP = 18;

/// Tope de atributo por nivel (decisión explícita: "sube junto al nivel") — cada ascenso ASI más
/// allá del original (24/28/32/36/40...) sube el tope en 1, para que los puntos de ascenso de
/// niveles altos sigan teniendo un sitio útil donde ir en vez de topar siempre en 18.
function attributeCapForLevel(level: number): number {
  let extraAsiEvents = 0;
  for (const asiLevel of ASI_LEVELS) {
    if (asiLevel > 19 && asiLevel <= level) extraAsiEvents++;
  }
  return BASE_ATTRIBUTE_CAP + extraAsiEvents;
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(level, MAX_LEVEL);
}

/// Tope real de habilidades de combate activas (2026-07-29, rediseño "tope de 10": 2 raciales
/// ataque+defensa + 2 de arma [4 desde el nivel de arma avanzada] + 4 de clase) — reemplaza a la
/// vieja `habilidadSlotsForLevel`, que crecía suave con el nivel (3 + nivel/2) de cuando las
/// habilidades de combate eran una lista progresiva de 12; ya no lo son, así que ese crecimiento
/// no reflejaba nada real y el contador de HabilidadesPanel mentía sobre cuántos huecos había.
///
/// Bajado de 10 a 8 (2026-09-01, petición explícita): las 2 raciales activas ("Sangre del
/// Estallido"/"Piel de Guerra" y equivalentes de otras razas) ya no se siembran nunca —
/// `dynamicAbilities.ts` las sustituyó por una única pasiva automática (`racialPassives.ts`,
/// 2026-08-28), redundante con las activas y ya quitada del todo. El tope real hoy es solo
/// arma+clase.
export function maxCombatAbilitiesFor(level: number): number {
  return (level >= WEAPON_ABILITY_LEVEL_AVANZADA ? 4 : 2) + 4;
}

const XP_BY_DIFFICULTY: Record<number, number> = {
  8: 0, // trivial
  12: 5, // fácil
  15: 25, // media
  18: 50, // difícil
  22: 100, // muy difícil
};

/// XP del canal automático (§ 3.1): solo en éxito, según la dificultad ya fijada por la clasificación.
export function xpForRollSuccess(difficulty: number, success: boolean): number {
  if (!success) return 0;
  return XP_BY_DIFFICULTY[difficulty] ?? 0;
}

export type HitoTipo = 'descubrimiento' | 'objetivo_menor' | 'objetivo_mayor' | 'capitulo';

const XP_BY_HITO: Record<HitoTipo, number> = {
  descubrimiento: 50,
  objetivo_menor: 100,
  objetivo_mayor: 300,
  // P306/P307 (decidido por la usuaria, 2026-10-26): 100, no 500. Un capítulo se cierra cada 15 acciones
  // (`TURNS_PER_CHAPTER`, chapterSummary.ts) y 500 XP por «solo» seguir jugando pesaba como cinco misiones.
  capitulo: 100,
};

/// Etiqueta legible del hito de mayor valor de un turno (UX 2026-09-01: separar visualmente el
/// XP de hito del XP normal de tirada — antes un único chip "+N XP" sumaba ambos, y si la tirada
/// fallaba pero había un hito grande [p.ej. "objetivo_mayor", 300 XP], el jugador veía un "+300 XP"
/// pegado a un "Fallo" en rojo, como si el juego premiara el fracaso). Solo para mostrar, nunca
/// para calcular — `xpForHitos` sigue siendo la única fuente de verdad del número.
const HITO_LABEL: Record<HitoTipo, string> = {
  descubrimiento: 'Descubrimiento',
  objetivo_menor: 'Objetivo cumplido',
  objetivo_mayor: 'Objetivo mayor cumplido',
  capitulo: 'Capítulo completado',
};

/// De la lista de hitos que propone el modelo (solo el tipo) más los eventos deterministas de
/// Reino, se queda con el de mayor valor — tope 1 hito/turno (§ 3.2, § 5.4).
export function xpForHitos(hitoTipos: HitoTipo[]): number {
  if (hitoTipos.length === 0) return 0;
  return Math.max(...hitoTipos.map((t) => XP_BY_HITO[t] ?? 0));
}

/// Etiqueta del hito de mayor valor entre los de este turno (mismo criterio de "el de mayor
/// valor gana" que `xpForHitos`) — null si no hubo ningún hito. `reinoXp` (fundar/consolidar
/// territorio, etc.) no tiene tipo de `HitoTipo` propio, así que lo etiqueta el caller si aplica
/// (ver `xpHitoLabel` en turnResolution.ts).
export function labelForHitos(hitoTipos: HitoTipo[]): string | null {
  if (hitoTipos.length === 0) return null;
  const top = hitoTipos.reduce((best, t) => (XP_BY_HITO[t] > XP_BY_HITO[best] ? t : best));
  return HITO_LABEL[top];
}

export interface ProgressionResult {
  xpDelta: number;
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  attributePointsGained: number;
  /// Desglose del XP de este turno (UX 2026-09-01, ver comentario de `HITO_LABEL`) — la parte de
  /// `xpDelta` que vino de una tirada normal de acción/combate vs. la que vino de un hito o de un
  /// evento de Reino. Opcionales: los callers de `applyXp` fuera del turno principal (XP de
  /// oficio al craftear, etc.) no conocen hitos y los dejan sin rellenar; el frontend trata su
  /// ausencia como "todo es XP de tirada", igual que hacía antes de este campo.
  xpTirada?: number;
  xpHito?: number;
  xpHitoLabel?: string | null;
}

/// Aplica un delta de XP a una partida y calcula si sube de nivel (§ 7). No toca la base de
/// datos — el caller decide cómo persistir (Save.xp/level/pendingAttributePoints, LogEntry.xpDelta).
/// `breakdown` es opcional (UX 2026-09-01) — solo lo rellena el turno principal, que es el único
/// caller que conoce la distinción tirada/hito; el resto de callers (XP de oficio, etc.) no lo
/// pasan y `ProgressionResult` simplemente no trae desglose para ellos.
export function applyXp(
  currentXp: number,
  currentLevel: number,
  xpDelta: number,
  breakdown?: { xpTirada: number; xpHito: number; xpHitoLabel: string | null },
): ProgressionResult {
  const newXp = currentXp + xpDelta;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > currentLevel;

  let attributePointsGained = 0;
  if (leveledUp) {
    for (let lvl = currentLevel + 1; lvl <= newLevel; lvl++) {
      if (ASI_LEVELS.has(lvl)) attributePointsGained += 2;
    }
  }

  return {
    xpDelta,
    newXp,
    newLevel,
    leveledUp,
    attributePointsGained,
    ...(breakdown
      ? { xpTirada: breakdown.xpTirada, xpHito: breakdown.xpHito, xpHitoLabel: breakdown.xpHitoLabel }
      : {}),
  };
}

/// Puntos de ASI ganados subiendo de `fromLevel` (exclusivo) a `toLevel` (inclusivo) — misma
/// cuenta que hace `applyXp` para el PJ, extraída aparte para reutilizarla también al escalar
/// atributos de NPC (§ escalado de niveles, 2026-08-21).
function asiPointsBetweenLevels(fromLevel: number, toLevel: number): number {
  let points = 0;
  for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
    if (ASI_LEVELS.has(lvl)) points += 2;
  }
  return points;
}

/// Reparto de puntos de ASI por clase para NPC (2026-08-21, petición explícita: "en el caso de
/// los npc repartiremos nosotros los puntos según la clase" — a diferencia del PJ, que elige, un
/// NPC no tiene jugadora detrás decidiendo dónde van sus puntos). Pesos relativos (suman 1 por
/// clase), no absolutos — deciden el ORDEN de prioridad de reparto, no cuántos puntos exactos caen
/// en cada atributo (eso lo hace `allocateAttributePoints` de más abajo, punto a punto, respetando
/// el tope real). Ampliado a las 9 clases (2026-08-24, Grupo 3 § Sistema de clases) — antes solo
/// Guerrero/Cazador tenían fila; las 7 nuevas son un primer borrador coherente con su identidad de
/// clases.md, sin repaso a fondo de habilidades todavía (mismo criterio que el resto del reparto:
/// cifra de partida, ajustable jugando).
const NPC_CLASS_ATTRIBUTE_WEIGHTS: Record<Clase, Partial<Record<Attribute, number>>> = {
  GUERRERO: { fuerza: 0.35, constitucion: 0.3, voluntad: 0.15, destreza: 0.1, inteligencia: 0.05, carisma: 0.03, magia: 0.02 },
  CAZADOR: { destreza: 0.35, inteligencia: 0.2, constitucion: 0.15, voluntad: 0.15, fuerza: 0.1, carisma: 0.03, magia: 0.02 },
  CHAMAN: { magia: 0.3, constitucion: 0.25, voluntad: 0.2, fuerza: 0.15, inteligencia: 0.05, destreza: 0.03, carisma: 0.02 },
  ARQUERO: { destreza: 0.4, inteligencia: 0.2, constitucion: 0.15, fuerza: 0.15, voluntad: 0.06, carisma: 0.02, magia: 0.02 },
  CABALLERO: { fuerza: 0.3, constitucion: 0.3, voluntad: 0.2, carisma: 0.1, destreza: 0.06, inteligencia: 0.02, magia: 0.02 },
  MAGO: { magia: 0.45, inteligencia: 0.25, voluntad: 0.15, constitucion: 0.08, destreza: 0.04, carisma: 0.02, fuerza: 0.01 },
  SEGADOR: { destreza: 0.3, inteligencia: 0.25, voluntad: 0.2, fuerza: 0.15, constitucion: 0.06, carisma: 0.02, magia: 0.02 },
  ASESINO: { destreza: 0.45, inteligencia: 0.2, voluntad: 0.15, fuerza: 0.1, constitucion: 0.06, carisma: 0.02, magia: 0.02 },
  DRUIDA: { constitucion: 0.3, voluntad: 0.25, fuerza: 0.2, destreza: 0.15, magia: 0.06, inteligencia: 0.02, carisma: 0.02 },
};

/// Reparte `points` entre los atributos de `weights` (normalizados a su suma real, no hace falta
/// que sumen 1 de entrada — el reparto proporcional a partir de atributos base crudos de fauna
/// también pasa por aquí) sin pasarse nunca del tope real (`cap`). Dos pasadas: primero la parte
/// entera proporcional a cada peso (garantiza que hasta el atributo secundario de una clase reciba
/// su parte si hay puntos suficientes, no solo el de más peso), luego el resto de redondeo se
/// reparte de uno en uno por prioridad — si el de más peso ya está topado, el punto cae en el
/// siguiente en vez de perderse en silencio.
function allocateAttributePoints(base: AttributeBlock, weights: Partial<Record<Attribute, number>>, points: number, cap: number): AttributeBlock {
  const entries = (Object.entries(weights) as [Attribute, number][]).filter(([, weight]) => weight > 0);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const result: AttributeBlock = { ...base };
  if (totalWeight <= 0 || points <= 0) return result;

  const priority = [...entries].sort((a, b) => b[1] - a[1]).map(([attribute]) => attribute);
  const share = new Map<Attribute, number>(priority.map((attribute) => [attribute, 0]));

  let allocated = 0;
  for (const [attribute, weight] of entries) {
    const room = Math.max(0, cap - result[attribute]);
    const proportional = Math.min(room, Math.floor((points * weight) / totalWeight));
    share.set(attribute, proportional);
    allocated += proportional;
  }

  let remaining = points - allocated;
  while (remaining > 0) {
    const target = priority.find((attribute) => result[attribute] + (share.get(attribute) ?? 0) < cap);
    if (!target) break; // todos los atributos con peso ya están topados — el resto se pierde (no hay dónde meterlo)
    share.set(target, (share.get(target) ?? 0) + 1);
    remaining -= 1;
  }

  for (const [attribute, amount] of share) result[attribute] += amount;
  return result;
}

/// Escala el bloque de atributos de un NPC (siempre nivel 1 de catálogo, decisión explícita:
/// "primero los stats ya establecidos son de nivel 1") hasta `targetLevel`, con el MISMO ritmo de
/// puntos que el PJ (`asiPointsBetweenLevels`) — "para que no sea injusto contra el pj". Un NPC no
/// elige dónde van sus puntos: `clase` (humanoide con Guerrero/Cazador/futuras) reparte por la
/// tabla de prioridad de esa clase; sin clase (fauna, que no porta clase de combate) reparte
/// proporcional al perfil de atributos que ya tiene en nivel 1 — el atributo que ya destaca en el
/// bicho sigue destacando al subir, sin tabla nueva por especie.
export function npcAttributesForLevel(baseAttributes: AttributeBlock, targetLevel: number, clase: Clase | null): AttributeBlock {
  const points = asiPointsBetweenLevels(1, targetLevel);
  if (points === 0) return baseAttributes;

  const weights: Partial<Record<Attribute, number>> =
    clase && NPC_CLASS_ATTRIBUTE_WEIGHTS[clase]
      ? NPC_CLASS_ATTRIBUTE_WEIGHTS[clase]
      : Object.fromEntries((Object.entries(baseAttributes) as [Attribute, number][]).map(([attribute, value]) => [attribute, value])) as Partial<Record<Attribute, number>>;

  return allocateAttributePoints(baseAttributes, weights, points, attributeCapForLevel(targetLevel));
}

export { attributeCapForLevel, MAX_LEVEL };
