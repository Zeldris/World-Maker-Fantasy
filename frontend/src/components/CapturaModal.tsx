import { useState } from 'react'
import { getCapturables, postCapturar, type CapturableCandidate } from '../lib/api'
import { SelectionModalShell } from './SelectionModalShell'
import { useAsyncModalData } from '../hooks/useAsyncModalData'

interface CapturaModalProps {
  saveId: string
  onCapturado: (npcSlug: string) => void
  onCancel: () => void
}

/// Captura (Grupo 3 § Compañeros y supervivencia, 2026-08-25, docs/rpgtarkor/
/// companeros-y-supervivencia.md § 1) — mismo patrón que SaquearZonaModal.tsx (barre la escena,
/// lista candidatos), pero a diferencia de Saquear, atar es una mutación 100% determinista sin
/// narración de por medio — `postCapturar` se llama directo, sin pasar por el turno/narración.
export function CapturaModal({ saveId, onCapturado, onCancel }: CapturaModalProps) {
  const [candidates, setCandidates] = useState<CapturableCandidate[]>([])
  const [tieneTrampaDeLazo, setTieneTrampaDeLazo] = useState(true)
  const [capturando, setCapturando] = useState<string | null>(null)
  const { loading, error, setError } = useAsyncModalData(
    () => getCapturables(saveId),
    (res) => {
      setCandidates(res.candidates)
      setTieneTrampaDeLazo(res.tieneTrampaDeLazo)
    },
    'No se pudo comprobar quién hay capturable en la zona.',
    [saveId],
  )

  async function handleCapturar(npcSlug: string) {
    setCapturando(npcSlug)
    setError(null)
    try {
      await postCapturar(saveId, npcSlug)
      onCapturado(npcSlug)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo atar — puede que ya no esté a tu alcance.')
      setCapturando(null)
    }
  }

  return (
    <SelectionModalShell title="Capturar" onCancel={onCancel} cancelDisabled={!!capturando}>
      {loading ? (
        <p className="text-xs text-wood-500">Buscando quién sigue a tu alcance...</p>
      ) : !tieneTrampaDeLazo ? (
        <p className="text-xs text-wood-400">
          Necesitas una trampa de lazo (en el inventario o equipada) para intentar atar a alguien.
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-wood-500">No hay nadie GRAVE o CONVALECIENTE aquí que puedas atar todavía.</p>
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => (
            <div key={c.npcSlug} className="flex items-center justify-between gap-2 rounded-lg border border-iron-700 p-2.5">
              <span className="text-xs text-wood-200">
                {c.tipo === 'FAUNA' ? '🐾 ' : ''}
                {c.name}
              </span>
              <button
                onClick={() => handleCapturar(c.npcSlug)}
                disabled={!!capturando}
                className="tactile shrink-0 rounded-lg border border-accent-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {capturando === c.npcSlug ? 'Atando...' : 'Atar'}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </SelectionModalShell>
  )
}
