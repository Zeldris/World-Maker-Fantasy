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
  /// habilidad DISTINTA de la básica (decisión explícita), no la misma escalada.
  tier: 'basica' | 'avanzada';
}

interface WeaponAbilityContent {
  name: string;
  icon: string;
  description: string;
  /// Texto en primera persona que se manda al Narrador al usarla en combate — `description` es
  /// de cara al tooltip, en 3ª persona.
  promptText: string;
}

/// Contenido genérico por grupo de atributo, no por arma exacta — ver comentario de arriba.
const WEAPON_ABILITY_CONTENT: Record<'fuerza' | 'destreza' | 'constitucion', Record<'basica' | 'avanzada', WeaponAbilityContent>> = {
  fuerza: {
    basica: {
      name: 'Golpe de Arma Pesada',
      icon: '💥',
      description: 'Un golpe directo con todo el peso del arma detrás — hacha, maza, pica o lanza, la fuerza bruta siempre pega igual de fuerte.',
      promptText: 'Descargo un golpe directo con todo el peso de mi arma detrás.',
    },
    avanzada: {
      name: 'Golpe Sísmico',
      icon: '🌋',
      description: 'Descarga todo el peso del cuerpo en un único golpe brutal, buscando derribar tanto como herir.',
      promptText: 'Descargo todo el peso de mi cuerpo en un único golpe brutal, buscando derribar tanto como herir.',
    },
  },
  destreza: {
    basica: {
      name: 'Estocada Rápida',
      icon: '⚡',
      description: 'Un ataque rápido y calculado con el filo — cuchillo, daga o espada, la precisión manda sobre la fuerza.',
      promptText: 'Lanzo un ataque rápido y calculado con mi filo, buscando precisión antes que fuerza.',
    },
    avanzada: {
      name: 'Ráfaga de Cortes',
      icon: '🌀',
      description: 'Encadena varios cortes rápidos desde ángulos distintos, sin dar tiempo a anticipar el siguiente.',
      promptText: 'Encadeno varios cortes rápidos desde ángulos distintos, sin dar tiempo a anticipar el siguiente.',
    },
  },
  constitucion: {
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
  },
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

/// Resuelve las habilidades de arma activas según lo que lleves equipado en cada mano y tu
/// nivel — determinista, nunca decide el modelo. Deduplicado por (atributo, tier): dos armas de
/// la MISMA categoría (p.ej. daga+daga) no duplican la misma tarjeta dos veces, solo cuentan una
/// vez — el hueco real de variedad es tener DOS categorías distintas, una por mano.
export function weaponAbilitiesFor(equipped: EquippedWeaponSlot[], level: number): WeaponAbility[] {
  const seen = new Map<string, WeaponAbility>();
  for (const slot of equipped) {
    if (slot.slot !== 'ARMA_PRINCIPAL' && slot.slot !== 'ARMA_SECUNDARIA') continue;
    if (!slot.tipoArma) continue;
    const attribute = WEAPON_CATEGORY_ATTRIBUTE[slot.tipoArma];
    const rol = weaponRoleFor(slot.tipoArma);
    const content = WEAPON_ABILITY_CONTENT[attribute as 'fuerza' | 'destreza' | 'constitucion'];
    if (level >= WEAPON_ABILITY_LEVEL_BASICA) {
      seen.set(`${attribute}-basica`, { ...content.basica, attribute, rol, tier: 'basica' });
    }
    if (level >= WEAPON_ABILITY_LEVEL_AVANZADA) {
      seen.set(`${attribute}-avanzada`, { ...content.avanzada, attribute, rol, tier: 'avanzada' });
    }
  }
  return [...seen.values()];
}
