import { useEffect, useState } from 'react'
import { NumeroGuardable } from '../../NumeroGuardable'
import { SelectorJuego } from '../../SelectorJuego'
import { Esqueleto } from '../../Esqueleto'
import type { AlmacenItemInfo, BuildingInfo, CompanionInfo, ProfessionRecipeInfo } from '../../../types'
import {
  type OrdenProduccionInfo,
  getOrdenesProduccion,
  getRecetasProduccionEdificio,
  crearOrdenProduccion,
  actualizarOrdenProduccion,
  borrarOrdenProduccion,
  asignarCompanionABuilding,
} from '../../../lib/api'
import { PanelEmptyState } from '../../PanelEmptyState'
import { SelectionModalShell, confirmButtonClasses } from '../../SelectionModalShell'
import { ConfirmModal } from '../../ConfirmModal'
import { ErrorBanner } from '../../../components/ErrorBanner'
import { useErrorConReintento } from '../../../hooks/useErrorConReintento'

interface ProduccionSectionProps {
  saveId: string
  buildings: BuildingInfo[]
  companions: CompanionInfo[]
  /// Ya no se usa aquí (los topes pasaron al Almacén, REI-41); se mantiene para no tocar al llamador.
  almacenItems?: AlmacenItemInfo[]
  professionRecipes: ProfessionRecipeInfo[]
  onRefreshSave: () => Promise<void>
}

