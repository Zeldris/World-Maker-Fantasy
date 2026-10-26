/// <reference types="vite/client" />

// Versión del juego (`A.P.C-etapa+commit`), inyectada en `vite.config.ts` con `define` (dev y build).
declare const __APP_VERSION__: string

// Contrato con la app de escritorio (Tauri, INS-31): inyecta esto antes que cualquier script de la página.
interface Window {
  __TARKOR__?: { apiUrl?: string }
}
