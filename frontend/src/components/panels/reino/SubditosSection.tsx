import { useEffect, useRef, useState } from 'react'
import type { AlmacenItemInfo, CompanionInfo, EquipSlot, InventoryItemInfo, PlantillaEquipoInfo, SubjectInfo } from '../../../types'
import { PanelSection } from '../../PanelSection'
import { depositarEnAlmacen, retirarDeAlmacen, crearPlantilla, borrarPlantilla, asignarPlantillaCompanion, asignarPlantillaSubject, fijarRolReinoCompanion } from '../../../lib/api'
import { SLOT_LABEL, SLOT_ORDER } from '../../../lib/equipSlots'

/// Selector compartido de plantilla — súbdito o compañero integrado en el Reino, mismo desplegable.
/// Exportado (2026-08-27, auditoría de diseño/UX § 1.3: "cuando `rolReino` no es null, la tarjeta
/// de CompanerosPanel.tsx podría incluir el mismo PlantillaSelect inline... en vez de obligar a
/// cambiar de pestaña") — reutilizado tal cual en CompanerosPanel.tsx, no duplicado. Vivía en
/// ReinoPanel.tsx hasta el rediseño de 2026-09-21 (sub-tabs); ReinoPanel.tsx re-exporta desde aquí
/// para no romper ese import.
///
/// Confirmación visual (2026-08-27, auditoría de diseño/UX § 3.4: "el `<select>` simplemente
/// vuelve a renderizar con el nuevo valor seleccionado — no hay ninguna confirmación visual de que
/// el auto-equipo... se aplicó" — a diferencia de `PaperdollSlot`, que sí tiene flash+pop al
/// cambiar TU propio equipo). Flash breve del borde tras resolver `onChange` (que ya hace el
/// `await asignarPlantilla.../await onRefreshSave()` real en cada caller) — mismo "pop counter"
/// que el resto de la app, nunca al montar.
export function PlantillaSelect({
  value,
  plantillas,
  onChange,
}: {
  value: string | null
  plantillas: PlantillaEquipoInfo[]
  onChange: (id: string | null) => void | Promise<void>
}) {
  const [confirmed, setConfirmed] = useState(0)
  const [flashing, setFlashing] = useState(false)
  const busyRef = useRef(false)

  async function handleChange(id: string | null) {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await onChange(id)
      setConfirmed((c) => c + 1)
      setFlashing(true)
    } finally {
      busyRef.current = false
    }
  }

  // Apaga el flash tras el pop (280ms, ver .animate-pop-once en index.css) — sin esto el borde
  // acentuado se quedaría "encendido" para siempre tras el primer cambio, en vez de ser un destello.
  useEffect(() => {
    if (!flashing) return
    const timer = setTimeout(() => setFlashing(false), 280)
    return () => clearTimeout(timer)
  }, [flashing])

  return (
    // El `key` va en el contenedor, no en el propio `<select>` (evita remontar el control nativo —
    // y con él el foco/desplegable — justo después de que la usuaria acabe de interactuar con él).
    <div key={confirmed} className={flashing ? 'animate-pop-once' : undefined}>
      <select
        value={value ?? ''}
        onChange={(e) => void handleChange(e.target.value || null)}
        className={`mt-2 w-full rounded-lg border bg-wood-950/60 px-2 py-1 text-2xs text-wood-300 ${flashing ? 'border-accent-500' : 'border-iron-700'}`}
      >
        <option value="">Sin plantilla</option>
        {plantillas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.rol})
          </option>
        ))}
      </select>
    </div>
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
                <button type="button"
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
                  <button type="button"
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
  inventory,
  onRefreshSave,
}: {
  saveId: string
  plantillasEquipo: PlantillaEquipoInfo[]
  companions: CompanionInfo[]
  inventory: InventoryItemInfo[]
  onRefreshSave: () => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [rol, setRol] = useState('guardia')
  const [prioridad, setPrioridad] = useState(0)
  const [rows, setRows] = useState<{ slot: EquipSlot; category: string }[]>([{ slot: 'ARMA_PRINCIPAL', category: '' }])
  const [busy, setBusy] = useState(false)

  // B.17 (checklist frontend 2026-08-27) — `category` es texto libre en todo el catálogo (sin
  // enum cerrado en el backend, ver ItemCatalog.category), así que un `<select>` estricto no es
  // viable — pero sí se puede sugerir con `<datalist>` las categorías que YA existen de verdad en
  // la mochila del jugador, para reducir el riesgo de escribir una que nunca matchea nada. No es
  // el catálogo completo del mundo (no hay endpoint dedicado para eso), pero es mucho mejor que
  // texto libre a ciegas.
  const categoriasConocidas = [...new Set(inventory.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort()

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
      <datalist id="plantilla-categorias-conocidas">
        {categoriasConocidas.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex flex-col gap-2">
        {plantillasEquipo.length === 0 && !creating && <p className="text-xs text-wood-500">Sin plantillas todavía.</p>}
        {plantillasEquipo.map((p) => (
          <div key={p.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-wood-100">
                {p.name} <span className="font-sans text-2xs text-wood-500">— {p.rol}, prioridad {p.prioridad}</span>
              </p>
              {p.personalizada ? (
                <button type="button" onClick={() => handleBorrar(p.id)} disabled={busy} className="tactile shrink-0 text-2xs text-wood-500 hover:text-red-300 disabled:opacity-50">
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
                  list="plantilla-categorias-conocidas"
                  className="flex-1 rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1.5 text-2xs text-wood-200"
                />
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="tactile text-2xs text-wood-500 hover:text-red-300">
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addRow} className="tactile self-start text-2xs text-accent-300 hover:underline">
              + ranura
            </button>
            <div className="flex gap-2">
              <button type="button"
                onClick={handleCrear}
                disabled={busy}
                className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-wood-950 disabled:opacity-50"
              >
                Crear
              </button>
              <button type="button" onClick={() => setCreating(false)} disabled={busy} className="tactile flex-1 rounded-lg border border-iron-700 px-3 py-1.5 text-2xs text-wood-300">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button"
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

/// Roles de Reino válidos (mismos que `ROLES_REINO` del backend, companeros.ts).
const ROLES_REINO: { value: string; label: string }[] = [
  { value: 'trabajador', label: 'Trabajador' },
  { value: 'guardia', label: 'Guardia' },
  { value: 'productor', label: 'Productor' },
  { value: 'diplomatico', label: 'Diplomático' },
]

/// Selector de rol de Reino por compañero (H-1): sin `rolReino` un compañero no es candidato a
/// trabajador ni a diplomático. "Sin rol" lo saca del Reino (y del edificio al que estuviera asignado).
function RolesReinoSection({ saveId, companions, onRefreshSave }: { saveId: string; companions: CompanionInfo[]; onRefreshSave: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  if (companions.length === 0) return null

  async function handleChange(companionId: string, rol: string) {
    setBusy(true)
    try {
      await fijarRolReinoCompanion(saveId, companionId, rol || null)
      await onRefreshSave()
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelSection title="Roles en el Reino">
      <div className="flex flex-col gap-1.5">
        {companions.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 text-xs text-wood-300">
            <span>{c.name}</span>
            <select
              value={c.rolReino ?? ''}
              disabled={busy}
              onChange={(e) => void handleChange(c.id, e.target.value)}
              aria-label={`Rol en el Reino de ${c.name}`}
              className="rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1 text-2xs text-wood-300 disabled:opacity-50"
            >
              <option value="">Sin rol</option>
              {ROLES_REINO.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </PanelSection>
  )
}

interface SubditosSectionProps {
  saveId: string
  subjects: SubjectInfo[]
  companions: CompanionInfo[]
  inventory: InventoryItemInfo[]
  almacenItems: AlmacenItemInfo[]
  plantillasEquipo: PlantillaEquipoInfo[]
  onRefreshSave: () => Promise<void>
}

/// Sub-tab "Súbditos y Plantillas" del Reino (rediseño 2026-09-21) — fusiona las 3 secciones
/// antes sueltas en ReinoPanel.tsx (Súbditos, Almacén de Reino, Plantillas de equipo): ya estaban
/// relacionadas conceptualmente (equipar súbditos/compañeros desde el almacén vía plantilla),
/// ahora viven bajo el mismo sub-tab en vez de 3 bloques sueltos en la misma lista larga.
export function SubditosSection({ saveId, subjects, companions, inventory, almacenItems, plantillasEquipo, onRefreshSave }: SubditosSectionProps) {
  return (
    <div className="flex flex-col gap-5">
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

      <RolesReinoSection saveId={saveId} companions={companions} onRefreshSave={onRefreshSave} />
      <AlmacenSection saveId={saveId} inventory={inventory} almacenItems={almacenItems} onRefreshSave={onRefreshSave} />
      <PlantillasSection
        saveId={saveId}
        plantillasEquipo={plantillasEquipo}
        companions={companions}
        inventory={inventory}
        onRefreshSave={onRefreshSave}
      />
    </div>
  )
}