/// Sub-tab "Producción" del Reino (Fase 2, 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4-ter) —
/// estilo Bellwright: por edificio, trabajadores asignados + órdenes de producción con prioridad
/// 0-9 y un botón para desactivar — mismo lenguaje visual que Job Priorities de Bellwright. Desde
/// REI-33 (2026-10-02) las desactivadas se pueden reactivar o borrar, y el límite de una orden
/// "único" se edita en línea. El motor de tick (`kingdomProduction.ts`) ya corre cada día de ficción; hasta este
/// panel no había ninguna forma real de crear una orden o asignar un trabajador.
export function ProduccionSection({ saveId, buildings, companions, professionRecipes, onRefreshSave }: ProduccionSectionProps) {
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
      {/* REI-41 (hito 0.1, R22) — los topes del Almacén viven ya junto al stock, en Súbditos › Almacén. */}
      <p className="text-2xs text-wood-500">Los topes de cada recurso se ajustan junto a su stock, en Súbditos › Almacén de Reino.</p>
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
  // REI-33 (hito 0.1, R13/R14) — borrar es irreversible: se confirma.
  const [ordenABorrar, setOrdenABorrar] = useState<OrdenProduccionInfo | null>(null)
  const { fallo, informar, limpiar } = useErrorConReintento()
  // Recetas del oficio del edificio (P-3, decisión de Álvaro, 2026-09-29): null = sin filtro
  // (edificio sin oficio, o aún sin cargar/error).
  const [recetasPermitidas, setRecetasPermitidas] = useState<string[] | null>(null)

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
    getRecetasProduccionEdificio(saveId, building.id)
      .then((res) => {
        if (!cancelado) setRecetasPermitidas(res.oficio ? res.recipeKeys : null)
      })
      .catch(() => {
        if (!cancelado) setRecetasPermitidas(null)
      })
    return () => {
      cancelado = true
    }
  }, [saveId, building.id])

  async function handlePrioridadChange(ordenId: string, prioridad: number): Promise<boolean> {
    setBusy(ordenId)
    try {
      await actualizarOrdenProduccion(saveId, ordenId, { prioridad })
      await reload()
      return true
    } catch (e) {
      informar('No se pudo cambiar la prioridad de la orden.', e, () => void handlePrioridadChange(ordenId, prioridad))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleDesactivar(ordenId: string) {
    setBusy(ordenId)
    try {
      await actualizarOrdenProduccion(saveId, ordenId, { activa: false })
      await reload()
    } catch (e) {
      informar('No se pudo desactivar la orden.', e, () => void handleDesactivar(ordenId))
    } finally {
      setBusy(null)
    }
  }

  // REI-33 (hito 0.1, R13/R14) — reactivar una orden desactivada (antes había que crearla de nuevo),
  // editar su límite y borrarla de verdad (`borrarOrdenProduccion` existía sin ningún botón).
  async function handleReactivar(ordenId: string) {
    setBusy(ordenId)
    try {
      await actualizarOrdenProduccion(saveId, ordenId, { activa: true })
      await reload()
    } catch (e) {
      informar('No se pudo reactivar la orden.', e, () => void handleReactivar(ordenId))
    } finally {
      setBusy(null)
    }
  }

  async function handleLimiteOrden(ordenId: string, limite: number | null): Promise<boolean> {
    setBusy(ordenId)
    try {
      await actualizarOrdenProduccion(saveId, ordenId, { limite })
      await reload()
      return true
    } catch (e) {
      informar('No se pudo cambiar el límite de la orden.', e, () => void handleLimiteOrden(ordenId, limite))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleBorrar(ordenId: string) {
    setBusy(ordenId)
    try {
      await borrarOrdenProduccion(saveId, ordenId)
      setOrdenABorrar(null)
      await reload()
    } catch (e) {
      setOrdenABorrar(null)
      informar('No se pudo borrar la orden.', e, () => void handleBorrar(ordenId))
    } finally {
      setBusy(null)
    }
  }

  async function handleAsignarTrabajador(companionId: string, asignar: boolean) {
    setBusy(companionId)
    try {
      await asignarCompanionABuilding(saveId, companionId, asignar ? building.id : null)
      await onRefreshSave()
    } catch (e) {
      informar('No se pudo cambiar el trabajador del edificio.', e, () => void handleAsignarTrabajador(companionId, asignar))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-3">
      <p className="font-medium text-wood-100">{building.name}</p>
      {fallo && <div className="mt-2"><ErrorBanner fallo={fallo} onCerrar={limpiar} /></div>}

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
        <Esqueleto filas={2} que="órdenes de producción" className="mt-1" />
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
                  <NumeroGuardable
                    ariaLabel={`Prioridad de ${recipeLabel(o.recipeKey, professionRecipes)}`}
                    valor={o.prioridad}
                    min={0}
                    max={9}
                    disabled={busy === o.id}
                    onGuardar={(v) => handlePrioridadChange(o.id, v ?? 0)}
                  />
                </label>
                {o.modo === 'unico' && (
                  <label className="flex items-center gap-1 text-2xs text-wood-500" title="Cuántas unidades produce antes de desactivarse sola. Vacío = sin límite.">
                    <span className="font-mono tabular-nums">{o.cantidadProducidaAcumulada}/</span>
                    <NumeroGuardable
                      ariaLabel={`Límite de ${recipeLabel(o.recipeKey, professionRecipes)}`}
                      valor={o.limite}
                      min={1}
                      permitirVacio
                      placeholder="∞"
                      disabled={busy === o.id}
                      onGuardar={(v) => handleLimiteOrden(o.id, v)}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => handleDesactivar(o.id)}
                  disabled={busy === o.id}
                  title="Desactivar (no borra — se reactiva desde «Desactivadas»)"
                  aria-label={`Desactivar ${recipeLabel(o.recipeKey, professionRecipes)}`}
                  className="tactile shrink-0 text-2xs text-wood-500 hover:text-danger-300 disabled:opacity-50"
                >
                  ⏸
                </button>
              </div>
            ))}
          {ordenes.some((o) => !o.activa) && (
            <details className="group rounded-lg border border-iron-700/70 bg-wood-950/30 text-2xs">
              <summary className="tactile flex cursor-pointer select-none items-center gap-1.5 px-2.5 py-1.5 text-wood-500 marker:content-none">
                <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
                Desactivadas ({ordenes.filter((o) => !o.activa).length})
              </summary>
              <div className="flex flex-col gap-1 px-2.5 pb-2">
                {ordenes
                  .filter((o) => !o.activa)
                  .map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-wood-400">{recipeLabel(o.recipeKey, professionRecipes)}</span>
                      <span className="text-wood-600">{o.modo === 'unico' ? 'único' : 'reponer'}</span>
                      <button
                        type="button"
                        onClick={() => handleReactivar(o.id)}
                        disabled={busy === o.id}
                        className="tactile rounded border border-accent-600/50 px-2 py-0.5 text-accent-300 hover:bg-accent-500/10 disabled:opacity-50"
                      >
                        Reactivar
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrdenABorrar(o)}
                        disabled={busy === o.id}
                        className="tactile rounded border border-danger-700/60 px-2 py-0.5 text-danger-300 hover:bg-danger-600/15 disabled:opacity-50"
                      >
                        Borrar
                      </button>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      )}
      {ordenABorrar && (
        <ConfirmModal
          title="Borrar orden de producción"
          message={`Se borrará la orden de ${recipeLabel(ordenABorrar.recipeKey, professionRecipes)} (llevaba ${ordenABorrar.cantidadProducidaAcumulada} producidas). No se puede deshacer.`}
          confirmLabel="Borrar"
          confirming={busy === ordenABorrar.id}
          onCancel={() => setOrdenABorrar(null)}
          onConfirm={() => void handleBorrar(ordenABorrar.id)}
        />
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
          professionRecipes={professionRecipes.filter((r) => r.recipeCategory === 'crafteo' && (!recetasPermitidas || recetasPermitidas.includes(r.recipeKey)))}
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
  const { fallo, informar, limpiar } = useErrorConReintento()

  async function handleCrear() {
    if (!recipeKey) return
    setCreando(true)
    try {
      await onCrear({ recipeKey, modo, limite: limite.trim() ? Number(limite) : null, prioridad })
    } catch (e) {
      informar('No se pudo crear la orden de producción.', e, () => void handleCrear())
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
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
      {professionRecipes.length === 0 ? (
        <p className="text-xs text-wood-500">No hay recetas de crafteo conocidas todavía.</p>
      ) : (
        <>
          <div className="flex flex-col">
            <SelectorJuego
              ariaLabel="Receta"
              value={recipeKey}
              opciones={professionRecipes.map((r) => ({ value: r.recipeKey, label: r.ability.name }))}
              onChange={setRecipeKey}
              className="py-1.5 text-xs"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-2xs text-wood-500">
              Modo
              <SelectorJuego<'unico' | 'reponer'>
                ariaLabel="Modo"
                value={modo}
                opciones={[
                  { value: 'reponer', label: 'Reponer', descripcion: 'Repite mientras haya hueco en el Almacén' },
                  { value: 'unico', label: 'Único', descripcion: 'Produce el lote y se desactiva' },
                ]}
                onChange={setModo}
                className="py-1.5 text-xs"
              />
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

