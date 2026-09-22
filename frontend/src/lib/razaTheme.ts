import type { CSSProperties } from 'react'

/// Paleta por RAZA, no por Facción (rediseño de Reino/Facciones, 2026-09-21 — referencia explícita
/// de Álvaro: "Total War: Warhammer da a cada raza su propia identidad visual, no a cada facción
/// suelta"). Confirmado con datos reales del proyecto: Tarkor tiene 4 razas de catálogo
/// (`BERIG_RAZAS`, backend/src/services/berigLore.ts) pero hoy solo 2 tienen `Faction` real
/// sembrada — 3 facciones orco (Serhu/Helsig/Goshg) + 1 goirnte (Concordia de Hierro). Con
/// `Faction.raza` ya siendo un campo simple, pintar por raza da a las 3 facciones orco un aire de
/// familia sin inventar 3 paletas distintas para algo que el propio lore ya trata como una sola
/// identidad cultural.
///
/// Deliberadamente NO extiende `WorldTheme`/`applyWorldTheme` (worldTheme.ts) — ese mecanismo
/// tiñe TODA la app (`document.documentElement`) con el tema de un `World` entero; `raza` es una
/// propiedad de cada fila `Faction`, no del mundo. Aplicar esto ahí pintaría toda la interfaz cada
/// vez que se mira una tarjeta de facción orca. En su lugar, esta utilidad se aplica con
/// `style={razaThemeStyleVars(faction.raza)}` en el nodo de CADA tarjeta/fila — scope real,
/// varias razas conviven en pantalla sin pisarse (clave para el mapa de relaciones entre
/// facciones, donde una fila muestra una facción orco junto a una goirnte).
///
/// Sin duplicar `BERIG_RAZAS` del backend a propósito — mismo criterio que `ReputacionPanel.tsx`
/// (duplica sus propias bandas de reputación en vez de pedirlas al backend, "tabla fija, no vale
/// la pena pedirla solo para pintar"): un slug de raza desconocido cae al fallback sin romper.
export interface RazaTheme {
  border: string
  text: string
  bar: string
}

const RAZA_THEMES: Record<string, RazaTheme> = {
  // Acero frío — "Orden" impuesto, mano dura de la Concordia de Hierro.
  goirntes: { border: '#5b8fae', text: '#8fc4e8', bar: '#5b8fae' },
  // Óxido/tierra — guerra y supervivencia de los 3 clanes orco.
  orcos: { border: '#b3542f', text: '#e0854f', bar: '#b3542f' },
  // Violeta apagado — sin facción sembrada todavía, reservado.
  nabieus: { border: '#6b5b95', text: '#a893c9', bar: '#6b5b95' },
  // Verde musgo — sin facción sembrada todavía, reservado.
  faerus: { border: '#5c7a3f', text: '#93b568', bar: '#5c7a3f' },
}

/// `null`/raza desconocida → objeto vacío, el nodo hereda `wood`/`iron` por defecto (nunca rompe,
/// nunca deja un `var()` sin resolver).
export function razaThemeStyleVars(raza: string | null | undefined): CSSProperties {
  const theme = raza ? RAZA_THEMES[raza] : undefined
  if (!theme) return {}
  return {
    '--raza-border': theme.border,
    '--raza-text': theme.text,
    '--raza-bar': theme.bar,
  } as CSSProperties
}
