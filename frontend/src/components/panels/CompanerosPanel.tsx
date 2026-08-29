import { useEffect, useState } from 'react'
import type { CompanionInfo, InventoryItemInfo, PlantillaEquipoInfo } from '../../types'
import { getTameoPendientes, asignarPlantillaCompanion, type TameoPendiente } from '../../lib/api'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { CapturaModal } from '../CapturaModal'
import { TameoModal } from '../TameoModal'
import { CompanionEquipModal } from '../CompanionEquipModal'
import { PlantillaSelect } from './ReinoPanel'
import { ResourceBar } from '../ResourceBar'
import { HealthBar } from '../HealthBar'

// Grupo 3 § Compañeros y supervivencia (2026-08-25, docs/rpgtarkor/companeros-y-supervivencia.md)
// — `felicidad: null` = compañero de quest/narración libre (comportamiento de siempre, sin capa
// mecánica que mostrar); con valor = venido de captura+tameo/persuasión de verdad, con Comida/Agua
// reales derivadas del reloj de ficción.

interface CompanerosPanelProps {
  saveId: string
  companions: CompanionInfo[]
  inventory: InventoryItemInfo[]
  /// Tras confirmar un tameo/persuasión (o equipar), el estado real viene del backend — se
  /// resincroniza la partida entera (mismo patrón que equipar, ver GameView.tsx § syncFromSave)
  /// en vez de intentar reconstruir la fila a mano aquí.
  onRefreshSave: () => Promise<void>
  /// Ficha unificada (2026-08-27, auditoría de diseño/UX § 1.3: "mitad de su ficha vive en
  /// Compañeros, la otra mitad en Reino... un jugador que quiere revisar o cambiar el equipo de un
  /// compañero integrado tiene que saber de antemano que esa gestión concreta vive en Reino") —
  /// mismas plantillas ya cargadas para ReinoPanel.tsx, reutilizadas aquí para no duplicar el
  /// fetch ni la mutación.
  plantillasEquipo: PlantillaEquipoInfo[]
}

