import { useEffect, useRef, useState, type WheelEvent } from 'react'

// MOD-5 (hito 0.2, roadmap-front.md § 5, H26) — selector de cantidad único, en vez de las copias
// de Recolectar, Curar y Comer/Beber: −/+ que repiten al mantenerlos pulsados, número editable,
// rueda del ratón sobre el número y botón «Máx.».

const RETARDO_REPETIR_MS = 400
const CADA_REPETIR_MS = 110

interface QuantityStepperProps {
  value: number
  /// Cuántas hay (el número que se enseña como «/max» si `mostrarMax`).
  max: number
  /// Hasta dónde deja subir «+» y «Máx.» ahora mismo (hueco en la mochila, ya estarías ileso…).
  /// Por defecto, `max`.
  tope?: number
  onChange: (n: number) => void
  /// Nombre de lo que se cuenta, para las etiquetas accesibles («Raciones»).
  etiqueta: string
  /// Motivo de que «+» esté bloqueado (tooltip).
  motivoTope?: string
  mostrarMax?: boolean
}

export function QuantityStepper({ value, max, tope = max, onChange, etiqueta, motivoTope, mostrarMax = false }: QuantityStepperProps) {
  const limite = Math.max(0, Math.min(max, tope))
  const fijar = (n: number) => onChange(Math.max(0, Math.min(limite, Math.round(n))))

  // Mantener pulsado −/+ repite; el valor vivo va en un ref para que cada repetición parta del
  // último, no del que había al empezar a pulsar.
  const valorRef = useRef(value)
  valorRef.current = value
  const limiteRef = useRef(limite)
  limiteRef.current = limite
  const repetir = useRef<{ t: ReturnType<typeof setTimeout> | null; i: ReturnType<typeof setInterval> | null }>({ t: null, i: null })
  // Si al mantener llegó a repetir, el clic que llega al soltar no suma otra vez.
  const repitio = useRef(false)
  const parar = () => {
    if (repetir.current.t) clearTimeout(repetir.current.t)
    if (repetir.current.i) clearInterval(repetir.current.i)
    repetir.current = { t: null, i: null }
  }
  const empezar = (paso: number) => {
    parar()
    repitio.current = false
    repetir.current.t = setTimeout(() => {
      repetir.current.i = setInterval(() => {
        repitio.current = true
        const siguiente = Math.max(0, Math.min(limiteRef.current, valorRef.current + paso))
        if (siguiente === valorRef.current) return parar()
        onChange(siguiente)
      }, CADA_REPETIR_MS)
    }, RETARDO_REPETIR_MS)
  }
  useEffect(() => parar, [])

  // Número editable: se escribe libre y se fija al salir o con Enter.
  const [texto, setTexto] = useState<string | null>(null)
  const confirmarTexto = () => {
    if (texto !== null && texto.trim() !== '' && !Number.isNaN(Number(texto))) fijar(Number(texto))
    setTexto(null)
  }

  const rueda = (e: WheelEvent<HTMLInputElement>) => {
    if (document.activeElement !== e.currentTarget) return
    fijar(value + (e.deltaY < 0 ? 1 : -1))
  }

  const boton =
    'tactile flex h-6 w-6 items-center justify-center rounded border border-iron-700 text-wood-300 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label={`Menos: ${etiqueta}`}
        onClick={() => (repitio.current ? (repitio.current = false) : fijar(value - 1))}
        onPointerDown={() => empezar(-1)}
        onPointerUp={parar}
        onPointerLeave={parar}
        disabled={value <= 0}
        className={boton}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={etiqueta}
        value={texto ?? String(value)}
        onChange={(e) => setTexto(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={confirmarTexto}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            confirmarTexto()
          }
        }}
        onWheel={rueda}
        className="w-8 rounded border border-transparent bg-transparent text-center font-mono tabular-nums text-wood-100 outline-none focus:border-accent-500"
      />
      {mostrarMax && <span className="-ml-1 font-mono tabular-nums text-wood-500">/{max}</span>}
      <button
        type="button"
        aria-label={`Más: ${etiqueta}`}
        onClick={() => (repitio.current ? (repitio.current = false) : fijar(value + 1))}
        onPointerDown={() => empezar(1)}
        onPointerUp={parar}
        onPointerLeave={parar}
        disabled={value >= limite}
        title={value >= limite && limite < max ? motivoTope : undefined}
        className={boton}
      >
        +
      </button>
      {max > 1 && (
        <button
          type="button"
          onClick={() => fijar(limite)}
          disabled={value >= limite}
          title={value >= limite && limite < max ? motivoTope : `Marcar ${limite}`}
          className="tactile rounded border border-iron-700 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-wood-400 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Máx.
        </button>
      )}
    </div>
  )
}
