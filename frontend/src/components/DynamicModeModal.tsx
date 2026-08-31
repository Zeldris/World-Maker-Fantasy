import { useEffect, useRef } from 'react'
import type { DynamicModeTurno } from '../lib/api'

interface DynamicModeModalProps {
  turno: DynamicModeTurno
  busy?: boolean
  error?: string
  /// B.6 (checklist frontend 2026-08-27) — retrato real del NPC/fauna, resuelto una vez al abrir
  /// (GameView.tsx, por `targetSlug` conocido con certeza, no por texto). `null`/`undefined` = sin
  /// imagen real subida todavía, mismo criterio silencioso que el resto de la app (nunca un icono
  /// roto).
  imageUrl?: string | null
  onElegir: (opcion: string) => void
  onCerrar: () => void
  onSalir: () => void
}

/// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — mini-flujo acotado abierto tras
/// pulsar "Interactuar" en la tarjeta de oferta del log (LogPanel.tsx § dynamicModeOffer). Misma
/// carcasa de overlay que PostCombatInteractionModal.tsx, pero con opciones dinámicas en vez de
/// botones fijos: el motor ya decidió el candidato y el guion determinista, el LLM solo redacta
/// cada vuelta y propone las opciones — nunca texto libre dentro de este modo. Cuando `turno.cierra`
/// es true, el único botón disponible es "Continuar" (cierra el modal, vuelve al juego normal).
///
/// `accent2` (azulado, canal "El mundo") en vez de `accent` (dorado, "Tu personaje") — checklist
/// frontend 2026-08-27, B.7: es una interacción con el mundo/un NPC, no con el propio personaje.
/// `error`/`onSalir` — B.4/B.5 del mismo checklist: antes no había ningún mensaje si `onElegir`
/// fallaba, ni ninguna vía de salir de la conversación antes de que el LLM decidiera cerrarla él
/// solo (único modal de "elección" de la app sin cancelar). `onSalir` llama a
/// `ignorarModoDinamico` (mismo endpoint que "Ignorar" en la tarjeta de oferta, ampliado en backend
/// para limpiar `pendingDynamicMode` también cuando ya hay una conversación en curso).
///
/// `key={turno.vuelta}` en el bloque de narración (B.8, mismo checklist) — el modal en sí permanece
/// montado entre vueltas (solo cambian sus props), así que `animate-entry-in` nunca se disparaba
/// más allá de la primera vez; forzar remount por vuelta hace que cada respuesta del NPC/fauna
/// vuelva a animarse en vez de "saltar" de texto sin transición.
export function DynamicModeModal({ turno, busy, error, imageUrl, onElegir, onCerrar, onSalir }: DynamicModeModalProps) {
  // Foco al abrirse por primera vez (2026-08-31, "revisa bien todos los casos del foco/scroll") —
  // solo en la vuelta 1 (el modal permanece montado entre vueltas, ver comentario de cabecera sobre
  // `key={turno.vuelta}`), para no robarle el foco al jugador en cada respuesta si ya está
  // interactuando con el teclado dentro del propio modal.
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (turno.vuelta === 1) rootRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={rootRef} tabIndex={-1} className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 outline-none">
      <div className="plank-panel animate-combat-enter relative flex w-full max-w-md flex-col gap-4 rounded-xl p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-accent2-400">
            Vuelta {turno.vuelta} — {turno.timeLabel}
          </p>
          {!turno.cierra && (
            <button
              type="button"
              onClick={onSalir}
              disabled={busy}
              className="tactile shrink-0 rounded-md border border-iron-700 px-2 py-0.5 text-2xs font-semibold text-wood-500 transition-colors hover:border-danger-600/60 hover:text-danger-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Salir
            </button>
          )}
        </div>
        <div key={turno.vuelta} className="animate-entry-in flex flex-col gap-3">
          {imageUrl && <img src={imageUrl} alt="" className="aspect-[2.5/1] w-full rounded-lg object-cover" />}
          <p className="text-sm leading-relaxed text-wood-100">{turno.narration}</p>
        </div>
        {/* B.8 (checklist consolidado 2026-08-27, mitad pendiente) — la transición ENTRE vueltas ya
            estaba resuelta (`key={turno.vuelta}`/`animate-entry-in`); faltaba el indicador MIENTRAS
            se espera la siguiente vuelta (Ollama puede tardar varios segundos y `busy` solo
            deshabilitaba los botones, sin ninguna señal visual de que algo está en curso). */}
        {busy && (
          <p className="animate-pulse text-2xs italic text-wood-500">Resolviendo...</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex flex-col gap-2">
          {turno.cierra ? (
            <button
              type="button"
              onClick={onCerrar}
              disabled={busy}
              className="tactile w-full rounded-lg border border-accent2-600 bg-gradient-to-b from-accent2-400 to-accent2-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
            >
              Continuar
            </button>
          ) : (
            turno.opciones.map((opcion) => (
              <button
                type="button"
                key={opcion}
                onClick={() => onElegir(opcion)}
                disabled={busy}
                className="tactile w-full rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-left text-xs font-semibold text-wood-200 transition-colors hover:border-accent2-600/60 hover:text-accent2-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {opcion}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
