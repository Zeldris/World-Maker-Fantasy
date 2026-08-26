import { useState } from 'react'
import type { AlmacenItemInfo, BuildingInfo, CompanionInfo, EquipSlot, InventoryItemInfo, KingdomStatsInfo, PlantillaEquipoInfo, SubjectInfo, TerritoryInfo } from '../../types'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { depositarEnAlmacen, retirarDeAlmacen, crearPlantilla, borrarPlantilla, asignarPlantillaCompanion, asignarPlantillaSubject } from '../../lib/api'
import { SLOT_LABEL, SLOT_ORDER } from '../../lib/equipSlots'

interface ReinoPanelProps {
  saveId: string
  kingdomName: string | null
  characterMotivation: string | null
  territories: TerritoryInfo[]
  buildings: BuildingInfo[]
  subjects: SubjectInfo[]
  companions: CompanionInfo[]
  /// Economía de Reino (sesión de diseño 2026-07-23) — null hasta fundar el primer Territory.
  kingdomStats: KingdomStatsInfo | null
  /// Bug real (auditoría de deuda técnica 2026-08-04): cancelar el popup de fundación (o recargar
  /// la página con él abierto) perdía la única oportunidad de nombrar el reino para siempre — no
  /// había ningún sitio para volver a intentarlo. undefined = no reabrir (no debería pasar en la
  /// práctica, GameView siempre lo pasa).
  onFundarReino?: () => void
  /// Grupo 3 § Compañeros y supervivencia (2026-08-25) — Almacén de Reino + Plantillas de equipo.
  inventory: InventoryItemInfo[]
  almacenItems: AlmacenItemInfo[]
  plantillasEquipo: PlantillaEquipoInfo[]
  onRefreshSave: () => Promise<void>
}

const KINGDOM_STAT_LABEL: Record<keyof KingdomStatsInfo, string> = {
  poblacion: 'Población',
  felicidad: 'Felicidad',
  comida: 'Comida',
  bebida: 'Bebida',
  riqueza: 'Riqueza',
  soldados: 'Soldados',
  trabajadores: 'Trabajadores',
  visitantes: 'Visitantes',
}

const controlLabel: Record<TerritoryInfo['control'], string> = {
  RECLAMADO: 'Reclamado',
  DISPUTADO: 'Disputado',
  CONSOLIDADO: 'Consolidado',
  PERDIDO: 'Perdido',
}

const buildingStatusLabel: Record<BuildingInfo['status'], string> = {
  EN_CONSTRUCCION: 'En construcción',
  ACTIVO: 'Activo',
  DANADO: 'Dañado',
  ABANDONADO: 'Abandonado',
}

// Nivel del Ayuntamiento (2026-08-04, docs/17-reglas-construcciones-reino.md) — 'ayuntamiento' es
// la única receta con tiers; el resto de construcciones no muestra nada aquí.
const AYUNTAMIENTO_TIER_LABEL: Record<number, string> = {
  1: 'pequeño',
  2: 'mediano',
  3: 'grande',
}

