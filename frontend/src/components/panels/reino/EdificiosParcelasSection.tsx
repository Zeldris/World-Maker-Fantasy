import { useRef, useState } from 'react'
import type { BuildingInfo, RecipeStatusInfo } from '../../../types'
import { PanelSection } from '../../PanelSection'
import { TooltipAnchor } from '../../TooltipAnchor'
import { cuartelBuildDisabledReason } from '../../../lib/cuartelBuild'
import { nombreDeEdificio } from '../../../lib/edificios'
import { postObra, postRepararEdificio } from '../../../lib/api'
import { CasaDeObrasCola } from './CasaDeObrasCola'

/// Construcción por oficio (P277): el personaje levanta en persona hasta tier 3; lo demás, la Casa de obras.
/// Copia de `TIER_MAXIMO_PERSONAJE` de backend/src/services/construction.ts: si cambia allí, cámbialo aquí.
const TIER_MAXIMO_PERSONAJE = 3

const buildingStatusLabel: Record<BuildingInfo['status'], string> = {
  EN_CONSTRUCCION: 'En construcción',
  ACTIVO: 'Activo',
  DANADO: 'Dañado',
  ABANDONADO: 'Abandonado',
}

const BUILDING_STATE_HINT: Record<BuildingInfo['status'], string> = {
  EN_CONSTRUCCION: 'Todavía no cumple su función — espera a que se complete.',
  ACTIVO: 'Funciona con normalidad.',
  DANADO: 'Sigue en pie pero con capacidad reducida.',
  ABANDONADO: 'Dejó de funcionar — sin trabajadores o sin mantenimiento.',
}

const BUILDING_STATUS_TONE: Record<BuildingInfo['status'], string> = {
  EN_CONSTRUCCION: 'border-iron-700 text-wood-400',
  ACTIVO: 'border-accent2-600/50 text-accent2-300',
  DANADO: 'border-cost-600/50 text-cost-400',
  ABANDONADO: 'border-danger-600/50 text-danger-400',
}

// Nivel del Ayuntamiento (2026-08-04, docs/mecanicas/17-reglas-construcciones-reino.md) — 'ayuntamiento' es
// la única receta con tiers; el resto de construcciones no muestra nada aquí.
const AYUNTAMIENTO_TIER_LABEL: Record<number, string> = {
  1: 'pequeño',
  2: 'mediano',
  3: 'grande',
}

/// Cuartel Avanzado y sus dos mejoras (H-12, 2026-09-28) — botón directo en vez de exigir texto
/// libre. No hay ruta de construcción propia: manda el MISMO texto que la Enciclopedia inserta
/// ("Me pongo a construir <nombre>") por el turno normal (`onBuild` = `handleSubmit` de GameView),
/// así que dónde se puede construir, coste y efectos colaterales (zona-interior, evento de
/// facción) son exactamente los del texto libre. Habilitado según `recipesStatus` (mismo
/// `met`/`blockedReason` que la Enciclopedia).
const CUARTEL_BUILD_OPTIONS: { recipeKey: string; label: string; actionText: string; needsCuartel: boolean }[] = [
  { recipeKey: 'cuartel-avanzado', label: 'Cuartel avanzado', actionText: 'Me pongo a construir un cuartel avanzado', needsCuartel: false },
  { recipeKey: 'cuartel-de-guerra', label: 'Mejorar a Cuartel de guerra', actionText: 'Me pongo a construir un cuartel de guerra', needsCuartel: true },
  { recipeKey: 'puesto-comercial', label: 'Mejorar a Puesto comercial', actionText: 'Me pongo a construir un puesto comercial', needsCuartel: true },
]

interface EdificiosParcelasSectionProps {
  buildings: BuildingInfo[]
  recipesStatus?: RecipeStatusInfo[]
  /// Manda el texto de construcción por el turno normal (undefined = sin botones).
  onBuild?: (actionText: string) => void
  /// UX-3 (hito 0.1) — motivo por el que ahora no se puede lanzar un turno (narrador escribiendo,
  /// ocupado…); `null`/ausente = libre. Deshabilita los botones que mandan una acción al turno.
  bloqueoTurno?: string | null
  /// P284/P296/P301 — para reparar un edificio dañado desde su tarjeta (sin ellos no hay botón).
  saveId?: string
  onRefreshSave?: () => Promise<void>
}

