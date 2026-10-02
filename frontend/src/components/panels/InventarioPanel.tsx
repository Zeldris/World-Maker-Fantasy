import { useState } from 'react'
import type { InventoryItemInfo, ItemTipo } from '../../types'
import { statBonusLabels } from '../../lib/dice'
import { ITEM_TIPO_LABEL, ITEM_TIPO_ORDER, itemIcon } from '../../lib/enciclopediaTargets'
import { totalInventoryUnits } from '../../lib/inventoryCapacity'
import { postDepositarCaptura, postSoltarCaptura } from '../../lib/api'
import { useSubmitError } from '../../hooks/useSubmitError'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { IconCard } from '../IconCard'
import { useModoConsulta } from '../../context/useModoConsulta'

interface InventarioPanelProps {
  saveId: string
  items: InventoryItemInfo[]
  /// Goirnos que lleva el jugador (2026-08-31, "Trabajador de Reino" — moneda única de Berig).
  goirnos: number
  /// Capacidad real de inventario (rediseño de profesiones, 2026-08-07) — base + Fuerza/
  /// Constitución + bonus de cosméticos equipados (ver lib/inventoryCapacity.ts).
  capacity: number
  onUse: (item: InventoryItemInfo) => void
  onDetail: (item: InventoryItemInfo) => void
  /// Tras depositar/soltar una captura, el estado real viene del backend (mismo patrón que
  /// CompanerosPanel.tsx — resincroniza la partida entera en vez de reconstruir a mano).
  onRefreshSave: () => Promise<void>
}

/// Captura en tránsito (rediseño de captura, 2026-08-28, docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md
/// § 2) — `capturaNpcId` no null. Sección propia, separada del `ItemGrid` genérico: a diferencia de
/// un objeto normal, "usarla" no tiene sentido (no se puede insertar como chip narrativo) — sus
/// únicas acciones son Depositar (en Jaula, solo fauna hoy — NPC espera la Celda de Retención,
/// pausada) y Soltar (libera en cualquier momento, mismo criterio que confirmado ronda 3 del diseño).
function CapturasEnTransito({ saveId, items, onRefreshSave }: { saveId: string; items: InventoryItemInfo[]; onRefreshSave: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const { error, runCatchingError } = useSubmitError()
  // UX-5 (hito 0.2) — depositar/soltar cambian datos: no mientras el panel está en modo consulta.
  const consulta = useModoConsulta()

  async function handleDepositar(item: InventoryItemInfo) {
    setBusyId(item.id)
    await runCatchingError(() => postDepositarCaptura(saveId, item.id), 'No se pudo depositar — puede que no tengas ninguna Jaula con hueco libre.')
    await onRefreshSave()
    setBusyId(null)
  }

  async function handleSoltar(item: InventoryItemInfo) {
    setBusyId(item.id)
    await runCatchingError(() => postSoltarCaptura(saveId, item.id), 'No se pudo soltar.')
    await onRefreshSave()
    setBusyId(null)
  }

  return (
    <PanelSection title="Capturas en tránsito">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-accent-700/50 bg-wood-950/40 p-2.5">
            <div>
              <p className="text-xs text-wood-200">🪢 {item.name}</p>
              <p className="mt-0.5 text-2xs text-wood-500">{item.description}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button type="button"
                onClick={() => handleDepositar(item)}
                disabled={busyId === item.id || !!consulta}
                title={consulta ?? undefined}
                className="tactile rounded-lg border border-accent-600/60 px-2.5 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === item.id ? '...' : 'Depositar'}
              </button>
              <button type="button"
                onClick={() => handleSoltar(item)}
                disabled={busyId === item.id || !!consulta}
                title={consulta ?? undefined}
                className="tactile rounded-lg border border-danger-700/60 px-2.5 py-1.5 text-2xs font-bold uppercase tracking-wide text-danger-300 transition-colors hover:bg-danger-600/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Soltar
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-2xs text-red-400">{error}</p>}
    </PanelSection>
  )
}

function ItemGrid({ items, onUse, onDetail }: Pick<InventarioPanelProps, 'items' | 'onUse' | 'onDetail'>) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <IconCard
          key={item.id}
          // Bug real jugando en vivo (2026-08-07): un objeto equipado mostraba SIEMPRE el mismo
          // icono de espadas cruzadas, sin importar qué fuera de verdad — "Raciones de viaje" o
          // "Tótem Maktor" equipados salían con icono de arma. El badge "E" de abajo ya distingue
          // "equipado" visualmente; el icono debe reflejar el objeto real siempre, tipo o no.
          icon={item.tipo === 'ESPECIAL' ? '✨' : itemIcon(item.category ?? '')}
          name={item.name}
          tooltip={item.effectDescription ?? item.description}
          onUse={() => onUse(item)}
          onDetail={() => onDetail(item)}
          badge={
            <>
              {item.slot && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-moss-600 bg-wood-950 text-2xs font-bold leading-none text-moss-400"
                >
                  E
                </span>
              )}
              {/* Objeto especial (2026-08-03, `tipo: ESPECIAL`) — marca aparte, diferenciada del
                  resto, para no perderlo entre el resto de la mochila; el efecto completo vive en
                  DetailModal.tsx. */}
              {item.tipo === 'ESPECIAL' && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-quest-600 bg-wood-950 text-2xs leading-none text-quest-400"
                >
                  ✨
                </span>
              )}
            </>
          }
          extra={
            <>
              {Object.entries(item.statBonuses ?? {}).map(
                ([attribute, amount]) =>
                  !!amount && (
                    <span key={attribute} className="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent-300">
                      +{amount} {statBonusLabels[attribute] ?? attribute}
                    </span>
                  ),
              )}
              {/* Tier > 1 (sesión de diseño 2026-07-23) — tier 1 es común, no se resalta. */}
              {!!item.tier && item.tier > 1 && (
                <span className="rounded-full border border-accent2-600/50 bg-accent2-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent2-300">
                  Nivel {item.tier}
                </span>
              )}
            </>
          }
        />
      ))}
    </div>
  )
}

