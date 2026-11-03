import { useEffect, useState } from 'react'
import type { BuildingInfo, KingdomStatsInfo, TerritoryInfo } from '../../../types'
import { PanelSection } from '../../PanelSection'
import { getDescansarCampamentoDisponible, getEconomiaReino, postDescansarCampamento, traspasarTesoro, type EconomiaReino } from '../../../lib/api'
import { avisosDeEconomia, textoAlmacen, textoComidaDia } from '../../../lib/economiaReino'
import { ConfirmModal } from '../../ConfirmModal'
import { TooltipAnchor } from '../../TooltipAnchor'
import { useModoConsulta } from '../../../context/useModoConsulta'

// `diasFelicidadBaja`/`diasFelicidadAlta` (B.19) quedan fuera a propósito — son metadatos de
// "cuántos días lleva así", no un recurso del reino que tenga sentido como tarjeta en Economía.
type KingdomStatKey = Exclude<keyof KingdomStatsInfo, 'diasFelicidadBaja' | 'diasFelicidadAlta' | 'diasParaRebelion' | 'diasParaConsolidar'>

const KINGDOM_STAT_LABEL: Record<KingdomStatKey, string> = {
  poblacion: 'Población',
  felicidad: 'Felicidad',
  comida: 'Comida',
  bebida: 'Bebida',
  riqueza: 'Riqueza',
  soldados: 'Soldados',
  trabajadores: 'Trabajadores',
  visitantes: 'Visitantes',
}

/// REI-115 (hito 0.1, roadmap-front-reino.md R25) — qué hace de verdad cada indicador, con las cifras
/// del tick diario (`backend/src/services/kingdomTick.ts`: "bocas" = población + soldados + visitantes).
/// Si cambian esas constantes, hay que cambiar estos textos.
const KINGDOM_STAT_HINT: Record<KingdomStatKey, string> = {
  poblacion: 'Súbditos civiles (trabajadores y crías). Cada uno come y bebe 1 al día. Llegan una vez por semana si hay cama, comida, agua y felicidad de 40 o más.',
  felicidad: 'De 0 a 100. Sube 2 al día si sobra comida y bebida, baja 5 si falta cualquiera de las dos y 3 cada día que no se pagan los sueldos. 7 días seguidos en 70 o más consolidan un territorio; 7 en 20 o menos lo pierden.',
  comida: 'Cada trabajador produce 2 al día; cada boca (población, soldados y visitantes) gasta 1. Cabe hasta el tope del almacén (Granero). 3 días sin comida: puede morir alguien de hambre.',
  bebida: 'Cada boca gasta 1 al día. La reponen los Pozos (12 al día) y una fuente natural junto al Ayuntamiento (20). Cabe hasta el tope (Cisterna). 2 días sin agua: puede morir alguien de sed.',
  riqueza: 'El tesoro del Reino, en Goirnos. Cada trabajador aporta 1 al día. Cada semana se pagan los sueldos: 2 por trabajador y 5 por soldado o vigía.',
  soldados: 'Soldados y vigías. Comen y beben como un habitante y cobran 5 Goirnos a la semana; sin cobrar 7 días, empiezan a desertar.',
  trabajadores: 'Producen 2 de comida y 1 Goirno al día cada uno y cobran 2 a la semana.',
  visitantes: 'Gente de paso: comen y beben como un habitante (1 al día).',
}

export const controlLabel: Record<TerritoryInfo['control'], string> = {
  RECLAMADO: 'Reclamado',
  DISPUTADO: 'Disputado',
  CONSOLIDADO: 'Consolidado',
  PERDIDO: 'Perdido',
}

// A.8 (checklist frontend 2026-08-27) — territorios PERDIDO/DISPUTADO y edificios DANADO/
// ABANDONADO se veían exactamente igual que el estado normal (mismo borde gris uniforme), pese a
// ser el sistema con más consecuencias de "no darte cuenta a tiempo". Mismo criterio de tono por
// estado que `OUTCOME_TONE` (KingdomFoundingModal.tsx).
export const CONTROL_TONE: Record<TerritoryInfo['control'], string> = {
  RECLAMADO: 'border-iron-700 text-wood-400',
  CONSOLIDADO: 'border-accent2-600/50 text-accent2-300',
  DISPUTADO: 'border-cost-600/50 text-cost-400',
  PERDIDO: 'border-danger-600/50 text-danger-400',
}

