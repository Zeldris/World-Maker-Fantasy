import { useEffect, useRef, useState } from 'react'
import type { EquipSlot, InventoryItemInfo } from '../../types'
import { TooltipAnchor } from '../TooltipAnchor'

interface EquipoPanelProps {
  items: InventoryItemInfo[]
  onSlotClick: (slot: EquipSlot, equipped: InventoryItemInfo | undefined) => void
}

export const SLOT_ORDER: EquipSlot[] = [
  'CASCO',
  'ABALORIO',
  'CAMISA',
  'ARMADURA_SUPERIOR',
  'GUANTES',
  'ARMADURA_INFERIOR',
  'ACCESORIO',
  'BOTAS',
  'ARMA_PRINCIPAL',
  'ARMA_SECUNDARIA',
  'ANILLO_1',
  'ANILLO_2',
  'CINTURON',
]

export const SLOT_LABEL: Record<EquipSlot, string> = {
  CASCO: 'Casco',
  ABALORIO: 'Abalorio',
  CAMISA: 'Camisa',
  ARMADURA_SUPERIOR: 'Armadura superior',
  GUANTES: 'Guantes',
  ARMADURA_INFERIOR: 'Armadura inferior',
  ACCESORIO: 'Accesorio',
  BOTAS: 'Botas',
  ARMA_PRINCIPAL: 'Arma principal',
  ARMA_SECUNDARIA: 'Arma secundaria',
  ANILLO_1: 'Anillo 1',
  ANILLO_2: 'Anillo 2',
  CINTURON: 'Cinturón',
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
}

// Disposición anatómica (roadmap de rediseño de paneles, Fable 2026-07-20/21): cabeza arriba,
// armas a los extremos como brazos extendidos, torso apilado en el centro, piernas/botas abajo.
// Rejilla CSS pura — sin silueta dibujada, la propia disposición ya comunica "cuerpo".
const SLOT_AREA: Record<EquipSlot, string> = {
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
}

// Celda por hueco, separada en su propio componente (mismo motivo que antes — roadmap de
// animaciones 2026-07-20, item 9): necesita su propio ref de "equipado anterior" para saber si un
// cambio de props es una acción real de equipar/quitar (flash + pop) o solo la primera vez que se
// pinta al abrir el panel. Lógica de `justChanged` copiada literal del `SlotRow` anterior — es lo
// único que no se podía perder al pasar de fila ancha a celda cuadrada.
function PaperdollSlot({ slot, equipped, onClick }: PaperdollSlotProps) {
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
    <div style={{ gridArea: SLOT_AREA[slot] }} className="relative min-w-0">
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
    <div
      className="mx-auto grid w-full max-w-lg gap-2.5"
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
      {SLOT_ORDER.map((slot) => {
        const equipped = items.find((i) => i.slot === slot)
        return <PaperdollSlot key={slot} slot={slot} equipped={equipped} onClick={() => onSlotClick(slot, equipped)} />
      })}
    </div>
  )
}
