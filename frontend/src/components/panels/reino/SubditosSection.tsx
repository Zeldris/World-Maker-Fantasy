import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlmacenItemInfo, CompanionInfo, EquipSlot, InventoryItemInfo, PlantillaEquipoInfo, SubjectInfo } from '../../../types'
import { PanelSection } from '../../PanelSection'
import { SelectorJuego } from '../../SelectorJuego'
import { AlmacenSection } from './AlmacenSection'
import { crearPlantilla, borrarPlantilla, asignarPlantillaCompanion, asignarPlantillaSubject, fijarRolReinoCompanion, getSubditos, cambiarRolSubdito, cambiarTareaSubdito, responderLlegada, type SubditoInfo, type TareaSubdito, type CamasReino, type CandidatoLlegada, type RequisitoLlegada, type SalidaSubdito } from '../../../lib/api'
import { lineaDeSubdito, plazoDeLlegada } from '../../../lib/subditos'
import { SLOT_LABEL, SLOT_ORDER } from '../../../lib/equipSlots'
import { ErrorBanner } from '../../../components/ErrorBanner'
import { useErrorConReintento } from '../../../hooks/useErrorConReintento'
import { useModoConsulta } from '../../../context/useModoConsulta'

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
  // UX-5 (hito 0.2) — asignar una plantilla re-equipa al compañero: no mientras no toca.
  const consulta = useModoConsulta()
  const { fallo, informar, limpiar } = useErrorConReintento()

  async function handleChange(id: string | null) {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await onChange(id)
      setConfirmed((c) => c + 1)
      setFlashing(true)
    } catch (e) {
      informar('No se pudo cambiar la plantilla.', e, () => void handleChange(id))
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
    // El `key` va en el contenedor, no en el propio selector (evita remontar el control — y con él
    // el foco — justo después de que la usuaria acabe de interactuar con él).
    <div key={confirmed} className={`mt-2 ${flashing ? 'animate-pop-once' : ''}`}>
      {/* REI-113 (hito 0.1) — selector del juego en vez del `<select>` nativo. */}
      <SelectorJuego
        ariaLabel="Plantilla de equipo"
        value={value ?? ''}
        opciones={[{ value: '', label: 'Sin plantilla' }, ...plantillas.map((p) => ({ value: p.id, label: `${p.name} (${p.rol})` }))]}
        onChange={(v) => void handleChange(v || null)}
        disabled={!!consulta}
        title={consulta ?? undefined}
        className={`w-full ${flashing ? 'border-accent-500' : ''}`}
      />
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
    </div>
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
  const { fallo, informar, limpiar } = useErrorConReintento()

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
    } catch (e) {
      informar('No se pudo crear la plantilla.', e, () => void handleCrear())
    } finally {
      setBusy(false)
    }
  }

  async function handleBorrar(id: string) {
    setBusy(true)
    try {
      await borrarPlantilla(saveId, id)
      await onRefreshSave()
    } catch (e) {
      informar('No se pudo borrar la plantilla.', e, () => void handleBorrar(id))
    } finally {
      setBusy(false)
    }
  }

  const companionesReino = companions.filter((c) => c.rolReino)

  return (
    <PanelSection title="Plantillas de equipo">
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
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
                <SelectorJuego<EquipSlot>
                  ariaLabel={`Hueco de la fila ${i + 1}`}
                  value={row.slot}
                  opciones={SLOT_ORDER.map((s) => ({ value: s, label: SLOT_LABEL[s] }))}
                  onChange={(v) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, slot: v } : r)))}
                  className="py-1.5"
                />
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
/// REI-115 (hito 0.1, R25) — qué hace hoy cada rol en el código (`backend/src/routes/saves/companeros.ts`,
/// `dailyTick.ts`, `reino.ts`): cualquier rol mete al compañero en el Reino (puede trabajar en un
/// edificio y lo atiende la Casa de curas); guardia/productor/trabajador solo cambian qué plantilla
/// de equipo se le aplica; diplomático habilita la diplomacia con facciones.
const ROLES_REINO: { value: string; label: string; descripcion: string }[] = [
  { value: 'trabajador', label: 'Trabajador', descripcion: 'Puede trabajar en un edificio. Recibe la plantilla de equipo de rol «trabajador».' },
  { value: 'guardia', label: 'Guardia', descripcion: 'Puede trabajar en un edificio. Recibe la plantilla de rol «guardia» (arma y ropa).' },
  { value: 'productor', label: 'Productor', descripcion: 'Puede trabajar en un edificio. Recibe la plantilla de rol «productor» (herramienta).' },
  { value: 'diplomatico', label: 'Diplomático', descripcion: 'Necesario para negociar, sabotear o espiar a otras facciones.' },
]

