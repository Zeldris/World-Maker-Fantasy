export type PanelId =
  | 'mapa'
  | 'inventario'
  | 'equipo'
  | 'estadisticas'
  | 'diario'
  | 'misiones'
  | 'companeros'
  | 'reino'
  | 'habilidades'
  | 'profesiones'
  | 'enciclopedia'

export interface Tab {
  id: PanelId
  icon: string
  label: string
}

/// Nav dividido en dos rieles laterales, uno junto a cada panel de log (Tu personaje / El
/// mundo) en vez de una única barra inferior — libera altura vertical para los propios logs.
export const characterTabs: Tab[] = [
  { id: 'estadisticas', icon: '📊', label: 'Estadísticas' },
  { id: 'inventario', icon: '🎒', label: 'Inventario' },
  { id: 'equipo', icon: '⚔️', label: 'Equipo' },
  { id: 'habilidades', icon: '✨', label: 'Habilidades' },
  { id: 'profesiones', icon: '🔨', label: 'Profesiones' },
]

export const worldTabs: Tab[] = [
  { id: 'mapa', icon: '🗺️', label: 'Mapa' },
  { id: 'diario', icon: '📖', label: 'Diario' },
  { id: 'misiones', icon: '🎯', label: 'Misiones' },
  { id: 'companeros', icon: '👥', label: 'Compañeros' },
  { id: 'reino', icon: '🏰', label: 'Reino' },
  { id: 'enciclopedia', icon: '📚', label: 'Enciclopedia' },
]
