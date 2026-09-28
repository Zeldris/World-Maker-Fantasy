import type { Attribute, AttributeBlock, RollResult, RollMode } from './dice.js';
import type { AbilityEffect, CondicionFisica } from '@prisma/client';
import { gradoExitoFor, rollD20 } from './dice.js';
import { effectiveAttributeValue, typeMultiplierFor, type CombatTree } from './attributeWheel.js';
import { condicionMalus, saludBandFor } from './death.js';

/// Ataque de NPC ya decidido (oculto al frontend) — se persiste en `Save.pendingNpcAttack`
/// cuando la iniciativa de un intercambio favorece al NPC, y se consume/limpia al resolver la
/// defensa a ciegas del jugador en su siguiente sumisión (turnResolution.ts).
export interface PendingNpcAttack {
  npcId: string;
  attribute: Attribute;
  /// Bonus de atributo fijo de la habilidad de clase elegida por el NPC (2026-08-24, ver
  /// comentario de `ExchangeParticipant.attributeBonus` más abajo) — undefined/null en Ataque
  /// base/racial/genéricas, que no llevan ninguno.
  attributeBonus?: number | null;
  /// Lista (2026-08-15, "que una habilidad pueda tener múltiples AbilityEffects") — [] si la
  /// habilidad no lleva ningún efecto mecánico.
  effects: AbilityEffect[];
  /// Tope de usos por combate de la habilidad que dio pie a este ataque pendiente (2026-08-15,
  /// AbilityEffect.LIMITADA) — null/undefined = sin tope.
  maxUsesPerCombat?: number | null;
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
  /// AUMENTO/DEBILIDAD con duración (2026-09-09, mismo cierre de hueco que
  /// `NpcCombatAbility.durationEffectMagnitude/Turns`, npcCombatAbilities.ts) — se copian de la
  /// habilidad ya elegida al sembrar este ataque pendiente, y se consumen al resolverlo
  /// (turnResolution.ts): AUMENTO se aplica al propio NPC atacante, DEBILIDAD al jugador que lo
  /// recibe, mismo umbral `golpe_pleno` que ya usa el camino simétrico del jugador atacando.
  durationEffectMagnitude?: number | null;
  durationEffectTurns?: number | null;
}

/// CANALIZAR real (2026-09-09) — habilidad de ATAQUE del jugador que lleva `effects: [...,
/// 'CANALIZAR']` y ganó la iniciativa de su intercambio: se persiste en `Save.pendingCanalizacion`
/// en vez de resolverse de inmediato — el golpe real (con la tirada normal, LETAL u otros efectos
/// propios de la ficha) se dispara automáticamente en el turno siguiente si el jugador no recibió
/// un golpe decisivo (`golpe_pleno`) mientras tanto (turnResolution.ts § CASO DEFENSA lo cancela;
/// § CASO CANALIZACIÓN lo dispara). Diseño confirmado por la usuaria: "CANALIZAR no da nada por sí
/// solo... el bonus a la tirada final solo vendría de un AUMENTO explícito combinado en la misma
/// ficha" — ninguna de las fichas reales de clases.md lo combina, así que `attributeBonus` aquí es
/// siempre el mismo bonus fijo que ya llevaba la habilidad (Estocada Calculada, Furia de los
/// Elementos...), no un extra por canalizar.
export interface PendingCanalizacion {
  abilityName: string;
  attribute: Attribute;
  attributeBonus?: number | null;
  effects: AbilityEffect[];
  npcId: string;
}

