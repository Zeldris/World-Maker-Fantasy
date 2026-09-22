import { useEffect, useState } from 'react'
import { construirEnParcela, getParcela } from '../lib/api'
import type { LogEntry, ParcelaDetailInfo, ProfessionRecipeInfo, RecipeStatusInfo, ZonaParcelaInfo } from '../types'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

interface ParcelaDetailModalProps {
  saveId: string
  parcela: ZonaParcelaInfo
  /// Roster estático de recetas (GET /profession-recipes, ya cargado una vez en GameView.tsx) —
  /// única fuente real de `name`/`description` por `recipeKey`; `RecipeStatusInfo` (candidatas de
  /// esta parcela) solo trae el estado real de materiales/bloqueo, nunca el texto de la receta.
  professionRecipes: ProfessionRecipeInfo[]
  onCancel: () => void
  /// Construir es DIRECTO, sin /turn/narrate (mismo criterio que "Descansar en campamento", ver
  /// docs/rpgtarkor/mundo-vivo-x4.md § 7.4) — el caller decide qué refrescar (Save/Zona) tras el
  /// éxito y cierra el modal. `logEntry` ya viene resuelto por completo del backend
  /// (`toFrontendLogEntry`), sin campos que fabricar a mano en el cliente.
  onConstruido: (logEntry: LogEntry) => void
}

function recipeLabel(recipeKey: string, professionRecipes: ProfessionRecipeInfo[]): { name: string; description: string } {
  const found = professionRecipes.find((r) => r.recipeKey === recipeKey)
  // Fallback al propio recipeKey (nunca debería pasar con el catálogo real, pero evita una
  // tarjeta en blanco si professionRecipes todavía no ha terminado de cargar).
  return found ? { name: found.ability.name, description: found.ability.description } : { name: recipeKey, description: '' }
}

// Mismo criterio de texto combinado que `readinessTooltip` (HabilidadesPanel.tsx) — reescrito en
// vez de importado porque ese vive acoplado a JSX de tarjeta, no a un párrafo de modal.
function motivoNoDisponible(status: RecipeStatusInfo): string | null {
  const parts: string[] = []
  const faltantes = status.ingredients.filter((i) => !i.met)
  if (faltantes.length > 0) {
    parts.push(`Necesitas: ${faltantes.map((i) => `${i.label} ${i.tienes}/${i.necesitas}`).join(', ')}.`)
  }
  if (status.missingRequisitos.length > 0) {
    parts.push(`Falta: ${status.missingRequisitos.join(', ')}.`)
  }
  if (!status.locationOk && status.requiredLocationName) {
    const lugares = Array.isArray(status.requiredLocationName) ? status.requiredLocationName.join(', ') : status.requiredLocationName
    parts.push(`Debes estar en ${lugares}.`)
  }
  if (status.blockedReason) {
    parts.push(`${status.blockedReason[0].toUpperCase()}${status.blockedReason.slice(1)}.`)
  }
  return parts.length > 0 ? parts.join(' ') : null
}

