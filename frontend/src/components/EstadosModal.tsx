import type { ReactNode } from 'react'

// MOD-2 (hito 0.2, roadmap-front.md § 5) — estados comunes de los modales: cargando (esqueleto con
// la altura final aproximada, para que el modal no salte al llegar los datos, H28), error de carga
// con «Reintentar» y éxito con sello (antes cada modal escribía su frase en `emerald-300`).

export function CargandoModal({ texto, filas = 3 }: { texto: string; filas?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <p className="text-xs text-wood-500">{texto}</p>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-10 animate-pulse rounded-lg border border-iron-800 bg-wood-950/40" />
      ))}
    </div>
  )
}

export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger-600/50 bg-danger-500/10 px-3 py-2 text-xs">
      <span aria-hidden="true">⚠️</span>
      <p className="min-w-0 flex-1 text-danger-300">{mensaje}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="tactile shrink-0 rounded-md border border-danger-500/60 px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-danger-300 hover:bg-danger-500/20"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

export function ExitoModal({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-lg border border-moss-600/50 bg-moss-500/10 px-3 py-2.5 text-xs text-moss-300">
      <span aria-hidden="true" className="animate-stamp-in flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-moss-500 text-sm">
        ✓
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
