import type { Attribute } from './dice.js';
import type { EquipSlot, WeaponCategory } from '@prisma/client';

/// Sistema de habilidades por arma (2026-07-29, referencia Guild Wars 2 — "dependiendo el arma
/// que lleves las habilidades se adapten... en vez de tener muchas habilidades usables a la vez
/// y un árbol complicado de habilidades podamos variar sencillamente cambiando de arma"): cada
/// CATEGORÍA de arma tiene un atributo fijo — equipar un arma de esa categoría genera sola una
/// habilidad de ataque (o de defensa, si es un escudo) con ese atributo. No hay un movimiento
/// distinto por arma exacta (hacha vs maza), solo por el grupo al que pertenece — mismo tope de
/// contenido con mucha más variedad real que escribir un moveset por arma.
export const WEAPON_CATEGORY_ATTRIBUTE: Record<WeaponCategory, Attribute> = {
  HACHA: 'fuerza',
  MAZA: 'fuerza',
  GARROTE: 'fuerza',
  PICA: 'fuerza',
  LANZA: 'fuerza',
  CUCHILLO: 'destreza',
  DAGA: 'destreza',
  ESPADA: 'destreza',
  ESCUDO: 'constitucion',
};

export type WeaponRole = 'ataque' | 'defensa';

/// Solo ESCUDO es defensivo — el resto de categorías siempre genera una habilidad de ataque
/// (mano principal o secundaria, da igual: "arma+arma = 2 ataques, arma+escudo = 1 ataque + 1
/// defensa", nunca una defensa "porque sí" solo por ir en la mano secundaria).
export function weaponRoleFor(categoria: WeaponCategory): WeaponRole {
  return categoria === 'ESCUDO' ? 'defensa' : 'ataque';
}

export interface WeaponAbility {
  name: string;
  icon: string;
  description: string;
  promptText: string;
  attribute: Attribute;
  rol: WeaponRole;
  /// "2 de arma nivel 1 + 2 de arma nivel máximo" (tope de 10 habilidades) — la avanzada es una
  /// habilidad DISTINTA de la básica (decisión explícita), no la misma escalada. `real` (2026-07-31)
  /// es la nueva pieza intermedia: habilidad de verdad por categoría EXACTA de arma, aprendida ya
  /// desde nivel 1 (ver `WEAPON_REAL_ATAQUE_CONTENT` más abajo) — "básica" queda reservada solo
  /// para el genérico Ataque Básico.
  tier: 'basica' | 'real' | 'avanzada';
  /// Rediseño 2026-07-31 — true SOLO en la básica de ataque ("Ataque Básico"): pasa a ser una de
  /// los 3 genéricos que tiene cualquier personaje (junto a Defenderse/Esquivar), no una habilidad
  /// más de la lista. La avanzada de ataque, la defensa de escudo (cualquier tier) y la nueva real
  /// por categoría siguen siendo habilidades reales — "a mayores, cada arma te da una habilidad de
  /// su tipo" por encima de la base que comparte todo el mundo.
  isGeneric: boolean;
  /// Ver energy.ts § nextEnergia — 0 en todas las de aquí (solo Defenderse/Esquivar regeneran).
  energyRegen: number;
  /// Habilidad real por categoría (2026-07-31, petición explícita: "si llevas 2 armas del mismo
  /// tipo tendrás solo 1 habilidad de arma con doble efecto") — true cuando ARMA_PRINCIPAL y
  /// ARMA_SECUNDARIA llevan la MISMA categoría de ataque, así que esta única tarjeta representa
  /// las dos. Nunca dobla el intercambio de combate (decisión explícita, más simple/fiable que dos
  /// tiradas reales en el mismo turno) — se traduce en un bonus de dificultad al usarla, ver
  /// DUAL_WIELD_DIFFICULTY_BONUS/turnResolution.ts.
  dualWield: boolean;
}

interface WeaponAbilityContent {
  name: string;
  icon: string;
  description: string;
  /// Texto en primera persona que se manda al Narrador al usarla en combate — `description` es
  /// de cara al tooltip, en 3ª persona.
  promptText: string;
}

