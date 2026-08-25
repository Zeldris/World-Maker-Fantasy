import type { CompanionInfo } from '../../types'
import { PanelEmptyState } from '../PanelEmptyState'

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

export function CompanerosPanel({ companions }: { companions: CompanionInfo[] }) {
  if (companions.length === 0) {
    return (
      <PanelEmptyState
        icon="🤝"
        title="Vas solo por ahora"
        hint="Los aliados o súbditos que ganes durante la partida aparecerán aquí — captura y tamea fauna, o persuade a un NPC rendido, para ganar un compañero de verdad."
      />
    )
  }

  return (
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
  )
}
