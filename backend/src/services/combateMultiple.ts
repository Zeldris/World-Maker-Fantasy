import type { AbilityEffect, CondicionFisica } from '@prisma/client';
import type { Attribute, AttributeBlock } from './dice.js';
import {
  resolveExchange,
  resolveIndependentExchange,
  exchangeContextBlock,
  independentExchangeContextBlock,
  utilityTriggered,
  rollAttributeCheck,
  type ExchangeParticipant,
  type ExchangeSideResult,
  type CombatExchangeDisplay,
} from './combatExchange.js';
import { nextCondicionForAttack } from './death.js';
import { dualWieldAdjustedDifficulty } from './weaponAbilities.js';
import type { ActiveEffect } from './activeEffects.js';

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
  /// Enriquecido (2026-09-04, centralización de todas las tiradas del juego) — antes ausente,
  /// `rollInitiativeMultiple` usaba `destreza` cruda sin ningún malus. Ver comentario de la
  /// función más abajo.
  condicionFisica: CondicionFisica;
  attributeBonus?: number;
}

export interface IniciativaEntry extends ExchangeSideResult {
  participantId: string;
  bando: Bando;
}

/// Cada combatiente tira su propia iniciativa — se ordenan todos en una única cola, empate lo gana
/// mayor Destreza cruda, empate total lo gana quien apareciera antes en `combatientes` (orden
/// estable, nunca aleatorio de más). Enriquecida (2026-09-04, mismo criterio que `rollInitiative`
/// 1v1, combatExchange.ts): reusa `rollAttributeCheck` con `multiplicador=1` fijo (sin rueda de
/// tipos, no aplica a "quién reacciona primero") — malus por condición física SÍ entra en juego.
export function rollInitiativeMultiple(combatientes: CombatienteIniciativa[], random: () => number = Math.random): IniciativaEntry[] {
  const entries = combatientes.map((c) => {
    const participant: ExchangeParticipant = {
      attributes: { fuerza: 0, destreza: c.destreza, constitucion: 0, inteligencia: 0, voluntad: 0, carisma: 0, magia: 0 },
      attribute: 'destreza',
      difficulty: 0,
      condicionFisica: c.condicionFisica,
      attributeBonus: c.attributeBonus,
      rol: 'utilidad',
    };
    const side = rollAttributeCheck(participant, 1, random);
    return { participantId: c.participantId, bando: c.bando, destreza: c.destreza, ...side };
  });
  return entries
    .slice()
    .sort((a, b) => b.result - a.result || b.destreza - a.destreza)
    .map(({ destreza: _destreza, ...entry }) => entry);
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
  /// Solo `true` para el `CombatParticipant` real de `tipo: 'JUGADOR'` — ver `bandoSigueEnCombate`.
  /// `undefined`/`false` para cualquier otro (NPC, COMPANION, INVOCACION), incluidos NPCs marcados
  /// con `bando: 'JUGADOR'' (aliados de un encuentro NPC-vs-NPC, sin jugadora real de por medio).
  esJugadorReal?: boolean;
}

export function objetivosValidos(candidatos: ObjetivoCandidato[]): ObjetivoCandidato[] {
  return candidatos.filter((c) => c.condicionFisica !== 'CONVALECIENTE' && c.condicionFisica !== 'MUERTO');
}

/// Bug real jugando en vivo (2026-08-29, primer combate múltiple real): `objetivosValidos` se
/// reutilizaba también para decidir si el `CombatEncounter` entero había TERMINADO — Gorhorn
/// CONVALECIENTE hacía que `vivosJugador.length === 0`, cerrando el combate pese a que quedaban
/// enemigos ILESO reales sin resolver. `objetivosValidos` es correcta para su propósito original
/// (a quién puede atacar de nuevo un NPC — CONVALECIENTE/MUERTO no son objetivo válido, mismo
/// criterio que el resto del motor: solo esos dos estados son saqueables/rematables), pero "sigue
/// el bando en combate" es una pregunta distinta con una respuesta distinta para la JUGADORA REAL:
/// el motor 1v1 clásico ya deja explícito que CONVALECIENTE NO es fuera de combate para ella
/// ("puedes seguir intentándolo, muy penalizado" — CombatPanel.tsx) — solo deja de estar en juego
/// si de verdad muere (`justDied`/respawn, gestionado aparte). Cualquier otro participante (NPC,
/// COMPANION, un aliado NPC metido en el bando 'JUGADOR' de un encuentro NPC-vs-NPC) SÍ sale
/// realmente del combate al caer CONVALECIENTE (necesita Matar/Capturar/Clemente para resolverse) —
/// mismo criterio de `objetivosValidos`, sin cambiar. Deliberadamente NO se decide por `bando`
/// (`'JUGADOR'` puede estar lleno de NPC aliados sin jugadora real, ver tests de integración) —
/// se decide por `esJugadorReal`, el dato concreto del `CombatParticipant.tipo === 'JUGADOR'`.
export function bandoSigueEnCombate(candidatos: ObjetivoCandidato[]): boolean {
  const jugadoraReal = candidatos.find((c) => c.esJugadorReal);
  if (jugadoraReal && jugadoraReal.condicionFisica !== 'MUERTO') return true;
  return objetivosValidos(candidatos.filter((c) => !c.esJugadorReal)).length > 0;
}

