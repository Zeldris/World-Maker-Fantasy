import { useEffect, useState } from 'react'
import { SelectionModalShell } from './SelectionModalShell'
import {
  getCombatGroups,
  createCombatGroup,
  renameCombatGroup,
  deleteCombatGroup,
  moveCompanionToCombatGroup,
  type CombatGroupInfo,
} from '../lib/api'

/// Grupos de combate (2026-09-08, diseño de la usuaria: "grupos de 4 con los compañeros... el
/// Grupo 1 siempre estará el PJ a la cabeza... podrás mover tus compañeros entre los diferentes
/// grupos, un poco como las habilidades de combate") — solo el Grupo 1 (slotIndex 0) entra a
/// combate en directo junto al jugador; el resto son "banquillo", organización libre del jugador.
/// Drag&drop HTML5 nativo entre columnas, mismo patrón que SkillBarEditor.tsx (arrastrar entre
/// slots) adaptado a arrastrar entre CONTENEDORES en vez de dentro de uno solo.
export function CombatGroupsModal({ saveId, onClose }: { saveId: string; onClose: () => void }) {
  const [groups, setGroups] = useState<CombatGroupInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragCompanionId, setDragCompanionId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  async function refresh() {
    try {
      const res = await getCombatGroups(saveId)
      setGroups(res.groups)
    } catch {
      setError('No se pudieron cargar los grupos de combate.')
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId])

  async function handleDrop(targetSlotIndex: number) {
    if (dragCompanionId === null) return
    const companionId = dragCompanionId
    setDragCompanionId(null)
    try {
      await moveCompanionToCombatGroup(saveId, companionId, targetSlotIndex)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mover al grupo.')
    }
  }

  async function handleCreate() {
    try {
      await createCombatGroup(saveId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el grupo.')
    }
  }

  async function handleRenameSave(slotIndex: number) {
    const name = renameValue.trim()
    setRenaming(null)
    if (!name) return
    try {
      await renameCombatGroup(saveId, slotIndex, name)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo renombrar el grupo.')
    }
  }

  async function handleDelete(slotIndex: number) {
    try {
      await deleteCombatGroup(saveId, slotIndex)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar el grupo.')
    }
  }

  return (
    <SelectionModalShell title="Grupos de combate" onCancel={onClose}>
      <p className="text-xs leading-relaxed text-wood-400">
        Solo el <span className="font-medium text-accent-300">Grupo 1</span> lucha junto a ti en combate — el resto es banquillo.
        Arrastra a tus compañeros entre grupos para organizarlos.
      </p>

      {error && <p className="text-xs text-danger-400">{error}</p>}

      {groups === null ? (
        <p className="text-xs text-wood-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div
              key={group.slotIndex}
              onDragOver={(e) => {
                if (dragCompanionId !== null) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(group.slotIndex)
              }}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                group.esBase ? 'border-accent-600/60 bg-accent-500/10' : 'border-iron-700 bg-wood-950/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                {renaming === group.slotIndex ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    maxLength={40}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameSave(group.slotIndex)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSave(group.slotIndex)
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    className="rounded border border-iron-700 bg-wood-950/50 px-2 py-1 text-sm text-wood-100 outline-none focus:border-accent-600/60"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(group.slotIndex)
                      setRenameValue(group.name)
                    }}
                    className="tactile text-sm font-medium text-wood-200 hover:text-accent-300"
                    title="Click para renombrar"
                  >
                    {group.esBase && '⚔️ '}
                    {group.name}
                  </button>
                )}
                {!group.esBase && (
                  <button
                    type="button"
                    onClick={() => handleDelete(group.slotIndex)}
                    aria-label={`Borrar ${group.name}`}
                    className="tactile flex h-6 w-6 items-center justify-center rounded-full border border-iron-700 text-xs text-wood-500 transition-colors hover:border-danger-600/60 hover:text-danger-300"
                  >
                    🗑️
                  </button>
                )}
              </div>

              {group.companions.length === 0 ? (
                <p className="mt-2 text-2xs italic text-wood-600">Arrastra un compañero aquí.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.companions.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragCompanionId(c.id)}
                      onDragEnd={() => setDragCompanionId(null)}
                      title="Arrastra para mover a otro grupo"
                      className="tactile flex cursor-grab items-center gap-1.5 rounded-lg border border-iron-700 bg-wood-950/50 px-2.5 py-1.5 text-xs text-wood-200 active:cursor-grabbing"
                    >
                      {c.tipo === 'FAUNA' ? '🐾' : '🤝'} {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={handleCreate}
            className="tactile rounded-lg border border-dashed border-iron-700 px-3 py-2 text-sm text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            + Nuevo grupo
          </button>
        </div>
      )}
    </SelectionModalShell>
  )
}
