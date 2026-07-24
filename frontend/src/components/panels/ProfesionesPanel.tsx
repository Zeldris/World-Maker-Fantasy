import { professions } from '../../data/professions'
import type { ProfessionProgressInfo } from '../../types'

// Umbrales de professionProgress.ts (backend) — duplicados aquí a propósito, igual que
// lib/progression.ts ya duplica la tabla de XP de personaje: es una tabla fija, no un cálculo
// que valga la pena pedir al backend solo para dibujar una barra.
const PROFESSION_LEVEL_THRESHOLDS = [0, 50, 150, 350, 700]
const MAX_PROFESSION_LEVEL = PROFESSION_LEVEL_THRESHOLDS.length

function professionSpan(nivel: number, xp: number): { current: number; span: number } {
  if (nivel >= MAX_PROFESSION_LEVEL) return { current: xp, span: xp || 1 }
  const base = PROFESSION_LEVEL_THRESHOLDS[nivel - 1] ?? 0
  const next = PROFESSION_LEVEL_THRESHOLDS[nivel] ?? base
  return { current: xp - base, span: next - base }
}

interface ProfesionesPanelProps {
  currentProfession: string | null
  onAdopt: (name: string) => void
  /// Nivel de oficio (sesión de diseño 2026-07-23) — independiente de cuál esté activa ahora
  /// mismo: se recuerda el progreso de CADA oficio practicado alguna vez.
  progress: ProfessionProgressInfo[]
}

export function ProfesionesPanel({ currentProfession, onAdopt, progress }: ProfesionesPanelProps) {
  const progressById = new Map(progress.map((p) => [p.professionId, p]))

  return (
    <div className="flex flex-col gap-3">
      {currentProfession && (
        <p className="rounded-lg border border-accent-600/50 bg-accent-500/10 px-3.5 py-2.5 text-sm text-accent-300">
          Ejerce como <span className="font-medium">{currentProfession}</span>.
        </p>
      )}
      {professions.map((p) => {
        const active = p.name === currentProfession
        const oficio = progressById.get(p.id)
        const { current, span } = oficio ? professionSpan(oficio.nivel, oficio.xp) : { current: 0, span: 1 }
        const percent = span > 0 ? Math.min(100, (current / span) * 100) : 100
        return (
          <div
            key={p.id}
            className={`rounded-lg border px-3.5 py-2.5 ${
              active ? 'border-accent-600/60 bg-accent-500/5' : 'border-iron-700 bg-wood-950/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`font-medium ${active ? 'text-accent-300' : 'text-wood-100'}`}>{p.name}</p>
              {!active && (
                <button
                  onClick={() => onAdopt(p.name)}
                  className="shrink-0 rounded-lg border border-iron-700 bg-wood-950/50 px-2 py-1 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                >
                  Adoptar
                </button>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-wood-400">{p.description}</p>
            {oficio ? (
              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between text-2xs">
                  <span className="text-wood-400">
                    Nivel {oficio.nivel}
                    {oficio.nivel >= MAX_PROFESSION_LEVEL ? ' (máximo)' : ''}
                  </span>
                  <span className="font-mono tabular-nums text-wood-500">
                    {oficio.nivel >= MAX_PROFESSION_LEVEL ? `${oficio.xp} XP` : `${current} / ${span} XP`}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-iron-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-2xs italic text-wood-600">Sin practicar todavía — sube craftereando o construyendo con este oficio.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
