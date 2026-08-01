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
export const attributeColorClasses: Record<Attribute, { text: string; border: string; bg: string; dot: string }> = {
  fuerza: { text: 'text-fuerza-400', border: 'border-fuerza-500', bg: 'bg-fuerza-500/15', dot: 'bg-fuerza-500' },
  destreza: { text: 'text-destreza-400', border: 'border-destreza-500', bg: 'bg-destreza-500/15', dot: 'bg-destreza-500' },
  constitucion: { text: 'text-constitucion-400', border: 'border-constitucion-500', bg: 'bg-constitucion-500/15', dot: 'bg-constitucion-500' },
  inteligencia: { text: 'text-inteligencia-400', border: 'border-inteligencia-500', bg: 'bg-inteligencia-500/15', dot: 'bg-inteligencia-500' },
  voluntad: { text: 'text-voluntad-400', border: 'border-voluntad-500', bg: 'bg-voluntad-500/15', dot: 'bg-voluntad-500' },
  carisma: { text: 'text-carisma-400', border: 'border-carisma-500', bg: 'bg-carisma-500/15', dot: 'bg-carisma-500' },
  arcano: { text: 'text-arcano-400', border: 'border-arcano-500', bg: 'bg-arcano-500/15', dot: 'bg-arcano-500' },
}