/// Rediseño 2026-07-31 (petición explícita: "renombrar siempre a 'Ataque Básico'") — la tier
/// básica de ataque deja de tener un nombre distinto por categoría de arma ("Golpe de Arma
/// Pesada" para fuerza, "Estocada Rápida" para destreza, "Golpe Desarmado" desarmado) y pasa a ser
/// UN solo genérico, con el mismo NOMBRE siempre — el atributo real (fuerza/destreza) lo sigue
/// decidiendo el arma equipada, ver `weaponAbilitiesFor`. La tier avanzada (nivel 20+) SÍ mantiene
/// su sabor por categoría — es una habilidad real, no un genérico, "a mayores" de la base.
///
/// El nombre es fijo, pero la descripción/promptText SÍ distinguen armado de desarmado (petición
/// explícita, 2026-07-31: "cuando no llevas equipado nada escala por fuerza y el ataque en esencia
/// pasa a ser con tus puños desnudos, garras o lo que sea") — nunca se le pide al modelo que
/// invente qué usa el personaje para golpear desarmado, el propio texto ya se lo da resuelto,
/// mismo criterio que el resto del proyecto de no dejarlo a su discreción.
const ATAQUE_BASICO_ARMADO_CONTENT: WeaponAbilityContent = {
  name: 'Ataque Básico',
  icon: '⚔️',
  description: 'El golpe base de cualquier combatiente — se adapta al arma que lleve equipada en la mano principal.',
  promptText: 'Ataco con un golpe directo, con el arma que llevo en la mano principal.',
};

const ATAQUE_BASICO_DESARMADO_CONTENT: WeaponAbilityContent = {
  name: 'Ataque Básico',
  icon: '👊',
  description: 'El golpe base de cualquier combatiente — sin arma equipada, golpea con los puños desnudos, garras o lo que tenga a mano.',
  promptText: 'Ataco con un golpe directo, con los puños desnudos (o garras, según lo que tenga).',
};

/// Contenido de la tier AVANZADA por grupo de atributo — ver comentario de `ATAQUE_BASICO_CONTENT`
/// sobre por qué la básica ya no vive aquí. La defensa de escudo (constitucion) no cambia: ambas
/// tiers siguen siendo habilidades reales, nunca genéricas.
const WEAPON_ABILITY_AVANZADA_CONTENT: Record<'fuerza' | 'destreza', WeaponAbilityContent> = {
  fuerza: {
    name: 'Golpe Sísmico',
    icon: '🌋',
    description: 'Descarga todo el peso del cuerpo en un único golpe brutal, buscando derribar tanto como herir.',
    promptText: 'Descargo todo el peso de mi cuerpo en un único golpe brutal, buscando derribar tanto como herir.',
  },
  destreza: {
    name: 'Ráfaga de Cortes',
    icon: '🌀',
    description: 'Encadena varios cortes rápidos desde ángulos distintos, sin dar tiempo a anticipar el siguiente.',
    promptText: 'Encadeno varios cortes rápidos desde ángulos distintos, sin dar tiempo a anticipar el siguiente.',
  },
};