/// Selector de rol de Reino por compañero (H-1): sin `rolReino` un compañero no es candidato a
/// trabajador ni a diplomático. "Sin rol" lo saca del Reino (y del edificio al que estuviera asignado).
function RolesReinoSection({ saveId, companions, onRefreshSave }: { saveId: string; companions: CompanionInfo[]; onRefreshSave: () => Promise<void> }) {
  // UX-5 (hito 0.2) — modo consulta: lo que cambia datos se deshabilita con el motivo.
  const consulta = useModoConsulta()
  const [busy, setBusy] = useState(false)
  const { fallo, informar, limpiar } = useErrorConReintento()
  if (companions.length === 0) return null

  async function handleChange(companionId: string, rol: string) {
    setBusy(true)
    try {
      await fijarRolReinoCompanion(saveId, companionId, rol || null)
      await onRefreshSave()
    } catch (e) {
      informar('No se pudo cambiar el rol.', e, () => void handleChange(companionId, rol))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelSection title="Roles en el Reino">
      <div className="flex flex-col gap-1.5">
        <ErrorBanner fallo={fallo} onCerrar={limpiar} />
        {companions.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 text-xs text-wood-300">
            <span>{c.name}</span>
            <SelectorJuego
              ariaLabel={`Rol en el Reino de ${c.name}`}
              value={c.rolReino ?? ''}
              disabled={busy || !!consulta}
              title={consulta ?? undefined}
              opciones={[
                { value: '', label: 'Sin rol', descripcion: 'Fuera del Reino: no trabaja en edificios ni lo atiende la Casa de curas.' },
                ...ROLES_REINO.map((r) => ({ value: r.value, label: r.label, descripcion: r.descripcion })),
              ]}
              onChange={(v) => void handleChange(c.id, v)}
              className="min-w-[8rem]"
            />
          </div>
        ))}
      </div>
    </PanelSection>
  )
}