/// Rediseño del turno de combate (2026-07-28, petición explícita: "primero se tiran dados y se
/// ve quien ataca primero... el otro entra en un turno de defensa... con su propia tirada de
/// dados independiente de la de ataque") — contraste directo entre los dos lados, gana quien saque
/// más. Enriquecido (2026-09-04, centralización de todas las tiradas del juego — "que el efecto de
/// los dados suceda de verdad, como en D&D"): antes un solo número plano (`dado + floor(destreza/2)`,
/// sin malus por condición física ni desglose alguno); ahora reusa `rollAttributeCheck` con
/// `multiplicador=1` fijo (sin rueda de tipos — no hay un "tipo de ataque" en una tirada de quién
/// reacciona más rápido, ambos lados siempre tiran con Destreza), así que malus por condición
/// física y `attributeBonus` de habilidad (si algún día alguna lo diera) SÍ entran en juego, igual
/// que en cualquier otra tirada de combate — cambio de balance real, no solo de vista, aprobado
/// explícitamente por la usuaria.
export interface InitiativeResult {
  ganador: 'jugador' | 'npc';
  jugador: ExchangeSideResult;
  npc: ExchangeSideResult;
}

export function rollInitiative(jugador: ExchangeParticipant, npc: ExchangeParticipant): InitiativeResult {
  const jugadorSide = rollAttributeCheck(jugador, 1);
  const npcSide = rollAttributeCheck(npc, 1);
  return { ganador: jugadorSide.result >= npcSide.result ? 'jugador' : 'npc', jugador: jugadorSide, npc: npcSide };
}

export interface ExchangeParticipant {
  attributes: AttributeBlock;
  /// Atributo de la habilidad elegida — sirve dos propósitos a la vez: es con qué se tira
  /// (igual que `rollCheck`) y es el "tipo" que entra en la rueda de debilidades
  /// (attributeWheel.ts). Nunca se pide por separado: la habilidad ya trae su
  /// `preferredAttribute`, ver classAbilities.ts/berigLore.ts/worldCatalog.ts.
  attribute: Attribute;
  /// Ya NO decide el desenlace de `resolveExchange` (rediseño a check opuesto, 2026-08-21) — se
  /// sigue calculando y viajando en `ExchangeSideResult.difficulty` solo porque `xpForRollSuccess`
  /// (progression.ts) todavía indexa su tabla de XP por este número. `resolveIndependentExchange`
  /// SÍ lo sigue usando para decidir el éxito propio de cada lado, sin cambios.
  difficulty: number;
  /// Malus mecánico por condición física (2026-07-29, ver death.ts § condicionMalus) — se resta
  /// al valor crudo del atributo antes del multiplicador de tipo, para este lado del intercambio.
  condicionFisica: CondicionFisica;
  /// Bonificador plano a la TIRADA de este lado (rediseño a check opuesto, 2026-08-21, petición
  /// explícita: mantener el bono de equipo de defensa del jugador — antes reducía la dificultad
  /// propia vía `contraataqueDifficultyFor`, ahora que la dificultad ya no decide nada se suma
  /// directo al resultado, como cualquier modificador normal de D&D — p.ej. el bono de armadura a
  /// la CA). Hoy solo lo usa el jugador defendiéndose (equipo real, `Save.defensa`); los NPC nunca
  /// lo tuvieron (siempre pasaban `0`), así que por defecto es `0` para todos los demás casos.
  bonoTirada?: number;
  /// Bonus de atributo fijo de la habilidad elegida (2026-08-24, Grupo 3 § Sistema de clases,
  /// clases.md § "Habilidad de daño vs ataque básico") — a diferencia de `bonoTirada` (se suma
  /// directo al resultado final, después de todo), esto se suma al valor CRUDO del atributo ANTES
  /// del multiplicador de tipo (`rollSide`, abajo) — sube el mismo modificador que subiría el
  /// atributo en sí ("Tajo Horizontal +2 de fuerza" es +2 de fuerza de verdad para esta tirada, no
  /// un +2 plano al resultado). `undefined`/`0` = comportamiento de siempre (Ataque Básico y el
  /// resto de habilidades sin bonus propio).
  attributeBonus?: number;
  /// Rediseño de combate (2026-08-09) — rol de la habilidad elegida por este lado ESTE
  /// intercambio. Decide qué función usa el caller (turnResolution.ts § resolveCombatExchangePhase):
  /// ataque-vs-defensa/ataque sigue resolviéndose por `resolveExchange`; en cuanto CUALQUIER lado
  /// es 'utilidad', se usa `resolveIndependentExchange` en su lugar. `resolveExchange` en sí no lee
  /// este campo (sigue funcionando exactamente igual que antes) — vive aquí para que el caller
  /// tenga un único objeto por lado, no un parámetro suelto aparte.
  rol: 'ataque' | 'defensa' | 'utilidad';
  /// Pasivas raciales (2026-08-28, pendiente 2026-08-27 punto 4, "de 2 raciales activas a 1
  /// pasiva") — el caller (turnResolution.ts/combateMultipleOrquestacion.ts) decide el modo según
  /// raza+contexto (defensa contra ataque no-mágico para Goirntes, primer intercambio del combate
  /// para Faerus...) y lo pasa aquí; `rollSide` solo sabe TIRAR con el modo que le dan, nunca
  /// decide por qué. `racialAdvantageReason` es el texto explicativo que viaja hasta la UI (petición
  /// explícita: "todos los datos ajenos al combate deben estar bien expresados e identificados") —
  /// ambos van juntos, nunca uno sin el otro.
  rollMode?: RollMode;
  racialAdvantageReason?: string;
}

