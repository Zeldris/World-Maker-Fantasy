import { useState } from 'react'
import { CONDICION_LABEL } from '../lib/health'
import type { CondicionFisica, InventoryItemInfo, SavedActionInfo } from '../types'

export interface CombatNpcDisplay {
  slug: string
  name: string
  condicion: Exclude<CondicionFisica, 'MUERTO'>
  yaSaqueado: boolean
}

interface CombatComposerProps {
  npcs: CombatNpcDisplay[]
  combatAbilities: SavedActionInfo[]
  combatItems: InventoryItemInfo[]
  busy: boolean
  ended: boolean
  onSubmit: (action: string, opts: { targetSlug?: string; savedActionId?: string }) => void
  onHuir: () => void
  onRegistrar: (npc: CombatNpcDisplay) => void
  onContinue: () => void
}

/// Composer de combate (rework 2026-07-24, petición explícita: "en vez de un popup que se abre
/// aparte...que el log de personaje donde se narra, se sustituya por el log de combate"). Antes
/// vivía dentro de CombatModal.tsx como overlay con su propio log de strings planos, duplicando
/// (peor, sin chips/banner/roll) lo que characterLog+LogPanel ya renderizan de verdad — cada
/// narración de combate ya se guarda ahí vía handleCombatTurnResolved. Este componente sustituye
/// solo al ChatComposer normal mientras dura el combate; el log de arriba no cambia de componente,
/// solo de contenido (la propia narración de combate que ya recibe).
export function CombatComposer({ npcs, combatAbilities, combatItems, busy, ended, onSubmit, onHuir, onRegistrar, onContinue }: CombatComposerProps) {
  const [selectedNpcSlug, setSelectedNpcSlug] = useState<string | null>(npcs[0]?.slug ?? null)
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')

  const selectedNpc = npcs.find((n) => n.slug === selectedNpcSlug) ?? null
  const selectedAbility = combatAbilities.find((a) => a.id === selectedAbilityId) ?? null
  const selectedItem = combatItems.find((i) => i.id === selectedItemId) ?? null

  function resetSelection() {
    setFreeText('')
    setSelectedAbilityId(null)
    setSelectedItemId(null)
  }

  function handleAttack() {
    if (!selectedAbility) return
    const base = selectedAbility.promptText.trim().replace(/\.+$/, '')
    const action = selectedNpc ? `${base} '${selectedNpc.name}'.` : selectedAbility.promptText
    onSubmit(action, { targetSlug: selectedNpc?.slug, savedActionId: selectedAbility.id })
    resetSelection()
  }

  // Objetos consumibles (petición explícita, 2026-07-22): siempre de uso propio, nunca contra un
  // NPC objetivo — no se manda targetSlug, así que nunca baja la condición de ningún NPC.
  function handleUseItem() {
    if (!selectedItem) return
    onSubmit(`Uso '${selectedItem.name}'.`, {})
    resetSelection()
  }

  function handleFreeSubmit() {
    if (!freeText.trim()) return
    onSubmit(freeText, {})
    resetSelection()
  }

  return (
    <div className="border-t border-danger-900/50 bg-wood-950/90 px-4 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-serif text-xs uppercase tracking-wide text-danger-400">⚔️ Combate</p>
        {!ended && (
          <button onClick={onHuir} disabled={busy} className="text-2xs text-wood-400 transition-colors hover:text-accent-300 disabled:opacity-50">
            Huir
          </button>
        )}
      </div>

      {/* NPCs y su condición se quedan visibles incluso tras terminar (petición implícita: ver el
          estado final antes de continuar) — mismo comportamiento que tenía CombatModal, solo las
          acciones de abajo cambian entre "en curso" y "terminado". */}
      <div className="mb-2 flex flex-wrap gap-2">
        {npcs.map((npc) => (
          <div
            key={npc.slug}
            role="button"
            tabIndex={busy ? -1 : 0}
            onClick={() => !busy && setSelectedNpcSlug(npc.slug)}
            onKeyDown={(e) => {
              if (!busy && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                setSelectedNpcSlug(npc.slug)
              }
            }}
            className={`tactile cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:opacity-60 ${
              selectedNpcSlug === npc.slug ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/40'
            } ${busy ? 'pointer-events-none opacity-60' : ''}`}
          >
            <p className="font-medium text-wood-100">{npc.name}</p>
            <p className="text-wood-400">{CONDICION_LABEL[npc.condicion]}</p>
            {(npc.condicion === 'GRAVE' || npc.condicion === 'INCAPACITADO') &&
              (npc.yaSaqueado ? (
                <span className="mt-1 inline-block rounded border border-iron-700 px-1.5 py-0.5 text-2xs text-wood-500">Ya saqueado</span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRegistrar(npc)
                  }}
                  disabled={busy}
                  className="tactile mt-1 inline-block rounded border border-accent-600/60 px-1.5 py-0.5 text-2xs text-accent-300 hover:bg-accent-500/10 disabled:opacity-60"
                >
                  Registrar
                </button>
              ))}
          </div>
        ))}
      </div>

      {ended ? (
        <button
          onClick={onContinue}
          className="tactile w-full rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          Continuar
        </button>
      ) : (
        <>
          {busy && <p className="mb-2 text-2xs italic text-wood-500">Resolviendo...</p>}

          {combatAbilities.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {combatAbilities.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedAbilityId(a.id)
                    setSelectedItemId(null)
                  }}
                  disabled={busy}
                  className={`tactile flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                    selectedAbilityId === a.id ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/40'
                  }`}
                >
                  <span>{a.icon}</span> {a.name}
                </button>
              ))}
            </div>
          )}
          {combatItems.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {combatItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedItemId(item.id)
                    setSelectedAbilityId(null)
                  }}
                  disabled={busy}
                  className={`tactile flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                    selectedItemId === item.id ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/40'
                  }`}
                >
                  <span>🎒</span> {item.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !selectedAbility && !selectedItem) handleFreeSubmit()
              }}
              placeholder="O describe tu acción..."
              disabled={busy}
              className="flex-1 rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-sm text-wood-100 outline-none disabled:opacity-50"
            />
            <button
              onClick={() => (selectedAbility ? handleAttack() : selectedItem ? handleUseItem() : handleFreeSubmit())}
              disabled={busy || (!selectedAbility && !selectedItem && !freeText.trim())}
              className="tactile shrink-0 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
            >
              Actuar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