/// REI-118 (hito 0.3): los roles que el motor da a un súbdito adulto.
const ROLES_SUBDITO: { value: SubditoInfo['rol']; label: string; descripcion: string }[] = [
  { value: 'trabajador', label: 'Trabajador', descripcion: 'Trabaja en su tarea y suma riqueza al Reino.' },
  { value: 'soldado', label: 'Soldado', descripcion: 'Defiende el Reino; cobra su mantenimiento.' },
  { value: 'vigia', label: 'Vigía', descripcion: 'Vigila el Reino; cuenta como soldado.' },
  { value: 'cazador', label: 'Cazador', descripcion: 'Sale con las partidas de caza y captura (Reino › Partidas); no trabaja en casa y lleva arma.' },
]
/// CR-61 (61c): la tarea de cada trabajador; de ella sale la comida del Reino.
const TAREAS_SUBDITO: { value: TareaSubdito; label: string; descripcion: string }[] = [
  { value: 'recolector', label: 'Recolector', descripcion: 'Recoge 2 de comida al día (2,5 en primavera y verano; 1 en invierno).' },
  { value: 'pescador', label: 'Pescador', descripcion: 'Pesca 3 al día si hay agua junto al Ayuntamiento; si no, recolecta.' },
  { value: 'cocinero', label: 'Cocinero', descripcion: 'Con Cocina, transforma 10 de comida cruda: +5, +10 o +15 según su escalón. Sin Cocina, recolecta.' },
  { value: 'ganadero', label: 'Ganadero', descripcion: 'Cuida el ganado de los Corrales (sin ganadero no producen).' },
  { value: 'fibrero', label: 'Fibrero', descripcion: 'Siega en la Fibrería: 10 de forraje al día.' },
]
/// REI-118 + REI-53 (parte): los súbditos como personas — pueblo, edad, linaje, felicidad y rol
/// editable (las crías no trabajan ni combaten) — y las camas que comparten con los compañeros.
function SubditosLista({ saveId, subjects, plantillasEquipo, onRefreshSave }: { saveId: string; subjects: SubjectInfo[]; plantillasEquipo: PlantillaEquipoInfo[]; onRefreshSave: () => Promise<void> }) {
  const consulta = useModoConsulta()
  const [datos, setDatos] = useState<{ ahora?: number; subditos: SubditoInfo[]; camas: CamasReino; candidatos?: CandidatoLlegada[]; salidas?: SalidaSubdito[]; requisitosLlegada?: RequisitoLlegada[] } | null>(null)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const { fallo, informar, limpiar, limpiarSi } = useErrorConReintento()
  // Cada refresco de la partida trae un `subjects` nuevo: se vuelve a pedir la lista, porque los
  // candidatos, muertes y salidas no cambian los súbditos activos que vienen en la partida.
  // P230 — un fallo al cargar no deja la lista vacía sin aviso: ErrorBanner con Reintentar.
  const [cargaFallida, setCargaFallida] = useState(false)
  const peticion = useRef(0)
  const cargar = useCallback(() => {
    const id = ++peticion.current
    getSubditos(saveId)
      .then((r) => {
        if (id !== peticion.current) return
        setCargaFallida(false)
        limpiarSi('No se pudieron cargar los súbditos.')
        setDatos(r)
      })
      .catch((e) => {
        if (id !== peticion.current) return
        setCargaFallida(true)
        setDatos(null)
        informar('No se pudieron cargar los súbditos.', e, cargar)
      })
  }, [saveId, informar, limpiarSi])
  useEffect(() => {
    cargar()
    return () => {
      peticion.current++
    }
  }, [cargar, subjects, version])

  async function handleRol(id: string, rol: string) {
    setBusy(true)
    try {
      await cambiarRolSubdito(saveId, id, rol)
      setVersion((v) => v + 1)
      await onRefreshSave()
    } catch (e) {
      informar('No se pudo cambiar el rol.', e, () => void handleRol(id, rol))
    } finally {
      setBusy(false)
    }
  }

  async function handleTarea(id: string, tarea: TareaSubdito) {
    setBusy(true)
    try {
      await cambiarTareaSubdito(saveId, id, tarea)
      setVersion((v) => v + 1)
      await onRefreshSave()
    } catch (e) {
      informar('No se pudo cambiar la tarea.', e, () => void handleTarea(id, tarea))
    } finally {
      setBusy(false)
    }
  }

  async function handleLlegada(id: string, acepta: boolean) {
    setBusy(true)
    try {
      await responderLlegada(saveId, id, acepta)
      setVersion((v) => v + 1)
      await onRefreshSave()
    } catch (e) {
      informar(acepta ? 'No se pudo acoger a quien llega.' : 'No se pudo despedir a quien llega.', e, () => void handleLlegada(id, acepta))
    } finally {
      setBusy(false)
    }
  }

  const subditos = datos?.subditos ?? []
  const candidatos = datos?.candidatos ?? []
  if (!datos && subjects.length === 0 && !cargaFallida) return null
  const porId = new Map(subjects.map((s) => [s.id, s]))
  return (
    <PanelSection title="Súbditos">
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
      {datos && (
        <p className="mb-2 text-2xs text-wood-400">
          Camas: {datos.camas.companeros + datos.camas.subditos}/{datos.camas.total + (datos.camas.temporales ?? 0)} ({datos.camas.subditos} súbdito{datos.camas.subditos === 1 ? '' : 's'}, {datos.camas.companeros} compañero{datos.camas.companeros === 1 ? '' : 's'}
          {datos.camas.temporales ? `, ${datos.camas.temporales} temporales del Ayuntamiento solo para súbditos` : ''})
        </p>
      )}
      {/* P220b: todos los requisitos para que llegue alguien, con su estado y su cifra (como en X4). */}
      {(datos?.requisitosLlegada ?? []).length > 0 && (
        <p className="mb-2 text-2xs text-wood-400" aria-label="Requisitos para que llegue alguien">
          Para que llegue alguien:{' '}
          {datos!.requisitosLlegada!.map((q, i) => (
            <span key={q.clave}>
              {i > 0 && ' · '}
              <span className={q.cumple ? 'text-emerald-400' : 'text-danger-400'} title={q.cumple ? undefined : q.motivo}>
                {q.nombre} <span aria-label={q.cumple ? 'cumplido' : 'falta'}>{q.cumple ? '✓' : '✗'}</span>
              </span>{' '}
              ({q.cifra})
            </span>
          ))}
        </p>
      )}
      {/* REI-119 / REI-54: quien llega espera respuesta; si no se le contesta, se va. */}
      {candidatos.map((c) => (
        <div key={c.id} className="mb-2 rounded-lg border border-accent-600/60 bg-wood-950/50 px-3.5 py-2.5" role="group" aria-label={`Llega ${c.name}`}>
          <p className="text-2xs uppercase tracking-[0.12em] text-accent-300">Llega a tu puerta</p>
          <p className="mt-0.5 font-medium text-wood-100">{c.name}</p>
          <p className="text-2xs text-wood-400">
            {[lineaDeSubdito(c), c.deDonde ? `de ${c.deDonde}` : null].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-xs text-wood-300">Viene porque en tu Reino hay cama, comida y agua. {plazoDeLlegada(c.hastaMinutes, datos?.ahora)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy || !!consulta} title={consulta ?? undefined} onClick={() => void handleLlegada(c.id, true)}
              className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-wood-950 disabled:opacity-50">
              Acoger
            </button>
            <button type="button" disabled={busy || !!consulta} title={consulta ?? undefined} onClick={() => void handleLlegada(c.id, false)}
              className="tactile flex-1 rounded-lg border border-iron-700 px-3 py-1.5 text-2xs text-wood-300 disabled:opacity-50">
              Despedir
            </button>
          </div>
        </div>
      ))}
      {/* REI-121 / REI-54: quien se fue o murió esta semana. */}
      {(datos?.salidas ?? []).length > 0 && (
        <ul className="mb-2 flex flex-col gap-0.5 rounded-lg border border-iron-800 bg-wood-950/30 px-3 py-2" aria-label="Salidas de esta semana">
          {datos!.salidas!.map((x) => (
            <li key={x.id} className="text-2xs text-wood-400">
              <span aria-hidden="true">{x.estado === 'MUERTO' ? '✝ ' : '↩ '}</span>
              <span className="text-wood-200">{x.name}</span> — {x.motivo}
            </li>
          ))}
        </ul>
      )}
      {/* P236 — el texto de vacío solo si la carga fue bien: con la carga fallida no se sabe si hay súbditos. */}
      {datos && !cargaFallida && subditos.length === 0 && <p className="text-xs text-wood-500">Aún no vive nadie en tu Reino.</p>}
      <div className="flex flex-col gap-2">
        {subditos.map((s) => {
          const fila = porId.get(s.id)
          return (
            <div key={s.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-wood-100">{s.name}</p>
                  <p className="text-2xs text-wood-400">{lineaDeSubdito(s) || s.role}</p>
                  {s.pareja && (
                    <p className="text-2xs text-wood-400">
                      Pareja de {s.pareja}
                      {s.crias ? ` · ${s.crias} cría${s.crias === 1 ? '' : 's'}` : ''}
                    </p>
                  )}
                </div>
                {s.rol === 'visitante' ? (
                  <span className="text-2xs text-wood-500">de paso</span>
                ) : s.adulto ? (
                  <SelectorJuego
                    ariaLabel={`Rol de ${s.name}`}
                    value={s.rol}
                    disabled={busy || !!consulta}
                    title={consulta ?? undefined}
                    opciones={ROLES_SUBDITO}
                    onChange={(v) => void handleRol(s.id, v)}
                    className="min-w-[7rem]"
                  />
                ) : (
                  <span className="text-2xs text-wood-500" title="Las crías no trabajan ni combaten hasta hacerse mayores.">
                    cría
                  </span>
                )}
              </div>
              {s.rol === 'trabajador' && s.adulto && (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-2xs text-wood-500">Tarea</span>
                  <SelectorJuego
                    ariaLabel={`Tarea de ${s.name}`}
                    value={s.tarea ?? 'recolector'}
                    disabled={busy || !!consulta}
                    title={consulta ?? undefined}
                    opciones={TAREAS_SUBDITO}
                    onChange={(v) => void handleTarea(s.id, v)}
                    className="min-w-[7rem]"
                  />
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-2" title={`Felicidad ${s.felicidad}/100`}>
                <span className="text-2xs text-wood-500">Felicidad</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-wood-900" role="meter" aria-label={`Felicidad de ${s.name}`} aria-valuenow={s.felicidad} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full ${s.felicidad >= 70 ? 'bg-emerald-500' : s.felicidad < 30 ? 'bg-danger-500' : 'bg-accent-500'}`} style={{ width: `${s.felicidad}%` }} />
                </div>
              </div>
              {fila?.notes && <p className="mt-1 text-xs leading-relaxed text-wood-400">{fila.notes}</p>}
              {fila && plantillasEquipo.length > 0 && (
                <PlantillaSelect
                  value={fila.plantillaEquipoId}
                  plantillas={plantillasEquipo}
                  onChange={async (id) => {
                    await asignarPlantillaSubject(saveId, s.id, id)
                    await onRefreshSave()
                  }}
                />
              )}
            </div>
          )
        })}
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
      <SubditosLista saveId={saveId} subjects={subjects} plantillasEquipo={plantillasEquipo} onRefreshSave={onRefreshSave} />

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