export interface ExchangeSideResult extends RollResult {
  /// Valor de atributo YA con el multiplicador de tipo aplicado — el que de verdad entró en la
  /// tirada, distinto del `value` crudo que ya trae `RollResult`.
  valorEfectivo: number;
  /// El multiplicador de la rueda de debilidades en sí, SIN aplicar (petición explícita,
  /// 2026-08-14: "los multiplicadores aplicados por las debilidades, dando el resultado final" —
  /// antes solo se veía `valorEfectivo` ya multiplicado, sin poder distinguir si un bono alto
  /// venía de un atributo alto o de tener ventaja de tipo contra el rival). >1 = ventaja de tipo,
  /// exactamente 1 = sin relación en la rueda O en desventaja de tipo (solo premia, nunca
  /// penaliza — ver el comentario largo de `typeMultiplierFor`, attributeWheel.ts).
  multiplicador: number;
  /// Resta al atributo crudo por condición física (petición explícita, 2026-08-15: "cuando
  /// mostramos el attr hay que indicar también la resta que tiene por el estado... en el
  /// resultado" — nunca en la animación de dados, solo aquí) — `condicionMalus` (death.ts):
  /// 0/2/5/10 según ILESO/HERIDO/GRAVE/CONVALECIENTE. Ya estaba aplicado en silencio dentro de
  /// `valorEfectivo` desde siempre, pero nunca viajaba expuesto — sin esto, un bono más bajo de
  /// lo esperado por estar herido no tenía explicación visible.
  malus: number;
  /// Pasivas raciales (2026-08-28) — mismo criterio que `malus`/`multiplicador`: el número final
  /// nunca debe esconder de dónde sale. `rollMode !== 'normal'` cuando la tirada real tiró 2d20 en
  /// vez de 1 (ver `rolls`); `racialAdvantageReason` es el texto listo para mostrar ("Piel
  /// Quitinosa: ventaja al defenderse contra ataques físicos"). Ambos ausentes = tirada normal, sin
  /// ninguna pasiva racial de por medio.
  rolls: number[];
  rollMode: RollMode;
  racialAdvantageReason?: string;
  /// Bug real (2026-08-28, "en los cálculos de la tirada tampoco se está viendo" — jugando en
  /// vivo): `ExchangeParticipant.attributeBonus` (habilidad de arma/clase, +2/+4) ya se sumaba
  /// dentro de `valorEfectivo`/`result` desde siempre, pero nunca viajaba expuesto — mismo hueco
  /// exacto que `malus` tenía antes de 2026-08-15. Sin esto, un resultado más alto de lo esperado
  /// por el bonus de la habilidad no tenía explicación visible, igual que pasaba con `malus`.
  attributeBonus: number;
}

