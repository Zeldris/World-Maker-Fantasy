import type { Attribute, RollInfo } from '../types'
import type { OpposedRollInfo } from './api'

export const attributeLabels: Record<Attribute, string> = {
  fuerza: 'Fuerza',
  destreza: 'Destreza',
  constitucion: 'Constitución',
  inteligencia: 'Inteligencia',
  voluntad: 'Voluntad',
  carisma: 'Carisma',
  magia: 'Magia',
}

/// Abreviatura de 3 letras por atributo (2026-08-12, rediseño de la vista de combate a 2 columnas:
/// "una abbr del attr y una descripción de la habilidad") — las tarjetas de habilidad en 2 columnas
/// no tienen ancho para `attributeLabels` completo ("Inteligencia", "Constitución"...) junto al
/// resto de la fila (icono, nombre, coste). Mismo criterio de mayúsculas que el resto de badges
/// compactos de la app (p. ej. "×2" de dualWield).
export const attributeAbbr: Record<Attribute, string> = {
  fuerza: 'FUE',
  destreza: 'DES',
  constitucion: 'CON',
  inteligencia: 'INT',
  voluntad: 'VOL',
  carisma: 'CAR',
  magia: 'MAG',
}

/// Etiquetas para bonificadores de objetos (2026-08-03) — `attributeLabels` de arriba solo cubre
/// los 7 atributos jugables; los objetos de armadura/escudo usan la clave especial 'defensa'
/// (ver equipment.ts § effectiveDefense, backend), que necesita su propia etiqueta para no
/// renderizarse como "undefined" en la UI (bug real: nunca la tuvo, ver InventoryItemInfo.statBonuses).
export const statBonusLabels: Record<string, string> = { ...attributeLabels, defensa: 'Defensa' }

/// Clases/especializaciones (2026-08-27, movida aquí desde EnciclopediaPanel.tsx en el roadmap de
/// especialización 2026-09-01 para compartirla con el modal de elección obligatoria a nivel 10, sin
/// duplicar el mismo formateo en dos sitios) — `Clase`/`Especializacion` (schema.prisma) son
/// valores SNAKE_CASE (BERSERKER, MAESTRO_ARQUERO...); en vez de mantener un mapa a mano
/// sincronizado con el enum del backend, se formatea genéricamente a Title Case con espacios.
export function claseLabel(clase: string): string {
  return clase.charAt(0) + clase.slice(1).toLowerCase()
}

export function especializacionLabel(especializacion: string): string {
  return especializacion
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/// Rediseño del turno de combate (2026-07-28) — un color por atributo (tokens en index.css) para
/// identificar el "tipo" de una habilidad de un vistazo. Clases completas y literales a propósito
/// (no una plantilla `` `border-${attr}-500` ``): Tailwind solo genera CSS para clases que ve
/// escritas tal cual en el código fuente, una cadena interpolada en tiempo de ejecución no la
/// detecta su análisis estático.
// `dot` (2026-07-30, rediseño de la vista de combate: "queda muy cargada de color" — sustituye
// chips enteros teñidos por un punto de color sólido) — MISMO criterio de arriba: clase completa
// y literal, nunca derivada de `border` con un `.replace()` en tiempo de ejecución (Tailwind no
// la habría detectado, `bg-fuerza-500` sin el `/15` de opacidad no aparecía en ningún sitio del
// código fuente hasta este campo).
// `dotLight` (2026-08-14, petición explícita: "la barra debería verse en color claro la parte de
// los attr base y en más oscuro lo que aumentan lo que llevas equipado") — reutiliza el mismo
// 400 que ya usaba `text`, ahora también como relleno sólido del tramo base de la barra de dos
// tonos (AttributeBars.tsx); `dot` (500) pasa a ser el tramo de bonus de equipo, más oscuro.
/// Tameo/captura (2026-09-04, centralización de todas las tiradas del juego) — `OpposedRollInfo`
/// (api.ts) ya expone el roll crudo de cada lado por separado del total, así que no hace falta
/// tocar backend: solo mapear al shape mínimo que `DiceRollVs` (DiceRoll.tsx) espera. Sin
/// `malus`/`attributeBonus`/`multiplicador` — Tameo nunca tuvo esos conceptos, `DiceFace` degrada
/// limpio sin ellos. `difficulty: 0`/`showDifficulty: false` — no hay dificultad fija en un check
/// opuesto, mismo criterio que iniciativa.
export function opposedRollToSides(roll: OpposedRollInfo): { left: RollInfo; right: RollInfo } {
  return {
    left: {
      attribute: roll.playerAttribute,
      value: roll.playerValue,
      roll: roll.playerRoll,
      result: roll.playerResult,
      difficulty: 0,
      success: roll.gano,
      gradoExito: roll.gano ? 'claro' : 'fallo',
    },
    right: {
      attribute: roll.resistenciaAttribute,
      value: roll.resistenciaValue,
      roll: roll.resistenciaRoll,
      result: roll.resistenciaResult,
      difficulty: 0,
      success: !roll.gano,
      gradoExito: roll.gano ? 'fallo' : 'claro',
    },
  }
}

export const attributeColorClasses: Record<Attribute, { text: string; border: string; bg: string; dot: string; dotLight: string }> = {
  fuerza: { text: 'text-fuerza-400', border: 'border-fuerza-500', bg: 'bg-fuerza-500/15', dot: 'bg-fuerza-500', dotLight: 'bg-fuerza-400' },
  destreza: { text: 'text-destreza-400', border: 'border-destreza-500', bg: 'bg-destreza-500/15', dot: 'bg-destreza-500', dotLight: 'bg-destreza-400' },
  constitucion: { text: 'text-constitucion-400', border: 'border-constitucion-500', bg: 'bg-constitucion-500/15', dot: 'bg-constitucion-500', dotLight: 'bg-constitucion-400' },
  inteligencia: { text: 'text-inteligencia-400', border: 'border-inteligencia-500', bg: 'bg-inteligencia-500/15', dot: 'bg-inteligencia-500', dotLight: 'bg-inteligencia-400' },
  voluntad: { text: 'text-voluntad-400', border: 'border-voluntad-500', bg: 'bg-voluntad-500/15', dot: 'bg-voluntad-500', dotLight: 'bg-voluntad-400' },
  carisma: { text: 'text-carisma-400', border: 'border-carisma-500', bg: 'bg-carisma-500/15', dot: 'bg-carisma-500', dotLight: 'bg-carisma-400' },
  magia: { text: 'text-magia-400', border: 'border-magia-500', bg: 'bg-magia-500/15', dot: 'bg-magia-500', dotLight: 'bg-magia-400' },
}