// Agrupación por tipo mecánico (2026-07-29, categorización de objetos) — antes este panel no
// agrupaba nada, un grid plano sin distinguir equipables/consumibles/recursos/materiales. Los
// equipados se quedan en su propia sección arriba (petición explícita de siempre, "equipados
// primero") porque cruzan varios tipos a la vez (un arma y una armadura equipadas no deberían
// separarse solo por eso); el resto se agrupa por tipo, igual que ya hace la Enciclopedia.
export function InventarioPanel({ saveId, items, goirnos, capacity, onUse, onDetail, onRefreshSave }: InventarioPanelProps) {
  // Bug real jugando en vivo (2026-08-08, "podemos tener inventario infinito"): esto contaba
  // filas, no unidades — una pila de 9 piedras aparentaba pesar 1 solo hueco. Ver
  // `totalInventoryUnits` (lib/inventoryCapacity.ts).
  const usedUnits = totalInventoryUnits(items)
  // C.14 (checklist frontend 2026-08-27) — antes solo 2 estados (rojo al límite exacto, gris el
  // resto), sin aviso de que ya casi no cabe nada más. Mismo escalón intermedio que B.23
  // (EstadisticasPanel: hambre/sed) — amber al 80%, rojo ya lleno.
  const capacityRatio = capacity > 0 ? usedUnits / capacity : 0
  const capacityLabel = (
    <div className="flex items-center justify-between gap-2">
      <p className={`text-2xs ${usedUnits >= capacity ? 'text-red-400' : capacityRatio >= 0.8 ? 'text-amber-400' : 'text-wood-500'}`}>
        Capacidad: {usedUnits}/{capacity} objetos
      </p>
      <p className="text-2xs font-semibold text-quest-400" title="Goirnos — moneda de Berig, acuñada por los Goirntes">
        🪙 {goirnos}
      </p>
    </div>
  )

  // Captura en tránsito (2026-08-28) — sección propia, ver CapturasEnTransito arriba. Excluida del
  // resto del panel (ItemGrid normal) porque sus acciones no son "usar"/"detalle" como cualquier
  // objeto, son Depositar/Soltar.
  const capturas = items.filter((i) => i.capturaNpcId)
  const restoItems = items.filter((i) => !i.capturaNpcId)

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {capacityLabel}
        <PanelEmptyState
          icon="🎒"
          title="La mochila está vacía"
          hint="Lo que consigas o fabriques durante la partida aparecerá aquí."
        />
      </div>
    )
  }

  const equipped = restoItems.filter((i) => i.slot)
  const unequipped = restoItems.filter((i) => !i.slot)
  const byTipo = new Map<string, InventoryItemInfo[]>()
  for (const item of unequipped) {
    // C.15 (checklist frontend 2026-08-27, revisado): esto no es un hueco de catálogo — `tipo` es
    // opcional por diseño en objetos narrativos sueltos que la IA inventa sobre la marcha, sin
    // `catalogSlug` ni fila real en ItemCatalog que consultar (ver types.ts). El grupo es esperado.
    const key = item.tipo ?? 'sin-categorizar'
    const group = byTipo.get(key) ?? []
    group.push(item)
    byTipo.set(key, group)
  }
  const orderedTipos = [
    ...ITEM_TIPO_ORDER.filter((t) => byTipo.has(t)),
    ...(byTipo.has('sin-categorizar') ? ['sin-categorizar'] : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      {capacityLabel}
      {capturas.length > 0 && <CapturasEnTransito saveId={saveId} items={capturas} onRefreshSave={onRefreshSave} />}
      {equipped.length > 0 && (
        <PanelSection title="Equipados">
          <ItemGrid items={equipped} onUse={onUse} onDetail={onDetail} />
        </PanelSection>
      )}
      {orderedTipos.map((tipo) => (
        <PanelSection key={tipo} title={tipo === 'sin-categorizar' ? 'Sin categorizar' : ITEM_TIPO_LABEL[tipo as ItemTipo]}>
          <ItemGrid items={byTipo.get(tipo) ?? []} onUse={onUse} onDetail={onDetail} />
        </PanelSection>
      ))}
    </div>
  )
}
