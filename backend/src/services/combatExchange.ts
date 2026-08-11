import type { Attribute, AttributeBlock, GradoExito, RollResult } from './dice.js';
import type { AbilityEffect, CondicionFisica } from '@prisma/client';
import { gradoExitoFor } from './dice.js';
import { effectiveAttributeValue, type CombatTree } from './attributeWheel.js';
import { condicionMalus } from './death.js';

/// Ataque de NPC ya decidido (oculto al frontend) — se persiste en `Save.pendingNpcAttack`
/// cuando la iniciativa de un intercambio favorece al NPC, y se consume/limpia al resolver la
/// defensa a ciegas del jugador en su siguiente sumisión (turnResolution.ts).
export interface PendingNpcAttack {
  npcId: string;
  attribute: Attribute;
  effect: AbilityEffect | null;
  /// Rediseño de combate (2026-08-09) — en la práctica SIEMPRE 'ataque': `chooseNpcAbility('ataque',
  /// ...)` (npcCombatAbilities.ts) ya filtra a solo `rol==='ataque'` antes de decidir el ataque
  /// pendiente de un NPC. Se persiste igual (en vez de asumirlo a ciegas en turnResolution.ts) para
  /// que la invariante quede comprobable, no solo documentada — si ese filtro cambiara algún día,
  /// la detección de "modo independiente" en CASO DEFENSA seguiría siendo correcta.
  rol: 'ataque' | 'defensa' | 'utilidad';
  abilityName: string;
  /// Revisión de partida 2026-08-08, bug real jugando en vivo: un Múrgol sin arma (`ataqueNatural`:
  /// "Topetazo torpe con su cornamenta ramificada...") se narró como "el orco lanudo" dando
  /// "zarpazos" — el Narrador solo veía el NOMBRE de la habilidad ("Ataque base", siempre igual,
  /// sin pista de cómo ataca de verdad esta especie en concreto). `?? ''` en la lectura cubre un
  /// `pendingNpcAttack` persistido antes de este campo (partida en curso).
  abilityDescription: string;
  /// Sistema de fatiga simétrico (2026-07-30) — coste de energía de esta habilidad ya elegida,
  /// para descontarlo del NPC en el turno donde de verdad se resuelve (ver turnResolution.ts).
  /// `?? 0` en la lectura cubre partidas con un pendingNpcAttack persistido antes de este campo.
  energyCost: number;
  /// Rediseño 2026-07-31 — energía que recupera esta habilidad ya elegida (en la práctica siempre
  /// 0 aquí: un NPC nunca elige Esquivar/Defenderse como ATAQUE, ver chooseNpcAbility; se guarda
  /// igual por completitud/simetría con el jugador). `?? 0` en la lectura, mismo criterio que
  /// `energyCost`.
  energyRegen: number;
}

/// Rediseño del turno de combate (2026-07-28, petición explícita: "primero se tiran dados y se
/// ve quien ataca primero... el otro entra en un turno de defensa... con su propia tirada de
/// dados independiente de la de ataque"). Un solo dado de d20+floor(valor/2), igual que
/// `rollCheck` (dice.ts) — sin difficultad fija, es un contraste directo entre los dos lados,
/// gana quien saque más.
function contestValue(attributes: AttributeBlock, attribute: Attribute): number {
  return Math.floor(Math.random() * 20) + 1 + Math.floor(attributes[attribute] / 2);
}

export interface InitiativeResult {
  ganador: 'jugador' | 'npc';
  /// Valores YA con destreza sumada (2026-07-29, "quiero que me indique qué salió en los dados
  /// para saber por qué ataco primero" — antes `rollInitiative` solo devolvía el ganador, tirando
  /// los números crudos, así que el turno de ataque nunca podía mostrar ninguna cifra real, a
  /// diferencia del de defensa).
  jugadorTirada: number;
  npcTirada: number;
}

export function rollInitiative(playerAttributes: AttributeBlock, npcAttributes: AttributeBlock): InitiativeResult {
  const jugadorTirada = contestValue(playerAttributes, 'destreza');
  const npcTirada = contestValue(npcAttributes, 'destreza');
  return { ganador: jugadorTirada >= npcTirada ? 'jugador' : 'npc', jugadorTirada, npcTirada };
}

