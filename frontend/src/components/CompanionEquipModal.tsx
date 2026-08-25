import { useState } from 'react'
import type { CompanionInfo, EquipSlot, InventoryItemInfo } from '../types'
import { setCompanionItemSlot } from '../lib/api'
import { isCompatibleWithSlot, SLOT_LABEL } from '../lib/equipSlots'
import { SelectionModalShell } from './SelectionModalShell'

// Grupo 3 § Compañeros y supervivencia (2026-08-25, docs/rpgtarkor/companeros-y-supervivencia.md
// § 6) — "ranuras reducidas" de fauna simplificadas a un set fijo (mismo criterio consciente que
// ya documenta companeros.ts § FAUNA_EQUIP_SLOTS en el backend: el doc pedía variar por tamaño,
// aquí se queda un único set para todas). NPC compañero usa el set completo, igual que el jugador.
const FAUNA_SLOTS: EquipSlot[] = ['CASCO', 'ARMADURA_SUPERIOR', 'ACCESORIO']
const NPC_SLOTS: EquipSlot[] = [
  'CASCO', 'CAMISA', 'ARMADURA_SUPERIOR', 'GUANTES', 'ARMADURA_INFERIOR', 'ACCESORIO', 'BOTAS',
  'ARMA_PRINCIPAL', 'ARMA_SECUNDARIA', 'ANILLO_1', 'ANILLO_2', 'CINTURON',
  'CONSUMIBLE_1', 'CONSUMIBLE_2', 'CONSUMIBLE_3', 'CONSUMIBLE_4', 'CONSUMIBLE_5', 'CONSUMIBLE_6',
]

interface CompanionEquipModalProps {
  saveId: string
  companion: CompanionInfo
  inventory: InventoryItemInfo[]
  onClose: () => void
  onChanged: () => Promise<void>
}

/// Equipo de compañero — mismo mecanismo que el equipo del jugador (un objeto por ranura,
/// familia compatible por `equipSlotFamily`), pero lista en vez de paperdoll (pocas ranuras
/// reales para fauna, no vale la pena el layout anatómico).
export function CompanionEquipModal({ saveId, companion, inventory, onClose, onChanged }: CompanionEquipModalProps) {
  const [pickingSlot, setPickingSlot] = useState<EquipSlot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slots = companion.tipo === 'FAUNA' ? FAUNA_SLOTS : NPC_SLOTS
  const equippedHere = inventory.filter((i) => i.companionId === companion.id)
  const unequipped = inventory.filter((i) => !i.slot && !i.companionId && !i.subjectId)

  async function handleEquip(slot: EquipSlot, itemId: string | null) {
    setBusy(true)
    setError(null)
    try {
      await setCompanionItemSlot(saveId, companion.id, itemId ?? equippedHere.find((i) => i.slot === slot)!.id, itemId ? slot : null)
      setPickingSlot(null)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo equipar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SelectionModalShell title={`Equipo de ${companion.name}`} onCancel={onClose} cancelDisabled={busy}>
      {pickingSlot ? (
        <div className="flex flex-col gap-2">
          <p className="text-2xs text-wood-500">Elige qué equipar en {SLOT_LABEL[pickingSlot]}:</p>
          {unequipped.filter((i) => isCompatibleWithSlot(i, pickingSlot)).length === 0 ? (
            <p className="text-xs text-wood-500">No tienes nada compatible sin equipar en la mochila.</p>
          ) : (
            unequipped
              .filter((i) => isCompatibleWithSlot(i, pickingSlot))
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleEquip(pickingSlot, item.id)}
                  disabled={busy}
                  className="tactile rounded-lg border border-iron-700 px-3 py-2 text-left text-xs text-wood-200 transition-colors hover:border-accent-600/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {item.name}
                </button>
              ))
          )}
          <button onClick={() => setPickingSlot(null)} disabled={busy} className="tactile text-2xs text-wood-500 underline">
            Volver
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {slots.map((slot) => {
            const equipped = equippedHere.find((i) => i.slot === slot)
            return (
              <div key={slot} className="flex items-center justify-between gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-2xs text-wood-500">{SLOT_LABEL[slot]}</p>
                  <p className="truncate text-xs text-wood-200">{equipped?.name ?? '— vacío —'}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {equipped && (
                    <button
                      onClick={() => handleEquip(slot, null)}
                      disabled={busy}
                      className="tactile rounded border border-iron-700 px-2 py-1 text-2xs text-wood-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  )}
                  <button
                    onClick={() => setPickingSlot(slot)}
                    disabled={busy}
                    className="tactile rounded border border-accent-600/60 px-2 py-1 text-2xs text-accent-300 hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {equipped ? 'Cambiar' : 'Equipar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </SelectionModalShell>
  )
}