export function ReinoPanel({
  saveId,
  kingdomName,
  characterMotivation,
  territories,
  buildings,
  subjects,
  companions,
  kingdomStats,
  onFundarReino,
  inventory,
  almacenItems,
  plantillasEquipo,
  onRefreshSave,
}: ReinoPanelProps) {
  const isEmpty = territories.length === 0 && buildings.length === 0 && subjects.length === 0
  const ayuntamiento = buildings.find((b) => b.recipeKey === 'ayuntamiento')

  if (isEmpty) {
    return (
      <PanelEmptyState
        icon="🏰"
        title="Todavía no gobierna a nadie"
        hint={
          characterMotivation ??
          'Ni tierra, ni súbditos, ni edificios propios — todavía. Lo que consiga a lo largo de la partida aparecerá aquí.'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {kingdomName ? (
        <p className="font-serif text-lg tracking-wide text-accent2-300">{kingdomName}</p>
      ) : (
        ayuntamiento &&
        onFundarReino && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent-600/50 bg-accent-600/10 px-3.5 py-2.5">
            <p className="text-xs leading-relaxed text-wood-300">Tu Ayuntamiento sigue sin nombre de reino.</p>
            <button
              onClick={onFundarReino}
              className="tactile shrink-0 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-wood-950 transition-colors"
            >
              Fundar reino
            </button>
          </div>
        )
      )}

      {kingdomStats && (
        <PanelSection title="Economía">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {(Object.keys(KINGDOM_STAT_LABEL) as Array<keyof KingdomStatsInfo>).map((key) => (
              <div key={key} className="rounded-lg border border-iron-700 bg-wood-950/40 px-2.5 py-2 text-center">
                <p className="text-2xs uppercase tracking-wide text-wood-500">{KINGDOM_STAT_LABEL[key]}</p>
                <p className="font-mono text-sm tabular-nums text-accent2-300">{kingdomStats[key]}</p>
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {territories.length > 0 && (
        <PanelSection title="Territorios">
          <div className="flex flex-col gap-2">
            {territories.map((t) => (
              <div key={t.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="flex items-center justify-between font-medium text-wood-100">
                  {t.name}
                  <span className="rounded-full border border-iron-700 px-2 py-0.5 text-2xs uppercase tracking-wide text-wood-400">
                    {controlLabel[t.control]}
                  </span>
                </p>
                {t.region && <p className="mt-0.5 text-2xs text-wood-500">{t.region}</p>}
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{t.description}</p>
                {t.population > 0 && (
                  <p className="mt-1 text-2xs text-wood-500">Población: {t.population}</p>
                )}
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {buildings.length > 0 && (
        <PanelSection title="Edificios">
          <div className="flex flex-col gap-2">
            {buildings.map((b) => (
              <div key={b.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="flex items-center justify-between font-medium text-wood-100">
                  {b.name}
                  <span className="rounded-full border border-iron-700 px-2 py-0.5 text-2xs uppercase tracking-wide text-wood-400">
                    {buildingStatusLabel[b.status]}
                  </span>
                </p>
                <p className="mt-0.5 text-2xs text-wood-500">
                  {b.kind}
                  {b.recipeKey === 'ayuntamiento' && b.tier && ` · Ayuntamiento ${AYUNTAMIENTO_TIER_LABEL[b.tier] ?? b.tier}`}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{b.description}</p>
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {subjects.length > 0 && (
        <PanelSection title="Súbditos">
          <div className="flex flex-col gap-2">
            {subjects.map((s) => (
              <div key={s.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="font-medium text-wood-100">
                  {s.name} <span className="font-sans text-xs text-wood-500">— {s.role}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{s.notes}</p>
                {plantillasEquipo.length > 0 && (
                  <PlantillaSelect
                    value={s.plantillaEquipoId}
                    plantillas={plantillasEquipo}
                    onChange={async (id) => {
                      await asignarPlantillaSubject(saveId, s.id, id)
                      await onRefreshSave()
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      <AlmacenSection saveId={saveId} inventory={inventory} almacenItems={almacenItems} onRefreshSave={onRefreshSave} />
      <PlantillasSection
        saveId={saveId}
        plantillasEquipo={plantillasEquipo}
        companions={companions}
        onRefreshSave={onRefreshSave}
      />
    </div>
  )
}

/// Selector compartido de plantilla — súbdito o compañero integrado en el Reino, mismo desplegable.
function PlantillaSelect({
  value,
  plantillas,
  onChange,
}: {
  value: string | null
  plantillas: PlantillaEquipoInfo[]
  onChange: (id: string | null) => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="mt-2 w-full rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1 text-2xs text-wood-300"
    >
      <option value="">Sin plantilla</option>
      {plantillas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.rol})
        </option>
      ))}
    </select>
  )
}

/// Almacén de Reino (§6-7) — pool de objetos separado de la mochila personal. Depositar mueve un
/// objeto SIN equipar de la mochila al Almacén (y dispara el auto-equipo del backend); Retirar
/// hace el camino contrario, sin equiparlo en nadie.
function AlmacenSection({
  saveId,
  inventory,
  almacenItems,
  onRefreshSave,
}: {
  saveId: string
  inventory: InventoryItemInfo[]
  almacenItems: AlmacenItemInfo[]
  onRefreshSave: () => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const depositable = inventory.filter((i) => !i.slot && !i.companionId && !i.subjectId)

  async function handleDepositar(itemId: string) {
    setBusy(itemId)
    try {
      await depositarEnAlmacen(saveId, itemId)
      await onRefreshSave()
    } finally {
      setBusy(null)
    }
  }

  async function handleRetirar(almacenItemId: string) {
    setBusy(almacenItemId)
    try {
      await retirarDeAlmacen(saveId, almacenItemId)
      await onRefreshSave()
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelSection title="Almacén de Reino">
      <div className="flex flex-col gap-3">
        {almacenItems.length === 0 ? (
          <p className="text-xs text-wood-500">Vacío — deposita objetos aquí para que se auto-equipen en súbditos/compañeros con plantilla asignada.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {almacenItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
                <span className="truncate text-xs text-wood-200">{item.name}</span>
                <button
                  onClick={() => handleRetirar(item.id)}
                  disabled={busy === item.id}
                  className="tactile shrink-0 rounded border border-iron-700 px-2 py-1 text-2xs text-wood-400 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === item.id ? '...' : 'Retirar'}
                </button>
              </div>
            ))}
          </div>
        )}

        {depositable.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-wood-400 hover:text-accent-300">Depositar desde la mochila</summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {depositable.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
                  <span className="truncate text-xs text-wood-200">{item.name}</span>
                  <button
                    onClick={() => handleDepositar(item.id)}
                    disabled={busy === item.id}
                    className="tactile shrink-0 rounded border border-accent-600/60 px-2 py-1 text-2xs text-accent-300 hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === item.id ? '...' : 'Depositar'}
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </PanelSection>
  )
}

const CATEGORIA_LIBRE_PLACEHOLDER = 'ej. arma-cuerpo-a-cuerpo'

/// Plantillas de equipo (§7) — creación simplificada: nombre/rol/prioridad + una lista de filas
/// ranura→categoría (el mismo criterio de match que ya usa crafting/construcción, ver
/// `IngredientMatch`, aquí solo por categoría, no por catalogSlug exacto, para mantener el
/// formulario simple). Asignación a un compañero abre directo desde su tarjeta (CompanerosPanel);
/// aquí solo se listan/crean/borran.
function PlantillasSection({
  saveId,
  plantillasEquipo,
  companions,
  onRefreshSave,
}: {
  saveId: string
  plantillasEquipo: PlantillaEquipoInfo[]
  companions: CompanionInfo[]
  onRefreshSave: () => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [rol, setRol] = useState('guardia')
  const [prioridad, setPrioridad] = useState(0)
  const [rows, setRows] = useState<{ slot: EquipSlot; category: string }[]>([{ slot: 'ARMA_PRINCIPAL', category: '' }])
  const [busy, setBusy] = useState(false)

  function addRow() {
    setRows((prev) => [...prev, { slot: 'ARMA_PRINCIPAL', category: '' }])
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleCrear() {
    const slots: PlantillaEquipoInfo['slots'] = {}
    for (const row of rows) {
      if (row.category.trim()) slots[row.slot] = { category: row.category.trim() }
    }
    if (!name.trim() || Object.keys(slots).length === 0) return
    setBusy(true)
    try {
      await crearPlantilla(saveId, { name: name.trim(), rol, prioridad, slots })
      setName('')
      setRows([{ slot: 'ARMA_PRINCIPAL', category: '' }])
      setCreating(false)
      await onRefreshSave()
    } finally {
      setBusy(false)
    }
  }

  async function handleBorrar(id: string) {
    setBusy(true)
    try {
      await borrarPlantilla(saveId, id)
      await onRefreshSave()
    } finally {
      setBusy(false)
    }
  }

  const companionesReino = companions.filter((c) => c.rolReino)

  return (
    <PanelSection title="Plantillas de equipo">
      <div className="flex flex-col gap-2">
        {plantillasEquipo.length === 0 && !creating && <p className="text-xs text-wood-500">Sin plantillas todavía.</p>}
        {plantillasEquipo.map((p) => (
          <div key={p.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-wood-100">
                {p.name} <span className="font-sans text-2xs text-wood-500">— {p.rol}, prioridad {p.prioridad}</span>
              </p>
              {p.personalizada ? (
                <button onClick={() => handleBorrar(p.id)} disabled={busy} className="tactile shrink-0 text-2xs text-wood-500 hover:text-red-300 disabled:opacity-50">
                  Borrar
                </button>
              ) : (
                <span className="shrink-0 text-2xs text-wood-600" title="Plantilla básica, no editable">
                  básica
                </span>
              )}
            </div>
            <p className="mt-1 text-2xs text-wood-500">
              {Object.entries(p.slots)
                .map(([slot, m]) => `${SLOT_LABEL[slot as EquipSlot] ?? slot}: ${m.category ?? m.catalogSlug}`)
                .join(' · ')}
            </p>
          </div>
        ))}

        {companionesReino.length > 0 && plantillasEquipo.length > 0 && (
          <div className="mt-1 flex flex-col gap-1.5">
            <p className="text-2xs text-wood-500">Compañeros integrados en el Reino:</p>
            {companionesReino.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-xs text-wood-300">
                <span>{c.name}</span>
                <PlantillaSelect
                  value={c.plantillaEquipoId}
                  plantillas={plantillasEquipo}
                  onChange={async (id) => {
                    await asignarPlantillaCompanion(saveId, c.id, id)
                    await onRefreshSave()
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {creating ? (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-iron-700 bg-wood-950/40 p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-xs text-wood-200"
            />
            <div className="flex gap-2">
              <input
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                placeholder="rol (guardia/trabajador/productor)"
                className="flex-1 rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-xs text-wood-200"
              />
              <input
                type="number"
                value={prioridad}
                onChange={(e) => setPrioridad(Number(e.target.value))}
                className="w-20 rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-xs text-wood-200"
              />
            </div>
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={row.slot}
                  onChange={(e) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, slot: e.target.value as EquipSlot } : r)))}
                  className="rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-2xs text-wood-200"
                >
                  {SLOT_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {SLOT_LABEL[s]}
                    </option>
                  ))}
                </select>
                <input
                  value={row.category}
                  onChange={(e) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, category: e.target.value } : r)))}
                  placeholder={CATEGORIA_LIBRE_PLACEHOLDER}
                  className="flex-1 rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-2xs text-wood-200"
                />
                {rows.length > 1 && (
                  <button onClick={() => removeRow(i)} className="tactile text-2xs text-wood-500 hover:text-red-300">
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button onClick={addRow} className="tactile self-start text-2xs text-accent-300 hover:underline">
              + ranura
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleCrear}
                disabled={busy}
                className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-wood-950 disabled:opacity-50"
              >
                Crear
              </button>
              <button onClick={() => setCreating(false)} disabled={busy} className="tactile flex-1 rounded-lg border border-iron-700 px-3 py-1.5 text-2xs text-wood-300">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="tactile self-start rounded-lg border border-accent-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10"
          >
            + Nueva plantilla
          </button>
        )}
      </div>
    </PanelSection>
  )
}
