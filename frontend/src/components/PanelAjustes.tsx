import { useEffect, useState } from 'react'
import { ModalShell } from './ModalShell'
import { useAjustes } from '../context/useAjustes'
import { AJUSTES_POR_DEFECTO, type Ajustes } from '../lib/ajustes'
import { ACCIONES_ATAJO, asignarAtajo, teclaValida, type AccionAtajo } from '../lib/atajos'
import { getRitmoMundo, setRitmoMundo, type EstiloNarrador } from '../lib/api'

// CFG-4 (hito 0.2, roadmap-front.md § 2.1) — panel de configuración: pestañas laterales, vista
// previa en vivo (los cambios se ven al momento pero no se guardan hasta «Aplicar»), pie
// Restablecer · Cancelar · Aplicar y aviso si se cierra con cambios sin aplicar.

type Pestana = 'pantalla' | 'texto' | 'animaciones' | 'controles' | 'accesibilidad' | 'partida'

const PESTANAS: { id: Pestana; label: string; icono: string }[] = [
  { id: 'pantalla', label: 'Pantalla', icono: '🖥️' },
  { id: 'texto', label: 'Interfaz y texto', icono: '📜' },
  { id: 'animaciones', label: 'Animaciones', icono: '✨' },
  { id: 'controles', label: 'Controles', icono: '⌨️' },
  { id: 'accesibilidad', label: 'Accesibilidad', icono: '👁' },
]

/// CR-12 — solo con una partida abierta: lo que se guarda en ella, no en este navegador.
const PESTANA_PARTIDA = { id: 'partida' as const, label: 'Partida', icono: '🌍' }

