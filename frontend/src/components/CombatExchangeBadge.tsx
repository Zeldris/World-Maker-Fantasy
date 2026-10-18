import type { CombatExchangeInfo, CombatExchangeOutcome, CombatExchangeSideInfo, RollInfo } from '../types'
import { attributeLabels, attributeColorClasses } from '../lib/dice'
import { TooltipAnchor } from './TooltipAnchor'
import { RollBreakdown } from './RollBreakdown'

// Espejo exacto de `difficultyHintFor` (backend, npcScene.ts) — la MISMA diferencia de nivel que
// decide la dificultad real de la tirada; aquí ya solo llega el número final, no el nivel de cada
// lado, así que se reconstruye el nombre por umbral en vez de por diferencia (mismo criterio ya
// usado en `combatDifficulty.ts` para el aviso previo a "Combatir"). Petición explícita,
// 2026-08-14, tras preguntar qué significaba "necesitaba 15": un número pelado sin más contexto
// no explica de dónde sale ni que es fijo (no depende de la tirada del rival). Exportada
// (2026-08-15) — DiceRollReveal.tsx la reutiliza para mostrar la misma dificultad en vivo.
export function difficultyLabelFor(difficulty: number): string {
  if (difficulty <= 12) return 'Fácil'
  if (difficulty <= 15) return 'Media'
  if (difficulty <= 18) return 'Difícil'
  return 'Muy difícil'
}

// Mismos 2 colores que RollBadge.tsx (claro/fallo, binario desde el 2026-09-07 — hallazgo
// 15/19b, revisar-partida-hallazgos.md: "con coste" retirado por ser puramente cosmético) —
// coherencia visual entre los dos tipos de tirada (acción libre vs intercambio de combate).
const GRADE_TEXT: Record<'claro' | 'fallo', string> = {
  claro: 'text-moss-400',
  fallo: 'text-wood-400',
}

const SIDE_LABEL: Record<'claro' | 'fallo', string> = {
  claro: 'Éxito',
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
  // Detecta un desenlace DEGRADADO (petición explícita, 2026-08-15: "saco menos pero he ganado el
  // turno?... este resultado no se entiende" — bug real: Gorhorn 20 [necesitaba 15] vs Orco 21
  // [necesitaba 12] narraba "supera con más margen" cuando en realidad el grado de éxito de los
  // DOS era idéntico [claro] — el verdadero desenlace era golpes_mutuos, degradado a golpe_normal
  // solo porque "Esquivar" no es una habilidad de contragolpe, ver effectiveExchangeOutcome en el
  // backend). La tabla real (OUTCOME_TABLE, combatExchange.ts) nunca produce golpe_normal con los
  // dos grados IGUALES, ni ataque_falla con el defensor en 'claro' — si eso pasa aquí, es que el
  // resultado crudo era golpes_mutuos/defensor_contragolpea y se degradó; frase distinta para no
  // hablar de un "margen" que no fue lo que decidió el turno.
  const gradoAtacante = gradoOf(atacante)
  const gradoDefensor = gradoOf(defensor)
  switch (exchange.resultado) {
    case 'ataque_falla':
      if (gradoDefensor === 'claro') {
        return `El ataque de ${nombreAtacante} (${atacante.result}) no alcanza la dificultad que necesitaba (${atacante.difficulty}) — y aunque la defensa de ${nombreDefensor} (${defensor.result}) fue excelente, su habilidad no es de contragolpe, así que no llega ningún golpe de vuelta.`
      }
      return `El ataque de ${nombreAtacante} (${atacante.result}) no alcanza la dificultad que necesitaba (${atacante.difficulty}) — no llega a tocar a ${nombreDefensor}.`
    case 'defensor_contragolpea':
      return `El ataque de ${nombreAtacante} (${atacante.result}) no alcanza la dificultad que necesitaba (${atacante.difficulty}), pero la defensa de ${nombreDefensor} (${defensor.result}) supera la suya (${defensor.difficulty}) de sobra — responde con un golpe propio.`
    case 'parada_en_seco':
      return `${nombreDefensor} (${defensor.result}) supera de sobra la dificultad que necesitaba (${defensor.difficulty}) — bloquea o esquiva el ataque de ${nombreAtacante} sin daño.`
    case 'golpes_mutuos':
      return `${nombreAtacante} y ${nombreDefensor} superan cada uno su propia dificultad de forma pareja — los dos acusan algo.`
    case 'golpe_normal':
      if (gradoAtacante === gradoDefensor) {
        return `${nombreAtacante} (${atacante.result}) y ${nombreDefensor} (${defensor.result}) superan cada uno su propia dificultad de forma igual de clara — pero la habilidad de ${nombreDefensor} no es de contragolpe, así que solo el golpe de ${nombreAtacante} llega a conectar.`
      }
      return `El ataque de ${nombreAtacante} (${atacante.result}) supera su dificultad (${atacante.difficulty}) con más margen que la defensa de ${nombreDefensor} la suya (${defensor.difficulty}) — el golpe conecta.`
    case 'golpe_pleno':
      return `El ataque de ${nombreAtacante} (${atacante.result}) supera de sobra su dificultad (${atacante.difficulty}), y la defensa de ${nombreDefensor} falla del todo — el golpe conecta de lleno.`
    case 'independiente':
      return independienteLabel(exchange, nombreAtacante, nombreDefensor)
  }
}

