import type { CombatExchangeInfo, CombatExchangeOutcome, CombatExchangeSideInfo } from '../types'
import { attributeLabels, attributeColorClasses } from '../lib/dice'
import { TooltipAnchor } from './TooltipAnchor'

// Espejo exacto de `difficultyHintFor` (backend, npcScene.ts) — la MISMA diferencia de nivel que
// decide la dificultad real de la tirada; aquí ya solo llega el número final, no el nivel de cada
// lado, así que se reconstruye el nombre por umbral en vez de por diferencia (mismo criterio ya
// usado en `combatDifficulty.ts` para el aviso previo a "Combatir"). Petición explícita,
// 2026-08-14, tras preguntar qué significaba "necesitaba 15": un número pelado sin más contexto
// no explica de dónde sale ni que es fijo (no depende de la tirada del rival).
function difficultyLabelFor(difficulty: number): string {
  if (difficulty <= 12) return 'Fácil'
  if (difficulty <= 15) return 'Media'
  if (difficulty <= 18) return 'Difícil'
  return 'Muy difícil'
}

// Mismos 3 colores que RollBadge.tsx (claro/con_coste/fallo) — coherencia visual entre los dos
// tipos de tirada (acción libre vs intercambio de combate).
const GRADE_TEXT: Record<'claro' | 'con_coste' | 'fallo', string> = {
  claro: 'text-moss-400',
  con_coste: 'text-cost-400',
  fallo: 'text-wood-400',
}

const SIDE_LABEL: Record<'claro' | 'con_coste' | 'fallo', string> = {
  claro: 'Éxito',
  con_coste: 'Éxito con coste',
  fallo: 'Fallo',
}

// Traducción corta de `ExchangeOutcome` (combatExchange.ts, backend) — decisión ya tomada por el
// motor determinista, esto solo la explica en una frase (revisión de partida 2026-08-08, petición
// explícita: "por qué perdiste o ganaste la tirada"). 'independiente' añadido 2026-08-13 (bug real:
// faltaba, se veía en blanco para cualquier habilidad de utilidad/ANALISIS).
//
// Convertida a función con los números reales (bug real jugando en vivo, 2026-08-15: "he sacado yo
// más y he perdido... esto está mal explicado" — la frase estática "El ataque falla del todo." no
// decía POR QUÉ, así que un jugador con la tirada bruta más alta (13 vs 8) no entendía cómo había
// "perdido" el intercambio contra un número menor; la clave es que cada lado compara su propio
// resultado contra SU PROPIA dificultad, nunca contra el número del rival). Ahora cita los mismos
// resultado/dificultad que ya se ven en las filas de abajo, para que la frase final cierre el
// círculo en vez de repetir un genérico.
function outcomeLabelFor(exchange: CombatExchangeInfo, nombreAtacante: string, nombreDefensor: string): string {
  const { atacante, defensor } = exchange
  switch (exchange.resultado) {
    case 'ataque_falla':
      return `El ataque de ${nombreAtacante} (${atacante.result}) no alcanza la dificultad que necesitaba (${atacante.difficulty}) — no llega a tocar a ${nombreDefensor}.`
    case 'defensor_contragolpea':
      return `El ataque de ${nombreAtacante} (${atacante.result}) no alcanza la dificultad que necesitaba (${atacante.difficulty}), pero la defensa de ${nombreDefensor} (${defensor.result}) supera la suya (${defensor.difficulty}) de sobra — responde con un golpe propio.`
    case 'parada_en_seco':
      return `${nombreDefensor} (${defensor.result}) supera de sobra la dificultad que necesitaba (${defensor.difficulty}) — bloquea o esquiva el ataque de ${nombreAtacante} sin daño.`
    case 'golpes_mutuos':
      return `${nombreAtacante} y ${nombreDefensor} superan cada uno su propia dificultad de forma pareja — los dos acusan algo.`
    case 'golpe_normal':
      return `El ataque de ${nombreAtacante} (${atacante.result}) supera su dificultad (${atacante.difficulty}) con más margen que la defensa de ${nombreDefensor} la suya (${defensor.difficulty}) — el golpe conecta.`
    case 'golpe_pleno':
      return `El ataque de ${nombreAtacante} (${atacante.result}) supera de sobra su dificultad (${atacante.difficulty}), y la defensa de ${nombreDefensor} falla del todo — el golpe conecta de lleno.`
    case 'independiente':
      return 'Cada lado se juzga por su cuenta — no hay un bando que "gane" el intercambio.'
  }
}