export interface ExchangeParticipant {
  attributes: AttributeBlock;
  /// Atributo de la habilidad elegida — sirve dos propósitos a la vez: es con qué se tira
  /// (igual que `rollCheck`) y es el "tipo" que entra en la rueda de debilidades
  /// (attributeWheel.ts). Nunca se pide por separado: la habilidad ya trae su
  /// `preferredAttribute`, ver classAbilities.ts/berigLore.ts/worldCatalog.ts.
  attribute: Attribute;
  difficulty: number;
  /// Malus mecánico por condición física (2026-07-29, ver death.ts § condicionMalus) — se resta
  /// al valor crudo del atributo antes del multiplicador de tipo, para este lado del intercambio.
  condicionFisica: CondicionFisica;
  /// Rediseño de combate (2026-08-09) — rol de la habilidad elegida por este lado ESTE
  /// intercambio. Decide qué función usa el caller (turnResolution.ts § resolveCombatExchangePhase):
  /// ataque-vs-defensa/ataque sigue cruzando OUTCOME_TABLE vía `resolveExchange`; en cuanto
  /// CUALQUIER lado es 'utilidad', se usa `resolveIndependentExchange` en su lugar. `resolveExchange`
  /// en sí no lee este campo (sigue funcionando exactamente igual que antes) — vive aquí para que
  /// el caller tenga un único objeto por lado, no un parámetro suelto aparte.
  rol: 'ataque' | 'defensa' | 'utilidad';
}

export interface ExchangeSideResult extends RollResult {
  /// Valor de atributo YA con el multiplicador de tipo aplicado — el que de verdad entró en la
  /// tirada, distinto del `value` crudo que ya trae `RollResult`.
  valorEfectivo: number;
}

export type ExchangeOutcome =
  | 'defensor_contragolpea' // el ataque falla Y la defensa fue excelente: el defensor de propina replica
  | 'ataque_falla' // el ataque falla, sin más — no llega, gane o no la defensa
  | 'parada_en_seco' // ataque decente, defensa excelente: bloqueado sin daño
  | 'golpes_mutuos' // ambos con grado parejo (los dos "con_coste" o los dos "claro"): los dos acusan algo
  | 'golpe_normal' // ataque decente y defensa floja, o ataque excelente y defensa decente: golpe que llega
  | 'golpe_pleno' // ataque excelente y defensa falla: el peor caso, el efecto de la habilidad atacante se aplica entero
  /// Rediseño de combate (2026-08-09) — marca `CombatExchangeDisplay` cuando el intercambio se
  /// resolvió por `resolveIndependentExchange` (cualquier lado rol:'utilidad'), no por la tabla
  /// cruzada de arriba — el frontend ya muestra el éxito/fallo de cada lado por separado
  /// (CombatExchangeBadge.tsx), este valor solo evita forzar uno de los 6 desenlaces de ataque-vs-
  /// defensa donde no aplica ninguno.
  | 'independiente';

const OUTCOME_TABLE: Record<GradoExito, Record<GradoExito, ExchangeOutcome>> = {
  fallo: { claro: 'defensor_contragolpea', con_coste: 'ataque_falla', fallo: 'ataque_falla' },
  con_coste: { claro: 'parada_en_seco', con_coste: 'golpes_mutuos', fallo: 'golpe_normal' },
  claro: { claro: 'golpes_mutuos', con_coste: 'golpe_normal', fallo: 'golpe_pleno' },
};

export interface ExchangeResult {
  atacante: ExchangeSideResult;
  defensor: ExchangeSideResult;
  resultado: ExchangeOutcome;
}

/// Cara visible del intercambio para el frontend (revisión de partida 2026-08-08, petición
/// explícita: "que aparezca el resultado de las tiradas... indicando qué atributo y valor sacó
/// [el jugador] y el del enemigo y por qué perdió o ganó la tirada") — hasta hoy `ExchangeResult`
/// se calculaba entero pero solo se usaba para construir el texto narrativo del Narrador
/// (`exchangeContextBlock`) y se descartaba en cuanto ese texto existía; nunca viajaba
/// estructurado hasta la respuesta HTTP. `atacanteEsJugador` es necesario porque quién ataca y
/// quién defiende cambia de turno a turno (según quién tenga la iniciativa, ver
/// `resolveCombatExchangePhase`), así que el frontend no puede asumirlo por su cuenta.
export interface CombatExchangeDisplay {
  atacanteEsJugador: boolean;
  atacante: ExchangeSideResult;
  defensor: ExchangeSideResult;
  resultado: ExchangeOutcome;
}