// Extraído de `outcomeLabelFor` (rediseño a check opuesto, 2026-08-21) — el camino 'independiente'
// (resolveIndependentExchange, backend) no cambia con el rediseño en absoluto: cada lado se sigue
// juzgando contra su propia dificultad, nunca contra el rival. Se comparte tal cual entre
// `outcomeLabelFor` (turnos antiguos, dificultad por lado) y `outcomeLabelForMargin` (turnos
// nuevos, check opuesto) — 'independiente' es el único desenlace que ninguno de los dos rediseños
// toca.
function independienteLabel(exchange: CombatExchangeInfo, nombreAtacante: string, nombreDefensor: string): string {
  const { atacante, defensor } = exchange
  const gradoAtacante = gradoOf(atacante)
  const gradoDefensor = gradoOf(defensor)
  // Bug real jugando en vivo (2026-08-15, "éxito y éxito son confusos... le hice daño y pone que
  // no"): el mensaje genérico de antes no decía si el golpe de cada lado conectaba de verdad — con
  // los dos en "Éxito" (p. ej. jugador atacando y un NPC defendiéndose con una habilidad de
  // UTILIDAD, no de defensa real, como "Carroña"), el jugador no podía saber si su ataque había
  // hecho daño o no solo con "no hay un bando que gane". Aquí SÍ hubo daño real (comprobado en
  // partida: la condición del rival cambió) — el mensaje ahora lo dice explícito para cada lado
  // por separado, sin comparar uno contra el otro (eso es justo lo que significa "independiente").
  const atacanteTexto =
    gradoAtacante === 'fallo'
      ? `El intento de ${nombreAtacante} (${atacante.result}) no alcanza lo que necesitaba (${atacante.difficulty}) — no consigue nada real este turno.`
      : `${nombreAtacante} (${atacante.result}) supera lo que necesitaba (${atacante.difficulty}) — su acción sí surte efecto de verdad.`
  const defensorTexto =
    gradoDefensor === 'fallo'
      ? `${nombreDefensor} (${defensor.result}) tampoco alcanza lo que necesitaba (${defensor.difficulty}).`
      : `${nombreDefensor} (${defensor.result}) sí supera lo que necesitaba (${defensor.difficulty}).`
  return `Cada lado se juzga por su cuenta, sin comparar uno contra el otro. ${atacanteTexto} ${defensorTexto}`
}