/// Bug real jugando en vivo (2026-08-29, cuarta causa encadenada del mismo hallazgo): con la
/// JUGADORA REAL ya incluida como "viva" (`bandoSigueEnCombate`/el guard de `resolverTurnoJugador`,
/// ambos ya fijados), un NPC enemigo que solo tenía a ella como candidato seguía sin poder elegirla
/// como objetivo — `elegirObjetivo` usaba `objetivosValidos` a secas, que la excluye por estar
/// CONVALECIENTE. Resultado real observado: el NPC quedaba con `objetivoActualId: null` para
/// siempre (nadie "vivo" que atacar según ese criterio), el combate se congelaba sin resolver
/// nunca — ronda tras ronda de `resolverTurnoAutonomo` devolviendo `null`. Mismo criterio que el
/// resto de esta familia: la jugadora real SIGUE siendo un objetivo válido de ataque mientras no
/// esté MUERTA de verdad (coherente con el motor 1v1 — un enemigo puede seguir golpeando a un
/// jugador convaleciente hasta rematarlo); solo otros participantes (NPC, aliados) quedan
/// excluidos al caer CONVALECIENTE, mismo criterio estricto de siempre.
export function objetivosValidosParaAtacar(candidatos: ObjetivoCandidato[]): ObjetivoCandidato[] {
  return candidatos.filter((c) => c.condicionFisica !== 'MUERTO' && (c.esJugadorReal || c.condicionFisica !== 'CONVALECIENTE'));
}

/// Elige el objetivo de un ataque — `null` si no queda nadie vivo en el bando contrario (el
/// combate para ese bando ya terminó). Inteligencia alta prioriza rematar (mayor `ORDEN_CONDICION`,
/// más cerca de caer); empate entre igual de heridos se rompe por orden de aparición en
/// `candidatos`, nunca aleatorio de más — solo Inteligencia baja tira dado de verdad.
export function elegirObjetivo(inteligenciaAtacante: number, candidatos: ObjetivoCandidato[], random: () => number = Math.random): string | null {
  const vivos = objetivosValidosParaAtacar(candidatos);
  if (vivos.length === 0) return null;
  if (inteligenciaAtacante < INTELIGENCIA_TACTICA_UMBRAL) {
    return vivos[Math.floor(random() * vivos.length)].participantId;
  }
  const masHerido = vivos.reduce((peor, actual) =>
    ORDEN_CONDICION.indexOf(actual.condicionFisica) > ORDEN_CONDICION.indexOf(peor.condicionFisica) ? actual : peor,
  );
  return masHerido.participantId;
}

/// Fase 3 § 3b de efectos de clase (2026-08-27, docs/21-roadmap.md) — objetivo adicional para
/// `MULTIPLE` (el mismo golpe alcanza a un segundo combatiente) y `DESVIAR`/`INVOCACION` más
/// adelante: uno aleatorio entre los vivos de `candidatos`, excluyendo al objetivo principal —
/// nunca prioriza por Inteligencia (a diferencia de `elegirObjetivo`), las filas reales de
/// `clases.md` que usan `MULTIPLE` siempre lo describen como "aleatorio", nunca "el más débil". El
/// caller ya filtra `candidatos` al bando correcto (esta función no conoce bandos).
export function objetivoExtraFor(excluirParticipantId: string, candidatos: ObjetivoCandidato[], random: () => number = Math.random): string | null {
  const vivos = objetivosValidos(candidatos).filter((c) => c.participantId !== excluirParticipantId);
  if (vivos.length === 0) return null;
  return vivos[Math.floor(random() * vivos.length)].participantId;
}

