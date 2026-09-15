import type { Attribute, AttributeBlock } from './dice.js';
import type { AbilityEffect, AbilityRol } from '@prisma/client';
import { baseAttackFor } from './baseAttack.js';
import { classAbilityUnlocksForClase, type Clase, type Especializacion } from './classAbilities.js';
import type { NpcHabilidadRacialInScene } from './npcScene.js';
import { faunaCategoriaAbilitiesForLevel, type FaunaCategoria } from './faunaAbilities.js';
import { ENERGY_COST_BASICA, ENERGY_COST_ATAQUE_BASICO } from './energy.js';

export interface NpcCombatAbility {
  name: string;
  /// Revisión de partida 2026-08-08, bug real jugando en vivo: un Múrgol (fauna sin arma, cuyo
  /// `ataqueNatural` es "Topetazo torpe con su cornamenta ramificada...") se narró repetidamente
  /// como "el orco lanudo" dando "zarpazos" — porque el único dato que llegaba al Narrador era el
  /// NOMBRE de la habilidad ("Ataque base", siempre igual, sin ninguna pista de CÓMO ataca de
  /// verdad esta especie) — `ataqueBase.description` (baseAttack.ts, ya calculada) se descartaba
  /// aquí mismo antes de este fix. Sin arma/ataqueNatural, el resto de habilidades (de clase,
  /// raciales) sí tenían nombres propios descriptivos, pero fauna desarmada dependía SOLO de
  /// "Ataque base" — el caso más grave y más frecuente.
  description: string;
  attribute: Attribute;
  /// Bonus de atributo fijo (2026-08-24, ver comentario de `ExchangeParticipant.attributeBonus`,
  /// combatExchange.ts) — solo las de clase lo llevan, igual que `effects`/`maxUsesPerCombat`.
  attributeBonus?: number;
  /// [] SOLO para Ataque base (baseAttackFor no tiene mecánica propia más allá del atributo).
  /// Hasta el sistema de categorías de raza de fauna (2026-09-02) las habilidades raciales de
  /// fauna (`Npc.habilidadesRaciales`) eran siempre puramente descriptivas, `effects: []` fijo —
  /// YA NO ES CIERTO: tanto las 7 de `faunaCategoria` (faunaAbilities.ts) como las hasta 3
  /// específicas por animal (`habilidadesRaciales`, ahora con `level`/`effects` reales en
  /// worldCatalog.ts) llevan `AbilityEffect` real, mismo criterio que las de clase. Lista, no
  /// valor único (2026-08-15, "que una habilidad pueda tener múltiples AbilityEffects").
  effects: AbilityEffect[];
  /// Rediseño de combate (2026-08-09) — ver `enum AbilityRol` (schema.prisma). Ataque base
  /// siempre 'ataque'; de clase toma el `rol` ya asignado en classAbilities.ts (hoy las 4 son
  /// 'utilidad'); racial humanoide ataque/defensa trivial según el slot; racial de fauna toma
  /// `categoria` tal cual (ya existía en worldCatalog.ts, antes descartado aquí); Esquivar/
  /// Defenderse genéricos 'defensa'. Deliberadamente MÁS ESTRECHO que el `AbilityRol` de Prisma
  /// (2026-08-15, tras añadirse 'pasiva' al enum para habilidades como "Compañero cazador"): esta
  /// lista es "lo que un NPC puede ELEGIR usar en un intercambio de combate" — una pasiva no es una
  /// acción de turno, nunca debería llegar aquí (ver el filtro en `npcCombatAbilitiesFor` de abajo).
  rol: 'ataque' | 'defensa' | 'utilidad';
  /// Sistema de fatiga simétrico (2026-07-30, deuda técnica: "los NPC siguen eligiendo habilidad
  /// sin restricción de energía") — mismo coste fijo por tramo que el jugador (energy.ts):
  /// ENERGY_COST_ATAQUE_BASICO para el Ataque base (2026-07-31, antes 0/gratis — ver comentario
  /// de más abajo), ENERGY_COST_BASICA para el resto (de clase, racial dual, o la propia de
  /// fauna) — ningún NPC tiene hoy una habilidad "avanzada" equivalente a la de arma nivel 20 del
  /// jugador, así que no hace falta ese tramo.
  energyCost: number;
  /// Rediseño 2026-07-31 (mismo sistema simétrico que el coste, ver energy.ts § nextEnergia) —
  /// energía que RECUPERA usar esta habilidad en un intercambio real. Esquivar/Defenderse
  /// genéricos regeneran (5/10); el resto, incluido Ataque base, se queda en 0.
  energyRegen: number;
  /// Tope de usos por combate (2026-08-15, AbilityEffect.LIMITADA) — undefined/null = sin tope.
  /// Solo las de clase pueden traerlo (classAbilities.ts); Ataque base/raciales/genéricas nunca.
  maxUsesPerCombat?: number | null;
  /// AUMENTO/DEBILIDAD con duración de turnos, generados por un atacante AUTÓNOMO — NPC rival o
  /// Companion (2026-09-09, cierre del hueco documentado en `classAbilities.ts` § cabecera:
  /// "Companion.activeEffects se LEE en combate múltiple pero nada lo ESCRIBE todavía"). Mismos
  /// campos que `StartingAbility.durationEffectMagnitude/Turns` — el catálogo YA los llevaba en
  /// varias habilidades de clase (Runa de Fuerza, Golpe Runa de Cólera...), pero se descartaban al
  /// construir este tipo, así que ningún NPC/Companion atacando podía nunca producir el efecto
  /// sobre sí mismo o su rival, aunque el jugador sí (`HabilidadParaIntercambio` ya los tenía desde
  /// Fase 3§3a, solo poblados para la habilidad de la jugadora). Solo las de clase los traen
  /// (mismo alcance que `attributeBonus`/`maxUsesPerCombat`) — Ataque base/racial/genéricas nunca.
  durationEffectMagnitude?: number | null;
  durationEffectTurns?: number | null;
  /// A quién recae el efecto de arriba (2026-09-15, Caballero del Valor 40, Sacrificio del
  /// Valiente — "te llevas el golpe dirigido a un aliado" disparado desde ROL DEFENSA, no ataque)
  /// — mismo campo/semántica que `HabilidadParaIntercambio.durationEffectTarget`
  /// (combateMultiple.ts), pero necesario aquí porque un Companion (o la jugadora, cuando defiende
  /// con su `SavedAction` real, mapeada a este tipo) también puede llevar una habilidad de DEFENSA
  /// con esta redirección — un NPC rival nunca la lleva (no tiene Companion propio), pero el tipo
  /// es compartido por todo el roster de `chooseNpcAbility`.
  durationEffectTarget?: 'self' | 'companion' | 'both' | null;
}