interface BuildOption { recipeKey: string; label: string; actionText: string; needsCuartel: boolean; status: RecipeStatusInfo | undefined; tier?: number }

/// P278: cuántos hay de cada clase (por `recipeKey`) y el número de orden de cada uno, para distinguir dos Pozos o dos
/// Chozas. Los narrados sin receta no se numeran.
export function numerarEdificios(buildings: BuildingInfo[]): { numero: Map<string, { n: number; de: number }>; resumen: string[] } {
  const porClave = new Map<string, BuildingInfo[]>()
  for (const b of buildings) {
    if (!b.recipeKey) continue
    porClave.set(b.recipeKey, [...(porClave.get(b.recipeKey) ?? []), b])
  }
  const numero = new Map<string, { n: number; de: number }>()
  const resumen: string[] = []
  for (const grupo of porClave.values()) {
    grupo.forEach((b, i) => numero.set(b.id, { n: i + 1, de: grupo.length }))
    if (grupo.length < 2) continue
    const danados = grupo.filter((b) => b.status === 'DANADO').length
    resumen.push(`${grupo.length} × ${nombreDeEdificio(grupo[0]!.name)}${danados ? ` (${danados} dañado${danados === 1 ? '' : 's'})` : ''}`)
  }
  return { numero, resumen }
}

/// P218 — todo lo que el reino puede levantar sale del catálogo del backend (`recipesStatus`), no de
/// una lista fija: edificios que cuelgan del Ayuntamiento (Pozo, Granero, Cisterna, Leñera, oficios…)
/// y las mejoras de un edificio que ya está en pie. Las mejoras de Cuartel se muestran siempre.
function opcionesDeConstruccion(buildings: BuildingInfo[], recipesStatus: RecipeStatusInfo[]): BuildOption[] {
  const fijas = new Map(CUARTEL_BUILD_OPTIONS.map((o) => [o.recipeKey, o]))
  const out: BuildOption[] = []
  const vistas = new Set<string>()
  const construcciones = recipesStatus.filter((s) => s.recipeCategory === 'construccion')
  const candidatas = [...construcciones, ...CUARTEL_BUILD_OPTIONS.filter((o) => !construcciones.some((s) => s.recipeKey === o.recipeKey)).map((o) => ({ recipeKey: o.recipeKey }) as RecipeStatusInfo)]
  for (const s of candidatas) {
    if (vistas.has(s.recipeKey)) continue
    const fija = fijas.get(s.recipeKey)
    // P255: una receta única por región (Mercado, Tablón…) que ya está en pie no se vuelve a ofrecer; las repetibles (Choza, Pozo…) sí.
    if (s.unicaYaLevantada && !fijas.has(s.recipeKey)) continue
    const mejora = s.upgradesRecipeKey ?? null
    // Una mejora solo se ofrece sobre su edificio y si aún no está en ese nivel: mejorar actualiza la
    // misma fila (sube `tier`, `recipeKey` sigue siendo el del nivel 1). Las del Ayuntamiento, solo
    // la del nivel siguiente (P277: ya no las levanta el personaje, se encargan a la Casa de obras).
    // P282: `panelReino` (backend) incluye las Jaulas, que no cuelgan del Ayuntamiento.
    const delPanel = s.panelReino ?? s.requiresAyuntamiento
    const mejoraOfrecida = mejora && buildings.some((b) => b.recipeKey === mejora && (mejora === 'ayuntamiento' ? (b.tier ?? 1) + 1 === (s.nivel ?? 2) : (b.tier ?? 1) < (s.nivel ?? 2)))
    const delReino = fija || (delPanel && !mejora) || mejoraOfrecida
    if (!delReino || !s.recipeKey) continue
    vistas.add(s.recipeKey)
    if (fija) {
      out.push({ ...fija, status: construcciones.includes(s) ? s : undefined, tier: s.tier })
    } else if (s.name) {
      out.push({ recipeKey: s.recipeKey, label: mejora ? `Mejorar a ${nombreDeEdificio(s.name)}` : nombreDeEdificio(s.name), actionText: `Me pongo a construir ${s.name}`, needsCuartel: false, status: s, tier: s.tier })
    }
  }
  return out
}

/// Sub-tab "Edificios y Parcelas" del Reino (rediseño 2026-09-21) — extraído de `ReinoPanel.tsx`.
/// P350: «Dañado por una tormenta el día 1522». Sin causa guardada (un daño antiguo): solo el día, o «Dañado».
function textoDanio(danio: BuildingInfo['danio']): string {
  if (!danio) return 'Dañado.'
  return `Dañado${danio.causa ? ` por ${danio.causa}` : ''} el día ${danio.dia}.`
}

