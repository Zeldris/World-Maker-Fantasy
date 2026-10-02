import { ModalShell } from './ModalShell'
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
  return (
    // MOD-1 (hito 0.2): sobre ModalShell. «Salir» (o Escape) abandona la escena; en la vuelta que
    // la cierra solo queda «Continuar». El modal sigue montado entre vueltas, así que el foco
    // inicial de ModalShell solo se toma en la primera.
    <ModalShell
      title={`Vuelta ${turno.vuelta} — ${turno.timeLabel}`}
      onClose={onSalir}
      sinCerrar={turno.cierra}
      closeDisabled={busy || turno.cierra}
      etiquetaCerrar="Salir"
      disableOverlayClose
      footer={
        <div className="flex w-full flex-col gap-2">
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
      }
    >
        <div key={turno.vuelta} className="animate-entry-in flex flex-col gap-3">
          {imageUrl && <img src={imageUrl} alt="" className="aspect-[2.5/1] w-full rounded-lg object-cover" />}
          <p className="text-sm leading-relaxed text-wood-100">{turno.narration}</p>
        </div>
        {/* B.8 (checklist consolidado 2026-08-27, mitad pendiente) — la transición ENTRE vueltas ya
            estaba resuelta (`key={turno.vuelta}`/`animate-entry-in`); faltaba el indicador MIENTRAS
            se espera la siguiente vuelta (Ollama puede tardar varios segundos y `busy` solo
            deshabilitaba los botones, sin ninguna señal visual de que algo está en curso).
            UX 2026-09-01 (hallazgo jugando en vivo): un simple `animate-pulse` en el texto entero
            (fade in/out en bloque, decenas de segundos por vuelta) no comunica "sigue en marcha"
            con claridad — se confunde con "algo se ha quedado colgado". Reutiliza el mismo patrón
            visual que ya usa LogPanel.tsx para la tarjeta "El Narrador escribe"/"El mundo se
            mueve" (`thinking-sheen`, un barrido de luz en bucle sobre la tarjeta, diseñado a
            propósito para esperas largas — "algo se mueve aunque tarde minutos") en vez de
            inventar un spinner nuevo. */}
        {busy && (
          <div className="relative overflow-hidden rounded-lg border border-dashed border-accent2-600/40 bg-accent2-500/5 px-3 py-2">
            <div className="thinking-sheen" />
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent2-400" />
              <p className="text-2xs italic text-wood-400">Resolviendo...</p>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
    </ModalShell>
  )
}