/// Habilidad REAL por categoría exacta de arma (2026-07-31, petición explícita: "cada arma que
/// tengas equipada te dará una habilidad de su tipo... el hacha 'Tajo horizontal', la Lanza
/// 'Punzada penetrante', la Maza 'Golpe Devastador', el cuchillo 'Estocada veloz'") — a diferencia
/// de `WEAPON_ABILITY_AVANZADA_CONTENT` (por GRUPO de atributo, solo 2 sabores), esta es una por
/// CATEGORÍA exacta (8 sabores) — más variedad real, mismo criterio de "Guild Wars 2" que ya guió
/// el sistema de armas. Aprendida desde nivel 1 (`WEAPON_ABILITY_LEVEL_BASICA`), igual que Ataque
/// Básico, pero NO genérica — cuesta ENERGY_COST_BASICA como cualquier habilidad de clase/racial
/// (ver dynamicAbilities.ts). Nombres de HACHA/LANZA/MAZA/CUCHILLO dados por la usuaria; el resto
/// (GARROTE/PICA/DAGA/ESPADA) propuestos siguiendo el mismo tono, pendientes de su visto bueno.
const WEAPON_REAL_ATAQUE_CONTENT: Record<'HACHA' | 'MAZA' | 'GARROTE' | 'PICA' | 'LANZA' | 'CUCHILLO' | 'DAGA' | 'ESPADA', WeaponAbilityContent> = {
  HACHA: {
    name: 'Tajo Horizontal',
    icon: '🪓',
    description: 'Un tajo amplio, en horizontal, buscando cortar con todo el filo del hacha a la vez.',
    promptText: 'Lanzo un tajo amplio en horizontal, buscando cortar con todo el filo de mi hacha.',
  },
  MAZA: {
    name: 'Golpe Devastador',
    icon: '🔨',
    description: 'Un golpe vertical con todo el peso de la maza detrás, buscando aplastar más que cortar.',
    promptText: 'Descargo un golpe vertical con todo el peso de mi maza, buscando aplastar más que cortar.',
  },
  GARROTE: {
    name: 'Golpe Contundente',
    icon: '🪵',
    description: 'Un mazazo directo y sin sutileza, puro impacto contundente.',
    promptText: 'Descargo un mazazo directo y sin sutileza, puro impacto contundente.',
  },
  PICA: {
    name: 'Embestida de Pica',
    icon: '🔱',
    description: 'Una embestida a fondo con la pica por delante, ganando distancia con el impulso del propio cuerpo.',
    promptText: 'Embisto a fondo con mi pica por delante, ganando distancia con el impulso de mi cuerpo.',
  },
  LANZA: {
    name: 'Punzada Penetrante',
    icon: '🗡️',
    description: 'Una punzada directa y precisa, buscando el hueco entre la guardia del rival.',
    promptText: 'Lanzo una punzada directa y precisa, buscando el hueco entre su guardia.',
  },
  CUCHILLO: {
    name: 'Estocada Veloz',
    icon: '🔪',
    description: 'Una estocada rápida y cercana, aprovechando lo corto del filo para colarse dentro de la guardia rival.',
    promptText: 'Lanzo una estocada rápida y cercana, colándome dentro de su guardia.',
  },
  DAGA: {
    name: 'Corte Certero',
    icon: '🗡️',
    description: 'Un corte rápido y calculado, buscando el punto exacto antes que la fuerza bruta.',
    promptText: 'Lanzo un corte rápido y calculado, buscando el punto exacto antes que la fuerza.',
  },
  ESPADA: {
    name: 'Tajo Preciso',
    icon: '⚔️',
    description: 'Un tajo limpio y bien calculado, con la precisión por delante de la fuerza.',
    promptText: 'Lanzo un tajo limpio y bien calculado, con la precisión por delante de la fuerza.',
  },
};

/// Camino inverso de `WEAPON_REAL_ATAQUE_CONTENT` (2026-08-01, bug real jugando en vivo: "Tajo
/// Horizontal" — la real de HACHA — narró "lanza su cuchillo de hielo sílice", el arma de la mano
/// SECUNDARIA — mismo problema que ya se arregló para Ataque Básico, aquí reproducido de verdad
/// para la real de categoría). Dado el NOMBRE de una habilidad real por categoría, su categoría de
/// arma exacta — turnResolution.ts lo usa para, cuando esa categoría solo vive en UNA de las dos
/// manos (nunca en dualWield, donde de verdad se usan las dos), nombrar el arma exacta en la
/// narración en vez de dejarlo a que el modelo elija entre las dos que lleva encima.
export function weaponCategoryForRealAbilityName(name: string): WeaponCategory | null {
  const entry = (Object.entries(WEAPON_REAL_ATAQUE_CONTENT) as [WeaponCategory, WeaponAbilityContent][]).find(([, content]) => content.name === name);
  return entry ? entry[0] : null;
}

/// Bonus de dificultad al usar la real de ataque cuando colapsó por llevar la MISMA categoría en
/// las dos manos (`WeaponAbility.dualWield`) — mismo orden de magnitud que el resto de ajustes de
/// dificultad del proyecto (p.ej. `defensa` en `contraataqueDifficultyFor`, npcScene.ts). Se resta
/// de la dificultad del ATACANTE en `resolveCombatExchangePhase` (turnResolution.ts), nunca dobla
/// el intercambio — decisión explícita tras valorar el riesgo de dos tiradas reales en un turno.
export const DUAL_WIELD_DIFFICULTY_BONUS = 3;