// Rediseño a check opuesto de D&D (2026-08-21, petición explícita: "en D&D que tu saques un 22 y
// el enemigo un 24, no quiere decir que el 24 sea el que gana?") — turnos de combate NUEVOS
// (`exchange.margen !== undefined`, ver CombatExchangeInfo, types.ts) ya no comparan cada lado
// contra su propia dificultad, así que el texto tiene que explicarlo así: los dos totales
// comparados DIRECTAMENTE, quien saca más gana. `'independiente'` sigue sin cambios (delega en
// `independienteLabel`, la misma función que usa el camino antiguo) — `resolveIndependentExchange`
// no forma parte de este rediseño.
function outcomeLabelForMargin(exchange: CombatExchangeInfo, nombreAtacante: string, nombreDefensor: string): string {
  const { atacante, defensor, margen = 0 } = exchange
  switch (exchange.resultado) {
    case 'ataque_falla':
      return margen === 0
        ? `Empate exacto (${atacante.result} vs ${defensor.result}) — el golpe de ${nombreAtacante} no logra superar la defensa de ${nombreDefensor}.`
        : `La defensa de ${nombreDefensor} (${defensor.result}) supera el ataque de ${nombreAtacante} (${atacante.result}) por ${Math.abs(margen)} — no llega a conectar.`
    case 'defensor_contragolpea':
      return `${nombreDefensor} (${defensor.result}) supera de sobra el ataque de ${nombreAtacante} (${atacante.result}), por ${Math.abs(margen)} — responde con un golpe propio.`
    case 'parada_en_seco':
      return `${nombreDefensor} (${defensor.result}) supera el ataque de ${nombreAtacante} (${atacante.result}) por ${Math.abs(margen)} — bloquea o esquiva sin daño.`
    case 'golpe_normal':
      return `El ataque de ${nombreAtacante} (${atacante.result}) supera la defensa de ${nombreDefensor} (${defensor.result}) por ${margen} — el golpe conecta.`
    case 'golpe_pleno':
      return `El ataque de ${nombreAtacante} (${atacante.result}) supera de sobra la defensa de ${nombreDefensor} (${defensor.result}), por ${margen} — el golpe conecta de lleno.`
    case 'independiente':
      return independienteLabel(exchange, nombreAtacante, nombreDefensor)
    case 'golpes_mutuos':
      // Inalcanzable en la práctica: `esCheckOpuesto` (más abajo) solo llama a esta función cuando
      // `exchange.margen !== undefined`, y un `golpes_mutuos` persistido de antes del rediseño
      // nunca trae `margen` (el backend ya no lo produce). Se queda solo para que el switch sea
      // exhaustivo sobre `CombatExchangeOutcome` — delega en el renderer antiguo por si acaso.
      return outcomeLabelFor(exchange, nombreAtacante, nombreDefensor)
  }
}

// Rediseño (2026-08-13, petición explícita: "que salga más claro, attr vs attr, tirada de un att,
// tirada del otro y luego los cálculos e indicar quién gana") — quién se lleva el intercambio según
// `ExchangeOutcome` (backend, combatExchange.ts): 'atacante'/'defensor' son posiciones (quién
// tenía la iniciativa este intercambio, ver `atacanteEsJugador`), no bandos fijos. null = sin
// ganador cruzado (independiente, cada lado se resuelve solo) o empate real.
//
// `golpes_mutuos: 'empate'` se queda a propósito (rediseño a check opuesto, 2026-08-21) aunque el
// backend ya NUNCA lo produce — turnos de combate persistidos ANTES de este cambio siguen
// pudiendo traer este valor en `LogEntry.combatExchange` (el JSON guardado nunca se migra
// retroactivamente), y `Record<CombatExchangeOutcome, ...>` exige que el mapa siga siendo
// exhaustivo sobre el tipo completo.
const WINNER_SIDE: Record<CombatExchangeOutcome, 'atacante' | 'defensor' | 'empate' | null> = {
  defensor_contragolpea: 'defensor',
  ataque_falla: 'defensor',
  parada_en_seco: 'defensor',
  golpes_mutuos: 'empate',
  golpe_normal: 'atacante',
  golpe_pleno: 'atacante',
  independiente: null,
}