export type ExchangeOutcome =
  | 'defensor_contragolpea' // el ataque pierde el contraste por mucho: el defensor de propina replica
  | 'ataque_falla' // empate, o el ataque pierde el contraste por poco: no llega
  | 'parada_en_seco' // el ataque pierde el contraste por poco: bloqueado sin daño
  | 'golpe_normal' // el ataque gana el contraste por poco: golpe que llega
  | 'golpe_pleno' // el ataque gana el contraste por mucho: el peor caso, el efecto de la habilidad atacante se aplica entero
  /// Rediseño de combate (2026-08-09) — marca `CombatExchangeDisplay` cuando el intercambio se
  /// resolvió por `resolveIndependentExchange` (cualquier lado rol:'utilidad'), no por
  /// `resolveExchange` — el frontend ya muestra el éxito/fallo de cada lado por separado
  /// (CombatExchangeBadge.tsx), este valor solo evita forzar uno de los 5 desenlaces de ataque-vs-
  /// defensa donde no aplica ninguno.
  | 'independiente';

/// Umbral de margen "contundente" (rediseño a check opuesto de D&D, 2026-08-21, petición explícita
/// de la usuaria: "en D&D que tu saques un 22 y el enemigo un 24, no quiere decir que el 24 sea el
/// que gana?" — antes cada lado tiraba contra su PROPIA dificultad y se cruzaban los dos grados en
/// una tabla de 9 combinaciones, `OUTCOME_TABLE`, sin comparar nunca los totales entre sí).
/// Recalibrable jugando, igual que cualquier otro umbral numérico del juego — primer valor, no
/// verificado en partidas largas todavía.
const DECISIVE_MARGIN = 10;

/// Decide el desenlace por la MAGNITUD del margen entre los dos totales, no por cruzar dos grados
/// contra dificultades separadas. `'golpes_mutuos'` (antes: los dos con el mismo grado a la vez)
/// desaparece a propósito — en un contraste directo de dos números, uno de los dos es
/// estrictamente mayor (o hay empate), nunca "los dos ganan a la vez": es la consecuencia correcta
/// de que sea un check opuesto de verdad, no una pérdida accidental de matiz.
function outcomeForMargin(margen: number): ExchangeOutcome {
  if (margen > 0) return margen >= DECISIVE_MARGIN ? 'golpe_pleno' : 'golpe_normal';
  if (margen === 0) return 'ataque_falla'; // empate exacto → gana el defensor, el golpe no conecta
  return margen <= -DECISIVE_MARGIN ? 'defensor_contragolpea' : 'parada_en_seco';
}

export interface ExchangeResult {
  atacante: ExchangeSideResult;
  defensor: ExchangeSideResult;
  resultado: ExchangeOutcome;
  /// `atacante.result - defensor.result` — positivo si gana el atacante, negativo si gana el
  /// defensor (incluido el empate, que cuenta como victoria del defensor). Expuesto tal cual para
  /// que el frontend nunca tenga que recalcularlo por su cuenta (mismo criterio que
  /// `valorEfectivo`/`multiplicador`/`malus`: los números reales viajan explícitos, no implícitos).
  margen: number;
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
  margen: number;
  /// B23 (2026-09-28): el atacante es un NPC que no ataca (`ataqueNatural` "No ataca…") — su
  /// "golpe" nunca hace daño; el frontend no debe presentarlo como un ataque que conecta.
  atacanteInofensivo?: true;
}

