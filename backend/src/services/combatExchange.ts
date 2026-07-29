import type { Attribute, AttributeBlock, GradoExito, RollResult } from './dice.js';
import type { AbilityEffect } from '@prisma/client';
import { gradoExitoFor } from './dice.js';
import { effectiveAttributeValue } from './attributeWheel.js';

/// Ataque de NPC ya decidido (oculto al frontend) — se persiste en `Save.pendingNpcAttack`
/// cuando la iniciativa de un intercambio favorece al NPC, y se consume/limpia al resolver la
/// defensa a ciegas del jugador en su siguiente sumisión (turnResolution.ts).
export interface PendingNpcAttack {
  npcId: string;
  attribute: Attribute;
  effect: AbilityEffect | null;
  abilityName: string;
}

/// Rediseño del turno de combate (2026-07-28, petición explícita: "primero se tiran dados y se
/// ve quien ataca primero... el otro entra en un turno de defensa... con su propia tirada de
/// dados independiente de la de ataque"). Un solo dado de d20+floor(valor/2), igual que
/// `rollCheck` (dice.ts) — sin difficultad fija, es un contraste directo entre los dos lados,
/// gana quien saque más.
function contestValue(attributes: AttributeBlock, attribute: Attribute): number {
  return Math.floor(Math.random() * 20) + 1 + Math.floor(attributes[attribute] / 2);
}

export function rollInitiative(playerAttributes: AttributeBlock, npcAttributes: AttributeBlock): 'jugador' | 'npc' {
  return contestValue(playerAttributes, 'destreza') >= contestValue(npcAttributes, 'destreza') ? 'jugador' : 'npc';
}

export interface ExchangeParticipant {
  attributes: AttributeBlock;
  /// Atributo de la habilidad elegida — sirve dos propósitos a la vez: es con qué se tira
  /// (igual que `rollCheck`) y es el "tipo" que entra en la rueda de debilidades
  /// (attributeWheel.ts). Nunca se pide por separado: la habilidad ya trae su
  /// `preferredAttribute`, ver classAbilities.ts/berigLore.ts/worldCatalog.ts.
  attribute: Attribute;
  difficulty: number;
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
  | 'golpe_pleno'; // ataque excelente y defensa falla: el peor caso, el efecto de la habilidad atacante se aplica entero

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

/// Resuelve un intercambio completo de ataque vs. defensa — dos tiradas independientes (nunca
/// una sola tirada de "contraataque" como hacía el sistema antiguo), cada una con su propio
/// multiplicador de tipo (rueda de debilidades, distinta para atacar que para defender), cruzadas
/// en una tabla de 9 resultados en vez de un simple golpea/no golpea. Puro y determinista salvo
/// por los dos `Math.random()` de las tiradas — mismo criterio que `rollCheck`: nunca deja que
/// el modelo decida el número, solo lo narra ya resuelto.
export function resolveExchange(atacante: ExchangeParticipant, defensor: ExchangeParticipant): ExchangeResult {
  const valorEfectivoAtacante = effectiveAttributeValue(atacante.attributes[atacante.attribute], atacante.attribute, defensor.attribute, 'ataque');
  const valorEfectivoDefensor = effectiveAttributeValue(defensor.attributes[defensor.attribute], defensor.attribute, atacante.attribute, 'defensa');

  const rollAtacante = Math.floor(Math.random() * 20) + 1;
  const resultAtacante = rollAtacante + Math.floor(valorEfectivoAtacante / 2);
  const gradoAtacante = gradoExitoFor(resultAtacante, atacante.difficulty);

  const rollDefensor = Math.floor(Math.random() * 20) + 1;
  const resultDefensor = rollDefensor + Math.floor(valorEfectivoDefensor / 2);
  const gradoDefensor = gradoExitoFor(resultDefensor, defensor.difficulty);

  return {
    atacante: {
      attribute: atacante.attribute,
      value: atacante.attributes[atacante.attribute],
      valorEfectivo: valorEfectivoAtacante,
      roll: rollAtacante,
      result: resultAtacante,
      difficulty: atacante.difficulty,
      success: gradoAtacante !== 'fallo',
      gradoExito: gradoAtacante,
    },
    defensor: {
      attribute: defensor.attribute,
      value: defensor.attributes[defensor.attribute],
      valorEfectivo: valorEfectivoDefensor,
      roll: rollDefensor,
      result: resultDefensor,
      difficulty: defensor.difficulty,
      success: gradoDefensor !== 'fallo',
      gradoExito: gradoDefensor,
    },
    resultado: OUTCOME_TABLE[gradoAtacante][gradoDefensor],
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
};

/// Texto "YA RESUELTO, no lo cambies" para el Narrador (mismo patrón que el resto de tiradas de
/// combate, turnResolution.ts) — nunca deja que el modelo decida ni el número ni el desenlace,
/// solo lo narra ya calculado.
export function exchangeContextBlock(exchange: ExchangeResult, atacanteNombre: string, defensorNombre: string): string {
  const grados = `${atacanteNombre} tira ${exchange.atacante.result} (${exchange.atacante.gradoExito}) vs dificultad ${exchange.atacante.difficulty} · ${defensorNombre} tira ${exchange.defensor.result} (${exchange.defensor.gradoExito}) vs dificultad ${exchange.defensor.difficulty}.`;
  return `RESULTADO DEL INTERCAMBIO — YA RESUELTO, no lo cambies: ${grados} ${OUTCOME_NARRATION_HINT[exchange.resultado](atacanteNombre, defensorNombre)}`;
}
