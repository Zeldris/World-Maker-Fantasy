import { ProgressBar } from './base/ProgressBar'

/// Barra de recurso 0-100 con umbral de color (2026-08-27, auditoría de diseño/UX § 1.4: "es la
/// misma mecánica [Hambre/Sed del jugador y del compañero] mostrada con dos implementaciones
/// separadas que ya han empezado a divergir") — misma lógica de color/ancho en los dos sitios que
/// la usan (EstadisticasPanel.tsx § jugador, CompanerosPanel.tsx § compañero), solo layout distinto
/// según el espacio disponible: `compact` para una tarjeta estrecha (label+barra+% en una fila),
/// `full` para una sección con ancho de sobra (label+% arriba, barra debajo, más legible).
export function ResourceBar({ label, pct, variant = 'full' }: { label: string; pct: number; variant?: 'compact' | 'full' }) {
  const colorClass = pct < 25 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
  // BAS-8 (hito 0.2) — barra común con «barra fantasma» al bajar.
  const bar = <ProgressBar pct={pct} color={colorClass} etiqueta={label} alto="fino" />

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5 text-2xs text-wood-400">
        <span className="w-14 shrink-0">{label}</span>
        {bar}
        <span className="w-9 shrink-0 text-right font-mono tabular-nums">{pct}%</span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-2xs text-wood-400">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      {bar}
    </div>
  )
}
