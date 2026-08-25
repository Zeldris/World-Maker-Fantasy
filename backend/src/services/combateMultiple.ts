import type { AbilityEffect, CondicionFisica } from '@prisma/client';
import type { Attribute, AttributeBlock } from './dice.js';
import { resolveExchange, resolveIndependentExchange, exchangeContextBlock, independentExchangeContextBlock, utilityTriggered, type ExchangeParticipant } from './combatExchange.js';
import { nextCondicionForAttack } from './death.js';
import { dualWieldAdjustedDifficulty } from './weaponAbilities.js';

/// Grupo 3 § Combate múltiple (2026-08-25, diseño completo en docs/rpgtarkor/combate-multiple.md)
/// — Fase A: piezas puras (iniciativa N-way, emparejamiento/retargeting por Inteligencia,
/// partición en sub-combates 4v4). Deliberadamente SEPARADO de `combatExchange.ts`: la tirada
/// pairwise (`resolveExchange`/`resolveIndependentExchange`) se queda intacta y se sigue
/// reutilizando tal cual, esto solo decide QUIÉN tira cuándo y CONTRA QUIÉN — nunca reimplementa
/// la mecánica de un intercambio en sí.

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — Iniciativa individual real (generaliza rollInitiative de 2 lados a N combatientes)
// ═══════════════════════════════════════════════════════════════════════════

export type Bando = 'JUGADOR' | 'ENEMIGO';

export interface CombatienteIniciativa {
  participantId: string;
  bando: Bando;
  destreza: number;
}

export interface IniciativaEntry {
  participantId: string;
  bando: Bando;
  roll: number;
  result: number;
}

/// Cada combatiente tira su propia iniciativa (d20 + mitad de Destreza, misma fórmula que
/// `contestValue` en combatExchange.ts) — se ordenan todos en una única cola, empate lo gana
/// mayor Destreza cruda, empate total lo gana quien apareciera antes en `combatientes` (orden
/// estable, nunca aleatorio de más).
export function rollInitiativeMultiple(combatientes: CombatienteIniciativa[], random: () => number = Math.random): IniciativaEntry[] {
  const entries = combatientes.map((c) => {
    const roll = Math.floor(random() * 20) + 1;
    return { participantId: c.participantId, bando: c.bando, destreza: c.destreza, roll, result: roll + Math.floor(c.destreza / 2) };
  });
  return entries
    .slice()
    .sort((a, b) => b.result - a.result || b.destreza - a.destreza)
    .map(({ participantId, bando, roll, result }) => ({ participantId, bando, roll, result }));
}

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — Quién ataca a quién: emparejamiento/retargeting por turno, según Inteligencia
// ═══════════════════════════════════════════════════════════════════════════

/// Mismo umbral que `SUERTE_VENTAJA_UMBRAL` (dice.ts) — cifra de partida, ajustable jugando, no
/// un cierre definitivo. Inteligencia ALTA = objetivo inteligente (remata al más herido);
/// Inteligencia BAJA = aleatorio entre los vivos del bando contrario.
export const INTELIGENCIA_TACTICA_UMBRAL = 12;

/// Orden de "cuánto le queda" — MUERTO/CONVALECIENTE ya no son objetivo válido (fuera de
/// combate, mismo criterio que el resto del motor: solo esos dos estados son saqueables/
/// rematables, nunca atacables de nuevo).
const ORDEN_CONDICION: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO'];

export interface ObjetivoCandidato {
  participantId: string;
  condicionFisica: CondicionFisica;
}

export function objetivosValidos(candidatos: ObjetivoCandidato[]): ObjetivoCandidato[] {
  return candidatos.filter((c) => c.condicionFisica !== 'CONVALECIENTE' && c.condicionFisica !== 'MUERTO');
}

/// Elige el objetivo de un ataque — `null` si no queda nadie vivo en el bando contrario (el
/// combate para ese bando ya terminó). Inteligencia alta prioriza rematar (mayor `ORDEN_CONDICION`,
/// más cerca de caer); empate entre igual de heridos se rompe por orden de aparición en
/// `candidatos`, nunca aleatorio de más — solo Inteligencia baja tira dado de verdad.
export function elegirObjetivo(inteligenciaAtacante: number, candidatos: ObjetivoCandidato[], random: () => number = Math.random): string | null {
  const vivos = objetivosValidos(candidatos);
  if (vivos.length === 0) return null;
  if (inteligenciaAtacante < INTELIGENCIA_TACTICA_UMBRAL) {
    return vivos[Math.floor(random() * vivos.length)].participantId;
  }
  const masHerido = vivos.reduce((peor, actual) =>
    ORDEN_CONDICION.indexOf(actual.condicionFisica) > ORDEN_CONDICION.indexOf(peor.condicionFisica) ? actual : peor,
  );
  return masHerido.participantId;
}

