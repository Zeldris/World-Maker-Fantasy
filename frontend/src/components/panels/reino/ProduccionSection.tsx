import { useEffect, useState } from 'react'
import type { AlmacenItemInfo, BuildingInfo, CompanionInfo, ProfessionRecipeInfo } from '../../../types'
import {
  type OrdenProduccionInfo,
  type AlmacenLimiteInfo,
  getOrdenesProduccion,
  crearOrdenProduccion,
  actualizarOrdenProduccion,
  asignarCompanionABuilding,
  getAlmacenLimites,
  setAlmacenLimite,
} from '../../../lib/api'
import { PanelEmptyState } from '../../PanelEmptyState'
import { SelectionModalShell, confirmButtonClasses } from '../../SelectionModalShell'

interface ProduccionSectionProps {
  saveId: string
  buildings: BuildingInfo[]
  companions: CompanionInfo[]
  almacenItems: AlmacenItemInfo[]
  professionRecipes: ProfessionRecipeInfo[]
  onRefreshSave: () => Promise<void>
}

/// Sub-tab "Producción" del Reino (Fase 2, 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4-ter) —
/// estilo Bellwright: por edificio, trabajadores asignados + órdenes de producción con prioridad
/// 0-9 y un botón "✕" para desactivar (nunca borrar) — mismo lenguaje visual que Job Priorities de
/// Bellwright. El motor de tick (`kingdomProduction.ts`) ya corre cada día de ficción; hasta este
/// panel no había ninguna forma real de crear una orden o asignar un trabajador.
export function ProduccionSection({ saveId, buildings, companions, almacenItems, professionRecipes, onRefreshSave }: ProduccionSectionProps) {
  // Solo edificios de reino (Ayuntamiento/Choza/Cuartel...) son candidatos a producir — mismo
  // criterio que `requiresAyuntamiento` del catálogo, aproximado aquí sin importar construction.ts
  // al cliente: cualquier edificio ya construido puede tener trabajadores/órdenes reales.
  const edificiosDeReino = buildings.filter((b) => b.status === 'ACTIVO')
  const companionesReino = companions.filter((c) => c.rolReino)

  if (edificiosDeReino.length === 0) {
    return (
      <PanelEmptyState
        icon="⚙️"
        title="Sin edificios activos todavía"
        hint="Construye y activa un edificio de Reino para poder asignarle trabajadores y órdenes de producción."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {edificiosDeReino.map((building) => (
        <BuildingProduccionCard
          key={building.id}
          saveId={saveId}
          building={building}
          companionesReino={companionesReino}
          professionRecipes={professionRecipes}
          onRefreshSave={onRefreshSave}
        />
      ))}
      <AlmacenLimitesCard saveId={saveId} almacenItems={almacenItems} onRefreshSave={onRefreshSave} />
    </div>
  )
}

const recipeLabel = (recipeKey: string, professionRecipes: ProfessionRecipeInfo[]): string =>
  professionRecipes.find((r) => r.recipeKey === recipeKey)?.ability.name ?? recipeKey

function BuildingProduccionCard({
  saveId,
  building,
  companionesReino,
  professionRecipes,
  onRefreshSave,
}: {
  saveId: string
  building: BuildingInfo
  companionesReino: CompanionInfo[]
  professionRecipes: ProfessionRecipeInfo[]
  onRefreshSave: () => Promise<void>
}) {
  const [ordenes, setOrdenes] = useState<OrdenProduccionInfo[] | null>(null)
  const [nuevaOrdenAbierta, setNuevaOrdenAbierta] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const trabajadores = companionesReino.filter((c) => c.buildingId === building.id)

  async function reload() {
    const res = await getOrdenesProduccion(saveId, building.id)
    setOrdenes(res.ordenes)
  }

  useEffect(() => {
    let cancelado = false
    getOrdenesProduccion(saveId, building.id)
      .then((res) => {
        if (!cancelado) setOrdenes(res.ordenes)
      })
      .catch(() => {
        if (!cancelado) setOrdenes([])
      })
    return () => {
      cancelado = true
    }
  }, [saveId, building.id])

  async function handlePrioridadChange(ordenId: string, prioridad: number) {
    setBusy(ordenId)
    try {
      await actualizarOrdenProduccion(saveId, ordenId, { prioridad })
      await reload()
    } finally {
      setBusy(null)
    }
  }

  async function handleDesactivar(ordenId: string) {
    setBusy(ordenId)
    try {
      await actualizarOrdenProduccion(saveId, ordenId, { activa: false })
      await reload()
    } finally {
      setBusy(null)
    }
  }

  async function handleAsignarTrabajador(companionId: string, asignar: boolean) {
    setBusy(companionId)
    try {
      await asignarCompanionABuilding(saveId, companionId, asignar ? building.id : null)
      await onRefreshSave()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-3">
      <p className="font-medium text-wood-100">{building.name}</p>

      <p className="mt-2 text-2xs uppercase tracking-wide text-wood-500">Trabajadores</p>
      {companionesReino.length === 0 ? (
        <p className="mt-1 text-2xs text-wood-500">Sin compañeros integrados en el Reino (asígnales un rol en Súbditos).</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {companionesReino.map((c) => {
            const asignadoAqui = c.buildingId === building.id
            const asignadoAOtro = c.buildingId != null && c.buildingId !== building.id
            return (
              <button
                type="button"
                key={c.id}
                disabled={busy === c.id}
                onClick={() => handleAsignarTrabajador(c.id, !asignadoAqui)}
                title={asignadoAOtro ? 'Asignado a otro edificio — clic para moverlo aquí' : undefined}
                className={`tactile rounded-full border px-2.5 py-1 text-2xs transition-colors disabled:opacity-50 ${
                  asignadoAqui
                    ? 'border-accent-600/70 bg-accent-600/10 text-accent-200'
                    : 'border-iron-700 bg-wood-950/60 text-wood-400 hover:border-accent-600/40'
                }`}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-3 text-2xs uppercase tracking-wide text-wood-500">Órdenes de producción</p>
      {ordenes === null ? (
        <p className="mt-1 text-2xs text-wood-500">Cargando…</p>
      ) : (
        <div className="mt-1 flex flex-col gap-1.5">
          {ordenes.filter((o) => o.activa).length === 0 && trabajadores.length === 0 && (
            <p className="text-2xs text-wood-500">Sin órdenes activas.</p>
          )}
          {ordenes
            .filter((o) => o.activa)
            .map((o) => (
              <div key={o.id} className="flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/60 px-2.5 py-1.5">
                <span className="flex-1 truncate text-xs text-wood-200">{recipeLabel(o.recipeKey, professionRecipes)}</span>
                <span className="text-2xs text-wood-500">{o.modo === 'unico' ? 'único' : 'reponer'}</span>
                <label className="flex items-center gap-1 text-2xs text-wood-500">
                  prioridad
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={o.prioridad}
                    disabled={busy === o.id}
                    onChange={(e) => handlePrioridadChange(o.id, Math.max(0, Math.min(9, Number(e.target.value))))}
                    className="w-12 rounded border border-iron-700 bg-wood-950/80 px-1.5 py-0.5 text-center text-2xs text-wood-200"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleDesactivar(o.id)}
                  disabled={busy === o.id}
                  title="Desactivar (no borra — se puede reactivar creando la misma orden de nuevo)"
                  className="tactile shrink-0 text-2xs text-wood-500 hover:text-danger-300 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setNuevaOrdenAbierta(true)}
        className="tactile mt-2 self-start rounded-lg border border-accent-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10"
      >
        + Nueva orden
      </button>

      {nuevaOrdenAbierta && (
        <NuevaOrdenModal
          professionRecipes={professionRecipes.filter((r) => r.recipeCategory === 'crafteo')}
          onCancel={() => setNuevaOrdenAbierta(false)}
          onCrear={async (params) => {
            await crearOrdenProduccion(saveId, building.id, params)
            setNuevaOrdenAbierta(false)
            await reload()
          }}
        />
      )}
    </div>
  )
}

function NuevaOrdenModal({
  professionRecipes,
  onCancel,
  onCrear,
}: {
  professionRecipes: ProfessionRecipeInfo[]
  onCancel: () => void
  onCrear: (params: { recipeKey: string; modo: 'unico' | 'reponer'; limite: number | null; prioridad: number }) => Promise<void>
}) {
  const [recipeKey, setRecipeKey] = useState(professionRecipes[0]?.recipeKey ?? '')
  const [modo, setModo] = useState<'unico' | 'reponer'>('reponer')
  const [limite, setLimite] = useState<string>('')
  const [prioridad, setPrioridad] = useState(5)
  const [creando, setCreando] = useState(false)

  async function handleCrear() {
    if (!recipeKey) return
    setCreando(true)
    try {
      await onCrear({ recipeKey, modo, limite: limite.trim() ? Number(limite) : null, prioridad })
    } finally {
      setCreando(false)
    }
  }

  return (
    <SelectionModalShell
      title="Nueva orden de producción"
      onCancel={onCancel}
      cancelDisabled={creando}
      footer={
        <button type="button" onClick={handleCrear} disabled={!recipeKey || creando} className={confirmButtonClasses('accent')}>
          {creando ? 'Creando…' : 'Crear'}
        </button>
      }
    >
      {professionRecipes.length === 0 ? (
        <p className="text-xs text-wood-500">No hay recetas de crafteo conocidas todavía.</p>
      ) : (
        <>
          <select
            value={recipeKey}
            onChange={(e) => setRecipeKey(e.target.value)}
            className="w-full rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-xs text-wood-200"
          >
            {professionRecipes.map((r) => (
              <option key={r.recipeKey} value={r.recipeKey}>
                {r.ability.name}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-2xs text-wood-500">
              Modo
              <select
                value={modo}
                onChange={(e) => setModo(e.target.value as 'unico' | 'reponer')}
                className="rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-xs text-wood-200"
              >
                <option value="reponer">Reponer (repite mientras haya hueco)</option>
                <option value="unico">Único (produce el lote y se desactiva)</option>
              </select>
            </label>
            <label className="flex w-24 flex-col gap-1 text-2xs text-wood-500">
              Límite
              <input
                type="number"
                min={1}
                placeholder="sin tope"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
                className="rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-xs text-wood-200"
              />
            </label>
            <label className="flex w-20 flex-col gap-1 text-2xs text-wood-500">
              Prioridad
              <input
                type="number"
                min={0}
                max={9}
                value={prioridad}
                onChange={(e) => setPrioridad(Math.max(0, Math.min(9, Number(e.target.value))))}
                className="rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-xs text-wood-200"
              />
            </label>
          </div>
        </>
      )}
    </SelectionModalShell>
  )
}

function AlmacenLimitesCard({ saveId, almacenItems, onRefreshSave }: { saveId: string; almacenItems: AlmacenItemInfo[]; onRefreshSave: () => Promise<void> }) {
  const [limites, setLimites] = useState<AlmacenLimiteInfo[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    getAlmacenLimites(saveId)
      .then((res) => {
        if (!cancelado) setLimites(res.limites)
      })
      .catch(() => {
        if (!cancelado) setLimites([])
      })
    return () => {
      cancelado = true
    }
  }, [saveId])

  // Stock actual agrupado por catalogSlug (dato ya disponible vía almacenItems, sin llamada nueva).
  const stockPorSlug = new Map<string, { name: string; count: number }>()
  for (const item of almacenItems) {
    if (!item.catalogSlug) continue
    const existing = stockPorSlug.get(item.catalogSlug)
    if (existing) existing.count += 1
    else stockPorSlug.set(item.catalogSlug, { name: item.name, count: 1 })
  }

  async function handleLimiteChange(catalogSlug: string, valor: string) {
    setBusy(catalogSlug)
    try {
      const limite = valor.trim() ? Number(valor) : null
      await setAlmacenLimite(saveId, catalogSlug, limite)
      const res = await getAlmacenLimites(saveId)
      setLimites(res.limites)
      await onRefreshSave()
    } finally {
      setBusy(null)
    }
  }

  if (stockPorSlug.size === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-3">
      <p className="font-medium text-wood-100">Topes de Almacén</p>
      <p className="mt-1 text-2xs text-wood-500">Cuando un recurso alcanza su tope, el trabajador deja de producirlo y pasa a la siguiente orden con hueco.</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {[...stockPorSlug.entries()].map(([slug, { name, count }]) => {
          const limiteActual = limites?.find((l) => l.catalogSlug === slug)?.limite ?? null
          return (
            <div key={slug} className="flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/60 px-2.5 py-1.5">
              <span className="flex-1 truncate text-xs text-wood-200">{name}</span>
              <span className="text-2xs font-mono text-wood-500">{count}</span>
              <label className="flex items-center gap-1 text-2xs text-wood-500">
                tope
                <input
                  type="number"
                  min={1}
                  placeholder="∞"
                  defaultValue={limiteActual ?? ''}
                  disabled={busy === slug}
                  onBlur={(e) => handleLimiteChange(slug, e.target.value)}
                  className="w-14 rounded border border-iron-700 bg-wood-950/80 px-1.5 py-0.5 text-center text-2xs text-wood-200"
                />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
