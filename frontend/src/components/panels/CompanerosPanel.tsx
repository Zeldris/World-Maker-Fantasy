import { useEffect, useState } from 'react'
import type { CompanionInfo } from '../../types'
import { getTameoPendientes, type TameoPendiente } from '../../lib/api'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { CapturaModal } from '../CapturaModal'
import { TameoModal } from '../TameoModal'

// Grupo 3 § Compañeros y supervivencia (2026-08-25, docs/rpgtarkor/companeros-y-supervivencia.md)
// — `felicidad: null` = compañero de quest/narración libre (comportamiento de siempre, sin capa
// mecánica que mostrar); con valor = venido de captura+tameo/persuasión de verdad, con Comida/Agua
// reales derivadas del reloj de ficción.
function MiniBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-1.5 text-2xs text-wood-400">
      <span className="w-14 shrink-0">{label}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-iron-800">
        <div
          className={`h-full rounded-full ${pct < 25 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono tabular-nums">{pct}%</span>
    </div>
  )
}

interface CompanerosPanelProps {
  saveId: string
  companions: CompanionInfo[]
  /// Tras confirmar un tameo/persuasión, el nuevo Companion viene del backend — se resincroniza
  /// la partida entera (mismo patrón que equipar, ver GameView.tsx § syncFromSave) en vez de
  /// intentar reconstruir la fila a mano aquí.
  onRefreshSave: () => Promise<void>
}

export function CompanerosPanel({ saveId, companions, onRefreshSave }: CompanerosPanelProps) {
  const [capturaOpen, setCapturaOpen] = useState(false)
  const [pendientes, setPendientes] = useState<TameoPendiente[]>([])
  const [tameoAbierto, setTameoAbierto] = useState<TameoPendiente | null>(null)

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
      <button
        onClick={() => setCapturaOpen(true)}
        className="tactile w-full rounded-lg border border-accent-600/60 bg-wood-950/40 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10"
      >
        🪢 Capturar en la zona
      </button>

      {pendientes.length > 0 && (
        <PanelSection title="Pendientes de tamear/persuadir">
          <div className="flex flex-col gap-2">
            {pendientes.map((p) => (
              <button
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
              {companion.felicidad !== null && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <MiniBar label="😊 Felicidad" pct={companion.felicidad} />
                  {companion.comida !== null && <MiniBar label="🍖 Comida" pct={companion.comida} />}
                  {companion.agua !== null && <MiniBar label="💧 Agua" pct={companion.agua} />}
                </div>
              )}
              {companion.rolReino && (
                <p className="mt-1.5 text-2xs italic text-wood-500">Integrado en el Reino como {companion.rolReino}.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {capturaOpen && (
        <CapturaModal
          saveId={saveId}
          onCapturado={() => {
            setCapturaOpen(false)
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
    </div>
  )
}