/// Una sola tirada de un lado del intercambio — extraído (rediseño de combate, 2026-08-09) de lo
/// que antes vivía duplicado inline dentro de `resolveExchange`, para que `resolveIndependentExchange`
/// pueda reusar exactamente la misma mecánica (malus por condición, multiplicador de tipo,
/// d20+bono, grado de éxito) sin cruzar `OUTCOME_TABLE` después.
function rollSide(self: ExchangeParticipant, opponentAttribute: Attribute, tree: CombatTree): ExchangeSideResult {
  const valorCrudo = Math.max(1, self.attributes[self.attribute] - condicionMalus(self.condicionFisica));
  const valorEfectivo = effectiveAttributeValue(valorCrudo, self.attribute, opponentAttribute, tree);
  const roll = Math.floor(Math.random() * 20) + 1;
  const result = roll + Math.floor(valorEfectivo / 2);
  const gradoExito = gradoExitoFor(result, self.difficulty);
  return {
    attribute: self.attribute,
    value: self.attributes[self.attribute],
    valorEfectivo,
    roll,
    result,
    difficulty: self.difficulty,
    success: gradoExito !== 'fallo',
    gradoExito,
  };
}

/// Resuelve un intercambio completo de ataque vs. defensa — dos tiradas independientes (nunca
/// una sola tirada de "contraataque" como hacía el sistema antiguo), cada una con su propio
/// multiplicador de tipo (rueda de debilidades, distinta para atacar que para defender), cruzadas
/// en una tabla de 9 resultados en vez de un simple golpea/no golpea. Puro y determinista salvo
/// por los dos `Math.random()` de las tiradas — mismo criterio que `rollCheck`: nunca deja que
/// el modelo decida el número, solo lo narra ya resuelto.
///
/// Solo válida para un intercambio ataque-vs-defensa (o ataque-vs-ataque) — el caller
/// (turnResolution.ts) decide ANTES de llamar si algún lado es `rol:'utilidad'`, en cuyo caso usa
/// `resolveIndependentExchange` en su lugar; esta función no lee `ExchangeParticipant.rol` en
/// absoluto, sigue funcionando exactamente igual que antes del rediseño.
export function resolveExchange(atacante: ExchangeParticipant, defensor: ExchangeParticipant): ExchangeResult {
  const resultadoAtacante = rollSide(atacante, defensor.attribute, 'ataque');
  const resultadoDefensor = rollSide(defensor, atacante.attribute, 'defensa');
  return {
    atacante: resultadoAtacante,
    defensor: resultadoDefensor,
    resultado: OUTCOME_TABLE[resultadoAtacante.gradoExito][resultadoDefensor.gradoExito],
  };
}

export interface IndependentSideOutcome extends ExchangeSideResult {
  /// true si este lado tiró con éxito (gradoExito !== 'fallo') — y por tanto su propio efecto (si
  /// tiene uno reactivo) puede evaluarse. Nunca depende de si el OTRO lado tuvo éxito o no.
  efectoAplica: boolean;
}

export interface IndependentExchangeResult {
  atacante: IndependentSideOutcome;
  defensor: IndependentSideOutcome;
}

/// Camino de resolución separado para cuando CUALQUIERA de los dos lados eligió una habilidad
/// `rol:'utilidad'` (rediseño de combate, 2026-08-09, petición explícita: "cada uno su tirada...
/// si los dos ganáis cada uno la vuestra, se podrán aplicar las dos de utilidad a la vez") — a
/// diferencia de `resolveExchange`, NUNCA cruza `OUTCOME_TABLE`: el éxito de cada lado decide SOLO
/// su propio efecto, nunca el del contrario. `atacante`/`defensor` aquí son solo etiquetas de
/// "quién tiene la iniciativa este intercambio" (mismo significado posicional que en
/// `resolveExchange`) — ninguno de los dos "gana" sobre el otro por tener la iniciativa.
export function resolveIndependentExchange(atacante: ExchangeParticipant, defensor: ExchangeParticipant): IndependentExchangeResult {
  const resultadoAtacante = rollSide(atacante, defensor.attribute, 'ataque');
  const resultadoDefensor = rollSide(defensor, atacante.attribute, 'defensa');
  return {
    atacante: { ...resultadoAtacante, efectoAplica: resultadoAtacante.gradoExito !== 'fallo' },
    defensor: { ...resultadoDefensor, efectoAplica: resultadoDefensor.gradoExito !== 'fallo' },
  };
}