/// Extraída como función pura (mismo criterio que `contraataqueDifficultyFor`, npcScene.ts) para
/// poder testearla directamente, en vez de dejar el `Math.max(8, ...)` suelto dentro de
/// `resolveCombatExchangePhase` (turnResolution.ts). Suelo en 8 (nunca "trivial" deja de requerir
/// tirada del todo) — mismo criterio que el resto de ajustes de dificultad del proyecto.
export function dualWieldAdjustedDifficulty(baseDifficulty: number, dualWield: boolean): number {
  return dualWield ? Math.max(8, baseDifficulty - DUAL_WIELD_DIFFICULTY_BONUS) : baseDifficulty;
}

const WEAPON_DEFENSA_CONTENT: Record<'basica' | 'avanzada', WeaponAbilityContent> = {
  basica: {
    name: 'Cobertura de Escudo',
    icon: '🛡️',
    description: 'Se cubre tras el escudo y absorbe el impacto con pura resistencia física, sin ceder terreno.',
    promptText: 'Me cubro tras mi escudo y absorbo el impacto con pura resistencia física, sin ceder terreno.',
  },
  avanzada: {
    name: 'Muro Inquebrantable',
    icon: '🧱',
    description: 'Planta el escudo por delante como un muro — el golpe que llega se estrella contra él sin apenas rozarle.',
    promptText: 'Planto mi escudo por delante como un muro, dejando que el golpe se estrelle contra él.',
  },
};

/// Ataque desarmado, tier avanzada (2026-07-30, petición explícita: "al personaje le falta la de
/// ataque normal [...] si no tiene armas el ataque será de tipo fuerza y será como si golpease con
/// los puños/garras/etc"). La básica desarmada ya no tiene contenido propio — comparte
/// `ATAQUE_BASICO_CONTENT` con cualquier otra arma, ver comentario de arriba.
const UNARMED_AVANZADA_CONTENT: WeaponAbilityContent = {
  name: 'Puño Demoledor',
  icon: '💢',
  description: 'Concentra toda su fuerza en un solo golpe desarmado, buscando aturdir tanto como herir.',
  promptText: 'Concentro toda mi fuerza en un solo golpe desarmado, buscando aturdir tanto como herir.',
};

export interface EquippedWeaponSlot {
  slot: EquipSlot;
  tipoArma: WeaponCategory | null;
}

/// Nivel al que se aprende cada tier (2026-07-29, "se aprenden desde el nivel 1"/"a nivel
/// máximo") — MAX_LEVEL real vive en progression.ts (20); duplicado aquí a propósito, mismo
/// criterio que el resto de tablas de diseño fijas del proyecto (evita import circular con
/// progression.ts, que no necesita saber nada de armas).
export const WEAPON_ABILITY_LEVEL_BASICA = 1;
export const WEAPON_ABILITY_LEVEL_AVANZADA = 20;