// Exportada (2026-08-15) — DiceRollReveal.tsx la reutiliza para colorear el dado en vivo con el
// mismo criterio exacto que este badge usa después, en vez de duplicar la lógica.
export function gradoOf(side: RollInfo | CombatExchangeSideInfo): 'claro' | 'fallo' {
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
// Exportada (2026-08-15) — DiceRollReveal.tsx la reutiliza para mostrar el mismo multiplicador
// junto al dado en vivo, en vez de duplicar el formateo.
export function formatMultiplier(m: number): string {
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
function SideRow({
  label,
  side,
  isWinner,
  withTopBorder,
  showDifficulty,
}: {
  label: string
  side: CombatExchangeSideInfo
  isWinner: boolean
  withTopBorder: boolean
  /// Rediseño a check opuesto (2026-08-21) — la "dificultad" por lado ya no decide nada en un
  /// turno NUEVO (se comparan los dos totales directamente), así que mostrarla como "necesitaba
  /// 15" sería engañoso. Solo se muestra para `LogEntry.combatExchange` persistidas ANTES del
  /// rediseño (`exchange.margen === undefined`), donde sí describe con exactitud cómo se resolvió
  /// aquel turno real.
  showDifficulty: boolean
}) {
  const grado = gradoOf(side)
  // Bug real (revisión de rediseño de combate, 2026-08-09): el bono mostrado se calculaba sobre
  // el atributo crudo (`value`) en vez del ya multiplicado por el árbol de ventajas
  // (`valorEfectivo`) — el número en pantalla nunca cuadraba con `result` cuando el árbol aplicaba
  // un multiplicador de verdad.
  //
  // "(valorCrudo×mult≈valorEfectivo/2)" junto al bono (petición explícita, 2026-08-15; revisado
  // 2026-08-18 y de nuevo 2026-08-20) — la multiplicación vive DENTRO del numerador de la
  // fracción, no suelta después: la versión de 2026-08-18 sacaba el "×mult" fuera de la fracción,
  // justo delante del "=resultado" final, y eso se leía como una operación TODAVÍA pendiente
  // sobre el total ya mostrado ("20+10=30... ¿y el ×1.5 dónde entra? 30×1.5 no da 30" — bug real,
  // 2026-08-20). Ahora el ×mult se aplica y se resuelve DENTRO del paréntesis (crudo×mult≈
  // valorEfectivo), así que "/2" cae justo después de su propio resultado y el bono +N es
  // literalmente esa cuenta terminada — nada se aplica ya fuera de la fracción.
  // Bug real (2026-08-28, "en los cálculos de la tirada tampoco se está viendo"): `attributeBonus`
  // (habilidad de arma/clase, +2/+4) se sumaba al atributo crudo DENTRO de `valorEfectivo` desde
  // siempre — sin restarlo aquí, `valorCrudo` no cuadraba con lo que `rollSide` (backend) calculó
  // de verdad en cuanto la habilidad llevaba bonus propio.
  const valorCrudo = Math.max(1, side.value - (side.malus || 0) + (side.attributeBonus || 0))
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
          calculados de antemano (ver `rollSide`, combatExchange.ts), nunca otra tirada. El
          multiplicador solo se muestra cuando de verdad hace algo (≠1) — siempre en verde con
          turnos nuevos, ya que la árbol de ventajas solo premia, nunca penaliza (rediseño
          2026-08-15, ver el comentario largo de `typeMultiplierFor`, attributeWheel.ts): un
          multiplicador real por debajo de 1 ya no puede salir de un turno resuelto hoy. La rama
          roja se queda a propósito, sin borrar — sigue siendo la lectura correcta de cualquier
          `LogEntry.combatExchange` YA PERSISTIDA de antes de este rediseño, que conserva el
          multiplicador desfavorable real de aquel turno.

          `side.valorEfectivo` viene ya calculado por el backend (rollSide, combatExchange.ts) —
          se reutiliza tal cual dentro de la fracción en vez de recalcularlo aquí, para que el
          número mostrado sea SIEMPRE el mismo que produjo `bono` (nunca un redondeo distinto por
          duplicar la cuenta en el frontend).

          Dos colores deliberadamente distintos (petición explícita, 2026-08-20: "que los que
          suman estén en un color y lo del paréntesis en otro") — `wood-100` (cálido, el mismo tono
          claro de todo el texto principal del juego) para el DADO/BONO/RESULTADO, que es la cuenta
          que de verdad se suma; `accent2` (frío, gris-azulado, tono que esta fila no usaba para
          nada más) para la fracción explicativa entre paréntesis — con hues tan distintos entre sí
          la vista separa "lo que se suma" de "por qué se suma eso" sin tener que leer el texto.

          "=resultado" en `text-sm` (petición explícita, 2026-08-20: "el total pegado a la
          ecuación y con algo más de tamaño de letra para que destaque") — más grande que el resto
          de la fila (`text-2xs` heredado del badge) para que el número que de verdad decide el
          turno salte a la vista sin tener que leer toda la explicación alrededor. */}
      <span className={`flex flex-wrap items-baseline justify-center gap-1.5 border-l border-l-iron-800/60 py-1.5 pl-2 font-mono tabular-nums ${border}`}>
        {/* Pasivas raciales (2026-08-28) — con `rollMode !== 'normal'`, `side.rolls` trae los DOS
            d20 reales tirados: se muestran ambos, tachando el descartado, en vez de un solo 🎲
            (petición explícita: "que se vea, dos dados haciendo roll y como descarta el más bajo y
            se queda con el grande"). `usedRoll` (= `side.roll`) siempre es el que de verdad entra
            en la cuenta de abajo. */}
        {side.rollMode && side.rollMode !== 'normal' && side.rolls && side.rolls.length === 2 ? (
          <TooltipAnchor text={side.racialAdvantageReason ?? (side.rollMode === 'ventaja' ? 'Ventaja: se tiran 2 dados, se queda el más alto.' : 'Desventaja: se tiran 2 dados, se queda el más bajo.')}>
            <span className="flex items-baseline gap-1 underline decoration-dotted decoration-wood-700 underline-offset-2">
              {side.rolls.map((r, i) => (
                <span key={i} className={r === side.roll ? 'font-bold text-wood-100' : 'text-wood-600 line-through'}>
                  🎲{r}
                </span>
              ))}
            </span>
          </TooltipAnchor>
        ) : (
          <span className="font-bold text-wood-100">🎲{side.roll}</span>
        )}
        <TooltipAnchor
          text={`${attributeLabels[side.attribute]} ${side.value}${side.malus ? ` − ${side.malus} por tu condición física` : ''}${side.attributeBonus ? ` + ${side.attributeBonus} de la habilidad` : ''} = ${valorCrudo}.${
            side.multiplicador != null && side.multiplicador !== 1
              ? ` Con ×${formatMultiplier(side.multiplicador)} de ventaja de tipo: ${valorCrudo}×${formatMultiplier(side.multiplicador)} ≈ ${side.valorEfectivo} (redondeado). Mitad = tu bono real: +${bono}.`
              : ` Mitad = tu bono real: +${bono}.`
          }`}
        >
          <span className="flex flex-wrap items-baseline gap-1.5 underline decoration-dotted decoration-wood-700 underline-offset-2">
            <span className="font-bold text-wood-100">+{bono}</span>
            {/* Desglose inline (petición explícita, 2026-08-29: "mejoralo todo para que se mas claro
                y se entiendan bien los calculos" — cada término vive DENTRO del paréntesis, en el
                sitio exacto donde ocurre la suma, mismos colores `danger-400`/`moss-400` que ya
                usaban los chips que sustituyó). Layout responsive por grupos (hallazgo 20,
                revisar-partida-hallazgos.md 2026-09-07, ver comentario de RollBreakdown.tsx) — el
                ×mult se resuelve DENTRO del componente, antes del "/2" (bug real, 2026-08-20: suelto
                fuera de la fracción se leía como multiplicación pendiente sobre el total ya
                mostrado). `!= null` evita "(×NaN)" en LogEntry persistidas antes de que
                `multiplicador` existiera (2026-08-14). */}
            <span className="text-accent2-400">
              <RollBreakdown side={side} valorCrudo={valorCrudo} valorEfectivo={side.valorEfectivo} />
            </span>
          </span>
        </TooltipAnchor>
        <span className="text-sm font-extrabold text-wood-100">= {side.result}</span>
      </span>
      <span className={`whitespace-nowrap border-l border-l-iron-800/60 py-1.5 pl-2 ${border}`}>
        {/* Nombre de la dificultad SIEMPRE visible, no solo al pasar el ratón (petición explícita,
            2026-08-14, tras ver que el tooltip por hover no bastaba: "lo veo igual" — en una
            captura, o sin saber que hay hover ahí, "necesitaba 12" seguía sin explicarse solo).
            El tooltip se queda de propina para quien quiera el detalle completo. Solo en turnos
            ANTIGUOS (`showDifficulty`) — en un check opuesto de verdad ya no es lo que decide nada. */}
        {showDifficulty && (
          <TooltipAnchor
            text={`Dificultad fija según tu nivel frente al del rival — no es la tirada del otro lado. Umbral real: ${side.difficulty}.`}
          >
            <span className="font-mono tabular-nums text-wood-500 underline decoration-dotted decoration-wood-700 underline-offset-2">
              {difficultyLabelFor(side.difficulty)} ({side.difficulty})
            </span>
          </TooltipAnchor>
        )}
        {/* Malus por condición física y bono de habilidad (petición explícita, 2026-08-15 y
            2026-08-28) — ya NO viven aquí como chips sueltos (rediseño 2026-08-29, "mejoralo todo
            para que se mas claro y se entiendan bien los calculos"): ahora se ven DENTRO de la
            fracción de la celda anterior, en el sitio exacto donde ocurre la suma, en vez de
            repetidos aquí sin conexión visual con el "13/2" que ya los incluía. */}
        {/* Pasivas raciales (2026-08-28) — chip propio, siempre visible cuando aplicó, mismo
            criterio que malus/attributeBonus de antes: nunca solo en un tooltip perdido. */}
        {side.racialAdvantageReason && (
          <TooltipAnchor text={side.racialAdvantageReason}>
            <span className={`ml-1 font-mono underline decoration-dotted decoration-wood-700 underline-offset-2 ${side.rollMode === 'ventaja' ? 'text-moss-400' : 'text-danger-400'}`}>
              {side.rollMode === 'ventaja' ? '▲' : '▼'} {side.ventajaPor ?? 'racial'}
            </span>
          </TooltipAnchor>
        )}
      </span>
      <span className={`whitespace-nowrap border-l border-l-iron-800/60 py-1.5 pl-2 pr-2.5 text-right font-sans font-semibold ${GRADE_TEXT[grado]} ${border}`}>
        {SIDE_LABEL[grado]}
        {isWinner && ' 🏆'}
      </span>
    </>
  )
}

/// Las dos tiradas reales de un intercambio de combate (revisión de partida 2026-08-08, ampliado
/// 2026-08-13 con cabecera "Atr vs Atr" + fila de ganador explícita, y 2026-08-14 fusionado en un
/// solo bloque con el multiplicador de la árbol de ventajas visible, resultados "10 vs 22" en
/// la cabecera y nombres reales en vez de "Tú"/"Enemigo" genéricos — peticiones directas de la
/// usuaria en las tres fechas/rondas).
///
/// `playerName`/`enemyName` opcionales: sin ellos cae a "Tú"/"el enemigo" (mismo criterio que
/// `playerName={characterName ?? 'Tú'}` ya usado en CombatPanel.tsx) — el nombre real del NPC
/// viaja en `LogEntry.npcAbilityUsed.npcName`, ya calculado por otro motivo (turnResolution.ts),
/// reutilizado aquí en vez de duplicar el dato.
// Rediseño a check opuesto (2026-08-21) — `margen` solo viaja en turnos NUEVOS (`resolveExchange`,
// backend); 'independiente' nunca lo usa aunque lo lleve a 0 de relleno (resolveIndependentExchange
// no forma parte de este rediseño, sigue con dificultad por lado). Exportada para que
// DiceRollReveal.tsx use el mismo criterio y no se desincronicen los dos sitios que lo comprueban.
export function esCheckOpuesto(exchange: CombatExchangeInfo): boolean {
  return exchange.margen !== undefined && exchange.resultado !== 'independiente'
}

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
  const esOpuesto = esCheckOpuesto(exchange)
  // P96 (QA-27): rematar a un convaleciente no se tira; la tarjeta solo lo cuenta.
  if (exchange.golpeDeGracia) {
    return (
      <div className="animate-stamp-in mt-2 rounded-lg border border-iron-700 bg-wood-950/40 px-2.5 py-1.5 text-center font-sans text-2xs text-wood-500">
        <span className="font-semibold text-wood-300">Golpe de gracia · </span>
        {`${nombreDefensor} está convaleciente y no puede defenderse: el golpe de ${nombreAtacante} acierta sin tirada.`}
      </div>
    )
  }
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
          {/* Mismo color siempre, gane o no (petición explícita, 2026-08-20: "el 21 de arriba...
              en el mismo color que el 20") — antes el lado NO ganador se quedaba sin color propio
              (solo `font-mono`), heredando el azul subrayado por defecto del navegador para
              números sueltos sin clase de color. Quién ganó ya se distingue con `opacity-70` en
              todo el bloque del lado perdedor, no hace falta un segundo código de color aparte. */}
          <span className="font-mono font-bold text-wood-100">{jugador.result}</span>
        </span>
        {/* Rediseño a check opuesto de D&D (2026-08-21) — en un turno NUEVO el "vs" es literal: se
            comparan los dos totales directamente, gana quien saca más (empate → gana el defensor).
            En un turno ANTIGUO (`!esOpuesto`) se mantiene la aclaración de siempre: cada lado
            compite contra SU PROPIA dificultad (bug real jugando en vivo, 2026-08-15: "he sacado yo
            más y he perdido... esto está mal explicado"), nunca contra el número del rival — eso sí
            describe con exactitud cómo se resolvió aquel turno real. */}
        <TooltipAnchor
          text={
            esOpuesto
              ? 'Check opuesto: se comparan las dos tiradas directamente — gana quien saca más. Empate exacto → gana el defensor.'
              : "Cada lado compara su tirada con su propia dificultad (ver 'necesitaba' abajo) — nunca directamente con el número del rival."
          }
        >
          <span className="text-wood-600 underline decoration-dotted decoration-wood-700 underline-offset-2">vs</span>
        </TooltipAnchor>
        <span className={winnerIsEnemigo ? '' : 'opacity-70'}>
          <span className={attributeColorClasses[enemigo.attribute].text}>{attributeLabels[enemigo.attribute]}</span>{' '}
          <span className="font-normal text-wood-500">({nombreEnemigo})</span>{' '}
          <span className="font-mono font-bold text-wood-100">{enemigo.result}</span>
        </span>
      </div>
      {/* Rejilla real (petición explícita, 2026-08-14: "haz que esté todo más organizado") — las
          4 columnas se calculan UNA vez sobre las 2 filas juntas (SideRow devuelve un fragmento,
          sin `<div>` propio, así sus celdas son hijas directas de esta rejilla), así que "🎲4+6=10"
          y "🎲20+2=22" quedan alineados de verdad entre sí, no solo texto suelto uno tras otro.
          Dado+bono+fracción+resultado vuelven a vivir juntos en UNA sola celda `1fr` con
          `flex-wrap` (revertido 2026-08-20: probé a separar el resultado en su propia columna
          `auto` para que "=20"/"=21" alinearan entre filas, pero eso dejaba un hueco variable
          entre la fracción y el resultado según cuánto ocupara cada una — petición explícita
          siguiente: "el total pegado a la ecuación"). Con todo en una celda y `gap-1.5` uniforme,
          el resultado queda siempre a la misma distancia corta de la fracción, aunque ya no
          garantice que las dos filas alineen columna a columna.

          Separadores de columna visibles (petición explícita, 2026-08-29: "añadir
          separadores/bordes de celda visibles... para que se perciba como una cuadrícula real")
          — antes solo había `border-t` entre filas (dentro de cada `SideRow`, vía `withTopBorder`).
          Probado primero con `divide-x` en el contenedor (no se veía — los hijos DOM reales del
          grid son los `<span>` de cada `SideRow`, no filas envolventes, así que Tailwind no tenía
          un selector `> * + *` fiable ahí). Cada celda de `SideRow` ahora lleva su propio
          `border-l` explícito (mismo patrón ya probado que `border-t`/`withTopBorder`, JIT-safe con
          la paleta custom del proyecto), salvo la primera columna (el nombre no necesita línea a su
          izquierda, es el borde del propio badge). */}
      <div className="grid grid-cols-[auto_1fr_auto_auto]">
        <SideRow label={nombreJugador} side={jugador} isWinner={winnerIsJugador} withTopBorder={false} showDifficulty={!esOpuesto} />
        <SideRow label={nombreEnemigo} side={enemigo} isWinner={winnerIsEnemigo} withTopBorder showDifficulty={!esOpuesto} />
      </div>
      <p className="border-t border-iron-800 px-2.5 py-1.5 text-center font-sans text-wood-500">
        {/* B23 (pruebas 2026-09-28): un animal que no ataca solo se revuelve — nunca "el golpe conecta". */}
        {exchange.atacanteInofensivo ? (
          `${nombreAtacante} no ataca de verdad: se revuelve para zafarse, sin hacer daño.`
        ) : (
          <>
            {winnerText && <span className="font-semibold text-wood-300">{winnerText} · </span>}
            {esOpuesto ? outcomeLabelForMargin(exchange, nombreAtacante, nombreDefensor) : outcomeLabelFor(exchange, nombreAtacante, nombreDefensor)}
          </>
        )}
      </p>
    </div>
  )
}