/// Identificador de combatientes duplicados (2026-08-27, bug real jugando: "ataqué a los dos
/// buitres a la vez" — no podía dirigir el golpe al segundo, dos `CombatParticipant` del mismo
/// `npcId` comparten nombre y el matching por texto siempre resolvía al primero del array). Calcula
/// "combatiente #1/#2..." SOLO para quien tenga algún otro participante con el mismo `npcId` en la
/// lista — un enemigo solitario no se numera (mismo criterio en frontend, `NpcInSceneInfo.
/// instanceNumber`). Orden ESTABLE por `participantId` (nunca por orden de llegada de una query,
/// que puede variar entre llamadas) — así "buitre #2" significa lo mismo tanto para el backend (al
/// interpretar el texto citado) como para el frontend (al mostrar el numerito), sin depender de que
/// ambos iteren en el mismo orden por casualidad.
export function instanceNumbersByParticipantId(combatientes: { participantId: string; npcId: string }[]): Map<string, number> {
  const countByNpcId = new Map<string, number>();
  for (const c of combatientes) countByNpcId.set(c.npcId, (countByNpcId.get(c.npcId) ?? 0) + 1);
  const ordenEstable = [...combatientes].sort((a, b) => a.participantId.localeCompare(b.participantId));
  const seenByNpcId = new Map<string, number>();
  const resultado = new Map<string, number>();
  for (const c of ordenEstable) {
    if ((countByNpcId.get(c.npcId) ?? 0) <= 1) continue;
    const numero = (seenByNpcId.get(c.npcId) ?? 0) + 1;
    seenByNpcId.set(c.npcId, numero);
    resultado.set(c.participantId, numero);
  }
  return resultado;
}

export interface CandidatoObjetivoPorTexto {
  participantId: string;
  npcId: string | null;
  vivo: boolean;
}