export function EdificiosParcelasSection({ buildings, recipesStatus = [], onBuild, bloqueoTurno, saveId, onRefreshSave }: EdificiosParcelasSectionProps) {
  // P302 — el cierre síncrono (ref) evita el doble clic antes de que React pinte el botón deshabilitado;
  // el estado lo deshabilita a la vista. Se suelta cuando termina la petición del turno.
  const enVuelo = useRef(false)
  const [construyendo, setConstruyendo] = useState(false)
  const [reparando, setReparando] = useState<string | null>(null)
  const [errorReparar, setErrorReparar] = useState<string | null>(null)
  const [encargando, setEncargando] = useState(false)
  const [versionCola, setVersionCola] = useState(0)
  const hayCasaDeObras = buildings.some((b) => b.recipeKey === 'casa-de-obras' && b.status === 'ACTIVO')
  /// P277/P284: encarga una obra o una reparación a la Casa de obras (al final de su cola).
  const encargar = async (encargo: { recipeKey: string } | { buildingId: string }) => {
    if (!saveId || encargando) return
    setEncargando(true)
    setErrorReparar(null)
    try {
      await postObra(saveId, encargo)
      setVersionCola((n) => n + 1)
    } catch (e) {
      setErrorReparar(e instanceof Error ? e.message : 'No se pudo encargar a la Casa de obras.')
    } finally {
      setEncargando(false)
    }
  }
  const construir = (actionText: string) => {
    if (!onBuild || enVuelo.current) return
    enVuelo.current = true
    setConstruyendo(true)
    void Promise.resolve(onBuild(actionText)).catch(() => {}).finally(() => { enVuelo.current = false; setConstruyendo(false) })
  }
  const reparar = async (id: string) => {
    if (!saveId || reparando) return
    setReparando(id)
    setErrorReparar(null)
    try {
      await postRepararEdificio(saveId, id)
      await onRefreshSave?.()
    } catch (e) {
      setErrorReparar(e instanceof Error ? e.message : 'No se pudo reparar el edificio.')
    } finally {
      setReparando(null)
    }
  }
  const hasCuartel = buildings.some((b) => b.recipeKey === 'cuartel-avanzado')
  const buildButtons = onBuild && (
    <PanelSection title="Construir">
      <div className="flex flex-col gap-2">
        {opcionesDeConstruccion(buildings, recipesStatus).map((opt) => {
          const status = opt.status
          // Solo las opciones fijas (Cuartel) se miran aquí; las del catálogo pueden repetirse (Leñeras,
          // Pozos…) y su tope lo dice el backend en `blockedReason`.
          const alreadyBuilt = !opt.status?.name && buildings.some((b) => b.recipeKey === opt.recipeKey)
          const soloCasa = (opt.tier ?? 1) > TIER_MAXIMO_PERSONAJE
          const reason = soloCasa
            ? `Tier ${opt.tier}: el personaje solo levanta hasta tier ${TIER_MAXIMO_PERSONAJE}; encárgala a la Casa de obras.`
            : cuartelBuildDisabledReason(status, hasCuartel, opt.needsCuartel, alreadyBuilt) ?? bloqueoTurno ?? (construyendo ? 'Enviando la orden de construir…' : null)
          const coste = status?.ingredients?.length ? status.ingredients.map((i) => `${i.label} ${i.tienes}/${i.necesitas}`).join(' · ') : null
          return (
            <div key={opt.recipeKey}>
              <button
                type="button"
                disabled={reason !== null}
                title={reason ?? undefined}
                onClick={() => construir(opt.actionText)}
                className="tactile w-full rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2 text-left text-sm font-medium text-wood-100 transition-colors hover:border-accent2-600/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                🏗️ {opt.label}{opt.tier ? <span className="ml-1 text-2xs text-wood-400">T{opt.tier}</span> : null}
              </button>
              {saveId && hayCasaDeObras && opt.status?.name && opt.recipeKey !== 'ayuntamiento' && (
                <button
                  type="button"
                  disabled={encargando}
                  onClick={() => void encargar({ recipeKey: opt.recipeKey })}
                  className="tactile mt-1 rounded-md border border-accent2-600/40 px-2 py-0.5 text-2xs font-semibold text-accent-300 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Encargar a la Casa de obras
                </button>
              )}
              {coste && <p className="mt-0.5 px-1 text-2xs text-wood-400">Coste: {coste}</p>}
              {reason && <p className="mt-0.5 px-1 text-2xs text-wood-500">{reason}</p>}
            </div>
          )
        })}
      </div>
    </PanelSection>
  )
  const { numero, resumen } = numerarEdificios(buildings)
  const cola = saveId ? <CasaDeObrasCola saveId={saveId} version={versionCola} /> : null
  if (buildings.length === 0) return <>{buildButtons}<p className="text-xs text-wood-500">Sin edificios todavía.</p></>

  return (
    <>
    {buildButtons}
    {hayCasaDeObras && cola}
    <PanelSection title="Edificios">
      {/* Leyenda de estados (Fase 0, higiene 2026-09-21) — mismo patrón que Territorios. */}
      <details className="group mb-2 rounded-lg border border-iron-700 bg-wood-950/40 text-2xs text-wood-400">
        <summary className="tactile flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 font-semibold uppercase tracking-[0.1em] text-wood-500 marker:content-none">
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
          ¿Qué significa cada estado?
        </summary>
        <div className="flex flex-col gap-1.5 border-t border-iron-800 px-3 py-2">
          {(Object.keys(buildingStatusLabel) as BuildingInfo['status'][]).map((estado) => (
            <p key={estado} className="flex items-start gap-2">
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${BUILDING_STATUS_TONE[estado]}`}>
                {buildingStatusLabel[estado]}
              </span>
              <span>{BUILDING_STATE_HINT[estado]}</span>
            </p>
          ))}
        </div>
      </details>
      {errorReparar && <p role="alert" className="mb-2 text-2xs text-cost-400">{errorReparar}</p>}
      {resumen.length > 0 && <p className="mb-2 text-2xs text-wood-400">Repetidos: {resumen.join(' · ')}</p>}
      <div className="flex flex-col gap-2">
        {buildings.map((b) => (
          <div key={b.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
            <p className="flex items-center justify-between font-medium text-wood-100">
              <span>
                {nombreDeEdificio(b.name)}
                {numero.get(b.id) && numero.get(b.id)!.de > 1 && <span className="ml-1.5 text-2xs font-normal text-wood-500">n.º {numero.get(b.id)!.n}</span>}
              </span>
              {/* REI-115 (hito 0.1) — el significado del estado al pasar por encima, no solo en la leyenda. */}
              <TooltipAnchor text={buildingStatusLabel[b.status]} subtext={BUILDING_STATE_HINT[b.status]}>
                <span className={`rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${BUILDING_STATUS_TONE[b.status]}`}>
                  {buildingStatusLabel[b.status]}
                </span>
              </TooltipAnchor>
            </p>
            <p className="mt-0.5 text-2xs text-wood-500">
              {b.kind}
              {b.recipeKey === 'ayuntamiento' && b.tier && ` · Ayuntamiento ${AYUNTAMIENTO_TIER_LABEL[b.tier] ?? b.tier}`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-wood-400">{b.description}</p>
            {b.ocupante && (
              <p className="mt-1 text-2xs text-accent-300">
                Atado: {b.ocupante.name} · Felicidad <span className="font-mono tabular-nums">{b.ocupante.felicidad}</span>
              </p>
            )}
            {b.status === 'DANADO' && (
              <p className="mt-1 text-2xs text-cost-400">{textoDanio(b.danio)}</p>
            )}
            {b.status === 'DANADO' && saveId && (
              <div className="mt-1.5 flex items-center gap-2 text-2xs">
                <button
                  type="button"
                  disabled={reparando !== null}
                  onClick={() => void reparar(b.id)}
                  className="tactile rounded-md border border-accent2-600/40 px-2 py-0.5 font-semibold text-accent-300 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reparar
                </button>
                {hayCasaDeObras && (
                  <button
                    type="button"
                    disabled={encargando}
                    onClick={() => void encargar({ buildingId: b.id })}
                    className="tactile rounded-md border border-iron-700 px-2 py-0.5 font-semibold text-wood-200 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Encargar reparación
                  </button>
                )}
                {b.costeReparar != null && <span className="text-wood-400">Coste: {b.costeReparar} materiales del Almacén</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </PanelSection>
    </>
  )
}