function Opciones<T extends string>({ etiqueta, valor, opciones, onChange, ayuda }: {
  etiqueta: string
  valor: T
  opciones: { valor: T; label: string }[]
  onChange: (v: T) => void
  ayuda?: string
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs font-semibold text-wood-200">{etiqueta}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            onClick={() => onChange(o.valor)}
            className={`tactile rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              valor === o.valor ? 'border-accent-500 bg-accent-500/15 text-accent-200' : 'border-iron-700 text-wood-300 hover:border-accent-600/60'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {ayuda && <p className="text-2xs text-wood-500">{ayuda}</p>}
    </fieldset>
  )
}

function Interruptor({ etiqueta, valor, onChange, ayuda }: { etiqueta: string; valor: boolean; onChange: (v: boolean) => void; ayuda?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-accent-500" />
      <span>
        <span className="text-xs font-semibold text-wood-200">{etiqueta}</span>
        {ayuda && <span className="mt-0.5 block text-2xs text-wood-500">{ayuda}</span>}
      </span>
    </label>
  )
}

export function PanelAjustes({ guardados, partidaId = null, onCerrar }: { guardados: Ajustes; partidaId?: string | null; onCerrar: () => void }) {
  const { setAjustes, descartarVistaPrevia } = useAjustes()
  const [borrador, setBorrador] = useState<Ajustes>(guardados)
  const [pestana, setPestana] = useState<Pestana>('pantalla')
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  // CFG-26 — acción cuyo atajo se está cambiando (espera la siguiente tecla).
  const [capturando, setCapturando] = useState<AccionAtajo | null>(null)
  // CR-12 — «Ritmo del mundo» de la partida abierta (null hasta cargarlo).
  const [ritmoGuardado, setRitmoGuardado] = useState<EstiloNarrador | null>(null)
  const [ritmo, setRitmo] = useState<EstiloNarrador | null>(null)
  useEffect(() => {
    if (!partidaId) return
    let vivo = true
    getRitmoMundo(partidaId)
      .then(({ estiloNarrador }) => {
        if (!vivo) return
        setRitmoGuardado(estiloNarrador)
        setRitmo(estiloNarrador)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [partidaId])
  const ritmoCambiado = partidaId !== null && ritmo !== null && ritmo !== ritmoGuardado
  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(guardados) || ritmoCambiado
  const pestanas = partidaId ? [...PESTANAS, PESTANA_PARTIDA] : PESTANAS

  const cambiar = <K extends keyof Ajustes>(clave: K, valor: Ajustes[K]) => {
    const nuevo = { ...borrador, [clave]: valor }
    setBorrador(nuevo)
    setAjustes(nuevo, { vistaPrevia: true })
  }
  const cancelar = () => {
    descartarVistaPrevia()
    onCerrar()
  }
  const intentarCerrar = () => (hayCambios ? setConfirmandoSalida(true) : cancelar())
  const aplicar = () => {
    setAjustes(borrador)
    if (ritmoCambiado && partidaId && ritmo) setRitmoMundo(partidaId, ritmo).catch(() => {})
    onCerrar()
  }
  const restablecer = () => {
    setBorrador(AJUSTES_POR_DEFECTO)
    setAjustes(AJUSTES_POR_DEFECTO, { vistaPrevia: true })
    if (ritmo !== null) setRitmo('EQUILIBRADO')
  }

  const boton =
    'tactile flex-1 rounded-lg border px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <ModalShell
      title="Configuración"
      icon="⚙️"
      tamano="lg"
      onClose={intentarCerrar}
      footer={
        confirmandoSalida ? (
          <>
            <p className="flex-1 self-center text-xs text-danger-300">Hay cambios sin aplicar.</p>
            <button type="button" onClick={cancelar} className={`${boton} border-danger-600/60 text-danger-300`}>
              Descartar
            </button>
            <button type="button" onClick={aplicar} className={`${boton} border-accent-600 text-accent-200`}>
              Aplicar y cerrar
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={restablecer} className={`${boton} border-iron-700 text-wood-400`}>
              Restablecer
            </button>
            <button type="button" onClick={intentarCerrar} className={`${boton} border-iron-700 text-wood-300`}>
              Cancelar
            </button>
            <button type="button" onClick={aplicar} disabled={!hayCambios} className={`${boton} border-accent-600 bg-accent-500/15 text-accent-200`}>
              Aplicar
            </button>
          </>
        )
      }
    >
      <div className="flex min-h-[18rem] gap-4">
        <nav aria-label="Secciones de la configuración" className="flex w-40 shrink-0 flex-col gap-1">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={pestana === p.id ? 'page' : undefined}
              onClick={() => setPestana(p.id)}
              className={`tactile flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                pestana === p.id ? 'bg-accent-500/15 text-accent-200' : 'text-wood-400 hover:text-wood-200'
              }`}
            >
              <span aria-hidden="true">{p.icono}</span>
              {p.label}
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-5 border-l border-iron-800 pl-4">
          {pestana === 'pantalla' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-wood-200">Escala de la interfaz: {borrador.escalaInterfaz} %</span>
              <input
                type="range"
                min={80}
                max={150}
                step={5}
                value={borrador.escalaInterfaz}
                onChange={(e) => cambiar('escalaInterfaz', Number(e.target.value))}
                className="accent-accent-500"
              />
              <span className="text-2xs text-wood-500">Agranda o reduce toda la interfaz (útil en la Steam Deck o en monitores 4K).</span>
            </label>
          )}
          {pestana === 'texto' && (
            <>
              <Opciones
                etiqueta="Tamaño de la narración"
                valor={borrador.tamanoNarracion}
                onChange={(v) => cambiar('tamanoNarracion', v)}
                opciones={[
                  { valor: 'pequeno', label: 'Pequeño' },
                  { valor: 'normal', label: 'Normal' },
                  { valor: 'grande', label: 'Grande' },
                  { valor: 'muy-grande', label: 'Muy grande' },
                ]}
              />
              <Opciones
                etiqueta="Fuente de la narración"
                valor={borrador.fuenteNarracion}
                onChange={(v) => cambiar('fuenteNarracion', v)}
                opciones={[
                  { valor: 'normal', label: 'Normal' },
                  { valor: 'serif', label: 'Serif de lectura' },
                  { valor: 'legible', label: 'Muy legible' },
                ]}
              />
              <Interruptor etiqueta="Interlineado amplio" valor={borrador.interlineadoAmplio} onChange={(v) => cambiar('interlineadoAmplio', v)} />
            </>
          )}
          {pestana === 'animaciones' && (
            <>
              <Opciones
                etiqueta="Animaciones"
                valor={borrador.animaciones}
                onChange={(v) => cambiar('animaciones', v)}
                ayuda="«Como el sistema» sigue el ajuste de reducir movimiento del sistema operativo."
                opciones={[
                  { valor: 'sistema', label: 'Como el sistema' },
                  { valor: 'completas', label: 'Completas' },
                  { valor: 'reducidas', label: 'Reducidas' },
                  { valor: 'ninguna', label: 'Ninguna' },
                ]}
              />
              <Opciones
                etiqueta="Velocidad de las tiradas"
                valor={borrador.velocidadDados}
                onChange={(v) => cambiar('velocidadDados', v)}
                opciones={[
                  { valor: 'dramatica', label: 'Dramática' },
                  { valor: 'normal', label: 'Normal' },
                  { valor: 'rapida', label: 'Rápida' },
                  { valor: 'instantanea', label: 'Instantánea' },
                ]}
              />
            </>
          )}
          {pestana === 'controles' && (
            <div className="flex flex-col gap-1.5">
              <p className="mb-1 text-2xs text-wood-500">
                Atajos de teclado (fuera de los campos de texto). Enter envía y Esc abre el menú; los números eligen opciones.
              </p>
              {ACCIONES_ATAJO.map(({ accion, label }) => (
                <div key={accion} className="flex items-center justify-between gap-3 rounded-lg border border-iron-800 px-3 py-1.5 text-xs">
                  <span className="text-wood-200">{label}</span>
                  {capturando === accion ? (
                    <input
                      autoFocus
                      readOnly
                      aria-label={`Pulsa la nueva tecla para ${label}`}
                      placeholder="Pulsa una tecla…"
                      onKeyDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (e.key === 'Escape') return setCapturando(null)
                        if (!teclaValida(e.key)) return
                        cambiar('atajos', asignarAtajo(borrador.atajos, accion, e.key))
                        setCapturando(null)
                      }}
                      onBlur={() => setCapturando(null)}
                      className="w-32 rounded border border-accent-500 bg-wood-950/60 px-2 py-0.5 text-center text-2xs text-accent-200 outline-none"
                    />
                  ) : (
                    <span className="flex items-center gap-2">
                      <kbd className="min-w-6 rounded border border-iron-700 bg-wood-950/60 px-1.5 py-0.5 text-center font-mono uppercase text-wood-100">
                        {borrador.atajos[accion]}
                      </kbd>
                      <button
                        type="button"
                        onClick={() => setCapturando(accion)}
                        className="tactile rounded border border-iron-700 px-2 py-0.5 text-2xs text-wood-400 hover:text-accent-300"
                      >
                        Cambiar
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {pestana === 'partida' && ritmo !== null && (
            <Opciones
              etiqueta="Ritmo del mundo"
              valor={ritmo}
              onChange={setRitmo}
              ayuda="Cuánto pasa en el mundo por sí solo: escaramuzas, caravanas, plagas, incendios… Se puede cambiar en cualquier momento."
              opciones={[
                { valor: 'TRANQUILO', label: 'Tranquilo' },
                { valor: 'EQUILIBRADO', label: 'Equilibrado' },
                { valor: 'CAOTICO', label: 'Caótico' },
              ]}
            />
          )}
          {pestana === 'accesibilidad' && (
            <Interruptor
              etiqueta="Alto contraste"
              valor={borrador.altoContraste}
              onChange={(v) => cambiar('altoContraste', v)}
              ayuda="Aclara los textos apagados y marca más los bordes."
            />
          )}
        </div>
      </div>
    </ModalShell>
  )
}