// Leyenda de estados (Fase 0, higiene 2026-09-21) — qué implica cada estado para el jugador, en
// lenguaje natural, sin repetir el nombre técnico (ya lo dice el propio badge al lado).
const TERRITORY_STATE_HINT: Record<TerritoryInfo['control'], string> = {
  RECLAMADO: 'Fundado, sin cambios recientes en su felicidad.',
  CONSOLIDADO: 'Felicidad alta sostenida 7 días — control asentado.',
  DISPUTADO: 'Felicidad baja sostenida — riesgo real de perderlo si no mejora.',
  PERDIDO: 'La felicidad cayó demasiado tiempo — el territorio se rebeló.',
}

const SIN_PROVISIONES: Record<'hambre' | 'sed' | 'ambas', string> = {
  ambas: 'Sin comida ni bebida',
  hambre: 'Sin comida',
  sed: 'Sin bebida',
}

/// P305: solo se promete la cura con provisiones; con carencia el descanso no cura y el estado empeora.
function mensajeDescanso(carencia: 'hambre' | 'sed' | 'ambas' | null): string {
  const guarda = 'Esto GUARDA la partida — reaparecerás aquí si mueres más adelante.'
  if (!carencia) return `Descansarás hasta el amanecer (08:00 del día siguiente), curándote hasta Herido. ${guarda}`
  return `Descansarás hasta el amanecer (08:00 del día siguiente). ${SIN_PROVISIONES[carencia]}, el descanso no cura y tu estado empeora. ${guarda}`
}

interface VisionGeneralSectionProps {
  saveId: string
  kingdomName: string | null
  territories: TerritoryInfo[]
  kingdomStats: KingdomStatsInfo | null
  buildings: BuildingInfo[]
  ayuntamiento: boolean
  onFundarReino?: () => void
  onRefreshSave: () => Promise<void>
}

