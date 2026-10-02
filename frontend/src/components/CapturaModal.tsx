import { useState } from 'react'
import { getCapturables, postCapturar, type CapturableCandidate } from '../lib/api'
import { SelectionModalShell } from './SelectionModalShell'
import { useAsyncModalData } from '../hooks/useAsyncModalData'
import { useSubmitError } from '../hooks/useSubmitError'
import { CargandoModal, ErrorCarga, ExitoModal } from './EstadosModal'
import { Miniatura } from './Miniatura'

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
  const [tieneCuerdas, setTieneCuerdas] = useState(true)
  const [capturando, setCapturando] = useState<string | null>(null)
  // Rediseño de captura (2026-08-28): atar ya no deja al objetivo listo para tamear al instante —
  // se lleva en el inventario hasta depositarlo en una Jaula. Mensaje de éxito propio en vez de
  // cerrar el modal sin explicación (mismo criterio que el resto de mutaciones deterministas de
  // este proyecto: confirmar lo que acaba de pasar, no dejarlo implícito).
  const [atado, setAtado] = useState<{ tipo: 'FAUNA' | 'NPC' } | null>(null)
  const { loading, error: loadError, reintentar } = useAsyncModalData(
    () => getCapturables(saveId),
    (res) => {
      setCandidates(res.candidates)
      setTieneCuerdas(res.tieneCuerdas)
    },
    'No se pudo comprobar quién hay capturable en la zona.',
    [saveId],
  )
  const { error: submitError, runCatchingError } = useSubmitError()
  const error = loadError ?? submitError

  async function handleCapturar(npcSlug: string) {
    setCapturando(npcSlug)
    const res = await runCatchingError(() => postCapturar(saveId, npcSlug), 'No se pudo atar — puede que ya no esté a tu alcance.')
    setCapturando(null)
    if (res === undefined) return
    setAtado({ tipo: res.tipo })
    onCapturado(npcSlug)
  }

  return (
    <SelectionModalShell title="Capturar" onCancel={onCancel} cancelDisabled={!!capturando}>
      {atado ? (
        <ExitoModal>
          ¡Atado! Ahora llevas {atado.tipo === 'FAUNA' ? 'a la criatura' : 'al prisionero'} en tu inventario — deposítalo en una Jaula desde ahí para empezar a ganarte su confianza.
        </ExitoModal>
      ) : loading ? (
        <CargandoModal texto="Buscando quién sigue a tu alcance..." />
      ) : !tieneCuerdas ? (
        <p className="text-xs text-wood-400">
          Necesitas cuerdas (en el inventario) para intentar atar a alguien.
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-wood-500">No hay nadie GRAVE o CONVALECIENTE aquí que puedas atar todavía.</p>
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => (
            <div key={c.npcSlug} className="flex items-center justify-between gap-2 rounded-lg border border-iron-700 p-2.5">
              <Miniatura nombre={c.name} entityType={c.tipo === 'FAUNA' ? 'fauna' : 'npc'} slug={c.npcSlug} icono={c.tipo === 'FAUNA' ? '🐾' : '👤'} />
              <span className="mr-auto text-xs text-wood-200">{c.name}</span>
              <button type="button"
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
      {error && <ErrorCarga mensaje={error} onReintentar={loadError ? reintentar : undefined} />}
    </SelectionModalShell>
  )
}