/// Modal del icono de parcela en el mapa de Zona (docs/rpgtarkor/mundo-vivo-x4.md § 7.4,
/// 2026-09-21) — mismo patrón que `ZonaSalidaModal`/`ZonePointDetailModal`: el mapa solo pinta el
/// icono con lo mínimo (`ZonaParcelaInfo`), el detalle real (candidatas + `blockedReason`) se pide
/// aquí, bajo demanda, al abrirse. AVANZADA solo tiene 1 candidata fija (`recipeKeyFijo`, el
/// jugador no elige); BASICA lista todas las que apliquen y el jugador elige cuál construir.
export function ParcelaDetailModal({ saveId, parcela, professionRecipes, onCancel, onConstruido }: ParcelaDetailModalProps) {
  const [detail, setDetail] = useState<ParcelaDetailInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecipeKey, setSelectedRecipeKey] = useState<string | null>(null)
  const [construyendo, setConstruyendo] = useState(false)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(null)
    getParcela(saveId, parcela.id)
      .then((res) => {
        if (cancelado) return
        setDetail(res)
        // AVANZADA solo tiene 1 candidata — se preselecciona sola, sin que el jugador tenga que
        // elegir nada (mismo criterio que su propio backend: "el jugador NO elige").
        if (res.parcela.tipo === 'AVANZADA' && res.candidates.length === 1) setSelectedRecipeKey(res.candidates[0].recipeKey)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el estado de esta parcela.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [saveId, parcela.id])

  async function handleConstruir() {
    if (!selectedRecipeKey) return
    setConstruyendo(true)
    setError(null)
    try {
      const res = await construirEnParcela(saveId, parcela.id, selectedRecipeKey)
      onConstruido(res.logEntry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo construir aquí.')
    } finally {
      setConstruyendo(false)
    }
  }

  // Ya ocupada — el propio `ZonaParcelaInfo` del mapa ya lo sabe, sin esperar al GET, para no
  // parpadear "cargando" en un caso que no necesita pedir nada.
  if (parcela.building) {
    return (
      <SelectionModalShell title={parcela.building.name} onCancel={onCancel}>
        <p className="text-xs text-wood-300">Ya hay una construcción aquí.</p>
      </SelectionModalShell>
    )
  }

  const selectedStatus = detail?.candidates.find((c) => c.recipeKey === selectedRecipeKey)
  // Título real con el nombre de la zona-interior en vez de "Parcela vacía" genérico (Fase 0,
  // higiene 2026-09-21) — solo disponible tras el GET (`detail.parcela.locationName`); mientras
  // carga, cae a un título neutro que no promete nada que el GET todavía no confirmó.
  const title = detail ? `Parcela vacía — ${detail.parcela.locationName ?? 'zona'}` : 'Parcela'
  // Frase corta por tipo — el jugador nunca elige en AVANZADA (posición ya decide qué se
  // construye), solo en BASICA (varias candidatas reales). Comunicado en vez de solo "notado" por
  // el radio deshabilitado.
  const subtitle =
    detail?.parcela.tipo === 'AVANZADA'
      ? 'Esta parcela solo admite un edificio concreto.'
      : detail?.parcela.tipo === 'BASICA'
        ? 'Elige qué construir aquí.'
        : null

  return (
    <SelectionModalShell
      title={title}
      onCancel={onCancel}
      cancelDisabled={construyendo}
      footer={
        detail && detail.candidates.length > 0 ? (
          <button
            type="button"
            onClick={handleConstruir}
            disabled={!selectedRecipeKey || !selectedStatus?.met || construyendo}
            className={confirmButtonClasses('accent')}
          >
            {construyendo ? 'Construyendo…' : 'Construir'}
          </button>
        ) : undefined
      }
    >
      {loading && <p className="text-xs text-wood-400">Consultando la parcela…</p>}
      {error && <p className="text-xs text-danger-400">{error}</p>}
      {subtitle && <p className="text-xs text-wood-400">{subtitle}</p>}
      {!loading && detail && detail.candidates.length === 0 && (
        <p className="text-xs italic text-wood-500">Nada que construir aquí todavía.</p>
      )}
      {!loading && detail && detail.candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* BASICA: varias candidatas, el jugador elige. AVANZADA: 1 sola, ya preseleccionada —
              se muestra igual (sin radio, solo su tarjeta) para que el texto no cambie de forma
              entre los dos tipos. */}
          {detail.candidates.map((c) => {
            const { name, description } = recipeLabel(c.recipeKey, professionRecipes)
            const selected = c.recipeKey === selectedRecipeKey
            return (
              <button
                key={c.recipeKey}
                type="button"
                onClick={() => setSelectedRecipeKey(c.recipeKey)}
                disabled={detail.parcela.tipo === 'AVANZADA'}
                className={`tactile rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:cursor-default ${
                  selected ? 'border-accent-600/70 bg-accent-600/10 text-accent-200' : 'border-iron-700 bg-wood-950/40 text-wood-300 hover:border-accent-600/40'
                }`}
              >
                <p className="font-bold">{name}</p>
                {description && <p className="mt-0.5 text-2xs text-wood-400">{description}</p>}
                {!c.met && (
                  <p className="mt-1 text-2xs text-cost-400">{motivoNoDisponible(c) ?? 'Todavía no cumples las condiciones.'}</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </SelectionModalShell>
  )
}