export interface NpcForCombatAbilities {
  level: number;
  attributes: AttributeBlock;
  raza: string | null;
  clase: string | null;
  /// Especialización dentro de `clase` (2026-08-24, Grupo 3 § Sistema de clases) — null/undefined
  /// = solo tronco común, o clase sin especialización asignada.
  especializacion?: string | null;
  ataqueNatural: string | null;
  habilidadesRaciales: NpcHabilidadRacialInScene[];
  /// Sistema de categorías de raza de fauna (2026-09-02, `Npc.faunaCategoria`) — sistema PARALELO
  /// a `clase`/`raza`, nunca combinado con ellos en la práctica (fauna no lleva clase/raza).
  /// null/undefined = sin categoría asignada (fauna sin combate real, o pendiente de clasificar).
  faunaCategoria?: string | null;
}

/// Rediseño del turno de combate (2026-07-28) — reúne TODO lo que un NPC puede usar en un
/// intercambio (Ataque base + su clase, si tiene, hasta su nivel + su racial, humanoide o
/// fauna) en una sola lista plana. Mismo criterio que `resolveCombatAbilities` del frontend
/// (lib/npcAbilities.ts) para la ficha de la Enciclopedia, pero aquí en el backend y sobre los
/// catálogos reales (classAbilities.ts/berigLore.ts) en vez de la respuesta HTTP de la
/// Enciclopedia — los dos deben mostrar lo mismo, pero este es el que de verdad decide la
/// mecánica.
export function npcCombatAbilitiesFor(npc: NpcForCombatAbilities, weaponNames: string[]): NpcCombatAbility[] {
  const abilities: NpcCombatAbility[] = [];

  // Rediseño 2026-07-31 ("ataque básico... son acciones que tienen todos los personajes... cuesta
  // solo 5 de energía") — mismo cambio que el lado del jugador (weaponAbilities.ts): el Ataque
  // base deja de ser gratis y pasa a costar ENERGY_COST_ATAQUE_BASICO, simétrico entre jugador y
  // NPC.
  const ataqueBase = baseAttackFor({ attributes: npc.attributes, weaponNames, ataqueNatural: npc.ataqueNatural });
  abilities.push({
    name: ataqueBase.name,
    description: ataqueBase.description,
    attribute: ataqueBase.preferredAttribute,
    effects: [],
    rol: 'ataque',
    energyCost: ENERGY_COST_ATAQUE_BASICO,
    energyRegen: 0,
  });

  if (npc.clase) {
    for (const unlock of classAbilityUnlocksForClase(npc.clase as Clase, npc.especializacion as Especializacion | null)) {
      if (unlock.level > npc.level) continue;
      // Pasivas (2026-08-15, "Compañero cazador" — nivel 8 Cazador) nunca entran al roster de
      // combate: no son una acción de turno, se quedan siempre activas por sí solas. Sin este
      // filtro, un Cazador NPC de nivel 8+ tendría una "habilidad" sin comportamiento real de
      // intercambio (chooseNpcAbility ya la ignoraría en la práctica, pero el tipo de `rol` deja
      // de ser el estrecho 'ataque'/'defensa'/'utilidad' que exige el resto del motor de combate).
      if (unlock.ability.rol === 'pasiva') continue;
      abilities.push({
        name: unlock.ability.name,
        description: unlock.ability.description,
        attribute: unlock.ability.preferredAttribute ?? 'fuerza',
        attributeBonus: unlock.ability.attributeBonus,
        effects: unlock.ability.effects ?? [],
        rol: unlock.ability.rol ?? 'ataque',
        energyCost: ENERGY_COST_BASICA,
        energyRegen: 0,
        maxUsesPerCombat: unlock.ability.maxUsesPerCombat,
        durationEffectMagnitude: unlock.ability.durationEffectMagnitude,
        durationEffectTurns: unlock.ability.durationEffectTurns,
        durationEffectTarget: unlock.ability.durationEffectTarget,
      });
    }
  }

  // Bug real jugando en vivo (2026-09-04: "el Orco Enfurecido usó Sangre del Estallido... juraría
  // que la descatalogamos"): este bloque seguía empujando las 2 habilidades raciales activas
  // VIEJAS (ataque/defensa, p.ej. "Sangre del Estallido"/"Piel de Guerra") para CUALQUIER NPC con
  // `raza`, incondicionalmente — incluso el Orco Enfurecido, que ya tiene `clase: GUERRERO` /
  // `especializacion: BERSERKER` real (worldCatalog.ts) y debería usar solo su kit de clase. El
  // camino gemelo del JUGADOR se cerró el 2026-09-01 (`dynamicCombatAbilitiesFor`,
  // dynamicAbilities.ts) cuando el rediseño de pasivas raciales (2026-08-28, `racialPassives.ts`)
  // las sustituyó por una única pasiva automática — este lado de NPC nunca se tocó en la misma
  // pasada. Decisión explícita esta vez: quitarlo de TODO NPC, tenga clase o no (nunca deja a
  // nadie sin nada usable — Ataque base arriba y Esquivar/Defenderse genéricos más abajo son
  // incondicionales). `BerigRazaInfo.habilidadesRaciales` en `berigLore.ts` se deja intacto —
  // sigue siendo lore/dato de referencia, solo se quita el punto que lo convertía en acción real.

  // Sistema de categorías de raza de fauna (2026-09-02) — las 7 habilidades base de
  // `npc.faunaCategoria`, filtradas por nivel igual que las de clase de arriba. Sistema PARALELO
  // a `clase`/`raza` (ver comentario de `NpcForCombatAbilities.faunaCategoria`) — en la práctica
  // nunca coincide con ninguno de los dos bloques de arriba (fauna no lleva clase/raza).
  if (npc.faunaCategoria) {
    for (const ability of faunaCategoriaAbilitiesForLevel(npc.faunaCategoria as FaunaCategoria, npc.level)) {
      // Ninguna habilidad de categoría de fauna es 'pasiva' hoy (faunaAbilities.ts, todas
      // 'ataque'/'defensa'/'utilidad'), pero el filtro se deja igual que en el bloque de clase de
      // arriba por si el catálogo crece — mismo motivo exacto: una pasiva no es acción de turno.
      if (ability.rol === 'pasiva') continue;
      abilities.push({
        name: ability.name,
        description: ability.description,
        attribute: ability.preferredAttribute ?? 'fuerza',
        attributeBonus: ability.attributeBonus,
        effects: ability.effects ?? [],
        rol: ability.rol ?? 'ataque',
        energyCost: ENERGY_COST_BASICA,
        energyRegen: 0,
        maxUsesPerCombat: ability.maxUsesPerCombat,
      });
    }
  }

  // Sistema de categorías de raza de fauna (2026-09-02) — las hasta 3 habilidades ESPECÍFICAS de
  // este animal individual (worldCatalog.ts), ahora filtradas por `level` igual que el resto del
  // roster (antes se añadían todas sin filtro, `effects: []` fijo — ver comentario actualizado de
  // `NpcCombatAbility.effects` arriba). `categoria` (ataque/defensa/utilidad) ya existía y se
  // respeta tal cual, igual que antes.
  for (const racial of npc.habilidadesRaciales) {
    if (racial.level > npc.level) continue;
    abilities.push({
      name: racial.name,
      description: racial.description,
      attribute: racial.preferredAttribute,
      effects: racial.effects ?? [],
      rol: racial.categoria,
      energyCost: ENERGY_COST_BASICA,
      energyRegen: 0,
    });
  }

  // Esquivar/Defenderse genéricos (2026-07-30, petición explícita: "a los npc les falta la
  // habilidad de esquivar y defenderse") — mismo fallback SIEMPRE disponible que ya tiene
  // cualquier personaje jugable (GENERIC_COMBAT_ABILITIES, genericCombatAbilities.ts). Sin esto,
  // un NPC sin clase/raza con habilidad AGUANTE (fauna, sociales, PLANTILLA genéricas) no tenía
  // NINGUNA opción defensiva real — `chooseNpcAbility('defensa', ...)` caía siempre en el roster
  // entero (en la práctica, reusar Ataque base como si fuera una defensa).
  // Descripciones idénticas a GENERIC_COMBAT_ABILITIES (genericCombatAbilities.ts) — mismo verbo
  // que ya usa el jugador para las mismas dos acciones, coherencia entre los dos lados.
  //
  // Ajuste 2026-08-28 (petición explícita, ronda de correcciones): "mismos números que el lado del
  // jugador" se quedó desactualizado en algún punto — el lado del NPC ya tenía Esquivar costando 5
  // (`energyCost: 5, energyRegen: 0`) desde antes, pero el lado del jugador seguía RECUPERANDO 5
  // hasta hoy. Ahora ambos vuelven a coincidir.
  abilities.push({
    name: 'Esquivar',
    description: 'Se aparta del golpe confiando en sus reflejos y destreza.',
    attribute: 'destreza',
    effects: ['AGUANTE'],
    rol: 'defensa',
    energyCost: 5,
    energyRegen: 0,
  });
  abilities.push({
    name: 'Defenderse',
    description: 'Se planta y aguanta el golpe con pura resistencia física.',
    attribute: 'constitucion',
    effects: ['AGUANTE'],
    rol: 'defensa',
    energyCost: 0,
    energyRegen: 5,
  });
  return abilities;
}