// Rediseño (2026-08-13, petición explícita: "que salga más claro, attr vs attr, tirada de un att,
// tirada del otro y luego los cálculos e indicar quién gana") — quién se lleva el intercambio según
// `ExchangeOutcome` (backend, OUTCOME_TABLE de combatExchange.ts): 'atacante'/'defensor' son
// posiciones (quién tenía la iniciativa este intercambio, ver `atacanteEsJugador`), no bandos fijos.
// null = sin ganador cruzado (independiente, cada lado se resuelve solo) o empate real.
const WINNER_SIDE: Record<CombatExchangeOutcome, 'atacante' | 'defensor' | 'empate' | null> = {
  defensor_contragolpea: 'defensor',
  ataque_falla: 'defensor',
  parada_en_seco: 'defensor',
  golpes_mutuos: 'empate',
  golpe_normal: 'atacante',
  golpe_pleno: 'atacante',
  independiente: null,
}

function gradoOf(side: CombatExchangeSideInfo): 'claro' | 'con_coste' | 'fallo' {
  return side.gradoExito ?? (side.success ? 'claro' : 'fallo')
}

/// 'jugador' | 'enemigo' | 'empate' | null (null = independiente, sin ganador cruzado) — quién se
/// lleva el intercambio, en términos de lado real (no de posición atacante/defensor).
function winnerSide(exchange: CombatExchangeInfo): 'jugador' | 'enemigo' | 'empate' | null {
  const side = WINNER_SIDE[exchange.resultado]
  if (side === null) return null
  if (side === 'empate') return 'empate'
  const ganaJugador = (side === 'atacante') === exchange.atacanteEsJugador
  return ganaJugador ? 'jugador' : 'enemigo'
}

// 2 decimales como mucho, sin ceros de sobra (1.5 en vez de 1.50; 0.67 en vez de 0.666666...) —
// `typeMultiplierFor` (attributeWheel.ts) devuelve fracciones exactas tipo 1/1.15 en desventaja.
function formatMultiplier(m: number): string {
  return (Math.round(m * 100) / 100).toString()
}

