import { useEffect, useState } from 'react'
import { ModalShell } from './ModalShell'
import { confirmButtonClasses } from './SelectionModalShell'

interface FinDePartidaModalProps {
  characterName: string | null
  deathCount: number
  /// «Día N, HH:MM» (`formatFictionalDate`): toda partida empieza el Día 1 (también al reiniciarla),
  /// así que el día en que acabó es los días vividos. Si el formato cambiara, no se enseña.
  fictionalDate: string
  onIrAPartidas: () => void
  /// Lo que se espera antes de salir, para leer la última narración (lo que hacía el salto de antes).
  esperaMs?: number
}

/// P128 (QA-27, decisión de la usuaria 2026-10-13): al acabarse la partida, una pantalla breve que lo
/// dice, con las muertes y los días vividos, y el paso a «Tus partidas», donde se puede reiniciar o
/// empezar otra (decisión del 2026-08-31). Antes saltaba sola a «Elige un mundo» a los 3,5 s.
export function FinDePartidaModal({ characterName, deathCount, fictionalDate, onIrAPartidas, esperaMs = 3500 }: FinDePartidaModalProps) {
  const [visible, setVisible] = useState(esperaMs <= 0)
  useEffect(() => {
    if (esperaMs <= 0) return
    const t = setTimeout(() => setVisible(true), esperaMs)
    return () => clearTimeout(t)
  }, [esperaMs])
  const dias = Number(/Día (\d+)/.exec(fictionalDate)?.[1] ?? 0)
  if (!visible) return null
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
