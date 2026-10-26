import { useEffect, useMemo, useState } from 'react'
import { isExtendedLogRoll, type EstacionKey } from '../../types'
import { getDiario, type DiarioEntry, type DiarioItem, type DiarioResponse } from '../../lib/api'
import { ESTACION_ICON } from '../../lib/entorno'
import { RollBadge } from '../RollBadge'
import { ExtendedRollBadge } from '../ExtendedRollBadge'
import { PanelEmptyState } from '../PanelEmptyState'
import { EnciclopediaLinkedText } from '../EnciclopediaLinkedText'
import { useEnciclopediaLink } from '../../context/useEnciclopediaLink'
import { notaDeHito } from '../../lib/hitos'

interface DiarioPanelProps {
  saveId: string
}

const channelLabel: Record<DiarioEntry['channel'], string> = {
  character: 'Personaje',
  world: 'Mundo',
  kingdom: 'Reino',
}

const channelClasses: Record<DiarioEntry['channel'], string> = {
  character: 'gem',
  world: 'gem2',
  kingdom: 'gem2',
}

const ESTACION_LABEL: Record<EstacionKey, string> = {
  PRIMAVERA: 'Primavera',
  VERANO: 'Verano',
  OTONO: 'Otoño',
  INVIERNO: 'Invierno',
}
const ESTACIONES_ORDEN: EstacionKey[] = ['PRIMAVERA', 'VERANO', 'OTONO', 'INVIERNO']

function tabButtonClasses(active: boolean): string {
  return `tactile flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
    active ? 'bg-wood-950/70 text-accent-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]' : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
  }`
}