/// Redecide el emparejamiento de TODO un bando de una vez (llamado tras cada baja, §2: "el
/// emparejamiento se redecide en cada turno individual") — cada atacante vivo de `atacantes`
/// recibe un objetivo válido de `defensores`, o `null` si ya no queda ninguno.
export function retargetBando(
  atacantes: { participantId: string; inteligencia: number }[],
  defensores: ObjetivoCandidato[],
  random: () => number = Math.random,
): Record<string, string | null> {
  const resultado: Record<string, string | null> = {};
  for (const atacante of atacantes) {
    resultado[atacante.participantId] = elegirObjetivo(atacante.inteligencia, defensores, random);
  }
  return resultado;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — Bandos y tope de combatientes: 4 vs. 4 máximo, partición de encuentros grandes
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_COMBATIENTES_POR_BANDO = 4;

export interface CombatienteParticion {
  participantId: string;
  bando: Bando;
  /// true = es LA jugadora en persona (nunca más de uno) — decide qué sub-combate resultante es
  /// `jugable` (§3/§4: "solo UNO de esos sub-combates es jugable en directo, el que te incluye").
  esJugador?: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/// Parte un enfrentamiento en sub-combates de máximo 4 vs. 4 (§3). Caso real más común: un bando
/// (la party de la jugadora) ya cabe en 4 y el otro (un grupo grande de enemigos) no — cada
/// fragmento del bando grande se enfrenta al bando pequeño ENTERO, repetido tantas veces como
/// fragmentos salgan. Si los DOS bandos superan 4 a la vez (una batalla de verdad, ejército
/// contra ejército — el ejemplo "12 vs 12" del propio doc), se emparejan fragmento a fragmento
/// por índice, envolviendo cíclicamente el lado más corto si el número de fragmentos no coincide
/// — simplificación consciente y documentada: el doc no especifica el emparejamiento exacto para
/// el caso simétrico, esta es la lectura más simple que no dispara ningún error ni deja a nadie
/// sin combate asignado.
export function particionarEnSubCombates(combatientes: CombatienteParticion[]): CombatienteParticion[][] {
  const jugador = combatientes.filter((c) => c.bando === 'JUGADOR');
  const enemigo = combatientes.filter((c) => c.bando === 'ENEMIGO');
  const fragmentosJugador = chunk(jugador, MAX_COMBATIENTES_POR_BANDO);
  const fragmentosEnemigo = chunk(enemigo, MAX_COMBATIENTES_POR_BANDO);
  if (fragmentosJugador.length === 0 || fragmentosEnemigo.length === 0) return [];

  const totalSubCombates = Math.max(fragmentosJugador.length, fragmentosEnemigo.length);
  const subCombates: CombatienteParticion[][] = [];
  for (let i = 0; i < totalSubCombates; i++) {
    const ladoJugador = fragmentosJugador[i % fragmentosJugador.length];
    const ladoEnemigo = fragmentosEnemigo[i % fragmentosEnemigo.length];
    subCombates.push([...ladoJugador, ...ladoEnemigo]);
  }
  return subCombates;
}

/// Cuál de los sub-combates resultantes de `particionarEnSubCombates` es el jugable en directo —
/// el que contiene a la propia jugadora; el resto se resuelven deterministas (§3/§4). `null` si
/// ninguno la incluye (combate íntegramente autónomo, p. ej. Reino defendiéndose sin ella
/// presente, §4 — todos los sub-combates resultantes son deterministas en ese caso).
export function subCombateJugable(subCombates: CombatienteParticion[][]): number | null {
  const index = subCombates.findIndex((sc) => sc.some((c) => c.esJugador));
  return index === -1 ? null : index;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 4 — Intercambio con paridad completa (2026-08-25, integración real con el turno de la
// jugadora, tras confirmar explícitamente "paridad completa desde ya"): generaliza la rama "CASO
// ATAQUE" de `resolveCombatExchangePhase` (turnResolution.ts) — utilidades reactivas (Contraataque/
// Grito de Guerra/Instinto Salvaje/Analizar/Recuperación), doble arma y LETAL — a un par
// atacante/defensor CUALQUIERA (jugadora, compañero o NPC en cualquier combinación), no solo
// jugadora-vs-NPC-único. El modelo de turnos de Combate múltiple (iniciativa N-way, cada
// participante resuelve su turno en orden, §1/§2) ya NO tiene la ping-pong "ataque pendiente
// oculto" del 1v1 clásico — cada intercambio se resuelve al momento, así que solo hace falta
// portar la rama "CASO ATAQUE" (turnResolution.ts:979-1163), nunca "CASO DEFENSA": aquí no existe
// nunca un ataque pendiente que defender a ciegas.
//
// Simplificación consciente (documentada, no un cierre definitivo): `iniciativaForzada`
// (ATURDIMIENTO/INTIMIDACION "roban la iniciativa siguiente" en el 1v1) no se traduce a este
// modelo — la cola de iniciativa (`ordenIniciativa`) es fija desde el inicio del encuentro, robar
// el turno siguiente exigiría reordenar la cola en caliente, fuera de alcance de esta pasada. El
// EFECTO mecánico real de cada utilidad (cancelar el golpe entrante de Grito de Guerra, golpe de
// vuelta de Contraataque, revelar con Analizar, energía extra de Recuperación) sí se porta entero
// — `iniciativaForzada` en el resultado es solo informativo, el caller puede ignorarlo.
// ═══════════════════════════════════════════════════════════════════════════

/// Shape mínima de una habilidad elegida (ataque, defensa o utilidad) para un intercambio —
/// coincide a propósito con `NpcCombatAbility` (npcCombatAbilities.ts) para poder pasar esa misma
/// interfaz sin conversión; el turno de la jugadora construye una de estas a partir de su
/// `SavedAction` elegida (ver comentario de integración en turnResolution.ts).
export interface HabilidadParaIntercambio {
  name: string;
  description: string;
  attribute: Attribute;
  attributeBonus?: number;
  effects: AbilityEffect[];
  rol: 'ataque' | 'defensa' | 'utilidad';
  energyCost: number;
  energyRegen: number;
  maxUsesPerCombat?: number | null;
}

export interface CombatienteParaIntercambio {
  nombre: string;
  attributes: AttributeBlock;
  condicionFisica: CondicionFisica;
}

export interface ResultadoIntercambioCompleto {
  /// Texto "YA RESUELTO" para el Narrador — ya incluye el hint de LETAL si aplica, mismo criterio
  /// que `abilityEffectHint` en turnResolution.ts, pero concatenado en un único bloque en vez de
  /// viajar aparte (más simple de pasar a `narrarTurnoCombateMultiple`).
  exchangeBlock: string;
  defensorRecibeGolpe: boolean;
  nuevaCondicionDefensor: CondicionFisica;
  /// Contragolpe (defensor con `effect:'ATAQUE'` en su habilidad de defensa/utilidad) — a
  /// diferencia del 1v1 (donde el "atacante" siempre es quien tiene la iniciativa y rara vez
  /// recibe daño de vuelta en el mismo intercambio), aquí SÍ hace falta escribir la condición del
  /// propio atacante tras su turno.
  atacanteRecibeGolpe: boolean;
  nuevaCondicionAtacante: CondicionFisica;
  /// Informativo únicamente — ver comentario de cabecera de esta sección (§4).
  iniciativaForzada: 'atacante' | 'defensor' | null;
  analizarRivalExito: boolean;
  atacanteRecuperacionExtra: number;
  defensorRecuperacionExtra: number;
  combatBothMissed: boolean;
  combatRealHitLanded: boolean;
}

/// Mismo valor fijo que `RECUPERACION_ENERGY_BONUS` en turnResolution.ts (2026-08-17) — no hay
/// ningún dato en el catálogo hoy que exprese "cuánta energía recupera" por separado del
/// `energyRegen` normal de la habilidad.
const RECUPERACION_ENERGY_BONUS = 15;

export function resolverIntercambioCompleto(
  atacante: CombatienteParaIntercambio,
  atacanteHabilidad: HabilidadParaIntercambio,
  atacanteRol: 'ataque' | 'defensa' | 'utilidad',
  dificultadAtacante: number,
  defensor: CombatienteParaIntercambio,
  defensorHabilidad: HabilidadParaIntercambio,
  dificultadDefensor: number,
  dualWieldBonus: boolean = false,
): ResultadoIntercambioCompleto {
  const dificultadAtacanteAjustada = dualWieldAdjustedDifficulty(dificultadAtacante, dualWieldBonus);
  const atacanteExch: ExchangeParticipant = {
    attributes: atacante.attributes,
    attribute: atacanteHabilidad.attribute,
    attributeBonus: atacanteHabilidad.attributeBonus ?? 0,
    difficulty: dificultadAtacanteAjustada,
    condicionFisica: atacante.condicionFisica,
    rol: atacanteRol,
  };
  const defensorExch: ExchangeParticipant = {
    attributes: defensor.attributes,
    attribute: defensorHabilidad.attribute,
    attributeBonus: defensorHabilidad.attributeBonus ?? 0,
    difficulty: dificultadDefensor,
    condicionFisica: defensor.condicionFisica,
    rol: defensorHabilidad.rol,
  };

  let defensorRecibeGolpe: boolean;
  let nuevaCondicionDefensor = defensor.condicionFisica;
  let atacanteRecibeGolpe = false;
  let nuevaCondicionAtacante = atacante.condicionFisica;
  let iniciativaForzada: 'atacante' | 'defensor' | null = null;
  let analizarRivalExito = false;
  let atacanteRecuperacionExtra = 0;
  let defensorRecuperacionExtra = 0;
  let exchangeBlock: string;

  const esIndependiente = atacanteRol !== 'ataque' || defensorHabilidad.rol === 'utilidad';

  if (esIndependiente) {
    const independent = resolveIndependentExchange(atacanteExch, defensorExch);
    defensorRecibeGolpe = atacanteRol === 'ataque' && independent.atacante.efectoAplica;
    if (defensorRecibeGolpe) nuevaCondicionDefensor = nextCondicionForAttack(atacanteHabilidad.effects, defensor.condicionFisica);

    if (atacanteRol === 'utilidad') {
      const disparo = utilityTriggered('utilidad', atacanteHabilidad.effects, independent.atacante.efectoAplica, defensorHabilidad.rol);
      if (disparo) {
        if (atacanteHabilidad.effects.includes('ANALISIS')) analizarRivalExito = true;
        if (atacanteHabilidad.effects.includes('ATAQUE')) {
          defensorRecibeGolpe = true;
          nuevaCondicionDefensor = nextCondicionForAttack(atacanteHabilidad.effects, defensor.condicionFisica);
        }
        if (atacanteHabilidad.effects.includes('INTIMIDACION')) {
          iniciativaForzada = 'atacante';
          defensorRecibeGolpe = false;
          nuevaCondicionDefensor = defensor.condicionFisica;
        }
        if (atacanteHabilidad.effects.includes('ATURDIMIENTO')) iniciativaForzada = 'atacante';
        if (atacanteHabilidad.effects.includes('RECUPERACION')) atacanteRecuperacionExtra = RECUPERACION_ENERGY_BONUS;
      }
    }
    if (defensorHabilidad.rol === 'utilidad') {
      const disparo = utilityTriggered('utilidad', defensorHabilidad.effects, independent.defensor.efectoAplica, atacanteRol);
      if (disparo) {
        if (defensorHabilidad.effects.includes('ATAQUE')) {
          atacanteRecibeGolpe = true;
          nuevaCondicionAtacante = nextCondicionForAttack(defensorHabilidad.effects, atacante.condicionFisica);
        }
        if (defensorHabilidad.effects.includes('INTIMIDACION')) {
          iniciativaForzada = 'defensor';
          defensorRecibeGolpe = false;
          nuevaCondicionDefensor = defensor.condicionFisica;
        }
        if (defensorHabilidad.effects.includes('ATURDIMIENTO')) iniciativaForzada = 'defensor';
        if (defensorHabilidad.effects.includes('RECUPERACION')) defensorRecuperacionExtra = RECUPERACION_ENERGY_BONUS;
      }
    }
    exchangeBlock = independentExchangeContextBlock(independent, atacante.nombre, defensor.nombre);
  } else {
    const exchange = resolveExchange(atacanteExch, defensorExch);
    const defensorPuedeContragolpear = defensorHabilidad.effects.includes('ATAQUE');
    const defensorContragolpeaAplica = exchange.resultado === 'defensor_contragolpea' && defensorPuedeContragolpear;
    defensorRecibeGolpe = exchange.resultado === 'golpe_pleno' || exchange.resultado === 'golpe_normal';
    if (defensorRecibeGolpe) nuevaCondicionDefensor = nextCondicionForAttack(atacanteHabilidad.effects, defensor.condicionFisica);
    atacanteRecibeGolpe = defensorContragolpeaAplica;
    if (atacanteRecibeGolpe) nuevaCondicionAtacante = nextCondicionForAttack(defensorHabilidad.effects, atacante.condicionFisica);
    exchangeBlock = exchangeContextBlock(exchange, atacante.nombre, defensor.nombre, defensorPuedeContragolpear);
  }

  if (atacanteHabilidad.effects.includes('LETAL')) {
    exchangeBlock += defensorRecibeGolpe
      ? ` EFECTO DE HABILIDAD — YA RESUELTO: el golpe letal contra ${defensor.nombre} conecta y lo mata en el acto, sin importar en qué estado estuviera antes — narra el golpe final, no una herida más.`
      : ` EFECTO DE HABILIDAD — YA RESUELTO: el golpe letal no llega a conectar esta vez — narra el intento fallido, nunca su muerte.`;
  }

  return {
    exchangeBlock,
    defensorRecibeGolpe,
    nuevaCondicionDefensor,
    atacanteRecibeGolpe,
    nuevaCondicionAtacante,
    iniciativaForzada,
    analizarRivalExito,
    atacanteRecuperacionExtra,
    defensorRecuperacionExtra,
    combatBothMissed: !defensorRecibeGolpe && !atacanteRecibeGolpe,
    combatRealHitLanded: defensorRecibeGolpe,
  };
}