// Rediseño (2026-08-14, tres peticiones explícitas seguidas: 1) "tiene que ser en un solo log lo
// que sacaste tú vs lo que sacó él [de cada attr] y los multiplicadores... dando el resultado
// final"; 2) viéndolo ya en partida, "baja el tamaño de letra, ponle algún borde y haz que esté
// todo más organizado"; 3) "deberías poner algo así como 10 vs 22 y poner la mención al npc o
// personaje que ganó el turno") — las dos filas son hijas DIRECTAS de la rejilla del componente
// exportado más abajo (fragmento `<>`, sin `<div>` propio) para que las columnas midan lo mismo
// en las dos filas y todo quede alineado de verdad. Bug real de paso (ronda 2): la rejilla no
// tenía `gap-x` — sin separación explícita entre columnas, "necesitaba 12" y "Éxito" quedaban
// pegados en cuanto el contenido de una fila era más ancho que el de la otra.
function SideRow({ label, side, isWinner, withTopBorder }: { label: string; side: CombatExchangeSideInfo; isWinner: boolean; withTopBorder: boolean }) {
  const grado = gradoOf(side)
  // Bug real (revisión de rediseño de combate, 2026-08-09): el bono mostrado se calculaba sobre
  // el atributo crudo (`value`) en vez del ya multiplicado por el árbol de debilidades
  // (`valorEfectivo`) — el número en pantalla nunca cuadraba con `result` cuando el árbol aplicaba
  // un multiplicador de verdad.
  const bono = Math.floor(side.valorEfectivo / 2)
  const colors = attributeColorClasses[side.attribute]
  const border = withTopBorder ? 'border-t border-iron-800/60' : ''
  return (
    <>
      <span className={`flex min-w-0 items-center gap-1.5 truncate py-1.5 pl-2.5 font-sans font-semibold text-wood-300 ${border}`}>
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      {/* Solo `side.roll` es un dado de verdad — bono, multiplicador y dificultad son números ya
          calculados de antemano (ver `rollSide`, combatExchange.ts), nunca otra tirada. El dado
          real va en negrita/claro, el resto apagado; "vs" pasa a "necesitaba" para que la
          dificultad no se lea como la tirada del rival (petición explícita, 2026-08-14: "parece
          que se están tirando los dados 4 veces y no 2"). El multiplicador solo se muestra cuando
          de verdad hace algo (≠1): en verde si favorece a este lado, en rojo si lo perjudica —
          así se ve de un vistazo si la rueda de debilidades ayudó o no, sin tener que calcularlo.
      */}
      <span className={`flex flex-wrap items-baseline gap-1 py-1.5 font-mono tabular-nums ${border}`}>
        <span className="font-bold text-wood-100">🎲{side.roll}</span>
        <span className="text-wood-500">
          +{bono}
          {/* Bug real (2026-08-14): entradas de LogEntry persistidas ANTES de que `multiplicador`
              existiera en combatExchange.ts no lo traen (`undefined`) — `!= null` evita "(×NaN)"
              en partidas ya en curso; los turnos nuevos siempre lo traen. */}
          {side.multiplicador != null && side.multiplicador !== 1 && (
            <span className={side.multiplicador > 1 ? 'text-moss-400' : 'text-danger-400'}>×{formatMultiplier(side.multiplicador)}</span>
          )}
        </span>
        <span className="text-wood-200">={side.result}</span>
      </span>
      <span className={`whitespace-nowrap py-1.5 ${border}`}>
        {/* Nombre de la dificultad SIEMPRE visible, no solo al pasar el ratón (petición explícita,
            2026-08-14, tras ver que el tooltip por hover no bastaba: "lo veo igual" — en una
            captura, o sin saber que hay hover ahí, "necesitaba 12" seguía sin explicarse solo).
            El tooltip se queda de propina para quien quiera el detalle completo. */}
        <TooltipAnchor
          text={`Dificultad fija según tu nivel frente al del rival — no es la tirada del otro lado. Umbral real: ${side.difficulty}.`}
        >
          <span className="font-mono tabular-nums text-wood-500 underline decoration-dotted decoration-wood-700 underline-offset-2">
            {difficultyLabelFor(side.difficulty)} ({side.difficulty})
          </span>
        </TooltipAnchor>
      </span>
      <span className={`whitespace-nowrap py-1.5 pr-2.5 text-right font-sans font-semibold ${GRADE_TEXT[grado]} ${border}`}>
        {SIDE_LABEL[grado]}
        {isWinner && ' 🏆'}
      </span>
    </>
  )
}

