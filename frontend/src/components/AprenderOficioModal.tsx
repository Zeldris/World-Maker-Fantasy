import { useState } from 'react'
import { getAprenderOficioMaestros, postAprenderOficio, type AprenderOficioMaestro } from '../lib/api'
import type { LogEntry } from '../types'
import { SelectionModalShell } from './SelectionModalShell'
import { useAsyncModalData } from '../hooks/useAsyncModalData'
import { useSubmitError } from '../hooks/useSubmitError'

interface AprenderOficioModalProps {
  saveId: string
  onAprendido: (professionId: string, costeGoirnos: number, logEntry: LogEntry) => void
  onCancel: () => void
}

/// "Aprender oficio de un Maestro" (2026-08-31, "Trabajador de Reino" — cierra el hueco real de
/// que los oficios solo se sembraban al crear personaje, sin ningún camino en partida). Mismo
/// patrón que EntregaModal.tsx, pero un solo paso — solo hay que elegir CON QUIÉN, el "qué" es fijo
/// (el oficio que enseña ese Maestro concreto). El backend ya resuelve reputación/pago/duplicado y
/// devuelve el motivo exacto de bloqueo, sin que el frontend tenga que reimplementar esa lógica.
export function AprenderOficioModal({ saveId, onAprendido, onCancel }: AprenderOficioModalProps) {
  const [maestros, setMaestros] = useState<AprenderOficioMaestro[]>([])
  const [aprendiendo, setAprendiendo] = useState<string | null>(null)
  const [aprendido, setAprendido] = useState<{ npcName: string; professionId: string } | null>(null)
  const { loading, error: loadError } = useAsyncModalData(
    () => getAprenderOficioMaestros(saveId),
    (res) => setMaestros(res.maestros),
    'No se pudo comprobar quién hay cerca.',
    [saveId],
  )
  const { error: submitError, runCatchingError } = useSubmitError()
  const error = loadError ?? submitError

  async function handleAprender(maestro: AprenderOficioMaestro) {
    setAprendiendo(maestro.npcSlug)
    const res = await runCatchingError(
      () => postAprenderOficio(saveId, maestro.npcSlug),
      'No se pudo aprender el oficio — puede que algo haya cambiado mientras tanto.',
    )
    setAprendiendo(null)
    if (res === undefined) return
    setAprendido({ npcName: maestro.name, professionId: res.professionId })
    onAprendido(res.professionId, maestro.costeGoirnos, res.logEntry)
  }

  return (
    <SelectionModalShell title="Aprender oficio" onCancel={onCancel} cancelDisabled={!!aprendiendo}>
      {aprendido ? (
        <p className="text-xs text-emerald-300">{aprendido.npcName} te enseña su oficio.</p>
      ) : loading ? (
        <p className="text-xs text-wood-500">Comprobando quién hay cerca...</p>
      ) : maestros.length === 0 ? (
        <p className="text-xs text-wood-500">No hay ningún Maestro de oficio aquí.</p>
      ) : (
        <div className="space-y-2">
          {maestros.map((maestro) => (
            <div key={maestro.npcSlug} className="flex items-center justify-between gap-2 rounded-lg border border-iron-700 p-2.5">
              <div>
                <p className="text-xs text-wood-200">{maestro.name}</p>
                <p className="mt-0.5 text-2xs text-wood-500">
                  {maestro.yaAprendido ? 'Ya conoces este oficio.' : maestro.motivoBloqueo ?? `Cuesta 🪙 ${maestro.costeGoirnos}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAprender(maestro)}
                disabled={!!aprendiendo || !maestro.puedeAprender}
                className="tactile shrink-0 rounded-lg border border-accent-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aprendiendo === maestro.npcSlug ? 'Aprendiendo...' : 'Aprender'}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </SelectionModalShell>
  )
}
