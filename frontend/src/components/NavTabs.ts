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
  | 'zona'

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

export const worldTabs: Tab[] = [
  { id: 'mapa', icon: '🗺️', label: 'Mapa' },
  // Grupo 3 § Mundo determinista, Capa 1 (2026-08-25) — prototipo de zonas navegables, solo
  // La Hondonada del Eco por ahora (ZonaPanel oculta su contenido si la zona actual no tiene
  // ningún ZonePoint sembrado, ver zona.ts).
  { id: 'zona', icon: '🧭', label: 'Zona' },
  { id: 'diario', icon: '📖', label: 'Diario' },
  { id: 'misiones', icon: '🎯', label: 'Misiones' },
  { id: 'enciclopedia', icon: '📚', label: 'Enciclopedia' },
]
