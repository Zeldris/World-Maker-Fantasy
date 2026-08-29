export type PanelId =
  | 'mapa'
  | 'inventario'
  | 'personaje'
  | 'diario'
  | 'misiones'
  | 'companeros'
  | 'reino'
  | 'habilidades'
  | 'enciclopedia'
  | 'reputacion'

export interface Tab {
  id: PanelId
  icon: string
  label: string
}

/// Nav dividido en dos rieles laterales, uno junto a cada panel de log (Tu personaje / El
/// mundo) en vez de una única barra inferior — libera altura vertical para los propios logs.
export const characterTabs: Tab[] = [
  { id: 'personaje', icon: '⚔️', label: 'Personaje' },
  { id: 'inventario', icon: '🎒', label: 'Inventario' },
  { id: 'habilidades', icon: '✨', label: 'Habilidades' },
  { id: 'companeros', icon: '👥', label: 'Compañeros' },
  { id: 'reino', icon: '🏰', label: 'Reino' },
]

// B.13 (checklist frontend 2026-08-27) — "Reputación" pasa de sub-pestaña de Personaje (canal
// dorado) a pestaña propia del riel "El mundo" (canal azulado): conceptualmente es del eje
// mundo/facciones, no del personaje en sí — mismo eje que Enciclopedia > Facciones, que muestra la
// misma entidad. Decisión de navegación explícita, no solo de estilo.
export const worldTabs: Tab[] = [
  { id: 'mapa', icon: '🗺️', label: 'Mapa' },
  { id: 'diario', icon: '📖', label: 'Diario' },
  { id: 'misiones', icon: '🎯', label: 'Misiones' },
  { id: 'reputacion', icon: '🤝', label: 'Reputación' },
  { id: 'enciclopedia', icon: '📚', label: 'Enciclopedia' },
]
