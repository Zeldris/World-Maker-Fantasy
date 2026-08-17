import { useEffect, useState } from 'react'
import { getSaquearZona, type LootZoneCandidate } from '../lib/api'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

interface SaquearZonaModalProps {
  saveId: string
  /// A diferencia de Volver al campamento/Viajar (que solo devuelven texto para el turno normal),
  /// saquear necesita mandar `lootItemNames` aparte y `enCombate: true` — mismo criterio EXACTO que
  /// ya usa `handleSaquearSeleccion` en combate, incluso con el combate ya terminado (evita el
  /// atajo de un único objetivo citado en texto libre, pensado para uno solo, no para un barrido).
  onConfirm: (actionText: string, lootItemNames: string[]) => void
  onCancel: () => void
}

/// Pop-up de "Saquear" fuera de combate (2026-08-17, comentario de startingAbilities.ts: "que
/// funcione igual que saquear de un combate, detectando los npcs muertos/convalecientes de la zona
/// y con los objetos que no hemos saqueado en el combate") — mismo patrón de casillas que ya usa
/// CombatPanel.tsx, aplanado aquí a un único listado (sin la UI de turnos/ataque que no aplica
/// fuera de combate).
export function SaquearZonaModal({ saveId, onConfirm, onCancel }: SaquearZonaModalProps) {
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<LootZoneCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set()) // `${npcSlug}::${itemName}` (o `${npcSlug}::__marcar__` para un NPC sin objetos)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    getSaquearZona(saveId)
      .then((res) => setCandidates(res.candidates))
      .catch(() => setError('No se pudo comprobar qué hay que saquear en la zona.'))
      .finally(() => setLoading(false))
  }, [saveId])

  function toggle(npcSlug: string, itemName: string) {
    const key = `${npcSlug}::${itemName}`
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleConfirmar() {
    if (selected.size === 0) return
    const npcNames = new Set<string>()
    const itemNames: string[] = []
    for (const key of selected) {
      const [npcSlug, itemName] = key.split('::')
      const npc = candidates.find((c) => c.slug === npcSlug)
      if (npc) npcNames.add(npc.name)
      // `__marcar__` (auditoría de código 2026-08-17): sentinela para un NPC sin objetos de
      // catálogo (p. ej. un PRINCIPAL sin loadout definido) — solo necesita quedar nombrado en el
      // texto para que el motor lo marque como registrado, no hay ningún nombre de objeto real que
      // mandar.
      if (itemName !== '__marcar__') itemNames.push(itemName)
    }
    setConfirming(true)
    onConfirm(`Registro los cuerpos de: ${[...npcNames].join(', ')}.`, itemNames)
  }

  return (
    <SelectionModalShell
      title="Saquear la zona"
      onCancel={onCancel}
      cancelDisabled={confirming}
      footer={
        candidates.length > 0 && (
          <button onClick={handleConfirmar} disabled={confirming || selected.size === 0} className={confirmButtonClasses('accent')}>
            {confirming ? 'Saqueando...' : 'Saquear seleccionados'}
          </button>
        )
      }
    >
      {loading ? (
        <p className="text-xs text-wood-500">Buscando cuerpos por la zona...</p>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-wood-500">No hay nadie por aquí que aún tenga algo que saquear.</p>
      ) : (
        <div className="space-y-3">
          {candidates.map((npc) => {
            const disponibles = npc.items.filter((i) => !npc.lootedItemNames.includes(i.name))
            // Sin objetos reales que ofrecer (2026-08-17: un NPC con loadout de catálogo vacío,
            // p. ej. un PRINCIPAL social, se quedaba sin ninguna fila que marcarlo — reaparecía
            // para siempre en este listado porque nunca llegaba nombrado al motor de turnos).
            if (disponibles.length === 0) {
              return (
                <div key={npc.slug} className="rounded-lg border border-iron-700 p-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-wood-300">
                    <input
                      type="checkbox"
                      checked={selected.has(`${npc.slug}::__marcar__`)}
                      onChange={() => toggle(npc.slug, '__marcar__')}
                      className="accent-accent-500"
                    />
                    <span>
                      <span className="font-semibold text-wood-100">{npc.name}</span>
                      <span className="ml-1.5 text-wood-500">— nada que llevarse, marcar como registrado</span>
                    </span>
                  </label>
                </div>
              )
            }
            return (
              <div key={npc.slug} className="rounded-lg border border-iron-700 p-2.5">
                <p className="mb-1.5 text-xs font-semibold text-wood-100">{npc.name}</p>
                <div className="space-y-1">
                  {disponibles.map((item) => (
                    <label key={item.name} className="flex cursor-pointer items-center gap-2 text-xs text-wood-300">
                      <input
                        type="checkbox"
                        checked={selected.has(`${npc.slug}::${item.name}`)}
                        onChange={() => toggle(npc.slug, item.name)}
                        className="accent-accent-500"
                      />
                      {item.name}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SelectionModalShell>
  )
}
