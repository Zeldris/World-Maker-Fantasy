import { useEffect, useState, type KeyboardEvent } from 'react'

/// REI-110 / REI-112 (hito 0.1, roadmap-front-reino.md R18/R20) — campo numérico que guarda contra el
/// backend con criterio: borrador local mientras se escribe, guardado al pulsar `Enter` o al salir del
/// campo (solo si el valor cambió), `Esc` deshace, y una ✓ breve cuando el guardado se confirma.
/// Antes la prioridad de una orden mandaba una petición por cada tecla y los topes se guardaban al
/// perder el foco sin ninguna señal.
interface NumeroGuardableProps {
  valor: number | null
  min?: number
  max?: number
  /// `true` = vaciar el campo guarda `null` (p. ej. "sin tope"); `false` = vacío deshace.
  permitirVacio?: boolean
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
  /// Devuelve `false` si el guardado falló (el campo vuelve al valor anterior).
  onGuardar: (valor: number | null) => Promise<boolean>
  className?: string
}

export function NumeroGuardable({ valor, min, max, permitirVacio = false, placeholder, ariaLabel, disabled, onGuardar, className }: NumeroGuardableProps) {
  const [borrador, setBorrador] = useState(valor == null ? '' : String(valor))
  const [guardando, setGuardando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)

  // Valor nuevo desde fuera (recarga tras guardar, otro cambio): el borrador lo sigue. Se ajusta en
  // el render y solo si `valor` cambió de verdad (QA-12): un efecto corría también al montar y, si se
  // había escrito antes de que corrieran los efectos, pisaba lo escrito con el valor de partida.
  const [valorVisto, setValorVisto] = useState(valor)
  if (valor !== valorVisto) {
    setValorVisto(valor)
    setBorrador(valor == null ? '' : String(valor))
  }

  useEffect(() => {
    if (!confirmado) return
    const t = setTimeout(() => setConfirmado(false), 1200)
    return () => clearTimeout(t)
  }, [confirmado])

  function normalizar(texto: string): number | null | undefined {
    const limpio = texto.trim()
    if (!limpio) return permitirVacio ? null : undefined
    const n = Number(limpio)
    if (!Number.isFinite(n)) return undefined
    let v = Math.round(n)
    if (min != null) v = Math.max(min, v)
    if (max != null) v = Math.min(max, v)
    return v
  }

  async function guardar() {
    const nuevo = normalizar(borrador)
    if (nuevo === undefined || nuevo === valor) {
      setBorrador(valor == null ? '' : String(valor))
      return
    }
    setBorrador(nuevo == null ? '' : String(nuevo))
    setGuardando(true)
    const ok = await onGuardar(nuevo)
    setGuardando(false)
    if (ok) setConfirmado(true)
    else setBorrador(valor == null ? '' : String(valor))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void guardar()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setBorrador(valor == null ? '' : String(valor))
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        min={min}
        max={max}
        placeholder={placeholder}
        value={borrador}
        disabled={disabled || guardando}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => void guardar()}
        onKeyDown={onKeyDown}
        className={className ?? 'w-12 rounded border border-iron-700 bg-wood-950/80 px-1.5 py-0.5 text-center text-2xs text-wood-200'}
      />
      <span aria-live="polite" className={`w-3 text-2xs text-moss-400 transition-opacity ${confirmado ? 'opacity-100' : 'opacity-0'}`}>
        {confirmado ? '✓' : ''}
      </span>
    </span>
  )
}
