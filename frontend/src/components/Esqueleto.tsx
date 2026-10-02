/// REI-114 (hito 0.1, roadmap-front-reino.md R24) — esqueleto de carga: barras con la forma de lo que
/// va a llegar, en vez de un "Cargando…" en texto. El pulso solo con `motion-safe` (respeta "reducir
/// movimiento" del sistema); `role="status"` y un texto oculto para lectores de pantalla.
interface EsqueletoProps {
  /// Número de filas (cada una, una barra con su propio ancho para que no parezca una tabla vacía).
  filas?: number
  /// Lo que se está cargando, para el lector de pantalla ("órdenes de producción").
  que: string
  className?: string
}

const ANCHOS = ['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3']

export function Esqueleto({ filas = 3, que, className }: EsqueletoProps) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <span className="sr-only">Cargando {que}…</span>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-2 rounded-lg border border-iron-800 bg-wood-950/40 px-2.5 py-2">
          <div className={`h-2.5 rounded bg-iron-800 motion-safe:animate-pulse ${ANCHOS[i % ANCHOS.length]}`} />
        </div>
      ))}
    </div>
  )
}