/// Sub-tab "Visión general" del Reino (rediseño 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md) —
/// extraído de `ReinoPanel.tsx` (antes lista plana única de 677 líneas), primera sub-pestaña de 5.
/// Contenido sin cambios funcionales: nombre de reino/aviso de fundación, Economía, Territorios (con
/// su leyenda de estados), y "Descansar en campamento" (acción transversal, no pertenece a ningún
/// sub-tab temático — se queda aquí, no en Edificios ni Producción).
export function VisionGeneralSection({
  saveId,
  kingdomName,
  territories,
  kingdomStats,
  buildings,
  ayuntamiento,
  onFundarReino,
  onRefreshSave,
}: VisionGeneralSectionProps) {
  // UX-5 (hito 0.2) — modo consulta: lo que cambia datos se deshabilita con el motivo.
  const consulta = useModoConsulta()
  // "Descansar en campamento" (2026-09-08, diseño de Álvaro: "una habilidad que solo aparecerá
  // cuando tienes construido el campamento") — visibilidad condicional real, consultada al backend
  // (mismo criterio de "Building propio ACTIVO en la Location actual" que fija el punto de
  // guardado real), no una SavedAction fija de barra.
  const [descansarDisponible, setDescansarDisponible] = useState(false)
  // P305: con hambre o sed el descanso no cura; el modal lo dice antes de confirmar.
  const [carencia, setCarencia] = useState<'hambre' | 'sed' | 'ambas' | null>(null)
  const [confirmandoDescanso, setConfirmandoDescanso] = useState(false)
  const [descansando, setDescansando] = useState(false)
  const [errorDescanso, setErrorDescanso] = useState<string | null>(null)
  useEffect(() => {
    let cancelado = false
    getDescansarCampamentoDisponible(saveId)
      .then((res) => {
        if (cancelado) return
        setDescansarDisponible(res.disponible)
        setCarencia(res.carencia ?? null)
      })
      .catch(() => {
        if (!cancelado) setDescansarDisponible(false)
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId, buildings])

  async function handleDescansar() {
    setDescansando(true)
    setErrorDescanso(null)
    try {
      await postDescansarCampamento(saveId)
      setConfirmandoDescanso(false)
      await onRefreshSave()
    } catch (e) {
      // El modal se queda abierto con el botón reactivado — el jugador puede reintentar sin
      // perder el contexto (mismo criterio que el resto de modales de confirmación del proyecto).
      // UX-24 (hito 0.1): antes sin ningún mensaje — ahora dice qué falló y el botón pasa a *Reintentar*.
      setErrorDescanso(`No se pudo descansar en el campamento.${e instanceof Error && e.message ? ` ${e.message}` : ''}`)
    } finally {
      setDescansando(false)
    }
  }

  const danados = buildings.filter((b) => b.status === 'DANADO').length

  return (
    <div className="flex flex-col gap-5">
      {kingdomName ? (
        <p className="font-serif text-lg tracking-wide text-accent2-300">{kingdomName}</p>
      ) : (
        ayuntamiento && (
          // B.18 (checklist frontend 2026-08-27) — antes el bloque entero desaparecía si
          // `onFundarReino` era undefined (no debería pasar en la práctica, ver comentario de la
          // prop, pero era exactamente el bug que motivó este botón regresando en silencio si
          // llegara a pasar): ahora el aviso siempre se muestra con Ayuntamiento sin nombre, el
          // botón solo si de verdad hay control para arreglarlo.
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent-600/50 bg-accent-600/10 px-3.5 py-2.5">
            <p className="text-xs leading-relaxed text-wood-300">Tu Ayuntamiento sigue sin nombre de reino.</p>
            {onFundarReino && (
              <button type="button"
                onClick={onFundarReino}
                disabled={!!consulta}
                title={consulta ?? undefined}
                className="tactile shrink-0 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-wood-950 transition-colors"
              >
                Fundar reino
              </button>
            )}
          </div>
        )
      )}

      {danados > 0 && (
        // P350: antes solo se sabía yendo a Reino › Edificios o leyendo el Diario.
        <p role="alert" className="rounded-lg border border-cost-600/50 bg-cost-600/10 px-3.5 py-2 text-xs text-cost-400">
          ⚠️ {danados === 1 ? '1 edificio dañado' : `${danados} edificios dañados`}: no {danados === 1 ? 'cuenta' : 'cuentan'} hasta repararlo{danados === 1 ? '' : 's'} (Reino › Edificios).
        </p>
      )}

      {kingdomStats && (
        <PanelSection title="Economía">
          {/* A.8 (checklist frontend 2026-08-27) — comida/bebida en 0 o negativo se veían igual
              que cualquier otro número; es el stat con consecuencia real (población que
              depleciona) y sin ninguna lectura visual rápida de "esto va mal". */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {(Object.keys(KINGDOM_STAT_LABEL) as KingdomStatKey[]).map((key) => {
              const critico = (key === 'comida' || key === 'bebida') && kingdomStats[key] <= 0
              return (
                <TooltipAnchor key={key} text={KINGDOM_STAT_LABEL[key]} subtext={KINGDOM_STAT_HINT[key]} className="block">
                <div
                  className={`rounded-lg border px-2.5 py-2 text-center ${critico ? 'border-danger-600/50 bg-danger-600/10' : 'border-iron-700 bg-wood-950/40'}`}
                >
                  <p className="text-2xs uppercase tracking-wide text-wood-500">{KINGDOM_STAT_LABEL[key]}</p>
                  <p className={`font-mono text-sm tabular-nums ${critico ? 'text-danger-400' : 'text-accent2-300'}`}>{kingdomStats[key]}</p>
                </div>
                </TooltipAnchor>
              )
            })}
          </div>
          <SuministrosReino saveId={saveId} version={kingdomStats} onRefreshSave={onRefreshSave} />
        </PanelSection>
      )}

      {territories.length > 0 && (
        <PanelSection title="Territorios">
          {/* Leyenda de estados (Fase 0, higiene 2026-09-21) — mismo patrón `<details>` colapsado
              por defecto que ya usa ZonaPanel.tsx ("nunca puede desincronizarse de lo que de
              verdad se pinta": reutiliza las mismas etiquetas/tonos `controlLabel`/`CONTROL_TONE`
              que la propia lista de abajo). Auditoría de friendliness (2026-09-21): los 4 estados
              se traducían a español pero sin explicar qué implica cada uno para el jugador. */}
          <details className="group mb-2 rounded-lg border border-iron-700 bg-wood-950/40 text-2xs text-wood-400">
            <summary className="tactile flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 font-semibold uppercase tracking-[0.1em] text-wood-500 marker:content-none">
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
              ¿Qué significa cada estado?
            </summary>
            <div className="flex flex-col gap-1.5 border-t border-iron-800 px-3 py-2">
              {(Object.keys(controlLabel) as TerritoryInfo['control'][]).map((estado) => (
                <p key={estado} className="flex items-start gap-2">
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${CONTROL_TONE[estado]}`}>
                    {controlLabel[estado]}
                  </span>
                  <span>{TERRITORY_STATE_HINT[estado]}</span>
                </p>
              ))}
            </div>
          </details>
          {/* B.19 (checklist frontend 2026-08-27) — causa REAL de un cambio de control: felicidad
              baja/alta sostenida (`diasParaRebelion`/`diasParaConsolidar`, que manda el backend), nunca el
              conflicto de facciones del mundo (sistema distinto, ver ZonaPanel > control regional).
              Solo se muestra cuando ya hay días acumulados de verdad, no en cada visita. */}
          {/* P299 (reabierto 2026-10-22): «14 de 7 días para la rebelión» hablaba en futuro de algo que ya había
              pasado. La rebelión es un hecho solo si hay un territorio PERDIDO (`dailyTick` rebela únicamente los
              territorios que existen); con los días cumplidos y ninguno perdido todavía, falta que pase el día.
              El umbral llega del backend (`diasParaRebelion`), no se copia aquí. */}
          {kingdomStats && kingdomStats.diasFelicidadBaja >= kingdomStats.diasParaRebelion && territories.some((t) => t.control === 'PERDIDO') && (
            <p className="mb-2 text-2xs text-danger-400">
              ⚠️ El reino se ha rebelado: {kingdomStats.diasFelicidadBaja} días seguidos con la felicidad baja. Mientras siga así,
              cada territorio se pierde con sus edificios. Sube la felicidad (comida, agua, camas).
            </p>
          )}
          {kingdomStats && kingdomStats.diasFelicidadBaja >= kingdomStats.diasParaRebelion && !territories.some((t) => t.control === 'PERDIDO') && (
            <p className="mb-2 text-2xs text-danger-400">
              ⚠️ Felicidad baja: {kingdomStats.diasFelicidadBaja} días seguidos (el límite son {kingdomStats.diasParaRebelion}) — al pasar el día el
              reino se rebela y pierde el territorio con sus edificios. Sube la felicidad (comida, agua, camas) ya.
            </p>
          )}
          {kingdomStats && kingdomStats.diasFelicidadBaja > 0 && kingdomStats.diasFelicidadBaja < kingdomStats.diasParaRebelion && (
            <p className="mb-2 text-2xs text-danger-400">
              ⚠️ Felicidad baja: {kingdomStats.diasFelicidadBaja} de {kingdomStats.diasParaRebelion} días para la rebelión — si llegas a {kingdomStats.diasParaRebelion} seguidos, el reino se rebela
              y pierde el territorio con sus edificios. Sube la felicidad (comida, agua, camas) antes.
            </p>
          )}
          {kingdomStats && kingdomStats.diasFelicidadAlta > 0 && (
            <p className="mb-2 text-2xs text-accent2-400">
              ✓ Felicidad alta desde hace {kingdomStats.diasFelicidadAlta} día{kingdomStats.diasFelicidadAlta === 1 ? '' : 's'} — sostenida {kingdomStats.diasParaConsolidar} días
              seguidos, tus territorios se consolidan.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {territories.map((t) => (
              <div key={t.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="flex items-center justify-between font-medium text-wood-100">
                  {t.name}
                  <TooltipAnchor text={controlLabel[t.control]} subtext={TERRITORY_STATE_HINT[t.control]}>
                    <span className={`rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${CONTROL_TONE[t.control]}`}>
                      {controlLabel[t.control]}
                    </span>
                  </TooltipAnchor>
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

      {descansarDisponible && (
        <button type="button"
          onClick={() => {
            // El hambre y la sed cambian con el reloj: se relee antes de abrir el modal para no avisar con un dato
            // viejo (fase 1 hacia main: abrirlo antes dejaba confirmar con el aviso anterior).
            getDescansarCampamentoDisponible(saveId)
              .then((res) => setCarencia(res.carencia ?? null))
              .catch(() => {})
              .finally(() => setConfirmandoDescanso(true))
          }}
          disabled={!!consulta}
          title={consulta ?? undefined}
          className="tactile w-full rounded-lg border border-accent-600/60 bg-wood-950/40 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10"
        >
          🔥 Descansar en el campamento
        </button>
      )}

      {confirmandoDescanso && (
        <ConfirmModal
          title="Descansar en el campamento"
          message={mensajeDescanso(carencia)}
          confirmLabel="Descansar"
          tone="accent"
          confirming={descansando}
          onCancel={() => {
            setConfirmandoDescanso(false)
            setErrorDescanso(null)
          }}
          onConfirm={handleDescansar}
          error={errorDescanso}
        />
      )}
    </div>
  )
}

/// CR-53 (hito 0.3, Fase D): agua al día, topes del almacén, tesoro y sueldos, con los avisos y el
/// traspaso de Goirnos entre la bolsa y el tesoro.
function SuministrosReino({ saveId, version, onRefreshSave }: { saveId: string; version: unknown; onRefreshSave: () => Promise<void> }) {
  const consulta = useModoConsulta()
  const [eco, setEco] = useState<EconomiaReino | null>(null)
  const [cantidad, setCantidad] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let vivo = true
    getEconomiaReino(saveId)
      .then((r) => vivo && setEco(r))
      .catch(() => vivo && setEco(null))
    return () => {
      vivo = false
    }
  }, [saveId, version, recarga])
  if (!eco) return null

  async function traspasar(n: number) {
    setBusy(true)
    setError(null)
    try {
      await traspasarTesoro(saveId, n)
      setRecarga((r) => r + 1)
      await onRefreshSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mover el dinero.')
    } finally {
      setBusy(false)
    }
  }

  const avisos = avisosDeEconomia(eco)
  const fila = (label: string, valor: string, hint: string) => (
    <TooltipAnchor text={label} subtext={hint} className="block">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-wood-400">{label}</span>
        <span className="font-mono tabular-nums text-wood-200">{valor}</span>
      </div>
    </TooltipAnchor>
  )
  return (
    <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-iron-800 bg-wood-950/30 px-3 py-2">
      {avisos.map((a) => (
        <p key={a} role="alert" className="text-2xs text-danger-400">⚠️ {a}</p>
      ))}
      {fila('Agua al día', `+${eco.aguaDia} / −${eco.bocas}`, 'Lo que dan los Pozos y la fuente natural frente a lo que beben las bocas del Reino.')}
      {textoComidaDia(eco) !== null &&
        fila('Comida al día', textoComidaDia(eco)!, 'Producción de media al día de las tareas de tus trabajadores (con la estación; el reparto diario varía) frente a lo que comen las bocas del Reino.')}
      {(eco.motivosComida ?? []).map((m) => (
        <p key={m} className="text-2xs text-wood-400">🍖 {m}</p>
      ))}
      {fila('Almacén', textoAlmacen(eco), 'Guardado sobre el tope de cada cosa. El Ayuntamiento da 60 de cada una; el Granero suma 120 de comida, la Cisterna 120 de agua y la Leñera 120 de materiales. Lo que no cabe se pierde.')}
      {fila('Sueldos a la semana', `${eco.sueldosSemana} Goirnos`, '2 por trabajador y 5 por soldado o vigía. Se pagan del tesoro.')}
      {fila(
        'Equipo a la semana',
        `${eco.equipoGoirnos ?? 0} Goirnos${eco.equipoMateriales ? ` + ${eco.equipoMateriales} materiales` : ''}`,
        'Desgaste de herramientas (duran 4 semanas), armas (6) y armaduras (8). Con Herrería, Peletería o Sastrería con trabajador se fabrican en casa con materiales; si no, se compran. Si no se paga, se rompe parte del equipo.',
      )}
      {fila('Tesoro / tu bolsa', `${eco.tesoro} / ${eco.bolsa} Goirnos`, 'El tesoro del Reino y lo que llevas tú encima.')}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={cantidad}
          aria-label="Goirnos a mover"
          onChange={(e) => setCantidad(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          className="w-20 rounded border border-iron-700 bg-wood-950/60 px-2 py-1 text-xs text-wood-200"
        />
        <button type="button" disabled={busy || !!consulta} title={consulta ?? undefined} onClick={() => void traspasar(cantidad)} className="tactile rounded border border-iron-700 px-2 py-1 text-2xs text-wood-300 disabled:opacity-50">
          Al tesoro
        </button>
        <button type="button" disabled={busy || !!consulta} title={consulta ?? undefined} onClick={() => void traspasar(-cantidad)} className="tactile rounded border border-iron-700 px-2 py-1 text-2xs text-wood-300 disabled:opacity-50">
          A tu bolsa
        </button>
      </div>
      {error && <p className="text-2xs text-danger-400">{error}</p>}
    </div>
  )
}
