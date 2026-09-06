/// Compartido entre HabilidadesPanel.tsx (etiqueta "Pasiva") y GameView.tsx (editor de barras de
/// habilidades) — bug real jugando en vivo (2026-09-06, "Desollar es una habilidad pasiva, así que
/// no debería poder añadirse a la barra de habilidades"): antes solo HabilidadesPanel.tsx conocía
/// esta lista, así que el editor de barras seguía ofreciendo Desollar como opción añadible.
export const PASSIVE_ABILITY_NAMES = new Set(['Desollar'])
