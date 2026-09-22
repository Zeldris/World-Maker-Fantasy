import { useEffect, useState } from 'react'
import type { FactionRelationInfo } from '../lib/api'
import { getFactionRelations } from '../lib/api'
import { SelectionModalShell } from './SelectionModalShell'
import { razaThemeStyleVars } from '../lib/razaTheme'

// Mismo lenguaje visual que RELATION_LABEL/RELATION_TONE de DiplomaciaMercadoSection.tsx — aquí
// entre facciones NPC en vez de jugador↔facción, pero la escala/bandas son las mismas del backend
// (factionRelations.ts), no se reinventan.
const RELATION_LABEL: Record<FactionRelationInfo['type'], string> = {
  ALIANZA: 'Alianza',
  TRATADO_COMERCIAL: 'Tratado comercial',
  NEUTRAL: 'Neutral',
  TENSION: 'Tensión',
  GUERRA: 'Guerra',
}

const RELATION_TONE: Record<FactionRelationInfo['type'], string> = {
  ALIANZA: 'text-accent-300',
  TRATADO_COMERCIAL: 'text-moss-400',
  NEUTRAL: 'text-wood-300',
  TENSION: 'text-cost-400',
  GUERRA: 'text-danger-400',
}

interface RelacionesFaccionesModalProps {
  worldSlug: string
  saveId: string | null
  onCancel: () => void
}

/// Mapa de relaciones entre facciones NPC (Fase 4, 2026-09-21, docs/rpgtarkor/mundo-vivo-x4.md
/// § 4.3) — colgado de ReputacionPanel.tsx vía botón "Ver relaciones entre facciones" (vive
/// conceptualmente ahí, no en Reino: es el eje mundo/facciones, mismo criterio que ya usa
/// Reputación). Listado de pares, no grafo — con solo 4 facciones sembradas hoy, un layout de red
/// es sobreingeniería frente al valor real; este listado ya sería la base de datos de un grafo
/// futuro sin volver a tocar el backend. `razaThemeStyleVars` en cada lado del par — aquí es donde
/// más se nota la paleta por raza (borde orco a la izquierda, borde goirnte a la derecha, p.ej.).
export function RelacionesFaccionesModal({ worldSlug, saveId, onCancel }: RelacionesFaccionesModalProps) {
  const [relations, setRelations] = useState<FactionRelationInfo[] | null>(null)

  useEffect(() => {
    let cancelado = false
    getFactionRelations(worldSlug, saveId ?? undefined)
      .then((res) => {
        if (!cancelado) setRelations(res.relations)
      })
      .catch(() => {
        if (!cancelado) setRelations([])
      })
    return () => {
      cancelado = true
    }
  }, [worldSlug, saveId])

  return (
    <SelectionModalShell title="Relaciones entre facciones" onCancel={onCancel}>
      {relations === null && <p className="text-xs text-wood-400">Consultando…</p>}
      {relations && relations.length === 0 && (
        <p className="text-xs italic text-wood-500">Todavía no has descubierto suficientes facciones como para conocer cómo se llevan entre sí.</p>
      )}
      {relations && relations.length > 0 && (
        <div className="flex flex-col gap-2">
          {relations.map((r) => (
            <div key={`${r.sourceFactionSlug}-${r.targetFactionSlug}`} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span style={razaThemeStyleVars(r.sourceRaza)} className="rounded-full border border-[var(--raza-border,var(--color-iron-700))] px-2 py-0.5 text-[var(--raza-text,var(--color-wood-300))]">
                  {r.sourceFactionName}
                </span>
                <span className="text-wood-600">→</span>
                <span style={razaThemeStyleVars(r.targetRaza)} className="rounded-full border border-[var(--raza-border,var(--color-iron-700))] px-2 py-0.5 text-[var(--raza-text,var(--color-wood-300))]">
                  {r.targetFactionName}
                </span>
              </div>
              <p className={`mt-1.5 text-2xs font-bold uppercase tracking-wide ${RELATION_TONE[r.type]}`}>
                {RELATION_LABEL[r.type]} <span className="font-mono font-normal normal-case text-wood-500">({r.presion}/100)</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </SelectionModalShell>
  )
}