/// Elige qué habilidad usa el NPC este intercambio (petición explícita: "por lo general usarán
/// habilidades defensivas pero siendo posible usar todas las del combate"). `side` es de qué LADO
/// del intercambio actúa el NPC este turno (atacando o defendiendo) — distinto de
/// `NpcCombatAbility.rol` (qué ES la habilidad en sí), de ahí el renombrado (rediseño de combate,
/// 2026-08-09, antes este parámetro se llamaba `rol` y chocaba con el campo nuevo).
///
/// Defendiendo: `rol:'defensa'` O `rol:'utilidad'` cuentan como "defensivo" (una utilidad
/// reactiva a un ataque rival ES una forma de defenderse, igual que antes lo era AGUANTE) — se
/// prefiere 7 de cada 10 veces, nunca al 100% (deja hueco a defenderse con una de ataque, igual
/// que puede hacer el jugador). Atacando: SOLO `rol:'ataque'` tiene sentido — ni una defensa ni
/// una utilidad "atacan" (bug real confirmado jugando en vivo, 2026-07-31, cuando esto se
/// filtraba solo por `effect==='AGUANTE'`: "el orco ataca con Esquivar"). Se excluye SIEMPRE
/// `effect==='ANALISIS'` (Analizar rival) del roster elegible, en los dos roles — no tiene ningún
/// payoff mecánico jugable desde el lado del NPC (no hay ficha del jugador que ocultar/revelar).
///
/// Sistema de fatiga simétrico (2026-07-30) — `energiaDisponible` descarta antes de elegir
/// cualquier habilidad que el NPC no pueda pagar ahora mismo, mismo criterio que HabilidadesPanel
/// bloquea un botón sin energía suficiente para el jugador. Desde 2026-07-31 el Ataque base ya NO
/// es gratis (cuesta ENERGY_COST_ATAQUE_BASICO) — Esquivar/Defenderse (energyCost 0) siguen
/// sobreviviendo el filtro, así que `affordable` nunca sale vacío, pero un NPC muy exhausto (menos
/// de 5 de energía, tras una racha larga de ataques sin defender nunca) puede quedarse SIN ningún
/// `atacantes` afrontable — ver el segundo fallback de abajo.
export function chooseNpcAbility(
  abilities: NpcCombatAbility[],
  side: 'ataque' | 'defensa',
  energiaDisponible: number,
  random: () => number = Math.random,
  // Tope de usos por combate (2026-08-15, AbilityEffect.LIMITADA/maxUsesPerCombat) — mapa
  // `nombre de habilidad → veces usada` en el encuentro actual (NpcState.abilityUsesThisEncounter).
  // Mismo criterio que `energyCost`: una habilidad que ya agotó su tope se descarta del roster
  // elegible, nunca se ofrece de nuevo hasta que el contador se resetee (vuelta a ILESO).
  usageCounts: Record<string, number> = {},
): NpcCombatAbility {
  const usable = abilities.filter(
    (a) => !a.effects.includes('ANALISIS') && (a.maxUsesPerCombat == null || (usageCounts[a.name] ?? 0) < a.maxUsesPerCombat),
  );
  const affordable = usable.filter((a) => a.energyCost <= energiaDisponible);
  if (side === 'defensa') {
    const defensivas = affordable.filter((a) => a.rol === 'defensa' || a.rol === 'utilidad');
    if (defensivas.length > 0 && random() < 0.7) {
      return defensivas[Math.floor(random() * defensivas.length)];
    }
    return affordable[Math.floor(random() * affordable.length)];
  }
  // Excepción acotada a CONTROL (auditoría de consolidación, 2026-09-01, "Opresión Mental
  // estructuralmente inalcanzable para cualquier NPC"): la regla de arriba ("ni una defensa ni
  // una utilidad atacan") es correcta en general, pero Opresión Mental es una utilidad que SÍ
  // actúa como ataque real (roba la iniciativa, turnResolution.ts) — sin este caso especial,
  // ningún NPC Chamán/Opresor podía usarla nunca, aunque el jugador sí. Acotado por `effects`,
  // no por `rol` en general, para no reintroducir el bug real que motivó la regla original ("el
  // orco ataca con Esquivar").
  const atacantes = affordable.filter((a) => a.rol === 'ataque' || (a.rol === 'utilidad' && a.effects.includes('CONTROL')));
  if (atacantes.length > 0) return atacantes[Math.floor(random() * atacantes.length)];
  // Sin ninguna de ataque AFRONTABLE (2026-07-31, consecuencia real de que Ataque base ya no sea
  // gratis) — antes de caer en el roster entero (que podría ser puramente defensiva/utilidad y
  // reintroducir "el orco ataca con Esquivar", el bug ya arreglado el 2026-07-31), se prueba con
  // CUALQUIER habilidad de ataque del roster completo, ignorando el coste — un NPC exhausto sigue
  // golpeando igual, nunca "ataca defendiéndose". `nextEnergia` ya topa el resultado a 0, nunca a
  // negativo.
  const cualquierAtacante = usable.filter((a) => a.rol === 'ataque' || (a.rol === 'utilidad' && a.effects.includes('CONTROL')));
  const pool = cualquierAtacante.length > 0 ? cualquierAtacante : affordable;
  return pool[Math.floor(random() * pool.length)];
}
