import { createContext, useContext, useSyncExternalStore } from 'react'

/// CFG-33 (hito 0.1, roadmap-front.md H17) — "modo desarrollador", apagado por defecto. Mientras está
/// apagado, las herramientas de prompts de imagen (`ImagePromptSlot`) no aparecen en la partida (Clase,
/// Especialización, fichas de la Enciclopedia). Se guarda por navegador en `localStorage`; se activa
/// desde la página de admin. Cuando exista el menú de Configuración (CFG-1) pasará a ser una opción más.
const CLAVE = 'tarkor.modo-desarrollador'
const EVENTO = 'tarkor:modo-desarrollador'

export function leerModoDesarrollador(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

export function fijarModoDesarrollador(activo: boolean) {
  try {
    if (activo) localStorage.setItem(CLAVE, '1')
    else localStorage.removeItem(CLAVE)
  } catch {
    // Almacenamiento bloqueado: el modo se queda como estaba.
  }
  window.dispatchEvent(new Event(EVENTO))
}

function suscribir(aviso: () => void) {
  window.addEventListener(EVENTO, aviso)
  window.addEventListener('storage', aviso)
  return () => {
    window.removeEventListener(EVENTO, aviso)
    window.removeEventListener('storage', aviso)
  }
}

export function useModoDesarrollador(): boolean {
  return useSyncExternalStore(suscribir, leerModoDesarrollador, () => false)
}

/// La página de admin enseña las herramientas siempre, esté o no el modo desarrollador activo.
export const HerramientasAdminContext = createContext(false)

export function useHerramientasAdminVisibles(): boolean {
  const enAdmin = useContext(HerramientasAdminContext)
  const modoDesarrollador = useModoDesarrollador()
  return enAdmin || modoDesarrollador
}