export function CompanerosPanel({ saveId, companions, inventory, onRefreshSave, plantillasEquipo }: CompanerosPanelProps) {
  const [capturaOpen, setCapturaOpen] = useState(false)
  const [pendientes, setPendientes] = useState<TameoPendiente[]>([])
  const [tameoAbierto, setTameoAbierto] = useState<TameoPendiente | null>(null)
  const [equipoAbierto, setEquipoAbierto] = useState<CompanionInfo | null>(null)

  async function refreshPendientes() {
    try {
      const res = await getTameoPendientes(saveId)
      setPendientes(res.pendientes)
    } catch {
      // Silencioso — la lista de pendientes es un extra sobre la lista real de compañeros, no
      // bloquea nada si el barrido falla puntualmente (se reintenta al reabrir el panel).
    }
  }

  useEffect(() => {
    refreshPendientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId])

  return (
    <div className="flex flex-col gap-4">
      <button type="button"
        onClick={() => setCapturaOpen(true)}
        className="tactile w-full rounded-lg border border-accent-600/60 bg-wood-950/40 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10"
      >
        🪢 Capturar en la zona
      </button>

      {pendientes.length > 0 && (
        <PanelSection title="Pendientes de tamear/persuadir">
          <div className="flex flex-col gap-2">
            {pendientes.map((p) => (
              <button type="button"
                key={p.npcSlug}
                onClick={() => setTameoAbierto(p)}
                className="tactile flex items-center justify-between gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5 text-left transition-colors hover:border-accent-600/60"
              >
                <span className="text-xs text-wood-200">
                  {p.tipo === 'FAUNA' ? '🐾 ' : ''}
                  {p.name}
                </span>
                <span className="shrink-0 font-mono text-2xs tabular-nums text-wood-500">
                  {p.felicidad}/{p.umbral}
                </span>
              </button>
            ))}
          </div>
        </PanelSection>
      )}

      {companions.length === 0 ? (
        <PanelEmptyState
          icon="🤝"
          title="Vas solo por ahora"
          hint="Los aliados o súbditos que ganes durante la partida aparecerán aquí — captura y tamea fauna, o persuade a un NPC rendido, para ganar un compañero de verdad."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {companions.map((companion) => (
            <div key={companion.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
              <p className="font-medium text-wood-100">
                {companion.tipo === 'FAUNA' ? '🐾 ' : ''}
                {companion.name} <span className="font-sans text-xs text-wood-500">— {companion.role}</span>
                {companion.esSlotDomador && <span className="ml-1.5 text-2xs text-accent-400">(slot de Domador)</span>}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-wood-400">{companion.notes}</p>
              {/* B.14 (checklist frontend 2026-08-27) — asimetría de información frente al
                  jugador, que sí tiene HealthBar visible siempre: un compañero con capa mecánica
                  real mostraba Felicidad/Comida/Agua pero nunca su condición física, aunque el
                  dato ya existe en el backend (participa de verdad en combate múltiple). */}
              {companion.condicionFisica && (
                <div className="mt-2.5">
                  <HealthBar condicionFisica={companion.condicionFisica} />
                </div>
              )}
              {companion.felicidad !== null && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <ResourceBar label="😊 Felicidad" pct={companion.felicidad} variant="compact" />
                  {companion.comida !== null && <ResourceBar label="🍖 Comida" pct={companion.comida} variant="compact" />}
                  {companion.agua !== null && <ResourceBar label="💧 Agua" pct={companion.agua} variant="compact" />}
                </div>
              )}
              {companion.rolReino && (
                <div className="mt-1.5">
                  <p className="text-2xs italic text-wood-500">Integrado en el Reino como {companion.rolReino}.</p>
                  {plantillasEquipo.length > 0 && (
                    <PlantillaSelect
                      value={companion.plantillaEquipoId}
                      plantillas={plantillasEquipo}
                      onChange={async (id) => {
                        await asignarPlantillaCompanion(saveId, companion.id, id)
                        await onRefreshSave()
                      }}
                    />
                  )}
                </div>
              )}
              <button type="button"
                onClick={() => setEquipoAbierto(companion)}
                className="tactile mt-2 rounded border border-iron-700 px-2 py-1 text-2xs text-wood-400 transition-colors hover:border-accent-600/60 hover:text-accent-300"
              >
                Equipo
              </button>
            </div>
          ))}
        </div>
      )}

      {capturaOpen && (
        <CapturaModal
          saveId={saveId}
          onCapturado={async () => {
            setCapturaOpen(false)
            // Rediseño de captura (2026-08-28): atar ya no deja al objetivo listo para tamear
            // aquí mismo — se materializa como InventoryItem en tránsito (ver InventarioPanel.tsx
            // § Capturas en tránsito), y solo vuelve a aparecer en "Pendientes de tamear" tras
            // depositarla en una Jaula. Sin refrescar la partida entera, el jugador no vería la
            // nueva captura en su mochila hasta la siguiente acción/recarga.
            await onRefreshSave()
            refreshPendientes()
          }}
          onCancel={() => setCapturaOpen(false)}
        />
      )}

      {tameoAbierto && (
        <TameoModal
          saveId={saveId}
          pendiente={tameoAbierto}
          onConfirmado={async () => {
            setTameoAbierto(null)
            await refreshPendientes()
            await onRefreshSave()
          }}
          onSoltado={() => {
            setTameoAbierto(null)
            refreshPendientes()
          }}
          onCancel={() => setTameoAbierto(null)}
        />
      )}

      {equipoAbierto && (
        <CompanionEquipModal
          saveId={saveId}
          companion={equipoAbierto}
          inventory={inventory}
          onClose={() => setEquipoAbierto(null)}
          onChanged={onRefreshSave}
        />
      )}
    </div>
  )
}
