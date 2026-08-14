import type { Attribute } from '../types'

export const attributeLabels: Record<Attribute, string> = {
  fuerza: 'Fuerza',
  destreza: 'Destreza',
  constitucion: 'Constitución',
  inteligencia: 'Inteligencia',
  voluntad: 'Voluntad',
  carisma: 'Carisma',
  arcano: 'Arcano',
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
  arcano: 'ARC',
}

/// Etiquetas para bonificadores de objetos (2026-08-03) — `attributeLabels` de arriba solo cubre
/// los 7 atributos jugables; los objetos de armadura/escudo usan la clave especial 'defensa'
/// (ver equipment.ts § effectiveDefense, backend), que necesita su propia etiqueta para no
/// renderizarse como "undefined" en la UI (bug real: nunca la tuvo, ver InventoryItemInfo.statBonuses).
export const statBonusLabels: Record<string, string> = { ...attributeLabels, defensa: 'Defensa' }

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
export const attributeColorClasses: Record<Attribute, { text: string; border: string; bg: string; dot: string; dotLight: string }> = {
  fuerza: { text: 'text-fuerza-400', border: 'border-fuerza-500', bg: 'bg-fuerza-500/15', dot: 'bg-fuerza-500', dotLight: 'bg-fuerza-400' },
  destreza: { text: 'text-destreza-400', border: 'border-destreza-500', bg: 'bg-destreza-500/15', dot: 'bg-destreza-500', dotLight: 'bg-destreza-400' },
  constitucion: { text: 'text-constitucion-400', border: 'border-constitucion-500', bg: 'bg-constitucion-500/15', dot: 'bg-constitucion-500', dotLight: 'bg-constitucion-400' },
  inteligencia: { text: 'text-inteligencia-400', border: 'border-inteligencia-500', bg: 'bg-inteligencia-500/15', dot: 'bg-inteligencia-500', dotLight: 'bg-inteligencia-400' },
  voluntad: { text: 'text-voluntad-400', border: 'border-voluntad-500', bg: 'bg-voluntad-500/15', dot: 'bg-voluntad-500', dotLight: 'bg-voluntad-400' },
  carisma: { text: 'text-carisma-400', border: 'border-carisma-500', bg: 'bg-carisma-500/15', dot: 'bg-carisma-500', dotLight: 'bg-carisma-400' },
  arcano: { text: 'text-arcano-400', border: 'border-arcano-500', bg: 'bg-arcano-500/15', dot: 'bg-arcano-500', dotLight: 'bg-arcano-400' },
}