/// Registro completo de la partida (rework 2026-07-24: "el log de personaje solo muestre 24h del
/// mundo... si quieres verlo todo vendrá clasificado por días en el diario"). Fetch propio y bajo
/// demanda (solo al abrir esta pestaña) — el historial completo vive aquí, no en GameView.
///
/// Rediseño en pestañas jerárquicas Año → Estación → Día (2026-09-04, petición explícita ya
/// anotada en la sesión de pruebas del 2026-09-03: "el Diario debería organizar los logs en
/// pestañas jerárquicas... que filtren el contenido mostrado, en vez de listarlo todo agrupado
/// solo visualmente"). Los capítulos (resumen por LLM cada 15 turnos) ya llegan fusionados con
/// fecha real en `entries` (`kind: 'chapter'`) — se intercalan dentro del día que les corresponde
/// en vez de un bloque fijo aparte; los capítulos legado sin fecha (`unplacedChapters`) se quedan
/// en una sección propia arriba de las pestañas.
export function DiarioPanel({ saveId }: DiarioPanelProps) {
  const { enciclopediaIndex, onEntityDetail, onEntityQuickInsert } = useEnciclopediaLink()
  const [data, setData] = useState<DiarioResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedEstacion, setSelectedEstacion] = useState<EstacionKey | null>(null)
  const [selectedDia, setSelectedDia] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    setSelectedYear(null)
    setSelectedEstacion(null)
    setSelectedDia(null)
    getDiario(saveId)
      .then((res) => {
        if (cancelled) return
        setData(res)
        // Selecciona por defecto el Año/Estación/Día MÁS RECIENTE con entradas — el jugador
        // probablemente quiere ver lo último que pasó, no forzar clic manual cada vez que abre
        // el panel.
        if (res.entries.length > 0) {
          const last = res.entries[res.entries.length - 1]
          setSelectedYear(last.year)
          setSelectedEstacion(last.estacion)
          setSelectedDia(last.diaRelativo)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [saveId])

  // Índice anidado Año → Estación → Día relativo, una sola pasada (2026-09-04).
  const byYear = useMemo(() => {
    const index = new Map<number, Map<EstacionKey, Map<number, DiarioItem[]>>>()
    for (const item of data?.entries ?? []) {
      if (!index.has(item.year)) index.set(item.year, new Map())
      const byEstacion = index.get(item.year)!
      if (!byEstacion.has(item.estacion)) byEstacion.set(item.estacion, new Map())
      const byDia = byEstacion.get(item.estacion)!
      if (!byDia.has(item.diaRelativo)) byDia.set(item.diaRelativo, [])
      byDia.get(item.diaRelativo)!.push(item)
    }
    return index
  }, [data])

  const years = useMemo(() => Array.from(byYear.keys()).sort((a, b) => a - b), [byYear])
  const estacionesDelAno =
    selectedYear !== null ? (byYear.get(selectedYear) ?? new Map<EstacionKey, Map<number, DiarioItem[]>>()) : new Map<EstacionKey, Map<number, DiarioItem[]>>()
  const estaciones = useMemo(
    () => ESTACIONES_ORDEN.filter((e) => estacionesDelAno.has(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedYear, byYear],
  )
  const diasDeEstacion = selectedEstacion !== null ? (estacionesDelAno.get(selectedEstacion) ?? new Map<number, DiarioItem[]>()) : new Map<number, DiarioItem[]>()
  const dias = useMemo(
    () => Array.from(diasDeEstacion.keys()).sort((a, b) => a - b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedYear, selectedEstacion, byYear],
  )
  const itemsDelDia = selectedDia !== null ? (diasDeEstacion.get(selectedDia) ?? []) : []

  function handleYearChange(year: number) {
    setSelectedYear(year)
    const estacionesNuevoAno = ESTACIONES_ORDEN.filter((e) => byYear.get(year)?.has(e))
    const nuevaEstacion = estacionesNuevoAno[estacionesNuevoAno.length - 1] ?? null
    setSelectedEstacion(nuevaEstacion)
    const diasNuevos = nuevaEstacion ? Array.from(byYear.get(year)?.get(nuevaEstacion)?.keys() ?? []).sort((a, b) => a - b) : []
    setSelectedDia(diasNuevos[diasNuevos.length - 1] ?? null)
  }

  function handleEstacionChange(estacion: EstacionKey) {
    setSelectedEstacion(estacion)
    const diasNuevos = selectedYear !== null ? Array.from(byYear.get(selectedYear)?.get(estacion)?.keys() ?? []).sort((a, b) => a - b) : []
    setSelectedDia(diasNuevos[diasNuevos.length - 1] ?? null)
  }

  if (failed) {
    return <PanelEmptyState icon="⚠️" title="No se pudo cargar el diario" hint="Inténtalo de nuevo más tarde." />
  }
  if (data === null) {
    return <p className="text-xs text-wood-400">Cargando...</p>
  }
  if (data.entries.length === 0 && data.unplacedChapters.length === 0) {
    return <PanelEmptyState icon="📜" title="Todavía no hay nada que registrar" hint="Lo que vivas jugando irá apareciendo aquí, capítulo a capítulo." />
  }

  return (
    <div className="flex flex-col gap-3">
      {data.unplacedChapters.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Capítulos antiguos sin fecha</p>
          {data.unplacedChapters.map((c) => (
            <div key={c.chapterNumber} className="rounded-lg border border-accent-600/40 bg-accent-500/5 px-3.5 py-2.5">
              <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-400">Capítulo {c.chapterNumber}</p>
              <p className="text-sm leading-relaxed text-wood-200">
                <EnciclopediaLinkedText
                  text={c.summary}
                  index={enciclopediaIndex}
                  onDetail={(t) => onEntityDetail?.(t)}
                  onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                />
              </p>
            </div>
          ))}
        </div>
      )}

      {years.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5 border-b border-iron-800 pb-2">
            {years.map((year) => (
              <button type="button" key={year} onClick={() => handleYearChange(year)} className={tabButtonClasses(selectedYear === year)}>
                Año {year}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-iron-800 pb-2">
            {estaciones.map((estacion) => (
              <button type="button" key={estacion} onClick={() => handleEstacionChange(estacion)} className={tabButtonClasses(selectedEstacion === estacion)}>
                <span className="text-sm leading-none">{ESTACION_ICON[estacion]}</span>
                {ESTACION_LABEL[estacion]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-iron-800 pb-2">
            {dias.map((dia) => (
              <button type="button" key={dia} onClick={() => setSelectedDia(dia)} className={tabButtonClasses(selectedDia === dia)}>
                Día {dia}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {itemsDelDia.map((item) =>
              item.kind === 'chapter' ? (
                <div key={`chapter-${item.chapterNumber}`} className="rounded-lg border border-accent-600/40 bg-accent-500/5 px-3.5 py-2.5">
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-400">Capítulo {item.chapterNumber}</p>
                  <p className="text-sm leading-relaxed text-wood-200">
                    <EnciclopediaLinkedText
                      text={item.summary}
                      index={enciclopediaIndex}
                      onDetail={(t) => onEntityDetail?.(t)}
                      onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                    />
                  </p>
                </div>
              ) : (
                <div key={item.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={channelClasses[item.channel]} />
                    <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-400">{channelLabel[item.channel]}</span>
                    <span className="text-wood-600">·</span>
                    <span className="text-2xs tracking-wide text-wood-400">{item.timeLabel}</span>
                    {/* UX 2026-09-01: `xpDelta` es el TOTAL del turno (tirada + hito); igual que en
                        LogPanel, aquí solo se muestra el resto tras quitar la parte de hito (que
                        tiene su propio chip 📖 al lado) — evita contar el mismo XP dos veces y un
                        "+0 XP" confuso en un turno fallido con solo hito detrás. */}
                    {!!item.xpDelta && item.xpDelta - (item.xpHitoDelta ?? 0) > 0 && (
                      <span className="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent-300">
                        +{item.xpDelta - (item.xpHitoDelta ?? 0)} XP
                      </span>
                    )}
                    {!!item.xpHitoDelta && (
                      <span title={notaDeHito(item.xpHitoLabel) ?? undefined} className="rounded-full border border-quest-600/50 bg-quest-500/10 px-1.5 py-0.5 font-mono text-2xs text-quest-400">
                        📖 {item.xpHitoLabel ?? 'Hito'} (+{item.xpHitoDelta} XP)
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-wood-200">
                    <EnciclopediaLinkedText
                      text={item.text}
                      index={enciclopediaIndex}
                      onDetail={(t) => onEntityDetail?.(t)}
                      onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                    />
                  </p>
                  {item.roll && (isExtendedLogRoll(item.roll) ? <ExtendedRollBadge roll={item.roll} /> : <RollBadge roll={item.roll} />)}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