/// Una sola tirada de un atributo — extraído (2026-09-04, centralización de todas las tiradas del
/// juego) de lo que antes era `rollSide`, parametrizado por el multiplicador YA calculado en vez de
/// derivarlo internamente: `rollSide` (ataque/defensa) sigue calculando la rueda de tipos y
/// llamando aquí; `rollInitiative` (más abajo) llama con `multiplicador=1` fijo — la rueda de
/// debilidades no tiene sentido semántico para "quién reacciona primero" (ambos lados siempre
/// tiran con Destreza contra Destreza, no hay un "tipo de ataque" en juego), pero malus por
/// condición física y `attributeBonus` sí aplican igual que en cualquier otra tirada.
export function rollAttributeCheck(self: ExchangeParticipant, multiplicador: number, random: () => number = Math.random): ExchangeSideResult {
  const valorCrudo = Math.max(1, self.attributes[self.attribute] + (self.attributeBonus ?? 0) - condicionMalus(self.condicionFisica));
  const valorEfectivo = Math.max(1, Math.round(valorCrudo * multiplicador));
  const { rolls, usedRoll } = rollD20(self.rollMode ?? 'normal', random);
  const result = usedRoll + Math.floor(valorEfectivo / 2) + (self.bonoTirada ?? 0);
  const gradoExito = gradoExitoFor(result, self.difficulty);
  return {
    attribute: self.attribute,
    value: self.attributes[self.attribute],
    valorEfectivo,
    multiplicador,
    malus: condicionMalus(self.condicionFisica),
    roll: usedRoll,
    rolls,
    rollMode: self.rollMode ?? 'normal',
    racialAdvantageReason: self.racialAdvantageReason,
    attributeBonus: self.attributeBonus ?? 0,
    result,
    difficulty: self.difficulty,
    success: gradoExito !== 'fallo',
    gradoExito,
  };
}

/// Una sola tirada de un lado del intercambio — extraído (rediseño de combate, 2026-08-09) de lo
/// que antes vivía duplicado inline dentro de `resolveExchange`, para que `resolveIndependentExchange`
/// pueda reusar exactamente la misma mecánica (malus por condición, multiplicador de tipo,
/// d20+bono, grado de éxito) sin decidir todavía cómo se cruza contra el rival.
function rollSide(self: ExchangeParticipant, opponentAttribute: Attribute, tree: CombatTree): ExchangeSideResult {
  const multiplicador = typeMultiplierFor(self.attribute, opponentAttribute, tree);
  return rollAttributeCheck(self, multiplicador);
}

