import { useCallback, useEffect, useState } from 'react'
import type { AlmacenItemInfo, InventoryItemInfo } from '../../../types'
import { PanelSection } from '../../PanelSection'
import { NumeroGuardable } from '../../NumeroGuardable'
import { ErrorBanner } from '../../ErrorBanner'
import { useErrorConReintento } from '../../../hooks/useErrorConReintento'
import { depositarEnAlmacen, retirarDeAlmacen, getAlmacenLimites, setAlmacenLimite, type AlmacenLimiteInfo } from '../../../lib/api'
import { agruparAlmacen, proporcionTope } from '../../../lib/almacen'
import { useModoConsulta } from '../../../context/useModoConsulta'

/// Almacén de Reino (§6-7) — pool de objetos separado de la mochila personal. Depositar mueve un
/// objeto SIN equipar de la mochila al Almacén (y dispara el auto-equipo del backend); Retirar
/// hace el camino contrario, sin equiparlo en nadie.
///
/// REI-40/REI-41 (hito 0.1, R9/R20/R22) — una fila por recurso con su cantidad (no una por unidad),
/// *Retirar 1* y, desplegadas, las unidades sueltas; y el tope de cada recurso junto a su stock
/// (barra `cantidad / tope` editable), en vez de en la pestaña de Producción.
export function AlmacenSection({
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
  // UX-5 (hito 0.2) — modo consulta: lo que cambia datos se deshabilita con el motivo.
  const consulta = useModoConsulta()
  const [busy, setBusy] = useState<string | null>(null)
  const [limites, setLimites] = useState<AlmacenLimiteInfo[] | null>(null)
  const { fallo, informar, limpiar } = useErrorConReintento()
  const depositable = inventory.filter((i) => !i.slot && !i.companionId && !i.subjectId)
  const grupos = agruparAlmacen(almacenItems)

  // P225 — si falla la carga de los topes se avisa con Reintentar (los topes quedan sin cargar).
  const cargarLimites = useCallback(() => {
    getAlmacenLimites(saveId)
      .then((res) => setLimites(res.limites))
      .catch((e) => informar('No se pudieron cargar los topes del almacén.', e, cargarLimites))
  }, [saveId, informar])

  useEffect(() => {
    cargarLimites()
  }, [cargarLimites])

  async function handleDepositar(itemId: string) {
    setBusy(itemId)
    try {
      await depositarEnAlmacen(saveId, itemId)
      await onRefreshSave()
    } catch (e) {
      informar('No se pudo depositar el objeto en el almacén.', e, () => void handleDepositar(itemId))
    } finally {
      setBusy(null)
    }
  }

  async function handleRetirar(almacenItemId: string) {
    setBusy(almacenItemId)
    try {
      await retirarDeAlmacen(saveId, almacenItemId)
      await onRefreshSave()
    } catch (e) {
      informar('No se pudo retirar el objeto del almacén.', e, () => void handleRetirar(almacenItemId))
    } finally {
      setBusy(null)
    }
  }

  async function handleTope(catalogSlug: string, limite: number | null): Promise<boolean> {
    setBusy(`tope:${catalogSlug}`)
    try {
      await setAlmacenLimite(saveId, catalogSlug, limite)
      const res = await getAlmacenLimites(saveId)
      setLimites(res.limites)
      return true
    } catch (e) {
      informar('No se pudo cambiar el tope del almacén.', e, () => void handleTope(catalogSlug, limite))
      return false
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelSection title={`Almacén de Reino${almacenItems.length > 0 ? ` · ${almacenItems.length} objetos` : ''}`}>
      <div className="flex flex-col gap-3">
        <ErrorBanner fallo={fallo} onCerrar={limpiar} />
        {grupos.length === 0 ? (
          <p className="text-xs text-wood-500">Vacío — deposita objetos aquí para que se auto-equipen en súbditos/compañeros con plantilla asignada.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {grupos.map((g) => {
              const cantidad = g.unidades.length
              const tope = g.catalogSlug ? (limites?.find((l) => l.catalogSlug === g.catalogSlug)?.limite ?? null) : null
              const proporcion = proporcionTope(cantidad, tope)
              const primera = g.unidades[0]
              return (
                <div key={g.clave} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-wood-200">{g.nombre}</span>
                    <span className="font-mono text-xs tabular-nums text-accent2-300" aria-label={`${cantidad} unidades`}>
                      ×{cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRetirar(primera.id)}
                      disabled={busy === primera.id || !!consulta}
                      title={consulta ?? undefined}
                      className="tactile shrink-0 rounded border border-iron-700 px-2 py-1 text-2xs text-wood-400 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === primera.id ? '...' : cantidad > 1 ? 'Retirar 1' : 'Retirar'}
                    </button>
                  </div>
                  {g.catalogSlug && (
                    <div className="mt-1.5 flex items-center gap-2 text-2xs text-wood-500">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-iron-800"
                        role="meter"
                        aria-label={`${g.nombre}: ${cantidad} de ${tope ?? 'sin tope'}`}
                        aria-valuemin={0}
                        aria-valuemax={tope ?? cantidad}
                        aria-valuenow={cantidad}
                      >
                        <div
                          className={`h-full rounded-full ${proporcion === 1 ? 'bg-amber-500' : 'bg-accent2-500'}`}
                          style={{ width: `${(proporcion ?? 0) * 100}%` }}
                        />
                      </div>
                      <label className="flex items-center gap-1" title="Al llegar al tope, los trabajadores dejan de producir este recurso y pasan a la siguiente orden. Vacío = sin tope.">
                        tope
                        <NumeroGuardable
                          ariaLabel={`Tope de ${g.nombre}`}
                          valor={tope}
                          min={1}
                          permitirVacio
                          placeholder="∞"
                          disabled={busy === `tope:${g.catalogSlug}` || limites === null}
                          onGuardar={(v) => handleTope(g.catalogSlug!, v)}
                          className="w-14 rounded border border-iron-700 bg-wood-950/80 px-1.5 py-0.5 text-center text-2xs text-wood-200"
                        />
                      </label>
                    </div>
                  )}
                  {cantidad > 1 && (
                    <details className="mt-1 text-2xs">
                      <summary className="cursor-pointer text-wood-500 hover:text-accent-300">Ver unidades sueltas</summary>
                      <div className="mt-1 flex flex-col gap-1">
                        {g.unidades.map((u) => (
                          <div key={u.id} className="flex items-center justify-between gap-2 pl-2">
                            <span className="truncate text-wood-400">{u.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRetirar(u.id)}
                              disabled={busy === u.id || !!consulta}
                              title={consulta ?? undefined}
                              className="tactile shrink-0 rounded border border-iron-700 px-1.5 py-0.5 text-wood-400 hover:text-accent-300 disabled:opacity-50"
                            >
                              {busy === u.id ? '...' : 'Retirar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {depositable.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-wood-400 hover:text-accent-300">Depositar desde la mochila</summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {depositable.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
                  <span className="truncate text-xs text-wood-200">
                    {item.name}
                    {/* P215: la comida que ninguna receta pide se suma a la Comida del Reino (10 de hambre = 1) y no queda en el almacén. */}
                    {item.pasaAComidaDelReino ? <span className="ml-1 text-wood-400">(pasa a la Comida del Reino)</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDepositar(item.id)}
                    disabled={busy === item.id || !!consulta}
                    title={consulta ?? undefined}
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