const OUTCOME_NARRATION_HINT: Record<ExchangeOutcome, (atacante: string, defensor: string) => string> = {
  defensor_contragolpea: (atacante, defensor) =>
    `El ataque de ${atacante} falla del todo Y ${defensor} responde con una réplica propia que sí conecta — narra que ${defensor} para el golpe y de propina consigue tocar a ${atacante}.`,
  ataque_falla: (atacante, defensor) => `El ataque de ${atacante} no llega a alcanzar a ${defensor} — narra cómo falla o es esquivado sin más.`,
  parada_en_seco: (atacante, defensor) => `${defensor} bloquea o esquiva por completo el ataque de ${atacante} — sin daño, narra una parada limpia.`,
  golpes_mutuos: (atacante, defensor) =>
    `Un choque duro entre los dos — narra que AMBOS acaban acusando algo, ni el ataque de ${atacante} ni la defensa de ${defensor} se llevan la partida limpia.`,
  golpe_normal: (atacante, defensor) => `El ataque de ${atacante} alcanza a ${defensor} con normalidad pese a su defensa — narra el golpe.`,
  golpe_pleno: (atacante, defensor) =>
    `El PEOR caso para ${defensor}: el ataque de ${atacante} conecta de lleno, casi sin resistencia — narra el golpe con toda su fuerza.`,
  // `OUTCOME_TABLE` (arriba) nunca produce este valor — solo lo asigna `resolveIndependentExchange`
  // directamente, que no pasa por `OUTCOME_NARRATION_HINT` en absoluto (usa
  // `independentExchangeContextBlock` en su lugar). Entrada presente solo para que el Record sea
  // exhaustivo a nivel de tipos.
  independiente: () => '',
};

/// Texto "YA RESUELTO, no lo cambies" para el Narrador (mismo patrón que el resto de tiradas de
/// combate, turnResolution.ts) — nunca deja que el modelo decida ni el número ni el desenlace,
/// solo lo narra ya calculado.
export function exchangeContextBlock(exchange: ExchangeResult, atacanteNombre: string, defensorNombre: string): string {
  const grados = `${atacanteNombre} tira ${exchange.atacante.result} (${exchange.atacante.gradoExito}) vs dificultad ${exchange.atacante.difficulty} · ${defensorNombre} tira ${exchange.defensor.result} (${exchange.defensor.gradoExito}) vs dificultad ${exchange.defensor.difficulty}.`;
  return `RESULTADO DEL INTERCAMBIO — YA RESUELTO, no lo cambies: ${grados} ${OUTCOME_NARRATION_HINT[exchange.resultado](atacanteNombre, defensorNombre)}`;
}

/// Equivalente de `exchangeContextBlock` para el camino independiente (rediseño de combate,
/// 2026-08-09) — solo da los números de las dos tiradas, SIN interpretar un desenlace conjunto
/// (no hay "quién gana": cada lado se juzga por su cuenta). El caller (turnResolution.ts §
/// resolveCombatExchangePhase) añade a continuación su propia frase sobre qué efecto concreto se
/// disparó o no, ya que eso depende de qué habilidad de utilidad se usó y si el rival atacó con
/// daño — información que este archivo no tiene.
export function independentExchangeContextBlock(result: IndependentExchangeResult, atacanteNombre: string, defensorNombre: string): string {
  const grados = `${atacanteNombre} tira ${result.atacante.result} (${result.atacante.gradoExito}) vs dificultad ${result.atacante.difficulty} · ${defensorNombre} tira ${result.defensor.result} (${result.defensor.gradoExito}) vs dificultad ${result.defensor.difficulty}.`;
  return `RESULTADO DEL INTERCAMBIO — YA RESUELTO, no lo cambies: ${grados} Cada tirada se juzga por separado, no hay un "quién gana" conjunto.`;
}
