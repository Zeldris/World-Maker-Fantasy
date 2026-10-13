import { ModalShell } from './ModalShell'
import { confirmButtonClasses } from './SelectionModalShell'

interface FinDePartidaModalProps {
  characterName: string | null
  deathCount: number
  /// «Día N, HH:MM» (`formatFictionalDate`): el día en que acabó es los días vividos.
  fictionalDate: string
  onIrAPartidas: () => void
}

/// P128 (QA-27, decisión de la usuaria 2026-10-13): al acabarse la partida, una pantalla breve que lo
/// dice, con las muertes y los días vividos, y el paso a «Tus partidas», donde se puede reiniciar o
/// empezar otra (decisión del 2026-08-31). Antes saltaba sola a «Elige un mundo» a los 3,5 s.
export function FinDePartidaModal({ characterName, deathCount, fictionalDate, onIrAPartidas }: FinDePartidaModalProps) {
  const dias = Number(/Día (\d+)/.exec(fictionalDate)?.[1] ?? 0)
  return (
    <ModalShell
      title="Fin de la partida"
      tamano="sm"
      onClose={onIrAPartidas}
      sinCerrar
      disableOverlayClose
      footer={
        <button type="button" onClick={onIrAPartidas} className={confirmButtonClasses('accent')}>
          Ir a tus partidas
        </button>
      }
    >
      <p className="text-sm text-wood-200">{characterName ?? 'Tu personaje'} ya no puede seguir: esta partida ha terminado.</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
          <dt className="text-wood-500">Muertes</dt>
          <dd className="font-mono text-base text-wood-100">{deathCount}</dd>
        </div>
        {dias > 0 && (
          <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
            <dt className="text-wood-500">Días vividos</dt>
            <dd className="font-mono text-base text-wood-100">{dias}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-wood-500">En «Tus partidas» puedes reiniciarla o empezar otra.</p>
    </ModalShell>
  )
}
