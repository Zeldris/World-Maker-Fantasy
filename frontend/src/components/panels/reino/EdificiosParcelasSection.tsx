import type { BuildingInfo } from '../../../types'
import { PanelSection } from '../../PanelSection'

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

interface EdificiosParcelasSectionProps {
  buildings: BuildingInfo[]
}

/// Sub-tab "Edificios y Parcelas" del Reino (rediseño 2026-09-21) — extraído de `ReinoPanel.tsx`
/// sin cambios funcionales.
///
/// TODO (§ 7.4 pieza 6 / hueco G, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 5-Fase-5): construir un Cuartel
/// Avanzado (y sus mejoras Cuartel de Guerra / Puesto Comercial) sigue exigiendo `/turn/narrate`
/// (texto libre interpretado por el LLM) — no hay botón directo aquí todavía. Depende de confirmar
/// si alguna `Parcela AVANZADA` del seed real ya tiene `recipeKeyFijo: 'cuartel-avanzado'` (sin
/// confirmar); hasta entonces, no se promete aquí un flujo que el backend no puede cumplir.
export function EdificiosParcelasSection({ buildings }: EdificiosParcelasSectionProps) {
  if (buildings.length === 0) return <p className="text-xs text-wood-500">Sin edificios todavía.</p>

  return (
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
      <div className="flex flex-col gap-2">
        {buildings.map((b) => (
          <div key={b.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
            <p className="flex items-center justify-between font-medium text-wood-100">
              {b.name}
              <span className={`rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${BUILDING_STATUS_TONE[b.status]}`}>
                {buildingStatusLabel[b.status]}
              </span>
            </p>
            <p className="mt-0.5 text-2xs text-wood-500">
              {b.kind}
              {b.recipeKey === 'ayuntamiento' && b.tier && ` · Ayuntamiento ${AYUNTAMIENTO_TIER_LABEL[b.tier] ?? b.tier}`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-wood-400">{b.description}</p>
          </div>
        ))}
      </div>
    </PanelSection>
  )
}
