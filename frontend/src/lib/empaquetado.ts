/// INS-33 — Tauri inyecta `window.__TARKOR__` antes de cualquier script y solo en la app de escritorio
/// (contrato: docs/04-empaquetado-tauri.md del instalador). En desarrollo y en la web no existe, así que
/// «empaquetado» es que sea un objeto. Lectura única: la usan `apiBaseUrl()` y la detección.
export function leerTarkor(): { apiUrl?: string } | undefined {
  const tarkor = typeof window === 'undefined' ? undefined : window.__TARKOR__
  return typeof tarkor === 'object' && tarkor !== null ? tarkor : undefined
}

/// Síncrona. El juego empaquetado no lleva las herramientas de admin.
export function esEmpaquetado(): boolean {
  return leerTarkor() !== undefined
}
