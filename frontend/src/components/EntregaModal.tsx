import { useState } from 'react'
import { getEntregables, postEntregar, type EntregableNpc } from '../lib/api'
import type { LogEntry } from '../types'
import { SelectionModalShell } from './SelectionModalShell'
import { useAsyncModalData } from '../hooks/useAsyncModalData'
import { useSubmitError } from '../hooks/useSubmitError'
import { CargandoModal, ErrorCarga, ExitoModal } from './EstadosModal'

interface EntregaModalProps {
  saveId: string
  onEntregado: (itemId: string, logEntry: LogEntry) => void
  onCancel: () => void
}

/// Entrega real de un objeto a un NPC (2026-08-31, mecánica real — antes solo existía la
/// mitigación de coherencia `hasFalseItemGivenAway`, narrador.ts: bloqueaba que la narración
/// PROMETIERA una entrega, sin ningún camino real de cumplirla). Mismo patrón que
/// `CapturaModal.tsx`: mutación 100% determinista sin narración de por medio, endpoint dedicado.
///
/// Dos pasos en vez de dos selectores a la vez (decisión explícita: "botón dedicado con selección
/// explícita") — primero el objeto, luego a quién, mismo criterio de fricción mínima que el resto
/// de modales de este proyecto (un paso a la vez, nunca un formulario con varios campos sueltos).
export function EntregaModal({ saveId, onEntregado, onCancel }: EntregaModalProps) {
  const [items, setItems] = useState<{ id: string; name: string; description: string }[]>([])
  const [npcs, setNpcs] = useState<EntregableNpc[]>([])
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string } | null>(null)
  const [entregando, setEntregando] = useState<string | null>(null)
  const [entregado, setEntregado] = useState<{ npcName: string; itemName: string } | null>(null)
  const { loading, error: loadError, reintentar } = useAsyncModalData(
    () => getEntregables(saveId),
    (res) => {
      setItems(res.items)
      setNpcs(res.npcs)
    },
    'No se pudo comprobar qué llevas encima ni quién hay cerca.',
    [saveId],
  )
  const { error: submitError, runCatchingError } = useSubmitError()
  const error = loadError ?? submitError

  async function handleEntregar(npc: EntregableNpc) {
    if (!selectedItem) return
    setEntregando(npc.npcSlug)
    const res = await runCatchingError(
      () => postEntregar(saveId, npc.npcSlug, selectedItem.id),
      'No se pudo entregar — puede que ya no lo lleves encima o que ya no esté aquí.',
    )
    setEntregando(null)
    if (res === undefined) return
    setEntregado({ npcName: npc.name, itemName: res.itemName })
    onEntregado(selectedItem.id, res.logEntry)
  }

  return (
    <SelectionModalShell title="Entregar" onCancel={onCancel} cancelDisabled={!!entregando}>
      {entregado ? (
        <ExitoModal>
          Le entregas {entregado.itemName} a {entregado.npcName}.
        </ExitoModal>
      ) : loading ? (
        <CargandoModal texto="Comprobando qué llevas encima..." />
      ) : items.length === 0 ? (
        <p className="text-xs text-wood-500">No llevas nada que puedas entregar (desequípalo primero si lo llevas puesto).</p>
      ) : npcs.length === 0 ? (
        <p className="text-xs text-wood-500">No hay nadie aquí a quien entregarle algo.</p>
      ) : !selectedItem ? (
        <div className="space-y-2">
          <p className="text-2xs text-wood-500">¿Qué le entregas?</p>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedItem({ id: item.id, name: item.name })}
              className="tactile flex w-full items-center justify-between gap-2 rounded-lg border border-iron-700 p-2.5 text-left text-xs text-wood-200 transition-colors hover:border-accent-600/60"
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <button type="button" onClick={() => setSelectedItem(null)} className="text-2xs text-wood-500 underline hover:text-wood-300">
            ← elegir otro objeto
          </button>
          <p className="text-2xs text-wood-500">¿A quién le entregas {selectedItem.name}?</p>
          {npcs.map((npc) => (
            <div key={npc.npcSlug} className="flex items-center justify-between gap-2 rounded-lg border border-iron-700 p-2.5">
              <span className="text-xs text-wood-200">{npc.name}</span>
              <button
                type="button"
                onClick={() => handleEntregar(npc)}
                disabled={!!entregando}
                className="tactile shrink-0 rounded-lg border border-accent-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {entregando === npc.npcSlug ? 'Entregando...' : 'Entregar'}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <ErrorCarga mensaje={error} onReintentar={loadError ? reintentar : undefined} />}
    </SelectionModalShell>
  )
}