/// Rediseño 2026-07-30 (petición explícita, tras probarlo en vivo: "ataque normal... se rige por
/// el tipo de arma de la MANO PRINCIPAL — la secundaria deja de generar su propia habilidad de
/// ataque aparte, como mucho aporta algo distinto si es un escudo"). Antes CADA categoría de arma
/// equipada (en cualquier mano) generaba su propia tarjeta de ataque — dos armas de categorías
/// distintas, una por mano, daban dos ataques a la vez. Ahora "Ataque normal" es UNA SOLA tarjeta,
/// que mira ÚNICAMENTE `ARMA_PRINCIPAL`: arma real ahí (categoría de ataque, no escudo) decide el
/// atributo; vacía, o con un escudo (que no ataca), cae al golpe desarmado en fuerza — igual que
/// `baseAttackFor` (NPCs/fauna) ya hace, ahora también para el jugador. La defensa de escudo se
/// mantiene igual que siempre, en CUALQUIER mano — un escudo sigue siendo útil llevado en la
/// secundaria, solo deja de generar un ataque aparte cuando la principal ya tiene arma real.
export function weaponAbilitiesFor(equipped: EquippedWeaponSlot[], level: number): WeaponAbility[] {
  const abilities: WeaponAbility[] = [];

  const principal = equipped.find((e) => e.slot === 'ARMA_PRINCIPAL');
  const principalTipoArma = principal?.tipoArma ?? null;
  const principalAtaca = principalTipoArma !== null && weaponRoleFor(principalTipoArma) === 'ataque';
  const attackAttribute: Attribute = principalAtaca ? WEAPON_CATEGORY_ATTRIBUTE[principalTipoArma!] : 'fuerza';
  const avanzadaContent: WeaponAbilityContent = principalAtaca
    ? WEAPON_ABILITY_AVANZADA_CONTENT[attackAttribute as 'fuerza' | 'destreza']
    : UNARMED_AVANZADA_CONTENT;
  const basicaContent = principalAtaca ? ATAQUE_BASICO_ARMADO_CONTENT : ATAQUE_BASICO_DESARMADO_CONTENT;
  if (level >= WEAPON_ABILITY_LEVEL_BASICA) {
    abilities.push({ ...basicaContent, attribute: attackAttribute, rol: 'ataque', tier: 'basica', isGeneric: true, energyRegen: 0, dualWield: false });
  }
  if (level >= WEAPON_ABILITY_LEVEL_AVANZADA) {
    abilities.push({ ...avanzadaContent, attribute: attackAttribute, rol: 'ataque', tier: 'avanzada', isGeneric: false, energyRegen: 0, dualWield: false });
  }

  // Habilidad REAL por categoría exacta (2026-07-31, ver WEAPON_REAL_ATAQUE_CONTENT) — a
  // diferencia de Ataque Básico (SOLO mano principal, ver comentario de arriba), esta mira las DOS
  // manos: categorías de ataque únicas entre los slots equipados. Misma categoría en las dos manos
  // (p.ej. 2 hachas) colapsa a 1 sola tarjeta con `dualWield: true` (bonus de dificultad, nunca un
  // segundo intercambio); categorías distintas (p.ej. hacha + cuchillo) dan 2 tarjetas separadas,
  // una por arma — esto es justo lo que "Ataque normal, solo mano principal" (2026-07-30) dejó de
  // hacer para el ataque genérico, pero aquí SÍ aplica: "a mayores, cada arma equipada da una
  // habilidad de su tipo".
  if (level >= WEAPON_ABILITY_LEVEL_BASICA) {
    const attackSlots = equipped.filter(
      (e): e is EquippedWeaponSlot & { tipoArma: WeaponCategory } =>
        (e.slot === 'ARMA_PRINCIPAL' || e.slot === 'ARMA_SECUNDARIA') && !!e.tipoArma && weaponRoleFor(e.tipoArma) === 'ataque',
    );
    const categoriasEquipadas = [...new Set(attackSlots.map((e) => e.tipoArma))] as (keyof typeof WEAPON_REAL_ATAQUE_CONTENT)[];
    for (const categoria of categoriasEquipadas) {
      const dualWield = attackSlots.filter((e) => e.tipoArma === categoria).length === 2;
      abilities.push({
        ...WEAPON_REAL_ATAQUE_CONTENT[categoria],
        attribute: WEAPON_CATEGORY_ATTRIBUTE[categoria],
        rol: 'ataque',
        tier: 'real',
        isGeneric: false,
        energyRegen: 0,
        dualWield,
      });
    }
  }

  // Defensa de escudo — cualquier mano, deduplicada (dos escudos a la vez no duplican la tarjeta).
  const seenDefensa = new Map<string, WeaponAbility>();
  for (const slot of equipped) {
    if (slot.slot !== 'ARMA_PRINCIPAL' && slot.slot !== 'ARMA_SECUNDARIA') continue;
    if (!slot.tipoArma || weaponRoleFor(slot.tipoArma) !== 'defensa') continue;
    const attribute = WEAPON_CATEGORY_ATTRIBUTE[slot.tipoArma];
    if (level >= WEAPON_ABILITY_LEVEL_BASICA)
      seenDefensa.set('basica', {
        ...WEAPON_DEFENSA_CONTENT.basica,
        attribute,
        rol: 'defensa',
        tier: 'basica',
        isGeneric: false,
        energyRegen: 0,
        dualWield: false,
      });
    if (level >= WEAPON_ABILITY_LEVEL_AVANZADA)
      seenDefensa.set('avanzada', {
        ...WEAPON_DEFENSA_CONTENT.avanzada,
        attribute,
        rol: 'defensa',
        tier: 'avanzada',
        isGeneric: false,
        energyRegen: 0,
        dualWield: false,
      });
  }
  abilities.push(...seenDefensa.values());

  return abilities;
}
