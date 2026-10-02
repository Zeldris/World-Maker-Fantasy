import { setFactorDados } from './duracionTirada'

// Ajustes del jugador (CFG-5 y CFG-6, hito 0.2 — roadmap-front.md § 2). Aquí la parte pura:
// valores por defecto, validación y carga/guardado en `localStorage` con clave versionada y
// migración entre versiones. `SettingsProvider` (context/AjustesContext.tsx) los aplica a <html>.

export type Animaciones = 'sistema' | 'completas' | 'reducidas' | 'ninguna'
export type TamanoNarracion = 'pequeno' | 'normal' | 'grande' | 'muy-grande'
export type FuenteNarracion = 'normal' | 'serif' | 'legible'
export type VelocidadDados = 'dramatica' | 'normal' | 'rapida' | 'instantanea'

export interface Ajustes {
  /// CFG-9 — escala de toda la interfaz, en % (80–150).
  escalaInterfaz: number
  /// CFG-13 — tamaño, fuente e interlineado de la narración.
  tamanoNarracion: TamanoNarracion
  fuenteNarracion: FuenteNarracion
  interlineadoAmplio: boolean
  /// CFG-14 — `sistema` sigue a `prefers-reduced-motion`.
  animaciones: Animaciones
  /// CFG-20 — velocidad de las tiradas de dados.
  velocidadDados: VelocidadDados
  /// CFG-28 — alto contraste.
  altoContraste: boolean
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  escalaInterfaz: 100,
  tamanoNarracion: 'normal',
  fuenteNarracion: 'normal',
  interlineadoAmplio: false,
  animaciones: 'sistema',
  velocidadDados: 'dramatica',
  altoContraste: false,
}

export const CLAVE_AJUSTES = 'tarkor.settings.v1'
const CLAVES_ANTIGUAS: string[] = []

const uno = <T extends string>(valor: unknown, validos: readonly T[], porDefecto: T): T =>
  typeof valor === 'string' && (validos as readonly string[]).includes(valor) ? (valor as T) : porDefecto

/// Normaliza lo leído (de cualquier versión, o basura): cada campo inválido o ausente vuelve a su
/// valor por defecto, sin tirar el resto.
export function normalizarAjustes(crudo: unknown): Ajustes {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>
  const d = AJUSTES_POR_DEFECTO
  const escala = typeof o.escalaInterfaz === 'number' && Number.isFinite(o.escalaInterfaz) ? o.escalaInterfaz : d.escalaInterfaz
  return {
    escalaInterfaz: Math.min(150, Math.max(80, Math.round(escala / 5) * 5)),
    tamanoNarracion: uno(o.tamanoNarracion, ['pequeno', 'normal', 'grande', 'muy-grande'] as const, d.tamanoNarracion),
    fuenteNarracion: uno(o.fuenteNarracion, ['normal', 'serif', 'legible'] as const, d.fuenteNarracion),
    interlineadoAmplio: typeof o.interlineadoAmplio === 'boolean' ? o.interlineadoAmplio : d.interlineadoAmplio,
    animaciones: uno(o.animaciones, ['sistema', 'completas', 'reducidas', 'ninguna'] as const, d.animaciones),
    velocidadDados: uno(o.velocidadDados, ['dramatica', 'normal', 'rapida', 'instantanea'] as const, d.velocidadDados),
    altoContraste: typeof o.altoContraste === 'boolean' ? o.altoContraste : d.altoContraste,
  }
}

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/// Lee los ajustes; si solo hay una versión antigua, la migra a la actual (y borra la vieja).
export function cargarAjustes(almacen: Almacen | null = guardado()): Ajustes {
  if (!almacen) return AJUSTES_POR_DEFECTO
  try {
    const actual = almacen.getItem(CLAVE_AJUSTES)
    if (actual) return normalizarAjustes(JSON.parse(actual))
    for (const clave of CLAVES_ANTIGUAS) {
      const viejo = almacen.getItem(clave)
      if (!viejo) continue
      const migrados = normalizarAjustes(JSON.parse(viejo))
      almacen.setItem(CLAVE_AJUSTES, JSON.stringify(migrados))
      almacen.removeItem(clave)
      return migrados
    }
  } catch {
    // JSON roto o almacenamiento bloqueado: se juega con los valores por defecto.
  }
  return AJUSTES_POR_DEFECTO
}

export function guardarAjustes(ajustes: Ajustes, almacen: Almacen | null = guardado()): void {
  try {
    almacen?.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes))
  } catch {
    // Sin almacenamiento (modo privado): los ajustes duran lo que la pestaña.
  }
}

function guardado(): Almacen | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/// Multiplicador de la duración de las tiradas (CFG-20): 1 = la animación de siempre.
export const FACTOR_DADOS: Record<VelocidadDados, number> = { dramatica: 1, normal: 0.6, rapida: 0.3, instantanea: 0 }

/// Tamaño de la narración en rem (CFG-13).
export const TAMANO_NARRACION_REM: Record<TamanoNarracion, number> = { pequeno: 0.8125, normal: 0.875, grande: 1, 'muy-grande': 1.125 }

/// CFG-6 (hito 0.2, roadmap-front.md § 2.1) — aplica los ajustes en <html> como atributos y
/// variables CSS, para que los componentes no lean ajustes uno a uno:
/// `font-size` raíz (escala, CFG-9), `data-motion` (CFG-14, «sistema» resuelto aquí con
/// `prefers-reduced-motion`), `data-contrast` (CFG-28), `--narration-size`, `--narration-leading`
/// y `data-narration-font` (CFG-13).
export function aplicarAjustes(a: Ajustes, raiz: HTMLElement = document.documentElement, reduceSistema = prefiereReducir()) {
  raiz.style.fontSize = a.escalaInterfaz === 100 ? '' : `${a.escalaInterfaz}%`
  raiz.dataset.motion = a.animaciones === 'sistema' ? (reduceSistema ? 'reducidas' : 'completas') : a.animaciones
  if (a.altoContraste) raiz.dataset.contrast = 'alto'
  else delete raiz.dataset.contrast
  raiz.dataset.narrationFont = a.fuenteNarracion
  raiz.style.setProperty('--narration-size', `${TAMANO_NARRACION_REM[a.tamanoNarracion]}rem`)
  raiz.style.setProperty('--narration-leading', a.interlineadoAmplio ? '1.9' : '1.625')
  setFactorDados(FACTOR_DADOS[a.velocidadDados])
}

function prefiereReducir(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
