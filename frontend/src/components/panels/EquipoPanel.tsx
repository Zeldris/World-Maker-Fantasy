import { useEffect, useRef, useState } from 'react'
import type { EquipSlot, InventoryItemInfo } from '../../types'
import { TooltipAnchor } from '../TooltipAnchor'
import { SLOT_ORDER, SLOT_LABEL, CONSUMIBLE_SLOTS } from '../../lib/equipSlots'

// Ranuras del paperdoll anatómico de siempre — separadas de CONSUMIBLE_SLOTS (fila propia debajo,
// sin sitio en la silueta) para no meter 6 huecos más dentro de `gridTemplateAreas`.
const PAPERDOLL_SLOTS = SLOT_ORDER.filter((s) => !(CONSUMIBLE_SLOTS as EquipSlot[]).includes(s))

interface EquipoPanelProps {
  items: InventoryItemInfo[]
  onSlotClick: (slot: EquipSlot, equipped: InventoryItemInfo | undefined) => void
}

const SLOT_ICON: Record<EquipSlot, string> = {
  CASCO: '🪖',
  ABALORIO: '📿',
  CAMISA: '👕',
  ARMADURA_SUPERIOR: '🥋',
  GUANTES: '🧤',
  ARMADURA_INFERIOR: '👖',
  ACCESORIO: '🔮',
  BOTAS: '👢',
  ARMA_PRINCIPAL: '⚔️',
  ARMA_SECUNDARIA: '🗡️',
  ANILLO_1: '💍',
  ANILLO_2: '💍',
  CINTURON: '🎗️',
  CONSUMIBLE_1: '🧪',
  CONSUMIBLE_2: '🧪',
  CONSUMIBLE_3: '🧪',
  CONSUMIBLE_4: '🧪',
  CONSUMIBLE_5: '🧪',
  CONSUMIBLE_6: '🧪',
}

// Disposición anatómica (roadmap de rediseño de paneles, Fable 2026-07-20/21): cabeza arriba,
// armas a los extremos como brazos extendidos, torso apilado en el centro, piernas/botas abajo.
// Rejilla CSS pura — sin silueta dibujada, la propia disposición ya comunica "cuerpo".
// `Partial` (2026-07-30): los 6 huecos de consumible no tienen sitio en la silueta anatómica,
// viven en su propia fila flex debajo — a propósito sin entrada aquí.
const SLOT_AREA: Partial<Record<EquipSlot, string>> = {
  CASCO: 'casco',
  ABALORIO: 'abalorio',
  ARMA_PRINCIPAL: 'armaP',
  GUANTES: 'guantes',
  CAMISA: 'camisa',
  ACCESORIO: 'accesorio',
  ARMA_SECUNDARIA: 'armaS',
  ANILLO_1: 'anillo1',
  CINTURON: 'cinturon',
  ANILLO_2: 'anillo2',
  ARMADURA_INFERIOR: 'inferior',
  BOTAS: 'botas',
  ARMADURA_SUPERIOR: 'superior',
}

interface PaperdollSlotProps {
  slot: EquipSlot
  equipped: InventoryItemInfo | undefined
  onClick: () => void
  /// Ausente para los huecos de consumible (2026-07-30) — viven en su propia fila flex debajo del
  /// paperdoll, no en `gridTemplateAreas` (no tienen sitio anatómico real).
  gridArea?: string
}

// Celda por hueco, separada en su propio componente (mismo motivo que antes — roadmap de
// animaciones 2026-07-20, item 9): necesita su propio ref de "equipado anterior" para saber si un
// cambio de props es una acción real de equipar/quitar (flash + pop) o solo la primera vez que se
// pinta al abrir el panel. Lógica de `justChanged` copiada literal del `SlotRow` anterior — es lo
// único que no se podía perder al pasar de fila ancha a celda cuadrada.
function PaperdollSlot({ slot, equipped, onClick, gridArea }: PaperdollSlotProps) {
  const prevIdRef = useRef(equipped?.id ?? null)
  const [justChanged, setJustChanged] = useState(false)

  useEffect(() => {
    const prevId = prevIdRef.current
    const nextId = equipped?.id ?? null
    if (prevId !== nextId) {
      setJustChanged(true)
      prevIdRef.current = nextId
      const timer = setTimeout(() => setJustChanged(false), 700)
      return () => clearTimeout(timer)
    }
  }, [equipped?.id])

  return (
    <div style={gridArea ? { gridArea } : undefined} className="relative min-w-0">
      <TooltipAnchor text={equipped ? equipped.description : `${SLOT_LABEL[slot]} — vacío`} className="block h-full min-w-0">
        <button
          onClick={onClick}
          className="tactile relative flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-iron-700 bg-wood-950/40 px-1.5 py-2.5 text-center transition-colors hover:border-accent-600/60 hover:bg-accent-500/10"
        >
          {justChanged && (
            <span aria-hidden="true" className="animate-edge-flash-accent pointer-events-none absolute inset-0 rounded-lg border border-accent-400" />
          )}
          <span key={equipped?.id ?? 'empty'} className={`text-xl leading-none ${justChanged ? 'animate-pop-once' : 'opacity-90'}`}>
            {SLOT_ICON[slot]}
          </span>
          <span className={`w-full truncate text-2xs leading-tight ${equipped ? 'text-wood-100' : 'text-wood-600 italic'}`}>
            {equipped ? equipped.name : SLOT_LABEL[slot]}
          </span>
        </button>
      </TooltipAnchor>
    </div>
  )
}

export function EquipoPanel({ items, onSlotClick }: EquipoPanelProps) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div
        className="grid w-full gap-2.5"
        style={{
          gridTemplateColumns: 'repeat(5, 1fr)',
          gridTemplateAreas: `
            ".      .        casco      .          ."
            ".      .        abalorio   .          ."
            "armaP  guantes  camisa     accesorio  armaS"
            "armaP  guantes  superior   accesorio  armaS"
            ".      anillo1  cinturon   anillo2    ."
            ".      .        inferior   .          ."
            ".      .        botas      .          ."
          `,
          gridAutoRows: '4.5rem',
        }}
      >
        {PAPERDOLL_SLOTS.map((slot) => {
          const equipped = items.find((i) => i.slot === slot)
          return <PaperdollSlot key={slot} slot={slot} equipped={equipped} gridArea={SLOT_AREA[slot]} onClick={() => onSlotClick(slot, equipped)} />
        })}
      </div>

      {/* Consumibles de combate (2026-07-30, petición explícita: "raciones y cataplasma
          catalogalo como Consumible que tendrá 6 slots en equipo donde podrás añadir los
          consumibles que quieres usar en el combate") — fila propia, sin sitio anatómico: lo que
          se equipa aquí es justo lo que aparece como "Tus objetos" dentro de un combate
          (GameView.tsx, ya no cualquier objeto suelto sin ranura de la mochila entera). */}
      <div>
        <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Consumibles de combate</p>
        <div className="grid grid-cols-6 gap-2">
          {CONSUMIBLE_SLOTS.map((slot) => {
            const equipped = items.find((i) => i.slot === slot)
            return (
              <div key={slot} className="aspect-square">
                <PaperdollSlot slot={slot} equipped={equipped} onClick={() => onSlotClick(slot, equipped)} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
