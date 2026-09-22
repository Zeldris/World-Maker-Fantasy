import { useEffect, useState } from 'react'
import type { BuildingInfo, KingdomStatsInfo, TerritoryInfo } from '../../../types'
import { PanelSection } from '../../PanelSection'
import { getDescansarCampamentoDisponible, postDescansarCampamento } from '../../../lib/api'
import { ConfirmModal } from '../../ConfirmModal'

// `diasFelicidadBaja`/`diasFelicidadAlta` (B.19) quedan fuera a propósito — son metadatos de
// "cuántos días lleva así", no un recurso del reino que tenga sentido como tarjeta en Economía.
type KingdomStatKey = Exclude<keyof KingdomStatsInfo, 'diasFelicidadBaja' | 'diasFelicidadAlta'>

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

/// Sub-tab "Visión general" del Reino (rediseño 2026-09-21, docs/rpgtarkor/mundo-vivo-x4.md) —
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
  // "Descansar en campamento" (2026-09-08, diseño de Álvaro: "una habilidad que solo aparecerá
  // cuando tienes construido el campamento") — visibilidad condicional real, consultada al backend
  // (mismo criterio de "Building propio ACTIVO en la Location actual" que fija el punto de
  // guardado real), no una SavedAction fija de barra.
  const [descansarDisponible, setDescansarDisponible] = useState(false)
  const [confirmandoDescanso, setConfirmandoDescanso] = useState(false)
  const [descansando, setDescansando] = useState(false)
  useEffect(() => {
    let cancelado = false
    getDescansarCampamentoDisponible(saveId)
      .then((res) => {
        if (!cancelado) setDescansarDisponible(res.disponible)
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
    try {
      await postDescansarCampamento(saveId)
      setConfirmandoDescanso(false)
      await onRefreshSave()
    } catch {
      // El modal se queda abierto con el botón reactivado — el jugador puede reintentar sin
      // perder el contexto (mismo criterio que el resto de modales de confirmación del proyecto).
    } finally {
      setDescansando(false)
    }
  }

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
                className="tactile shrink-0 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-wood-950 transition-colors"
              >
                Fundar reino
              </button>
            )}
          </div>
        )
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
                <div
                  key={key}
                  className={`rounded-lg border px-2.5 py-2 text-center ${critico ? 'border-danger-600/50 bg-danger-600/10' : 'border-iron-700 bg-wood-950/40'}`}
                >
                  <p className="text-2xs uppercase tracking-wide text-wood-500">{KINGDOM_STAT_LABEL[key]}</p>
                  <p className={`font-mono text-sm tabular-nums ${critico ? 'text-danger-400' : 'text-accent2-300'}`}>{kingdomStats[key]}</p>
                </div>
              )
            })}
          </div>
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
              baja/alta sostenida (7 días, DIAS_PARA_REBELION/CONSOLIDAR en el backend), nunca el
              conflicto de facciones del mundo (sistema distinto, ver ZonaPanel > control regional).
              Solo se muestra cuando ya hay días acumulados de verdad, no en cada visita. */}
          {kingdomStats && kingdomStats.diasFelicidadBaja > 0 && (
            <p className="mb-2 text-2xs text-danger-400">
              ⚠️ Felicidad baja desde hace {kingdomStats.diasFelicidadBaja} día{kingdomStats.diasFelicidadBaja === 1 ? '' : 's'} — si sigue así 7
              días seguidos, el reino puede rebelarse y perder el control de un territorio.
            </p>
          )}
          {kingdomStats && kingdomStats.diasFelicidadAlta > 0 && (
            <p className="mb-2 text-2xs text-accent2-400">
              ✓ Felicidad alta desde hace {kingdomStats.diasFelicidadAlta} día{kingdomStats.diasFelicidadAlta === 1 ? '' : 's'} — sostenida 7 días
              seguidos, tus territorios se consolidan.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {territories.map((t) => (
              <div key={t.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="flex items-center justify-between font-medium text-wood-100">
                  {t.name}
                  <span className={`rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${CONTROL_TONE[t.control]}`}>
                    {controlLabel[t.control]}
                  </span>
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
          onClick={() => setConfirmandoDescanso(true)}
          className="tactile w-full rounded-lg border border-accent-600/60 bg-wood-950/40 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10"
        >
          🔥 Descansar en el campamento
        </button>
      )}

      {confirmandoDescanso && (
        <ConfirmModal
          title="Descansar en el campamento"
          message="Descansarás hasta el amanecer (08:00 del día siguiente), curándote hasta Herido. Esto GUARDA la partida — reaparecerás aquí si mueres más adelante."
          confirmLabel="Descansar"
          tone="accent"
          confirming={descansando}
          onCancel={() => setConfirmandoDescanso(false)}
          onConfirm={handleDescansar}
        />
      )}
    </div>
  )
}