/// Resuelve un intercambio completo de ataque vs. defensa — dos tiradas independientes (nunca
/// una sola tirada de "contraataque" como hacía el sistema antiguo), cada una con su propio
/// multiplicador de tipo (rueda de debilidades, distinta para atacar que para defender). Check
/// OPUESTO de verdad (rediseño 2026-08-21): se comparan los dos totales DIRECTAMENTE — quien saca
/// más, gana — en vez de que cada lado tire contra su propia dificultad y se crucen los grados
/// (mismo patrón que ya usaba `rollInitiative`/`contestValue` de arriba para decidir iniciativa,
/// simplemente nunca se había aplicado también aquí). `difficulty` de cada lado se SIGUE
/// calculando y viaja en el resultado (`ExchangeSideResult.difficulty`), pero ya no decide nada —
/// solo alimenta `xpForRollSuccess` (progression.ts) exactamente igual que antes. Empate exacto →
/// gana el defensor (petición explícita: el golpe no logra superar la defensa).
///
/// `success`/`gradoExito` de `rollSide` (calculados contra la propia dificultad, todavía
/// necesarios tal cual para `resolveIndependentExchange`) se SOBRESCRIBEN aquí con su significado
/// nuevo — relativo al RIVAL, no a la dificultad propia — para que el frontend (`CombatExchangeBadge`)
/// siga leyendo los mismos campos sin necesitar su propia copia de esta lógica. Desde el
/// 2026-09-07 (hallazgo 15/19b) `gradoExito` es binario (claro/fallo) — el margen real (`margen`,
/// más abajo) ya viaja expuesto para quien quiera matizar el desenlace, sin una tercera etiqueta
/// que a veces contradecía "quién ganó".
///
/// Puro y determinista salvo por los dos `Math.random()` de las tiradas — mismo criterio que
/// `rollCheck`: nunca deja que el modelo decida el número, solo lo narra ya resuelto.
///
/// Solo válida para un intercambio ataque-vs-defensa (o ataque-vs-ataque) — el caller
/// (turnResolution.ts) decide ANTES de llamar si algún lado es `rol:'utilidad'`, en cuyo caso usa
/// `resolveIndependentExchange` en su lugar; esta función no lee `ExchangeParticipant.rol` en
/// absoluto, sigue funcionando exactamente igual que antes del rediseño.
export function resolveExchange(atacante: ExchangeParticipant, defensor: ExchangeParticipant): ExchangeResult {
  const resultadoAtacante = rollSide(atacante, defensor.attribute, 'ataque');
  const resultadoDefensor = rollSide(defensor, atacante.attribute, 'defensa');
  const margen = resultadoAtacante.result - resultadoDefensor.result;
  resultadoAtacante.success = margen > 0;
  resultadoAtacante.gradoExito = margen > 0 ? 'claro' : 'fallo';
  resultadoDefensor.success = margen <= 0;
  resultadoDefensor.gradoExito = margen <= 0 ? 'claro' : 'fallo';
  return {
    atacante: resultadoAtacante,
    defensor: resultadoDefensor,
    resultado: outcomeForMargin(margen),
    margen,
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
/// diferencia de `resolveExchange`, NUNCA compara los dos totales entre sí (ni antes ni después del
/// rediseño a check opuesto de 2026-08-21, fuera de alcance a propósito): el éxito de cada lado
/// sigue decidiéndose SOLO contra su propia dificultad, nunca contra el rival. `atacante`/`defensor`
/// aquí son solo etiquetas de
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
  golpe_normal: (atacante, defensor) => `El ataque de ${atacante} alcanza a ${defensor} con normalidad pese a su defensa — narra el golpe.`,
  golpe_pleno: (atacante, defensor) =>
    `El PEOR caso para ${defensor}: el ataque de ${atacante} conecta de lleno, casi sin resistencia — narra el golpe con toda su fuerza.`,
  // `resolveExchange` (arriba) nunca produce este valor — solo lo asigna `resolveIndependentExchange`
  // directamente, que no pasa por `OUTCOME_NARRATION_HINT` en absoluto (usa
  // `independentExchangeContextBlock` en su lugar). Entrada presente solo para que el Record sea
  // exhaustivo a nivel de tipos.
  independiente: () => '',
};

/// Texto "YA RESUELTO, no lo cambies" para el Narrador (mismo patrón que el resto de tiradas de
/// combate, turnResolution.ts) — nunca deja que el modelo decida ni el número ni el desenlace,
/// solo lo narra ya calculado.
///
/// `defensorPuedeContragolpear` (bug real jugando en vivo, 2026-08-13, petición explícita de la
/// usuaria: "solo si la habilidad especifica que hace daño en defensa debe hacerlo... solo las de
/// ataque hacen daño"): `defensor_contragolpea` solo debería narrar un golpe de vuelta que
/// conecta de verdad si la habilidad de defensa elegida tiene `effect: 'ATAQUE'` — hoy NINGUNA
/// habilidad `rol: 'defensa'` lo tiene (todas son AGUANTE o sin efecto), así que el "de propina
/// replica" del texto original nunca debería narrarse; el caller (turnResolution.ts) decide el
/// booleano mirando la habilidad real, este archivo no conoce habilidades, solo tiradas.
///
/// Bug real de segunda vuelta (2026-08-14, "me hizo daño con una habilidad defensiva" —
/// "Lana Espesa", una habilidad `rol:'defensa'` sin `effect:'ATAQUE'`, seguía hiriendo al jugador
/// vía `golpes_mutuos`): la regla de la usuaria ("solo las de ataque hacen daño") se aplicó a
/// `defensor_contragolpea` en su momento pero se dejó fuera `golpes_mutuos`, el otro desenlace
/// donde el defensor también hace daño — mismo gate, mismo parámetro (el defensor de este
/// intercambio es el mismo en los dos casos). Downgrade a `golpe_normal` (el ataque SÍ conecta,
/// solo el golpe de vuelta del defensor queda anulado), no a `ataque_falla` — a diferencia de
/// `defensor_contragolpea` (el ataque ya había perdido el contraste por mucho ahí), aquí el
/// atacante sí ganó el contraste. Desenlace REAL del intercambio, tras aplicar el gate de "solo las
/// de ataque hacen daño" (bug real jugando en vivo, 2026-08-13/2026-08-14) — extraído de
/// `exchangeContextBlock` (bug real de segunda vuelta, 2026-08-15) para que el texto del Narrador y
/// el badge del frontend (`CombatExchangeDisplay`) nunca calculen el downgrade cada uno por su
/// cuenta. `'golpes_mutuos'` ya no existe como desenlace posible (rediseño a check opuesto,
/// 2026-08-21) — el downgrade que antes le aplicaba (→ `golpe_normal`) ya no hace falta.
export function effectiveExchangeOutcome(resultado: ExchangeOutcome, defensorPuedeContragolpear: boolean): ExchangeOutcome {
  if (defensorPuedeContragolpear) return resultado;
  if (resultado === 'defensor_contragolpea') return 'ataque_falla';
  return resultado;
}

export function exchangeContextBlock(
  exchange: ExchangeResult,
  atacanteNombre: string,
  defensorNombre: string,
  defensorPuedeContragolpear: boolean = true,
): string {
  // Rediseño a check opuesto (2026-08-21): ya no tiene sentido decir "vs dificultad X" por lado —
  // lo que decide el desenlace es la comparación DIRECTA entre los dos totales, así que el texto
  // se lo dice así al Narrador, con el margen real incluido.
  const margenTexto =
    exchange.margen > 0
      ? `${atacanteNombre} supera a ${defensorNombre} por ${exchange.margen}`
      : exchange.margen < 0
        ? `${defensorNombre} supera a ${atacanteNombre} por ${Math.abs(exchange.margen)}`
        : `empate exacto — gana ${defensorNombre} por defecto`;
  const grados = `${atacanteNombre} tira ${exchange.atacante.result} · ${defensorNombre} tira ${exchange.defensor.result} — ${margenTexto}.`;
  const resultadoEfectivo = effectiveExchangeOutcome(exchange.resultado, defensorPuedeContragolpear);
  return `RESULTADO DEL INTERCAMBIO — YA RESUELTO, no lo cambies: ${grados} ${OUTCOME_NARRATION_HINT[resultadoEfectivo](atacanteNombre, defensorNombre)}`;
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

/// Calibra la severidad del golpe en el camino independiente (bug real jugando en vivo, 2026-08-15:
/// "clava su maza en el cráneo... atravesándolo de lado a lado... antes de caer al suelo, inerte"
/// para un golpe que en realidad solo bajó a la víctima de HERIDO a GRAVE — sigue consciente y en
/// pie, ni convaleciente ni muerta). `independentExchangeContextBlock` solo da los números crudos,
/// sin decir qué tan fuerte narrar el golpe — a diferencia del camino cruzado (`resolveExchange`),
/// que sí tiene `OUTCOME_NARRATION_HINT`/`npcFallsUnconsciousThisTurn` calibrando esto. `nuevaCondicion`
/// null = el golpe no conectó (efectoAplica false), nada que narrar como daño.
/// Rediseño de combate (2026-08-09) — ¿se dispara el efecto reactivo de una habilidad
/// `rol:'utilidad'` este intercambio? Dos reglas, según el propio `effect`:
/// - `ANALISIS` (Analizar rival): NO reactiva — solo depende de la propia tirada, nunca de qué
///   eligió el rival (petición explícita: revela el atributo recomendado con solo usarla y
///   acertar tu tirada, no hace falta que el rival ataque).
/// - Cualquier otro (`ATAQUE`=Contraataque, `INTIMIDACION`=Grito de Guerra, `ATURDIMIENTO`=
///   Instinto Salvaje): reactiva de verdad — exige AMBAS cosas a la vez: la tirada PROPIA tuvo
///   éxito (`ownEfectoAplica`, independiente de la tirada del rival, ver
///   `resolveIndependentExchange`) Y la habilidad que el RIVAL eligió este mismo intercambio es
///   `rol:'ataque'` (si el rival se defendió o usó utilidad, no hay ataque de daño al que
///   reaccionar, así que nunca se dispara).
///
/// Vive aquí (no en `turnResolution.ts`, donde nació) desde Combate múltiple (2026-08-25): pieza
/// pura reutilizada tanto por el 1v1 de siempre como por `combateMultiple.ts` § 4 — moverla evita
/// un import circular (turnResolution.ts → combateMultiple*.ts → turnResolution.ts).
export function utilityTriggered(
  ownRol: 'ataque' | 'defensa' | 'utilidad',
  ownEffects: AbilityEffect[],
  ownEfectoAplica: boolean,
  opponentRol: 'ataque' | 'defensa' | 'utilidad',
): boolean {
  if (ownRol !== 'utilidad' || !ownEfectoAplica) return false;
  if (ownEffects.includes('ANALISIS')) return true;
  return opponentRol === 'ataque';
}

/// Decide qué función de resolución usar para este lado de utilidad (hallazgo 12,
/// revisar-partida-hallazgos.md 2026-09-06) — antes: cualquier lado rol:'utilidad' bastaba para
/// caer siempre en resolveIndependentExchange (dificultad fija propia). Ahora: una utilidad que
/// RESPONDE a un ataque entrante (efectos reactivos: ATAQUE/ATURDIMIENTO/INTIMIDACION/CONTROL —
/// los mismos 4 que turnResolution.ts ya trata como "roba iniciativa o contragolpea" tanto en el
/// camino independiente como en `utilityTriggered`, cuando el rival este intercambio es
/// rol:'ataque') se resuelve como tirada-vs-tirada directa (resolveExchange), igual que
/// ataque/defensa — petición explícita de la usuaria: "la única forma de parar un ataque es
/// defendiéndote o usando una habilidad de utilidad que indique que para el ataque... en esos
/// casos se comparará solo la tirada como en ataque/defensa". Solo ANALISIS/RECUPERACION (nunca
/// reactivos) y cualquier utilidad usada sin ataque entrante del rival siguen en el camino
/// independiente contra dificultad propia (utilityDifficultyFor) — el ataque entra con su tirada
/// normal Y la utilidad se juzga en paralelo, sin relación entre sí.
export function isReactiveUtility(
  ownRol: 'ataque' | 'defensa' | 'utilidad',
  ownEffects: AbilityEffect[],
  opponentRol: 'ataque' | 'defensa' | 'utilidad',
): boolean {
  if (ownRol !== 'utilidad') return false;
  if (ownEffects.includes('ANALISIS')) return false;
  return (
    opponentRol === 'ataque' &&
    (ownEffects.includes('ATAQUE') || ownEffects.includes('ATURDIMIENTO') || ownEffects.includes('INTIMIDACION') || ownEffects.includes('CONTROL'))
  );
}

export function hitSeverityHint(nombreObjetivo: string, nuevaCondicion: CondicionFisica | null): string {
  if (!nuevaCondicion) return `El golpe no conecta — no hay ningún daño real que narrar en ${nombreObjetivo}.`;
  if (nuevaCondicion === 'CONVALECIENTE' || nuevaCondicion === 'MUERTO') return '';
  return `El golpe SÍ conecta y empeora la condición de ${nombreObjetivo} a ${saludBandFor(nuevaCondicion)} — pero sigue consciente, en pie y capaz de seguir luchando. NUNCA lo narres cayendo inerte, desmayado o muerto: eso sería adelantar un desenlace que todavía no ha pasado.`;
}
