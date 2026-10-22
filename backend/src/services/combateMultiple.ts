import type { AbilityEffect, CondicionFisica } from '@prisma/client';
import type { Attribute, AttributeBlock } from './dice.js';
import {
  conGolpeDeGracia,
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

/// Grupo 3 § Combate múltiple (2026-08-25, diseño completo en docs/rpgtarkor/sistemas-combate/combate-multiple.md)
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

/// CR-45 (hito 0.2, Fase G): desde aquí un NPC es capitán — manda a los de su bando con menos
/// Inteligencia y concentra con ellos los ataques en un mismo objetivo.
export const INTELIGENCIA_CAPITAN = 20;

/// CR-45: el capitán de un bando — el de más Inteligencia, si llega a `INTELIGENCIA_CAPITAN`. Una sola
/// regla para la apertura, cada ronda y la moral (`moralGrupo.ts`).
export function elegirCapitan<T>(candidatos: T[], inteligenciaDe: (c: T) => number): T | null {
  return [...candidatos].filter((c) => inteligenciaDe(c) >= INTELIGENCIA_CAPITAN).sort((a, b) => inteligenciaDe(b) - inteligenciaDe(a))[0] ?? null;
}

/// CR-45: el objetivo que el capitán señala a los suyos — el más vulnerable (peor condición y, a
/// igualdad, menos Constitución). Entre empatados elige al azar, para que no sea siempre el mismo
/// (en Baldur's Gate 3, que la IA vaya siempre a por el más débil es de lo que más se quejan).
export function objetivoConcentrado(candidatos: (ObjetivoCandidato & { constitucion: number })[], random: () => number = Math.random): string | null {
  const validos = new Set(objetivosValidosParaAtacar(candidatos).map((c) => c.participantId));
  const vivos = candidatos.filter((c) => validos.has(c.participantId));
  if (vivos.length === 0) return null;
  const puntos = (c: (typeof vivos)[number]) => ORDEN_CONDICION.indexOf(c.condicionFisica) * 100 - c.constitucion;
  const mejor = Math.max(...vivos.map(puntos));
  const empatados = vivos.filter((c) => puntos(c) === mejor);
  return empatados[Math.floor(random() * empatados.length)]!.participantId;
}

/// Fase 3 § 3b de efectos de clase (2026-08-27, docs/producto/21-roadmap.md) — objetivo adicional para
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

/// `AREA` real, variante ofensiva (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Opresor 32/36/40) —
/// generalización de `objetivoExtraFor` a un número CUALQUIERA de objetivos extra, en vez de
/// exactamente uno. `limite: null` = "a todos" (sin tope, cifra real de las fichas de Opresor —
/// "inmoviliza/resta a TODOS los rivales"); `limite: N` = objetivo principal + (N-1) aleatorios sin
/// repetir, mismo mecanismo que `objetivoExtraFor` pero con más de un extra (ninguna ficha real de
/// `clases.md` usa hoy un límite numérico >1 para AREA — el propio MULTIPLE ya cubre el caso N=2 —
/// pero se deja el parámetro genérico en vez de asumir "siempre todos"). Nunca prioriza por
/// Inteligencia, mismo criterio que `objetivoExtraFor`.
export function objetivosExtraFor(excluirParticipantId: string, candidatos: ObjetivoCandidato[], limite: number | null, random: () => number = Math.random): string[] {
  const vivos = objetivosValidos(candidatos).filter((c) => c.participantId !== excluirParticipantId);
  if (vivos.length === 0) return [];
  if (limite === null || limite >= vivos.length) return vivos.map((c) => c.participantId);
  // Barajado parcial (Fisher-Yates truncado) — mismo determinismo por `random` inyectable que el
  // resto del motor, sin sesgar hacia el principio del array de candidatos.
  const restantes = [...vivos];
  const elegidos: string[] = [];
  for (let i = 0; i < limite && restantes.length > 0; i++) {
    const idx = Math.floor(random() * restantes.length);
    elegidos.push(restantes[idx].participantId);
    restantes.splice(idx, 1);
  }
  return elegidos;
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
  /// `PROVOCACION` real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Guardián 16/19 y variantes) —
  /// provocado → provocador. Mecanismo INVERSO a `ocultos`: en vez de excluir a alguien de ser
  /// ELEGIDO, fuerza que un combatiente concreto ELIJA a un objetivo concreto, saltándose por
  /// completo su `elegirObjetivoPara` normal (IA de Inteligencia, o la elección libre de la
  /// jugadora) — mismo criterio que un jugador citando un nombre entre comillas, pero impuesto por
  /// el motor, no por texto libre. Solo aplica si el provocado TODAVÍA no fue reclamado por otro al
  /// llegarle su turno (regla 3 del enganche sigue mandando: "si ya te han elegido, no eliges tú")
  /// — la provocación no puede resucitar una elección que la ronda ya le quitó.
  provocaciones: Map<string, string> = new Map(),
  /// `MARCAR` real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Domador 24, Concentración del Domador) —
  /// combatiente forzado (siempre un COMPANION) → objetivo marcado por su jugador. Mecanismo
  /// INVERSO a `provocaciones` en quién decide (aquí el JUGADOR fuerza a SU COMPANION, allí el
  /// motor fuerza al RIVAL), pero el mismo mecanismo de "salta la IA normal" en la resolución de
  /// enganches. Si un combatiente tiene AMBOS (imposible hoy en la práctica — `provocaciones` solo
  /// se dispara sobre quien SUFRE la provocación, `marcas` solo sobre un COMPANION propio — pero se
  /// deja la prioridad explícita por si algún día coinciden), `provocaciones` gana: ser provocado es
  /// una pérdida de control más fuerte que la propia orden de marcar, mismo criterio que "si ya te
  /// han elegido, no eliges tú" de la regla 3 ya existente.
  marcas: Map<string, string> = new Map(),
  /// CR-45 (P292, 2026-10-21): la orden del capitán. Sus `seguidores` van a por `objetivoId` aunque
  /// otro los haya elegido antes o después (se saltan las reglas 3 y 4): quien los eligió les pega sin
  /// duelo y el señalado se defiende del primero que llega. Antes, la jugadora atacando al capitán y
  /// los compañeros eligiendo a los demás deshacían la orden y los golpes acababan en la jugadora.
  /// Una provocación sigue mandando sobre la orden, y un señalado oculto no es candidato.
  ordenCapitan: { seguidores: Set<string>; objetivoId: string } | null = null,
): Map<string, string | null> {
  const bandoDe = new Map(combatientes.map((c) => [c.participantId, c.bando]));
  // Seguidores del capitán que esta ronda cumplen la orden (ni la regla 3 ni la 4 se la quitan).
  const cumplenOrden = new Set<string>();
  // target → primer atacante que lo reclamó — first-come, nunca se sobreescribe con un reclamo
  // nuevo (eso es justo lo que produce el golpe gratis del segundo/tercer pretendiente).
  const reclamadoPor = new Map<string, string>();
  // atacante → objetivo elegido — provisional: se borra en la limpieza si el propio atacante
  // acaba reclamado por alguien más tarde en la misma pasada.
  const objetivoProvisional = new Map<string, string>();

  for (const id of ordenIniciativa) {
    if (!bandoDe.has(id)) continue; // participante fuera de este encuentro (no debería pasar)

    const bando = bandoDe.get(id)!;
    const candidatosCrudos = combatientes.filter((c) => c.bando !== bando);
    const candidatosVisibles = candidatosCrudos.filter((c) => !ocultos.has(c.participantId));
    const candidatos = (candidatosVisibles.length > 0 ? candidatosVisibles : candidatosCrudos).map((c) => c.participantId);
    // Provocado con provocador todavía vivo/candidato real este turno → salta la IA normal.
    const provocadorId = provocaciones.get(id);
    const provocado = !!provocadorId && candidatos.includes(provocadorId);
    if (ordenCapitan && !provocado && ordenCapitan.seguidores.has(id) && candidatos.includes(ordenCapitan.objetivoId)) {
      cumplenOrden.add(id);
      objetivoProvisional.set(id, ordenCapitan.objetivoId);
      if (!reclamadoPor.has(ordenCapitan.objetivoId)) reclamadoPor.set(ordenCapitan.objetivoId, id);
      continue;
    }
    if (reclamadoPor.has(id)) continue; // ya reclamado por alguien antes — no elige (regla 3)
    // MARCAR: sin provocación activa, un COMPANION con marca viva y objetivo todavía candidato
    // ataca preferentemente a ese objetivo en vez de su IA de Inteligencia normal.
    const marcaId = marcas.get(id);
    const elegido =
      provocadorId && candidatos.includes(provocadorId)
        ? provocadorId
        : marcaId && candidatos.includes(marcaId)
          ? marcaId
          : elegirObjetivoPara(id, candidatos);
    if (elegido === null) continue; // sin nadie a quien atacar (bando contrario agotado)

    objetivoProvisional.set(id, elegido);
    if (!reclamadoPor.has(elegido)) reclamadoPor.set(elegido, id);
  }

  // Limpieza (regla 4): un atacante con elección propia que ADEMÁS acabó reclamado por otro
  // pierde esa elección — su objetivo original queda libre otra vez (aunque ya nadie más vaya a
  // reclamarlo esta ronda, ver comentario de cabecera).
  for (const [atacante, objetivoElegido] of objetivoProvisional) {
    if (!reclamadoPor.has(atacante) || cumplenOrden.has(atacante)) continue;
    objetivoProvisional.delete(atacante);
    if (reclamadoPor.get(objetivoElegido) === atacante) reclamadoPor.delete(objetivoElegido);
  }

  const resultado = new Map<string, string | null>();
  for (const id of ordenIniciativa) {
    if (!bandoDe.has(id)) continue; // mismo filtro que la fase de elección, ver comentario de arriba
    if (cumplenOrden.has(id)) resultado.set(id, objetivoProvisional.get(id)!);
    else if (reclamadoPor.has(id)) resultado.set(id, reclamadoPor.get(id)!);
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
  /// Fase 3 § 3a de efectos de clase (2026-08-27, docs/producto/21-roadmap.md) — mismos campos que
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
  /// efecto al Companion del bando del atacante en vez de al propio atacante; 'both' (2026-09-14,
  /// Domador 32, Grito Animal: "aumenta... del compañero y a ti mismo") = el efecto se aplica a
  /// AMBOS a la vez con la misma tirada, no excluye al atacante como sí hace 'companion'. Esta
  /// función (`resolverIntercambioCompleto`) NO lee este campo — solo lo transporta, la
  /// redirección/duplicación vive en el caller porque es el único que conoce al resto de
  /// participantes del encuentro.
  durationEffectTarget?: 'self' | 'companion' | 'both' | null;
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
  /// Fase 3 § 3a de efectos de clase (2026-08-27, docs/producto/21-roadmap.md) — margen decisivo del camino
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
  /// `PROVOCACION` real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Guardián 16/19, Lancero 32,
  /// Especialista 28, Caballero del Valor 12) — dos caminos posibles, igual que CONTROL/OCULTACION:
  /// (a) `PROVOCACION` sola o combinada solo con otro efecto de utilidad (Desafío/Grito de
  /// Valentía) dispara por el camino independiente (`utilityTriggered`, mismo gate que OCULTACION);
  /// (b) `AGUANTE`+`PROVOCACION` (Bastión Personal, Guardia de Asta, Postura Firme) dispara por
  /// margen decisivo, mismo gate que EXPULSAR/DESVIAR. Quien la dispara provoca SIEMPRE al RIVAL de
  /// ESTE intercambio (nunca a sí mismo) — el caller marca `provocadoPorRondas`/`provocadoPorId`
  /// sobre ese rival. La variante "redirige el golpe dirigido a un aliado" (Caballero del Valor 28)
  /// no vive aquí — no es un efecto de UN intercambio 1-a-1, es una sustitución del enganche de
  /// TODA la ronda que solo el orquestador puede resolver (ver combateMultipleOrquestacion.ts).
  atacanteProvocacionDisparada: boolean;
  defensorProvocacionDisparada: boolean;
  /// `MARCAR` real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Domador 24, Concentración del Domador)
  /// — camino independiente/utilidad, mismo gate que PROVOCACION/OCULTACION. A diferencia de esos
  /// dos (que actúan sobre el RIVAL de este intercambio), MARCAR no tiene un "objetivo" claro
  /// dentro de un intercambio 1-a-1 — el jugador marca a un tercero cualquiera (su enganche de la
  /// ronda, ver comentario de `provocarCompanionRedirect`/mismo criterio de "objetivo = tu propio
  /// enganche, sin MULTIPLE" que PROVOCACION) para que SU COMPANION lo ataque preferentemente. El
  /// caller (combateMultipleOrquestacion.ts) resuelve el Companion real y marca
  /// `marcaObjetivoRondas`/`marcaObjetivoId` sobre él, nunca aquí (esta función no conoce
  /// Companions, solo atacante/defensor de un intercambio pairwise).
  atacanteMarcarDisparado: boolean;
  defensorMarcarDisparado: boolean;
  /// `AREA` real, variante ofensiva (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Opresor 32/36/40) —
  /// mismo gate que MULTIPLE/EXPULSAR (margen decisivo, camino no-independiente, el golpe base debe
  /// haber conectado de verdad) + `ATAQUE`+`AREA` en la habilidad de ataque. El caller resuelve
  /// TODOS los vivos del bando del defensor con `objetivosExtraFor` (sin tope, "a todos los
  /// rivales") en vez de un único extra — a diferencia de MULTIPLE, no hay variante "solo defensa"
  /// aquí (esa vive en `areaDefensaPorRondas`, resuelta por el orquestador en cada intercambio
  /// normal, no como un disparo puntual de esta función).
  areaOfensivaTriggered: boolean;
  /// `AREA` real, variante defensiva (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Instintivo 28,
  /// Instinto de Reserva: `AGUANTE`+`RECUPERACION`+`AREA`) — mismo gate que PROVOCACION defensiva
  /// (contragolpea con éxito, camino no-independiente): la DEFENSORA de este intercambio activa
  /// `areaDefensaPorRondas` sobre sí misma, nunca sobre el atacante. El caller resuelve la duración
  /// real y la redirección de golpes futuros (`redirigirPorAreaDefensiva`).
  defensorAreaDefensivaDisparada: boolean;
  /// `AREA` real, variante persistente (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Supervivencia 32,
  /// Trampa Improvisada) — camino independiente/utilidad, mismo gate que MARCAR/PROVOCACION
  /// (utilidad). Quien la dispara coloca la trampa SOBRE SÍ MISMO (mismo lado que OCULTACION), nunca
  /// sobre el rival — el caller marca `areaTrampaPorRondas` sobre quien la usó.
  atacanteAreaTrampaDisparada: boolean;
  defensorAreaTrampaDisparada: boolean;
  /// `LIMPIAR` real (2026-09-15, docs/rpgtarkor/sistemas-combate/clases.md — Caballero del Valor 16/32, Manto de
  /// Purificación/Purga de Honor) — camino independiente/utilidad, mismo gate que MARCAR/
  /// PROVOCACION/AREA persistente (utilidad). Quien la dispara se limpia A SÍ MISMO (mismo lado que
  /// OCULTACION/AREA persistente), nunca al rival — el caller aplica `removeWorstDebilidad`
  /// (activeEffects.ts) sobre los `activeEffects` reales de quien la usó.
  atacanteLimpiarDisparado: boolean;
  defensorLimpiarDisparado: boolean;
  /// `CURAZION` real (2026-09-15, docs/rpgtarkor/sistemas-combate/clases.md — Segador Parca/Transmutador,
  /// Especialista 40) — el caller aplica `oneStepBetterThan` (death.ts) sobre la condición física
  /// YA calculada de quien corresponda. `atacanteCurazionDisparado` cubre 2 casos (vampirismo por
  /// margen decisivo con ATAQUE, o camino independiente/utilidad puro — Segunda Oportunidad) —
  /// siempre sobre quien atacó/usó la utilidad. `defensorCurazionDisparado` cubre la transmutación
  /// defensiva (recibe el golpe pero mitiga parte del daño con su propia curación).
  atacanteCurazionDisparado: boolean;
  defensorCurazionDisparado: boolean;
  /// `REFLEJAR` real (2026-09-15, docs/rpgtarkor/sistemas-combate/clases.md — Segador Transmutador, Espejo Maldito/
  /// Espejo de Poder) — el caller captura el DEBILIDAD de mayor magnitud negativa de quien dispara
  /// (`removeWorstDebilidad`, activeEffects.ts), lo quita de su lista, y lo aplica como DEBILIDAD
  /// nuevo sobre el RIVAL de este intercambio (el defensor). Sin ningún DEBILIDAD propio activo, se
  /// pierde en silencio, mismo criterio que LIMPIAR.
  atacanteReflejarDisparado: boolean;
  /// `CONVERSION` real, transmutación de efectos activos (2026-09-15, Segador Transmutador,
  /// Transmutación Menor/Mayor/Equilibrio Roto) — choque de nombre deliberado con el CONVERSION ya
  /// existente (elige el atributo del golpe, siempre con `ATAQUE`); esta variante va sola o con
  /// REFLEJAR, nunca con ATAQUE. `atacanteTransmutaPropiaDisparada` (Transmutación Menor): el
  /// caller convierte el DEBILIDAD propio de mayor magnitud negativa en AUMENTO sobre sí misma.
  /// `atacanteTransmutaRivalDisparada` (Transmutación Mayor/Equilibrio Roto): el caller convierte
  /// el AUMENTO del RIVAL en DEBILIDAD y su DEBILIDAD en AUMENTO — "y viceversa".
  atacanteTransmutaPropiaDisparada: boolean;
  atacanteTransmutaRivalDisparada: boolean;
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
  /// AREA real, variante persistente (2026-09-14, Trampa Improvisada) — `true` si el DEFENSOR de
  /// este intercambio tiene `areaTrampaPorRondas > 0` (el caller, que sí conoce el estado real del
  /// `CombatParticipant`, resuelve esta condición) — refuerza el contragolpe normal con
  /// `iniciativaForzada` a su favor cuando gana, sin necesitar que la habilidad de defensa que use
  /// ESE turno concreto lleve `ATURDIMIENTO` explícito (mismo criterio de simplificación ya usado
  /// para EXPULSAR/PROVOCACION: la trampa YA fue activada en otro turno, aquí solo se consume).
  defensorTieneTrampaActiva: boolean = false,
  /// P129 (QA-27): el atacante golpea a quien ya pelea con otro rival — tira con ventaja.
  ventajaAtacante: boolean = false,
): ResultadoIntercambioCompleto {
  const dificultadAtacanteAjustada = dualWieldAdjustedDifficulty(dificultadAtacante, dualWieldBonus);
  const atacanteExch: ExchangeParticipant = {
    attributes: atacante.attributes,
    attribute: atacanteHabilidad.attribute,
    attributeBonus: atacanteHabilidad.attributeBonus ?? 0,
    difficulty: dificultadAtacanteAjustada,
    condicionFisica: atacante.condicionFisica,
    rol: atacanteRol,
    ...(ventajaAtacante ? { rollMode: 'ventaja' as const, racialAdvantageReason: 'Ataca mientras peleas con otro rival: ventaja', ventajaPor: 'flanqueo' } : {}),
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
  let atacanteProvocacionDisparada = false;
  let defensorProvocacionDisparada = false;
  let atacanteMarcarDisparado = false;
  let defensorMarcarDisparado = false;
  let defensorAreaDefensivaDisparada = false;
  let atacanteAreaTrampaDisparada = false;
  let defensorAreaTrampaDisparada = false;
  let atacanteAumentoUtilidadDisparado = false;
  let atacanteDebilidadUtilidadDisparada = false;
  let atacanteLimpiarDisparado = false;
  let defensorLimpiarDisparado = false;
  let atacanteCurazionDisparado = false;
  let defensorCurazionDisparado = false;
  let atacanteReflejarDisparado = false;
  let atacanteTransmutaPropiaDisparada = false;
  let atacanteTransmutaRivalDisparada = false;
  let defensorGanaPorMargen = false;
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
        // PROVOCACION real (2026-09-14, Desafío/Grito de Valentía) — quien la dispara provoca al
        // RIVAL de este intercambio (el defensor), nunca a sí mismo — mismo lado que CONTROL, lado
        // contrario que OCULTACION.
        if (atacanteHabilidad.effects.includes('PROVOCACION')) atacanteProvocacionDisparada = true;
        // AUMENTO real, camino independiente (2026-09-15, docs/rpgtarkor/sistemas-combate/clases.md — Valor
        // Compartido/Grito Improvisado) — a diferencia de MARCAR/PROVOCACION/OCULTACION en el
        // mismo camino (fuerzan un ESTADO en alguien), aquí lo que dispara es la construcción de
        // `nuevoEfectoAtacante` más abajo (mismo `ActiveEffect` de siempre) — el caller lo redirige
        // al Companion propio vía `durationEffectTarget`, mismo mecanismo ya construido para el
        // camino de margen decisivo (2026-09-09/2026-09-14). Solo AUMENTO desde utilidad (nunca
        // DEBILIDAD — ninguna ficha real de `clases.md` debilita a un aliado desde utilidad).
        if (atacanteHabilidad.effects.includes('AUMENTO')) atacanteAumentoUtilidadDisparado = true;
        // DEBILIDAD real, camino independiente (2026-09-15, docs/rpgtarkor/sistemas-combate/clases.md — Segador
        // Parca/Maldito, Toque de la Parca/Maldición Susurrada) — a diferencia de AUMENTO arriba
        // (redirigido al Companion propio), DEBILIDAD desde utilidad recae sobre el RIVAL de este
        // intercambio (el defensor), mismo lado que PROVOCACION/MARCAR en el mismo camino — nunca
        // sobre un aliado (ninguna ficha real debilita a un aliado, ver comentario de AUMENTO).
        if (atacanteHabilidad.effects.includes('DEBILIDAD')) atacanteDebilidadUtilidadDisparada = true;
        // MARCAR real (2026-09-14, Concentración del Domador) — dispara sobre el RIVAL de este
        // intercambio (el defensor), el caller resuelve el Companion real que recibe la marca.
        if (atacanteHabilidad.effects.includes('MARCAR')) atacanteMarcarDisparado = true;
        // AREA real, variante persistente (2026-09-14, Trampa Improvisada) — quien la dispara coloca
        // la trampa sobre SÍ MISMO (mismo lado que OCULTACION), nunca sobre el rival.
        if (atacanteHabilidad.effects.includes('AREA')) atacanteAreaTrampaDisparada = true;
        // LIMPIAR real (2026-09-15, Manto de Purificación/Purga de Honor) — mismo lado que
        // OCULTACION/AREA persistente: quien la dispara se limpia A SÍ MISMO, nunca al rival. El
        // caller resuelve `removeWorstDebilidad` sobre los `activeEffects` reales de quien la usó.
        if (atacanteHabilidad.effects.includes('LIMPIAR')) atacanteLimpiarDisparado = true;
        // CURAZION real, camino independiente (2026-09-15, Segunda Oportunidad — Especialista 40,
        // `RECUPERACION`+`CURAZION`+`LIMITADA`) — mismo lado que LIMPIAR/OCULTACION: quien la
        // dispara mejora SU PROPIA condición física un escalón (`oneStepBetterThan`, death.ts).
        if (atacanteHabilidad.effects.includes('CURAZION')) atacanteCurazionDisparado = true;
        // REFLEJAR real, camino independiente (2026-09-15, Segador Transmutador — Espejo Maldito/
        // Espejo de Poder) — a diferencia de LIMPIAR (quita el DEBILIDAD sin más), REFLEJAR lo
        // "devuelve al rival": esta función solo marca el disparo — no conoce `activeEffects` de
        // nadie (recibe solo los datos del intercambio) — el caller (combateMultipleOrquestacion.ts)
        // captura el DEBILIDAD de mayor magnitud negativa de quien la usó (`removeWorstDebilidad`,
        // activeEffects.ts), lo quita de su lista, y lo vuelve a construir como DEBILIDAD nuevo
        // sobre el RIVAL de este intercambio (el defensor). Sin ningún DEBILIDAD propio activo, se
        // pierde en silencio, mismo criterio que LIMPIAR.
        // Equilibrio Roto (`CONVERSION`+`REFLEJAR` juntos) NO pasa por el REFLEJAR simple — su
        // combinación dispara el camino "transmuta rival" más abajo, que ya cubre ambos sentidos.
        if (atacanteHabilidad.effects.includes('REFLEJAR') && !atacanteHabilidad.effects.includes('CONVERSION')) {
          atacanteReflejarDisparado = true;
        }
        // CONVERSION real, transmutación de efectos activos (2026-09-15, Segador Transmutador) —
        // choque de nombre deliberado con el CONVERSION ya existente (elige el atributo del golpe,
        // SIEMPRE combinado con `ATAQUE` en las 7 fichas reales que lo usan así) — aquí CONVERSION
        // va SOLA (Transmutación Menor) o con REFLEJAR (Equilibrio Roto), nunca con ATAQUE, así que
        // distinguir por `!effects.includes('ATAQUE')` es seguro, sin colisión real posible.
        // Transmutación Menor: convierte el DEBILIDAD propio de mayor magnitud negativa en un
        // AUMENTO sobre sí misma (magnitud con el signo invertido, mismos atributo/turnos) — el
        // caller resuelve `worstDebilidadOf`+`removeWorstDebilidad` sobre `datosAtacante.activeEffects`.
        if (atacanteHabilidad.effects.includes('CONVERSION') && !atacanteHabilidad.effects.includes('ATAQUE') && !atacanteHabilidad.effects.includes('REFLEJAR')) {
          atacanteTransmutaPropiaDisparada = true;
        }
        // Transmutación Mayor / Equilibrio Roto: convierte el AUMENTO del RIVAL en DEBILIDAD, Y su
        // DEBILIDAD en AUMENTO — "y viceversa" — el caller resuelve ambos lados sobre
        // `datosDefensor.activeEffects` (mismo rival de este intercambio).
        if (atacanteHabilidad.effects.includes('CONVERSION') && atacanteHabilidad.effects.includes('REFLEJAR')) {
          atacanteTransmutaRivalDisparada = true;
        }
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
        if (defensorHabilidad.effects.includes('PROVOCACION')) defensorProvocacionDisparada = true;
        if (defensorHabilidad.effects.includes('MARCAR')) defensorMarcarDisparado = true;
        if (defensorHabilidad.effects.includes('AREA')) defensorAreaTrampaDisparada = true;
        if (defensorHabilidad.effects.includes('LIMPIAR')) defensorLimpiarDisparado = true;
      }
    }
    exchangeBlock = independentExchangeContextBlock(independent, atacante.nombre, defensor.nombre);
    display = { atacanteEsJugador, atacante: independent.atacante, defensor: independent.defensor, resultado: 'independiente', margen: 0 };
  } else {
    // P96: la jugadora remata a un convaleciente sin que pueda defenderse.
    const exchange = atacanteEsJugador ? conGolpeDeGracia(resolveExchange(atacanteExch, defensorExch), defensor.condicionFisica) : resolveExchange(atacanteExch, defensorExch);
    const defensorPuedeContragolpear = defensorHabilidad.effects.includes('ATAQUE');
    // `defensorGanaPorMargen` (2026-09-15) — margen decisivo A FAVOR del defensor, puro, SIN exigir
    // `ATAQUE` (bug real cazado sembrando Sacrificio del Valiente: ninguna de las 4 fichas reales
    // de PROVOCACION variante margen decisivo lleva ATAQUE — "ganas la defensa con margen" y
    // "además devuelves un golpe físico" son conceptualmente independientes). `atacanteRecibeGolpe`
    // (daño real de contragolpe) SIGUE exigiendo ATAQUE — solo el disparo de PROVOCACION deja de
    // depender de él.
    defensorGanaPorMargen = exchange.resultado === 'defensor_contragolpea';
    const defensorContragolpeaAplica = defensorGanaPorMargen && defensorPuedeContragolpear;
    defensorRecibeGolpe = exchange.resultado === 'golpe_pleno' || exchange.resultado === 'golpe_normal';
    if (defensorRecibeGolpe) nuevaCondicionDefensor = nextCondicionForAttack(atacanteHabilidad.effects, defensor.condicionFisica);
    atacanteRecibeGolpe = defensorContragolpeaAplica;
    if (atacanteRecibeGolpe) nuevaCondicionAtacante = nextCondicionForAttack(defensorHabilidad.effects, atacante.condicionFisica);
    exchangeBlock = exchangeContextBlock(exchange, atacante.nombre, defensor.nombre, defensorPuedeContragolpear);
    margenDecisivo = exchange.resultado === 'golpe_pleno';
    // AREA real, variante persistente (2026-09-14, Trampa Improvisada) — el defensor con trampa
    // activa gana este intercambio por margen decisivo a su favor (`defensor_contragolpea`,
    // independiente de si su habilidad de defensa de ESTE turno lleva ATAQUE/ATURDIMIENTO propio):
    // roba la iniciativa, mismo mecanismo ya existente para cualquier ATURDIMIENTO real.
    if (defensorTieneTrampaActiva && exchange.resultado === 'defensor_contragolpea') {
      iniciativaForzada = 'defensor';
    }
    // DESVIAR real (Fase 3 § 3c, 2026-08-27) — la defensora gana por margen decisivo (mismo umbral
    // que CONTRA/REFRACTAR, `defensor_contragolpea`) Y su habilidad de defensa lleva DESVIAR: el
    // golpe entrante (que de todos modos ya iba a fallar, `defensorRecibeGolpe` es `false` en este
    // desenlace) se redirige a un tercero en vez de simplemente fallar — el caller (que sí conoce
    // al resto de combatientes) resuelve el golpe redirigido con las propias `atacanteHabilidad`.
    desviarTriggered = exchange.resultado === 'defensor_contragolpea' && defensorHabilidad.effects.includes('DESVIAR');
    display = { atacanteEsJugador, atacante: exchange.atacante, defensor: exchange.defensor, resultado: exchange.resultado, margen: exchange.margen, ...(exchange.golpeDeGracia ? { golpeDeGracia: true as const } : {}) };
  }

  // AUMENTO/DEBILIDAD real (Fase 3 § 3a, 2026-08-27) — mismo gate que Fase 2 (margen decisivo,
  // ver comentario de `margenDecisivo` arriba): solo se construye el `ActiveEffect` si la propia
  // habilidad de ataque trae ambos campos de duración poblados (ver comentario de
  // `HabilidadParaIntercambio.durationEffectMagnitude/Turns`). `atacanteAumentoUtilidadDisparado`
  // (2026-09-15) amplía este gate al camino independiente para AUMENTO; `atacanteDebilidadUtilidadDisparada`
  // (2026-09-15, Segador Parca/Maldito) hace lo mismo para DEBILIDAD — recae sobre el DEFENSOR
  // (rival), nunca sobre quien la usó (mismo lado que PROVOCACION/MARCAR en este camino).
  let nuevoEfectoAtacante: ActiveEffect | null = null;
  let nuevoEfectoDefensor: ActiveEffect | null = null;
  if ((margenDecisivo || atacanteAumentoUtilidadDisparado || atacanteDebilidadUtilidadDisparada) && atacanteHabilidad.durationEffectMagnitude != null && atacanteHabilidad.durationEffectTurns != null) {
    const efecto: ActiveEffect = {
      attribute: atacanteHabilidad.attribute,
      magnitude: atacanteHabilidad.durationEffectMagnitude,
      turnsRemaining: atacanteHabilidad.durationEffectTurns,
      sourceAbility: atacanteHabilidad.name,
    };
    if (atacanteHabilidad.effects.includes('AUMENTO')) nuevoEfectoAtacante = efecto;
    if ((margenDecisivo || atacanteDebilidadUtilidadDisparada) && atacanteHabilidad.effects.includes('DEBILIDAD')) nuevoEfectoDefensor = efecto;
  }

  // MULTIPLE real (Fase 3 § 3b, 2026-08-27) — mismo gate, ver comentario de la interfaz.
  const multipleTriggered = margenDecisivo && defensorRecibeGolpe && atacanteHabilidad.effects.includes('ATAQUE') && atacanteHabilidad.effects.includes('MULTIPLE');

  // AREA real, variante ofensiva (2026-09-14) — mismo gate que MULTIPLE, ver comentario de la interfaz.
  const areaOfensivaTriggered = margenDecisivo && defensorRecibeGolpe && atacanteHabilidad.effects.includes('ATAQUE') && atacanteHabilidad.effects.includes('AREA');

  // EXPULSAR real (Fase 3 § 3e, 2026-08-27) — mismo gate que MULTIPLE, ver comentario de la interfaz.
  const expulsarTriggered = margenDecisivo && defensorRecibeGolpe && atacanteHabilidad.effects.includes('ATAQUE') && atacanteHabilidad.effects.includes('EXPULSAR');

  // PROVOCACION real, camino de margen decisivo (2026-09-14, Bastión Personal/Guardia de Asta/
  // Postura Firme/Sacrificio del Valiente — `AGUANTE`+`PROVOCACION`) — a diferencia de EXPULSAR
  // (lado ATACANTE, golpe que conecta), esta es una ficha de DEFENSA: quien gana la defensa por
  // margen decisivo (`defensorGanaPorMargen`, 2026-09-15 — NO `atacanteRecibeGolpe`, que exige
  // `ATAQUE` y ninguna de las 4 fichas reales lo lleva, bug real cazado sembrando Sacrificio del
  // Valiente) y su habilidad de defensa trae `PROVOCACION` provoca al atacante — lo de arriba
  // (`atacanteProvocacionDisparada`/`defensorProvocacionDisparada`) solo cubre el camino
  // independiente (utilidad pura); esto cubre el combinado con ataque real.
  if (!esIndependiente && defensorGanaPorMargen && defensorHabilidad.effects.includes('AGUANTE') && defensorHabilidad.effects.includes('PROVOCACION')) {
    defensorProvocacionDisparada = true;
  }

  // AREA real, variante defensiva (2026-09-14, Instinto de Reserva — `AGUANTE`+`RECUPERACION`+
  // `AREA`) — mismo gate que PROVOCACION defensiva: contragolpea con éxito y su habilidad de
  // defensa trae AGUANTE+AREA. Activa `areaDefensaPorRondas` sobre quien la usó (nunca sobre el
  // atacante) — el caller resuelve la duración real.
  if (!esIndependiente && atacanteRecibeGolpe && defensorHabilidad.effects.includes('AGUANTE') && defensorHabilidad.effects.includes('AREA')) {
    defensorAreaDefensivaDisparada = true;
  }

  // CURAZION real, vampirismo (2026-09-15, Segador Parca — Sed de Vida/Último Suspiro,
  // `ATAQUE`+`CURAZION`) — mismo gate que MULTIPLE/EXPULSAR/AREA ofensiva (margen decisivo, el
  // golpe base conecta): quien ataca "roba vida" y mejora su propia condición un escalón.
  if (margenDecisivo && defensorRecibeGolpe && atacanteHabilidad.effects.includes('ATAQUE') && atacanteHabilidad.effects.includes('CURAZION')) {
    atacanteCurazionDisparado = true;
  }

  // CURAZION real, transmutación defensiva (2026-09-15, Segador Transmutador — Alquimia Vital,
  // `CURAZION` sola, sin AGUANTE explícito: "transmuta el daño recibido") — a diferencia de AREA/
  // PROVOCACION defensivas (disparan al CONTRAGOLPEAR con éxito), esta dispara cuando el golpe SÍ
  // conecta (`defensorRecibeGolpe`): quien recibe el golpe mitiga parte del daño con su propia
  // curación, mejorando un escalón pese a haber sido golpeado.
  if (!esIndependiente && defensorRecibeGolpe && defensorHabilidad.effects.includes('CURAZION')) {
    defensorCurazionDisparado = true;
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
    atacanteProvocacionDisparada,
    defensorProvocacionDisparada,
    atacanteMarcarDisparado,
    defensorMarcarDisparado,
    areaOfensivaTriggered,
    defensorAreaDefensivaDisparada,
    atacanteAreaTrampaDisparada,
    defensorAreaTrampaDisparada,
    atacanteLimpiarDisparado,
    defensorLimpiarDisparado,
    atacanteCurazionDisparado,
    defensorCurazionDisparado,
    atacanteReflejarDisparado,
    atacanteTransmutaPropiaDisparada,
    atacanteTransmutaRivalDisparada,
    display,
  };
}