/// Las dos tiradas reales de un intercambio de combate (revisión de partida 2026-08-08, ampliado
/// 2026-08-13 con cabecera "Atr vs Atr" + fila de ganador explícita, y 2026-08-14 fusionado en un
/// solo bloque con el multiplicador de la rueda de debilidades visible, resultados "10 vs 22" en
/// la cabecera y nombres reales en vez de "Tú"/"Enemigo" genéricos — peticiones directas de la
/// usuaria en las tres fechas/rondas).
///
/// `playerName`/`enemyName` opcionales: sin ellos cae a "Tú"/"el enemigo" (mismo criterio que
/// `playerName={characterName ?? 'Tú'}` ya usado en CombatPanel.tsx) — el nombre real del NPC
/// viaja en `LogEntry.npcAbilityUsed.npcName`, ya calculado por otro motivo (turnResolution.ts),
/// reutilizado aquí en vez de duplicar el dato.
export function CombatExchangeBadge({ exchange, playerName, enemyName }: { exchange: CombatExchangeInfo; playerName?: string; enemyName?: string }) {
  const jugador = exchange.atacanteEsJugador ? exchange.atacante : exchange.defensor
  const enemigo = exchange.atacanteEsJugador ? exchange.defensor : exchange.atacante
  const nombreJugador = playerName ?? 'Tú'
  const nombreEnemigo = enemyName ?? 'el enemigo'
  const ganador = winnerSide(exchange)
  const winnerIsJugador = ganador === 'jugador'
  const winnerIsEnemigo = ganador === 'enemigo'
  const winnerText = ganador === 'jugador' ? `Gana ${nombreJugador}` : ganador === 'enemigo' ? `Gana ${nombreEnemigo}` : ganador === 'empate' ? 'Empate' : null
  const nombreAtacante = exchange.atacanteEsJugador ? nombreJugador : nombreEnemigo
  const nombreDefensor = exchange.atacanteEsJugador ? nombreEnemigo : nombreJugador
  return (
    <div className="animate-stamp-in mt-2 overflow-hidden rounded-lg border border-iron-700 bg-wood-950/40 text-2xs">
      <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0.5 border-b border-iron-800 px-2.5 py-1.5 font-sans font-semibold text-wood-500">
        {/* "10 vs 22" (petición explícita, 2026-08-14) — el resultado final de cada lado, no solo
            el nombre del atributo, para poder comparar los dos números de un vistazo sin tener
            que bajar la vista a las filas. El lado ganador queda más claro/grande. Todo en una
            sola línea (petición explícita, misma ronda: "sigue en dos líneas en vez de en una"
            — la primera versión apilaba nombre de atributo arriba y número debajo). Nombre entre
            paréntesis (petición explícita, misma ronda: "a los lados de los attr aquí tiene que
            salir el nombre del jugador o npc que le corresponde ese attr") — antes solo se veía
            de quién era cada lado bajando la vista a las filas de abajo. */}
        <span className={winnerIsJugador ? '' : 'opacity-70'}>
          <span className={attributeColorClasses[jugador.attribute].text}>{attributeLabels[jugador.attribute]}</span>{' '}
          <span className="font-normal text-wood-500">({nombreJugador})</span>{' '}
          <span className={winnerIsJugador ? 'font-bold text-wood-100' : 'font-mono'}>{jugador.result}</span>
        </span>
        {/* Aclaración explícita (bug real jugando en vivo, 2026-08-15: "he sacado yo más y he
            perdido... esto está mal explicado") — el "13 vs 8" de arriba parece un cara a cara
            directo, pero cada lado compite contra SU PROPIA dificultad (ver "necesitaba" en las
            filas de abajo), no contra el número del rival: puedes sacar más que el otro lado y
            aun así fallar tu propia dificultad, o sacar menos y aun así superar la tuya. */}
        <TooltipAnchor text="Cada lado compara su tirada con su propia dificultad (ver 'necesitaba' abajo) — nunca directamente con el número del rival.">
          <span className="text-wood-600 underline decoration-dotted decoration-wood-700 underline-offset-2">vs</span>
        </TooltipAnchor>
        <span className={winnerIsEnemigo ? '' : 'opacity-70'}>
          <span className={attributeColorClasses[enemigo.attribute].text}>{attributeLabels[enemigo.attribute]}</span>{' '}
          <span className="font-normal text-wood-500">({nombreEnemigo})</span>{' '}
          <span className={winnerIsEnemigo ? 'font-bold text-wood-100' : 'font-mono'}>{enemigo.result}</span>
        </span>
      </div>
      {/* Rejilla real (petición explícita, 2026-08-14: "haz que esté todo más organizado") — las
          4 columnas se calculan UNA vez sobre las 2 filas juntas (SideRow devuelve un fragmento,
          sin `<div>` propio, así sus celdas son hijas directas de esta rejilla), así que "🎲4+6=10"
          y "🎲20+2=22" quedan alineados de verdad entre sí, no solo texto suelto uno tras otro. */}
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-2">
        <SideRow label={nombreJugador} side={jugador} isWinner={winnerIsJugador} withTopBorder={false} />
        <SideRow label={nombreEnemigo} side={enemigo} isWinner={winnerIsEnemigo} withTopBorder />
      </div>
      <p className="border-t border-iron-800 px-2.5 py-1.5 text-center font-sans text-wood-500">
        {winnerText && <span className="font-semibold text-wood-300">{winnerText} · </span>}
        {outcomeLabelFor(exchange, nombreAtacante, nombreDefensor)}
      </p>
    </div>
  )
}