/// Extraído de `turnResolution.ts` (2026-08-27, "buitre #2" — mismo bug de identificador de
/// combatientes duplicados) para poder probarlo aislado del resto del turno (clasificador LLM real,
/// `explicitTarget`/`npcsInScene` del sistema viejo, etc. — toda esa superficie era ruido genuino
/// para un test de integración de ESTE matching concreto, ver memoria de sesión). Nombre citado
/// entre comillas contra los enemigos VIVOS, aceptando tanto el nombre base como "Nombre #N" cuando
/// hace falta desambiguar (mismo criterio de `instanceNumbersByParticipantId`, calculado aquí sobre
/// TODOS los candidatos recibidos, no solo los vivos, para que "buitre #2" no cambie de significado
/// solo porque otro miembro del grupo ya cayó). Sin cita real o sin match, cae al primer vivo (nunca
/// se queda sin elegir) — `null` si no queda ninguno.
export function resolverObjetivoPorTexto(action: string, candidatos: CandidatoObjetivoPorTexto[], nombreByNpcId: Map<string, string>, normalizeText: (s: string) => string): string | null {
  const vivos = candidatos.filter((c) => c.vivo);
  const instanceNumberByParticipantId = instanceNumbersByParticipantId(
    candidatos.filter((c): c is CandidatoObjetivoPorTexto & { npcId: string } => !!c.npcId).map((c) => ({ participantId: c.participantId, npcId: c.npcId })),
  );
  const quotedMatch = action.match(/'([^']+)'/);
  const quotedNormalizado = quotedMatch ? normalizeText(quotedMatch[1]) : null;
  const targetPorNombre = quotedNormalizado
    ? vivos.find((c) => {
        if (!c.npcId) return false;
        const nombreBase = normalizeText(nombreByNpcId.get(c.npcId) ?? '');
        if (nombreBase === quotedNormalizado) return true;
        const numero = instanceNumberByParticipantId.get(c.participantId);
        return numero != null && normalizeText(`${nombreBase} #${numero}`) === quotedNormalizado;
      })
    : undefined;
  return targetPorNombre?.participantId ?? vivos[0]?.participantId ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 2b — Objetivo individual real: "enganche" por ronda (2026-08-26, diseño cerrado con la
// usuaria jugando en vivo contra 2 cuervos — "no puedo elegir objetivo... cuando ataco debería
// ser yo vs mi objetivo y el otro enemigo tiene ataque gratis"). Sustituye `retargetBando` para
// el modelo de ronda real: ahí CADA atacante vivo siempre recibía un objetivo válido y CADA
// intercambio era una defensa real por igual — nunca existía "el otro me pega gratis porque no
// era mi objetivo". Aquí, en cambio:
//
//   1. Se procesa `ordenIniciativa` UNA vez, de principio a fin (la cola ya calculada por
//      `rollInitiativeMultiple`, nunca se re-tira).
//   2. Quien TODAVÍA no sea objetivo de nadie, al llegarle su turno, ELIGE a quién atacar
//      (`elegirObjetivoPara`, inyectado por el caller: IA de siempre para NPC/COMPANION vía
//      `elegirObjetivo`, elección explícita para la jugadora). El PRIMER reclamo sobre un
//      objetivo dado gana — un segundo/tercer atacante que también lo elija no le "roba" el
//      duelo al primero, se queda con un golpe gratis contra ese mismo objetivo (ver más abajo).
//   3. Quien YA es objetivo de alguien cuando le toca actuar NO elige — su turno pasa a ser
//      defender/duelar contra quien lo reclamó (regla 2 de la usuaria: "si te han elegido ya
//      como objetivo... no puedes elegir objetivo").
//   4. Si ese quien-ya-eligió-antes es reclamado DESPUÉS por otro (X eligió Y, luego Z eligió X)
//      su elección anterior se cancela — "el ataque de X ya no puede ir contra Y" — X pasa a
//      duelar contra Z. Y, que ya se había resignado a defender de X, se queda sin nadie
//      atacándolo esta ronda (perdió su propio turno de elegir cuando fue reclamado, y no
//      recupera una segunda oportunidad solo porque su reclamante cambió de objetivo).
//
// El resultado tiene la MISMA forma que `objetivoActualId`/`retargetBando` (mapa participante →
// objetivo o null) — el caller decide si un objetivo concreto es un DUELO real o un GOLPE
// GRATIS comparando ambos lados: si `resultado.get(A) === B` Y `resultado.get(B) === A`, es un
// duelo mutuo (dentro de él, golpea primero quien tenga más iniciativa — ver posición en
// `ordenIniciativa`, no hace falta guardar nada más). Cualquier otro caso donde A SÍ tiene
// objetivo pero ese objetivo no le devuelve la mirada es un golpe gratis, sin oposición real
// (`AGUANTE`+`MULTIPLE` es la única forma de defenderse de verdad de uno de estos, ver
// combateMultipleOrquestacion.ts).
//
// Cadena de cancelaciones (2026-08-26, cazado depurando la integración real con más de 2
// candidatos empatados): la regla 4 no se limita a un solo nivel — si A reclama a B, y luego C
// reclama a A (cancelando el ataque de A contra B, B se queda sin nadie), pero DESPUÉS D reclama a
// C (cancelando a su vez el ataque de C contra A) — tanto B como A se quedan sin nadie
// atacándoles esta ronda (cada uno perdió su propio turno de elegir en el momento exacto en que
// fue reclamado, y ninguno recupera una segunda oportunidad solo porque su reclamante cambió de
// objetivo más tarde) — solo la pareja final (C↔D) llega a duelo real. Consecuencia directa de
// aplicar la regla 4 con generalidad, no un caso especial nuevo — verificado con test dedicado.
export function resolverEnganchesRonda(
  ordenIniciativa: string[],
  combatientes: { participantId: string; bando: Bando }[],
  elegirObjetivoPara: (participantId: string, candidatos: string[]) => string | null,
  /// OCULTACION (Fase 3 § 3c) + EXPULSAR (Fase 3 § 3e, 2026-08-27) — combatientes excluidos de ser
  /// ELEGIDOS como objetivo (siguen pudiendo elegir el suyo propio con normalidad) salvo que sean
  /// el único vivo de su bando (regla explícita de Camuflaje: "si no es el único enemigo/aliado" —
  /// EXPULSAR reutiliza la misma excepción, "vuelve antes de las 2 rondas si su bando se queda sin
  /// nadie más") — calculado por bando, nunca globalmente. El caller pasa la UNIÓN de ambos sets
  /// (`ocultoPorRondas`/`expulsadoPorRondas`), la exclusión en sí no distingue el motivo.
  ocultos: Set<string> = new Set(),
): Map<string, string | null> {
  const bandoDe = new Map(combatientes.map((c) => [c.participantId, c.bando]));
  // target → primer atacante que lo reclamó — first-come, nunca se sobreescribe con un reclamo
  // nuevo (eso es justo lo que produce el golpe gratis del segundo/tercer pretendiente).
  const reclamadoPor = new Map<string, string>();
  // atacante → objetivo elegido — provisional: se borra en la limpieza si el propio atacante
  // acaba reclamado por alguien más tarde en la misma pasada.
  const objetivoProvisional = new Map<string, string>();

  for (const id of ordenIniciativa) {
    if (!bandoDe.has(id)) continue; // participante fuera de este encuentro (no debería pasar)
    if (reclamadoPor.has(id)) continue; // ya reclamado por alguien antes — no elige (regla 3)

    const bando = bandoDe.get(id)!;
    const candidatosCrudos = combatientes.filter((c) => c.bando !== bando);
    const candidatosVisibles = candidatosCrudos.filter((c) => !ocultos.has(c.participantId));
    const candidatos = (candidatosVisibles.length > 0 ? candidatosVisibles : candidatosCrudos).map((c) => c.participantId);
    const elegido = elegirObjetivoPara(id, candidatos);
    if (elegido === null) continue; // sin nadie a quien atacar (bando contrario agotado)

    objetivoProvisional.set(id, elegido);
    if (!reclamadoPor.has(elegido)) reclamadoPor.set(elegido, id);
  }

  // Limpieza (regla 4): un atacante con elección propia que ADEMÁS acabó reclamado por otro
  // pierde esa elección — su objetivo original queda libre otra vez (aunque ya nadie más vaya a
  // reclamarlo esta ronda, ver comentario de cabecera).
  for (const [atacante, objetivoElegido] of objetivoProvisional) {
    if (!reclamadoPor.has(atacante)) continue;
    objetivoProvisional.delete(atacante);
    if (reclamadoPor.get(objetivoElegido) === atacante) reclamadoPor.delete(objetivoElegido);
  }

  const resultado = new Map<string, string | null>();
  for (const id of ordenIniciativa) {
    if (!bandoDe.has(id)) continue; // mismo filtro que la fase de elección, ver comentario de arriba
    if (reclamadoPor.has(id)) resultado.set(id, reclamadoPor.get(id)!);
    else if (objetivoProvisional.has(id)) resultado.set(id, objetivoProvisional.get(id)!);
    else resultado.set(id, null);
  }
  return resultado;
}

/// ¿Es esto un duelo real (mutuo) o un golpe gratis? Ver comentario de cabecera de
/// `resolverEnganchesRonda` — un duelo es simétrico (A→B y B→A), cualquier otra cosa donde A sí
/// tiene objetivo es golpe gratis sin oposición real.
export function esDueloMutuo(enganches: Map<string, string | null>, a: string, b: string): boolean {
  return enganches.get(a) === b && enganches.get(b) === a;
}

/// Dentro de un duelo mutuo, quien tenga más iniciativa golpea primero — mismo criterio que la
/// propia cola `ordenIniciativa` ya establece (posición más temprana = más iniciativa), sin
/// necesidad de comparar ningún número aparte.
export function golpeaPrimeroEnDuelo(ordenIniciativa: string[], a: string, b: string): string {
  return ordenIniciativa.indexOf(a) <= ordenIniciativa.indexOf(b) ? a : b;
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
  /// Fase 3 § 3a de efectos de clase (2026-08-27, docs/21-roadmap.md) — mismos campos que
  /// `SavedAction.durationEffectMagnitude/Turns`, poblados para la habilidad de ATAQUE que la
  /// JUGADORA elige explícitamente (turnResolution.ts, construcción de `jugadorHabilidad`) Y
  /// (2026-09-09, cierre del hueco de motor "ningún atacante autónomo podía generar AUMENTO/
  /// DEBILIDAD" — ver cabecera de `NpcCombatAbility` en npcCombatAbilities.ts) para cualquier NPC
  /// rival o Companion auto-elegido — `atacanteHabilidad` llega poblada en ambos casos, sin
  /// distinguir el tipo de combatiente en esta función (ver `escribirCondicionYEnergia`,
  /// combateMultipleOrquestacion.ts, que tampoco distingue al escribir `activeEffects`).
  durationEffectMagnitude?: number | null;
  durationEffectTurns?: number | null;
  /// A quién recae `nuevoEfectoAtacante` (2026-09-09, `SavedAction.durationEffectTarget`) —
  /// undefined/'self'/null = comportamiento de siempre (quien usó la habilidad); 'companion' =
  /// el caller (combateMultipleOrquestacion.ts § `ejecutarIntercambioYAvanzar`) redirige el
  /// efecto al Companion del bando del atacante en vez de al propio atacante. Esta función
  /// (`resolverIntercambioCompleto`) NO lee este campo — solo lo transporta, la redirección vive
  /// en el caller porque es el único que conoce al resto de participantes del encuentro.
  durationEffectTarget?: 'self' | 'companion' | null;
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
  /// Fase 3 § 3a de efectos de clase (2026-08-27, docs/21-roadmap.md) — margen decisivo del camino
  /// NO independiente (`golpe_pleno`, `resolveExchange`), el mismo umbral que ya usan CONTRA/
  /// REFRACTAR/LETAL. Único gate real para empujar AUMENTO/DEBILIDAD (ver Fase 2, turnResolution.ts
  /// § resolveCombatExchangePhase) — siempre `false` en el camino independiente (cada lado se juzga
  /// contra su propia dificultad, no hay "margen" entre dos totales; mismo alcance que Fase 2, que
  /// tampoco enganchó ese camino).
  margenDecisivo: boolean;
  /// CONTROL real (Fase 3 § 3a) — la utilidad del atacante/defensor disparó CONTROL con éxito (solo
  /// posible en el camino independiente, `rol: 'utilidad'`) — el caller debe marcar al OTRO lado
  /// (quien no disparó) como controlado N rondas, nunca a quien la usó (mismo sentido que la ficha
  /// de cada habilidad: "tomas el control DEL RIVAL").
  atacanteControlDisparado: boolean;
  defensorControlDisparado: boolean;
  /// AUMENTO/DEBILIDAD real (Fase 3 § 3a) — `ActiveEffect` listo para empujar (`pushActiveEffect`,
  /// activeEffects.ts) sobre quien corresponda. `null` si esta habilidad no lleva duración, o el
  /// golpe no fue decisivo. `nuevoEfectoAtacante` = AUMENTO sobre quien atacó, `nuevoEfectoDefensor`
  /// = DEBILIDAD sobre quien lo recibió — nunca los dos a la vez (una habilidad real de
  /// `clases.md` no combina ambos efectos hoy).
  nuevoEfectoAtacante: ActiveEffect | null;
  nuevoEfectoDefensor: ActiveEffect | null;
  /// `MULTIPLE` real (Fase 3 § 3b, 2026-08-27) — mismo gate que AUMENTO/DEBILIDAD (margen decisivo,
  /// nunca el camino independiente) + el golpe base debe haber conectado de verdad. Solo cubre la
  /// combinación `ATAQUE`+`MULTIPLE` (un enemigo extra) — `AUMENTO`/`AGUANTE`+`MULTIPLE` (buff a
  /// aliados) queda sin construir a propósito: depende de que AUMENTO funcione en el camino de
  /// utilidad, que Fase 2/3a nunca engancharon (ver comentario de `margenDecisivo`). El caller
  /// (combateMultipleOrquestacion.ts) es quien conoce al resto de combatientes — resuelve el golpe
  /// al objetivo extra con `objetivoExtraFor` + el mismo mecanismo directo que un golpe gratis.
  multipleTriggered: boolean;
  /// `DESVIAR` real (Fase 3 § 3c, 2026-08-27) — la defensora ganó por margen decisivo con una
  /// habilidad `DESVIAR`: el golpe entrante se redirige a un tercero del bando del atacante en vez
  /// de simplemente fallar. Solo 1 fila real hoy (Comunión Salvaje), sin cifra propia de duración
  /// para su `DEBILIDAD` combinada (la ficha nunca la describe) — esa parte se queda sin construir,
  /// documentado, no un descuido.
  desviarTriggered: boolean;
  /// `OCULTACION` real (Fase 3 § 3c) — la utilidad que la dispara oculta A QUIEN LA USÓ (nunca al
  /// rival, a diferencia de CONTROL) — el caller marca `ocultoPorRondas` sobre ese mismo lado.
  atacanteOcultacionDisparada: boolean;
  defensorOcultacionDisparada: boolean;
  /// `EXPULSAR` real (Fase 3 § 3e, 2026-08-27) — mismo gate que MULTIPLE/DESVIAR (margen decisivo,
  /// camino no-independiente, el golpe base debe haber conectado) + la habilidad de ataque lleva
  /// `ATAQUE`+`EXPULSAR`. Solo 1 fila real (Embate de Escudo) — simplificación consciente frente a
  /// la ficha (2 tramos por margen, 50% de volver, "no vuelve nunca" en el tramo alto): un único
  /// margen decisivo dispara siempre "expulsa 2 rondas", sin tirada de 50% ni caso "nunca vuelve"
  /// por separado (decisión explícita de la usuaria). El caller marca `expulsadoPorRondas` sobre EL
  /// DEFENSOR (a quien golpea Embate de Escudo), nunca sobre el atacante.
  expulsarTriggered: boolean;
  /// Desglose real de dados para el frontend (2026-09-04, auditoría "buscar tiradas de dados sin
  /// representar" — hallazgo real: `resolverIntercambioCompleto` SIEMPRE tira con la misma
  /// mecánica que el 1v1 clásico (`resolveExchange`/`resolveIndependentExchange`, mismo `rollD20`),
  /// pero hasta ahora solo se usaba el resultado para construir `exchangeBlock` (texto para el
  /// Narrador) — el objeto estructurado con los números reales (roll, atributo, dificultad, margen)
  /// se descartaba entero. Mismo shape `CombatExchangeDisplay` que ya usa `turnResolution.ts` para
  /// el 1v1 (`DiceRollReveal`/`CombatExchangeBadge` en el frontend ya saben pintarlo) — el caller
  /// (`combateMultipleOrquestacion.ts`) solo tiene que decidir `atacanteEsJugador` según a quién
  /// corresponda el rol "atacante" en esta llamada concreta, igual que ya hace turnResolution.ts.
  display: CombatExchangeDisplay;
}

/// `INVOCACION` real (Fase 3 § 3d, 2026-08-27) — a diferencia del resto de efectos de
/// `ResultadoIntercambioCompleto`, INVOCACION nunca pasa por `resolverIntercambioCompleto`: el
/// caller (combateMultipleOrquestacion.ts) la intercepta ANTES, mirando directamente
/// `habilidad.effects.includes('INVOCACION')` — invocar consume el turno entero, sin intercambio
/// real ese turno (ver comentario largo en `resolverTurnoJugador`/`resolverTurnoAutonomo`).

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
  /// Necesario solo para `ResultadoIntercambioCompleto.display` (2026-09-04, ver su comentario) —
  /// `CombatienteParaIntercambio` no lleva ningún flag de "es jugador", así que es el caller
  /// (combateMultipleOrquestacion.ts, que sí conoce qué CombatParticipant es tipo JUGADOR) quien
  /// decide esto, igual que ya hace turnResolution.ts para el 1v1.
  atacanteEsJugador: boolean = false,
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
  let atacanteControlDisparado = false;
  let defensorControlDisparado = false;
  let margenDecisivo = false;
  let desviarTriggered = false;
  let atacanteOcultacionDisparada = false;
  let defensorOcultacionDisparada = false;
  let display: CombatExchangeDisplay;

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
        // CONTROL real (Fase 3 § 3a, 2026-08-27) — el atacante "toma el control del rival": es el
        // DEFENSOR quien queda controlado, nunca quien usó la habilidad.
        if (atacanteHabilidad.effects.includes('CONTROL')) atacanteControlDisparado = true;
        // OCULTACION real (Fase 3 § 3c, 2026-08-27) — a diferencia de CONTROL, quien la dispara se
        // oculta A SÍ MISMO (Camuflaje: "te oculta... del agro"), nunca al rival.
        if (atacanteHabilidad.effects.includes('OCULTACION')) atacanteOcultacionDisparada = true;
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
        if (defensorHabilidad.effects.includes('CONTROL')) defensorControlDisparado = true;
        if (defensorHabilidad.effects.includes('OCULTACION')) defensorOcultacionDisparada = true;
      }
    }
    exchangeBlock = independentExchangeContextBlock(independent, atacante.nombre, defensor.nombre);
    display = { atacanteEsJugador, atacante: independent.atacante, defensor: independent.defensor, resultado: 'independiente', margen: 0 };
  } else {
    const exchange = resolveExchange(atacanteExch, defensorExch);
    const defensorPuedeContragolpear = defensorHabilidad.effects.includes('ATAQUE');
    const defensorContragolpeaAplica = exchange.resultado === 'defensor_contragolpea' && defensorPuedeContragolpear;
    defensorRecibeGolpe = exchange.resultado === 'golpe_pleno' || exchange.resultado === 'golpe_normal';
    if (defensorRecibeGolpe) nuevaCondicionDefensor = nextCondicionForAttack(atacanteHabilidad.effects, defensor.condicionFisica);
    atacanteRecibeGolpe = defensorContragolpeaAplica;
    if (atacanteRecibeGolpe) nuevaCondicionAtacante = nextCondicionForAttack(defensorHabilidad.effects, atacante.condicionFisica);
    exchangeBlock = exchangeContextBlock(exchange, atacante.nombre, defensor.nombre, defensorPuedeContragolpear);
    margenDecisivo = exchange.resultado === 'golpe_pleno';
    // DESVIAR real (Fase 3 § 3c, 2026-08-27) — la defensora gana por margen decisivo (mismo umbral
    // que CONTRA/REFRACTAR, `defensor_contragolpea`) Y su habilidad de defensa lleva DESVIAR: el
    // golpe entrante (que de todos modos ya iba a fallar, `defensorRecibeGolpe` es `false` en este
    // desenlace) se redirige a un tercero en vez de simplemente fallar — el caller (que sí conoce
    // al resto de combatientes) resuelve el golpe redirigido con las propias `atacanteHabilidad`.
    desviarTriggered = exchange.resultado === 'defensor_contragolpea' && defensorHabilidad.effects.includes('DESVIAR');
    display = { atacanteEsJugador, atacante: exchange.atacante, defensor: exchange.defensor, resultado: exchange.resultado, margen: exchange.margen };
  }

  // AUMENTO/DEBILIDAD real (Fase 3 § 3a, 2026-08-27) — mismo gate que Fase 2 (margen decisivo,
  // ver comentario de `margenDecisivo` arriba): solo se construye el `ActiveEffect` si la propia
  // habilidad de ataque trae ambos campos de duración poblados (ver comentario de
  // `HabilidadParaIntercambio.durationEffectMagnitude/Turns`).
  let nuevoEfectoAtacante: ActiveEffect | null = null;
  let nuevoEfectoDefensor: ActiveEffect | null = null;
  if (margenDecisivo && atacanteHabilidad.durationEffectMagnitude != null && atacanteHabilidad.durationEffectTurns != null) {
    const efecto: ActiveEffect = {
      attribute: atacanteHabilidad.attribute,
      magnitude: atacanteHabilidad.durationEffectMagnitude,
      turnsRemaining: atacanteHabilidad.durationEffectTurns,
      sourceAbility: atacanteHabilidad.name,
    };
    if (atacanteHabilidad.effects.includes('AUMENTO')) nuevoEfectoAtacante = efecto;
    if (atacanteHabilidad.effects.includes('DEBILIDAD')) nuevoEfectoDefensor = efecto;
  }

  // MULTIPLE real (Fase 3 § 3b, 2026-08-27) — mismo gate, ver comentario de la interfaz.
  const multipleTriggered = margenDecisivo && defensorRecibeGolpe && atacanteHabilidad.effects.includes('ATAQUE') && atacanteHabilidad.effects.includes('MULTIPLE');

  // EXPULSAR real (Fase 3 § 3e, 2026-08-27) — mismo gate que MULTIPLE, ver comentario de la interfaz.
  const expulsarTriggered = margenDecisivo && defensorRecibeGolpe && atacanteHabilidad.effects.includes('ATAQUE') && atacanteHabilidad.effects.includes('EXPULSAR');

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
    margenDecisivo,
    atacanteControlDisparado,
    defensorControlDisparado,
    nuevoEfectoAtacante,
    nuevoEfectoDefensor,
    multipleTriggered,
    desviarTriggered,
    atacanteOcultacionDisparada,
    defensorOcultacionDisparada,
    expulsarTriggered,
    display,
  };
}
