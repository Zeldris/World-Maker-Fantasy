import type { ExtendedLogRoll, GatheringRollInfo, IniciativaEncuentroLogRoll, RollInfo, SegundaTiradaInfo } from '../types'
import { attributeLabels } from '../lib/dice'
import { DiceRollVs } from './DiceRoll'
import { GatheringDiceReveal } from './GatheringDiceReveal'

/// Fase 10 (2026-09-29, "todas las tiradas visibles") — pinta las tiradas que antes se descartaban
/// en el backend (`LogEntry.roll` con `kind`, ver `ExtendedLogRoll`, types.ts). Mismo criterio que
/// `RollBadge` (estático, histórico: recarga/Diario) vs `DiceRollSingle` (en vivo, la primera vez
/// que se ve): `live` reutiliza `GatheringDiceReveal` (d20 de recolección) y `DiceRollVs` (tirada
/// opuesta) tal cual; los dados que no son d20 (d100 de la caza sigilosa, d6 del grupo) y las listas
/// se pintan como badge estático con el mismo lenguaje visual de `RollBadge`.

const BADGE = 'mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2.5 py-1 font-mono text-2xs'
const OK = 'border-moss-600/60 bg-moss-500/10 text-moss-400 animate-stamp-in'
const KO = 'border-iron-700 bg-iron-800/80 text-wood-400 animate-shake-no'

const GRADO_LABEL: Record<SegundaTiradaInfo['grado'], string> = { claro: 'Éxito', con_coste: 'Éxito parcial', fallo: 'Fallo' }

/// Desglose estático de una tirada de recolección: dado(s) + bono = total.
export function GatheringRollBadge({ roll, label }: { roll: GatheringRollInfo; label?: string }) {
  const bono = Math.floor(roll.value / 2) + roll.bonusOficio
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      {label && <span>{label}</span>}
      <span>{attributeLabels[roll.attribute]}</span>
      <span className="text-wood-600">·</span>
      <span>
        🎲{roll.rolls.length > 1 ? roll.rolls.join('/') : roll.rolls[0]} + {bono} = {roll.result}
      </span>
      {roll.advantage && <span title="Ventaja por Suerte: se queda con el mejor de los dos dados">🍀</span>}
    </span>
  )
}

export function SegundasTiradasBadge({ segundas }: { segundas: SegundaTiradaInfo[] }) {
  return (
    <div className="mt-2 flex flex-col items-start gap-1" data-testid="segundas-tiradas">
      {segundas.map((s, i) => (
        <div key={`${s.sourceSlug}:${s.itemSlug}:${i}`} className={`${BADGE} ${s.paso ? OK : KO}`}>
          <span className="font-semibold">{s.itemName}</span>
          <span className="text-wood-600">·</span>
          <GatheringRollBadge roll={s.roll} />
          <span>vs {s.dificultad}</span>
          <span className="text-wood-600">·</span>
          <span className="font-semibold">{GRADO_LABEL[s.grado]}</span>
        </div>
      ))}
    </div>
  )
}

function ladoToRollInfo(lado: IniciativaEncuentroLogRoll['jugador'], gana: boolean): RollInfo {
  return { attribute: lado.attribute, value: lado.value, roll: lado.roll, result: lado.result, difficulty: 0, success: gana, gradoExito: gana ? 'claro' : 'fallo' }
}

export function IniciativaEncuentroBadge({ roll, characterName, live }: { roll: IniciativaEncuentroLogRoll; characterName?: string; live?: boolean }) {
  const jugadorGana = roll.quienInicia === 'jugador'
  const tuNombre = characterName ?? 'Tú'
  if (live) {
    return (
      <>
        <p className="mt-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-400">¿Quién ve a quién primero?</p>
        <DiceRollVs left={ladoToRollInfo(roll.jugador, jugadorGana)} right={ladoToRollInfo(roll.npc, !jugadorGana)} leftLabel={tuNombre} rightLabel={roll.npcName} leftFirst showDifficulty={false} />
      </>
    )
  }
  return (
    <div className={`${BADGE} ${jugadorGana ? OK : KO}`} data-testid="iniciativa-encuentro">
      <span>{tuNombre}</span>
      <span>
        🎲{roll.jugador.roll} + {roll.jugador.bono} = {roll.jugador.result}
      </span>
      <span className="text-wood-600">vs</span>
      <span>{roll.npcName}</span>
      <span>
        🎲{roll.npc.roll} + {roll.npc.bono} = {roll.npc.result}
      </span>
      <span className="text-wood-600">·</span>
      <span className="font-semibold">{jugadorGana ? 'Lo ves primero' : 'Te ve primero'}</span>
    </div>
  )
}

export function ExtendedRollBadge({ roll, characterName, live = false }: { roll: ExtendedLogRoll; characterName?: string; live?: boolean }) {
  switch (roll.kind) {
    case 'recoleccion':
      return (
        <>
          {roll.tirada &&
            (live ? (
              <GatheringDiceReveal roll={roll.tirada} oficioLabel="Recolección" />
            ) : (
              <div className={`${BADGE} ${OK}`} data-testid="recoleccion-tirada">
                <GatheringRollBadge roll={roll.tirada} label="Explorar" />
              </div>
            ))}
          {roll.segundas && roll.segundas.length > 0 && <SegundasTiradasBadge segundas={roll.segundas} />}
        </>
      )
    case 'iniciativa-encuentro':
      return <IniciativaEncuentroBadge roll={roll} characterName={characterName} live={live} />
    case 'caza-sigilo':
      return (
        <div className={`${BADGE} ${roll.exito ? OK : KO}`} data-testid="caza-sigilo">
          <span>Sigilo</span>
          <span className="text-wood-600">·</span>
          <span>
            🎲{roll.roll} (d100) {roll.exito ? '≤' : '>'} {roll.chance}%
          </span>
          <span className="text-wood-600">·</span>
          <span className="font-semibold">{roll.exito ? 'Éxito' : 'Te detecta'}</span>
        </div>
      )
    case 'combate-grupo':
      return <CombateGrupoBadge roll={roll} />
  }
}

const DELTA_LABEL: Record<-1 | 0 | 1, string> = { [-1]: 'uno menos', 0: 'los elegidos', 1: 'uno más' }

export function CombateGrupoBadge({ roll }: { roll: Extract<ExtendedLogRoll, { kind: 'combate-grupo' }> }) {
  return (
    <div className="mt-2 flex flex-col items-start gap-1.5" data-testid="combate-grupo">
      {roll.engagement.map((e) => (
        <div key={e.slug} className={`${BADGE} ${OK}`}>
          <span className="font-semibold">{e.name}</span>
          <span className="text-wood-600">·</span>
          <span>🎲{e.roll} (d6)</span>
          <span>
            → {DELTA_LABEL[e.delta]}: {e.cantidadElegida} elegidos, {e.cantidadReal} de {e.avistados} entran
          </span>
        </div>
      ))}
      {roll.iniciativa.length > 0 && (
        <div className="rounded-md border border-iron-700 bg-wood-950/30 px-2.5 py-1.5 font-mono text-2xs text-wood-300">
          <p className="mb-0.5 font-semibold uppercase tracking-[0.14em] text-accent-400">Iniciativa</p>
          <ol className="list-inside list-decimal space-y-0.5">
            {roll.iniciativa.map((p) => (
              <li key={p.participantId} className={p.bando === 'JUGADOR' ? 'text-moss-400' : 'text-wood-300'}>
                {p.nombre}: 🎲{p.roll} + {Math.floor(p.value / 2)} = {p.result}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
