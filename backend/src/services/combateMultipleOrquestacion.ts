import type { Prisma, PrismaClient, CondicionFisica, Npc, Clase } from '@prisma/client';
import type { AttributeBlock } from './dice.js';
import {
  rollInitiativeMultiple,
  objetivosValidos,
  objetivosValidosParaAtacar,
  bandoSigueEnCombate,
  elegirObjetivo,
  objetivoExtraFor,
  resolverEnganchesRonda,
  resolverIntercambioCompleto,
  type CombatienteIniciativa,
  type Bando,
  type ObjetivoCandidato,
  type HabilidadParaIntercambio,
} from './combateMultiple.js';
import { npcCombatAbilitiesFor, chooseNpcAbility, type NpcCombatAbility, type NpcForCombatAbilities } from './npcCombatAbilities.js';
import { narrarTurnoCombateMultiple } from './combateMultipleNarracion.js';
import type { NpcHabilidadRacialInScene } from './npcScene.js';
import { energiaMaxFor, nextEnergia } from './energy.js';
import { saludForCondicion, nextCondicionForAttack } from './death.js';
import { npcAttributesForLevel } from './progression.js';
import { effectiveAttributesConDuracion, decrementActiveEffects, parseActiveEffects, type ActiveEffect } from './activeEffects.js';

/// Grupo 3 § Combate múltiple (2026-08-25) — orquestación con estado real (crea/avanza un
/// `CombatEncounter`). Fase A/B: resuelve turnos autónomos de NPC/COMPANION (sin intervención de
/// la jugadora) de principio a fin — mecánica + condición física/energía real + narración —
/// construida y probada aislada a propósito, antes de tocar el motor de combate en uso.
///
/// Integración real (2026-08-25, "paridad completa desde ya"): `resolverTurnoJugador` resuelve
/// también el turno de la JUGADORA cuando hay un `CombatEncounter` activo — la mecánica de cada
/// intercambio (ambos casos) pasa por `resolverIntercambioCompleto` (combateMultiple.ts § 4), que
/// SÍ tiene paridad con `resolveCombatExchangePhase` (utilidades reactivas, doble arma, LETAL).
/// TODAVÍA no engancha XP/cierre de misión/loot al matar dentro de un `CombatEncounter` (eso sigue
/// viviendo en `applyCombatExchangeToNpcState`, turnResolution.ts, para el combate 1v1 clásico) —
/// el enganche a esa parte pasa por el punto de integración en `narrateAndPersistTurn`, no por
/// este archivo.
///
/// Fronteras transaccionales (arreglado 2026-08-25 tras un `PrismaClientKnownRequestError` real en
/// partida): las funciones orquestadoras (`resolverTurnoAutonomo`/`resolverTurnoJugador`/
/// `resolverTurnosAutonomosHastaJugadora`) reciben el `PrismaClient` real, NUNCA un `tx` ya abierto
/// por el caller — cada intercambio abre sus propias transacciones cortas (solo escritura) y llama
/// a `narrarFn` (Ollama, 9-25s en vivo) fuera de cualquiera de ellas, ver comentario completo en
/// `ejecutarIntercambioYAvanzar`. `iniciarCombatEncounter` es la excepción: no narra nada, así que
/// sigue recibiendo un `tx` del caller (crear el encuentro completo es atómico y rápido).

export interface CombatienteInicial {
  bando: Bando;
  tipo: 'JUGADOR' | 'COMPANION' | 'NPC';
  npcId?: string;
  npcScope?: string;
  companionId?: string;
  /// true = miembro real de un grupo cazado (varios individuos comparten `npcId`+`npcScope`,
  /// ver comentario de `CombatParticipant.condicionFisicaGrupo` en schema.prisma) — su condición
  /// se trackea en el propio `CombatParticipant`, nunca en `NpcState` (esa fila la comparten
  /// todos los miembros del grupo, no puede distinguirlos). Simplificación consciente: la energía
  /// y el tope de usos por combate NO se trackean por individuo de grupo (siempre "fresca" cada
  /// encuentro) — la fauna salvaje cazada en manada no usa rotaciones de habilidad complejas hoy.
  esGrupo?: boolean;
}

/// Crea el `CombatEncounter` + sus `CombatParticipant`, tira iniciativa para todos (§1) y fija el
/// primer emparejamiento de cada bando (§2) — todo en una sola transacción. El caller ya resolvió
/// qué combatientes participan (npcs/companions concretos) y sus atributos crudos para poder tirar
/// iniciativa sin releer nada más aquí.
export async function iniciarCombatEncounter(
  tx: Prisma.TransactionClient,
  saveId: string,
  combatientes: (CombatienteInicial & { destreza: number; inteligencia: number })[],
  jugable: boolean = true,
): Promise<{ encounterId: string }> {
  const encounter = await tx.combatEncounter.create({ data: { saveId, jugable } });
  // `Promise.all` preserva el orden del array de entrada — `creados[i]` corresponde siempre a
  // `combatientes[i]`, así se puede emparejar destreza/inteligencia (datos crudos que el caller
  // ya trae) con el `CombatParticipant.id` real recién creado sin buscar nada por índice suelto.
  const creados = await Promise.all(
    combatientes.map((c) =>
      tx.combatParticipant.create({
        data: {
          encounterId: encounter.id,
          bando: c.bando,
          tipo: c.tipo,
          npcId: c.npcId,
          npcScope: c.npcScope ?? '',
          companionId: c.companionId,
          condicionFisicaGrupo: c.esGrupo ? 'ILESO' : undefined,
        },
      }),
    ),
  );
  const participantes = creados.map((p, i) => ({ participantId: p.id, bando: p.bando, destreza: combatientes[i].destreza, inteligencia: combatientes[i].inteligencia }));

  const orden = rollInitiativeMultiple(participantes.map((p) => ({ participantId: p.participantId, bando: p.bando, destreza: p.destreza })));

  // Objetivo individual real (2026-08-26, docs/21-roadmap.md § Fase 3) — primer cálculo de
  // enganche (duelo/golpe gratis) de la ronda 1, sustituye el viejo `retargetBando` (que siempre
  // le daba a TODOS un objetivo válido, sin distinguir "duelo real" de "golpe gratis sin
  // oposición"). Todos frescos en ILESO (encuentro recién creado) — no hace falta releer nada de
  // la base de datos todavía, a diferencia de `calcularEnganchesRonda` (usado en rondas
  // posteriores), así que esto se calcula directo con los datos crudos que ya trae el caller.
  const jugadorParticipantId = participantes.find((_, i) => combatientes[i].tipo === 'JUGADOR')?.participantId ?? null;
  const combatientesParaEnganche = participantes.map((p) => ({ participantId: p.participantId, bando: p.bando }));
  const elegirObjetivoInicial = (id: string, candidatos: string[]): string | null => {
    // La jugadora decide en su primer turno real, nunca aquí (ver comentario de
    // `esperandoEleccionJugadora` en schema.prisma) — null la deja "sin objetivo propio" hasta
    // entonces, aunque otros SÍ puedan reclamarla a ella mientras tanto.
    if (id === jugadorParticipantId) return null;
    const inteligencia = participantes.find((p) => p.participantId === id)?.inteligencia ?? 0;
    const candidatosObj: ObjetivoCandidato[] = candidatos.map((cid) => ({ participantId: cid, condicionFisica: 'ILESO' as CondicionFisica }));
    return elegirObjetivo(inteligencia, candidatosObj, Math.random);
  };
  const ordenIds = orden.map((e) => e.participantId);
  const enganches = resolverEnganchesRonda(ordenIds, combatientesParaEnganche, elegirObjetivoInicial);
  const esperandoJugadora = jugadorParticipantId !== null && enganches.get(jugadorParticipantId) === null;

  await Promise.all(
    [...enganches.entries()].map(([id, objetivo]) => tx.combatParticipant.update({ where: { id }, data: { objetivoActualId: objetivo } })),
  );

  await tx.combatEncounter.update({ where: { id: encounter.id }, data: { ordenIniciativa: ordenIds, esperandoEleccionJugadora: esperandoJugadora } });
  return { encounterId: encounter.id };
}

/// Shape mínima de `CombatParticipant` que necesitan `datosVivosDe`/`escribirCondicionYEnergia` —
/// coincide con lo que Prisma devuelve de verdad, nombrado aparte para no repetir el mismo objeto
/// literal en cada firma.
interface ParticipantRef {
  id: string;
  tipo: string;
  npcId: string | null;
  npcScope: string;
  companionId: string | null;
  condicionFisicaGrupo: CondicionFisica | null;
  /// Objetivo individual real (2026-08-26) — ver `dueloYaResueltoPorElOtro`/`calcularEnganchesRonda`.
  objetivoActualId: string | null;
  /// CONTROL real (Fase 3 § 3a, 2026-08-27) — ver comentario de la columna en schema.prisma.
  controladoPorRondas: number | null;
  /// OCULTACION real (Fase 3 § 3c, 2026-08-27) — ver comentario de la columna en schema.prisma.
  ocultoPorRondas: number | null;
  /// INVOCACION real (Fase 3 § 3d, 2026-08-27) — ver comentario de las 3 columnas en schema.prisma.
  invocacionVidaRestante: number | null;
  invocacionRondasRestantes: number | null;
  invocacionInvocadorId: string | null;
  /// EXPULSAR real (Fase 3 § 3e, 2026-08-27) — ver comentario de la columna en schema.prisma.
  expulsadoPorRondas: number | null;
  /// Analizar Rival real en combate múltiple (2026-08-27) — ver comentario de la columna en schema.prisma.
  analizadoGrupo: boolean | null;
}

interface DatosCombatiente {
  nombre: string;
  /// Ya con `activeEffects` aplicados (`effectiveAttributesConDuracion`) — lo que de verdad debe
  /// entrar en un intercambio (Fase 3 § 3a, 2026-08-27, cierra el hueco de Fase 2: este motor no
  /// leía `activeEffects` en absoluto hasta ahora).
  attributes: AttributeBlock;
  condicionFisica: CondicionFisica;
  energia: number;
  abilities: NpcCombatAbility[];
  usageCounts: Record<string, number>;
  /// Crudos, SIN aplicar — lo que hace falta para decrementar/empujar y volver a persistir (nunca
  /// para calcular un intercambio, ver `attributes` arriba). `[]` para miembros de grupo, mismo
  /// criterio de simplificación consciente que `usageCounts`/energía (esGrupo, ver comentario de
  /// `CombatienteInicial.esGrupo`).
  activeEffects: ActiveEffect[];
}

/// Resuelve los datos EN VIVO de un combatiente — nunca duplicados en `CombatParticipant`, ver
/// comentario del modelo en schema.prisma. `NpcState` se crea perezosa (mismo criterio que el
/// resto del motor: un NPC nunca tocado no tiene fila propia todavía).
/// Roster defensivo mínimo garantizado (mismo "Esquivar" que `npcCombatAbilitiesFor` añade siempre
/// al final de CUALQUIER NPC, npcCombatAbilities.ts) — la jugadora lo usa como último recurso si
/// no tiene ninguna `SavedAction` de defensa/utilidad todavía (personaje recién creado).
const ESQUIVAR_GENERICO: NpcCombatAbility = { name: 'Esquivar', description: 'Esquiva el golpe entrante.', attribute: 'destreza', effects: [], rol: 'defensa', energyCost: 0, energyRegen: 15 };

/// CONTROL real (Fase 3 § 3a, 2026-08-27) — mismas "2 rondas" que describen Opresión Mental Y
/// Control Rúnico, las dos únicas filas reales de `clases.md` con este efecto (cifra fija, mismo
/// criterio de simplificación consciente que el resto de Fase 2/3).
const CONTROL_RONDAS = 2;

/// OCULTACION real (Fase 3 § 3c, 2026-08-27) — tramo alto de Camuflaje (diferencia 10 → 2 turnos,
/// en vez de los 2 tramos 4/10 → 1/2 turnos de la fila real), mismo criterio de simplificación que
/// el resto de Fase 2/3 (Golpe Envenenado, "solo el tramo alto").
const OCULTACION_RONDAS = 2;

/// INVOCACION real (Fase 3 § 3d, 2026-08-27) — cifras literales de la ficha real de Tótem de
/// Guerra ("aguanta 1 golpe, ataca durante 2 turnos y desaparece"), primer y único tipo de
/// invocación sembrado en esta pasada. Un tipo de tótem futuro con cifras distintas (Tótem de
/// Protección aguanta 2, por ejemplo) necesitaría llevar sus propias cifras en el catálogo en vez
/// de esta constante única — fuera de alcance de esta pasada (solo 1 fila real sembrada).
const TOTEM_DE_GUERRA_SLUG = 'totem-de-guerra';
const TOTEM_DE_GUERRA_VIDA = 1;
const TOTEM_DE_GUERRA_RONDAS = 2;

/// EXPULSAR real (Fase 3 § 3e, 2026-08-27) — simplificación consciente frente a la ficha real de
/// Embate de Escudo (2 tramos por margen, 50% de volver, "no vuelve nunca" en el tramo alto): un
/// único margen decisivo dispara siempre "expulsa 2 rondas, vuelve solo al cumplirlas o antes si su
/// bando se queda sin nadie más vivo" (decisión explícita de la usuaria).
const EXPULSAR_RONDAS = 2;

async function datosVivosDe(
  tx: Prisma.TransactionClient,
  worldId: string,
  saveId: string,
  participant: ParticipantRef,
  weaponNames: string[],
): Promise<DatosCombatiente | null> {
  if (participant.tipo === 'JUGADOR') {
    // La jugadora en un CombatEncounter real (2026-08-25) — a diferencia de NPC/COMPANION, en su
    // propio turno ELIGE la habilidad de ataque explícitamente (ver `resolverTurnoJugador`, no
    // usa `chooseNpcAbility`); el roster que se devuelve aquí solo hace falta para cuando actúa
    // como DEFENSORA en el turno de otro combatiente — auto-elegido igual que un NPC, entre sus
    // propias `SavedAction` de defensa/utilidad reales (simplificación consciente: no se pide su
    // reacción en directo en cada ataque enemigo dentro de una resolución en grupo, mismo criterio
    // "resuelve autónomo hasta que le toca a la jugadora" del resto de este archivo).
    const save = await tx.save.findUniqueOrThrow({ where: { id: saveId } });
    const jugadorActiveEffects = parseActiveEffects(save.activeEffects);
    const savedActions = await tx.savedAction.findMany({ where: { saveId, rol: { in: ['defensa', 'utilidad'] } } });
    const abilities: NpcCombatAbility[] = savedActions
      .filter((a): a is typeof a & { preferredAttribute: string; rol: 'defensa' | 'utilidad' } => !!a.preferredAttribute && (a.rol === 'defensa' || a.rol === 'utilidad'))
      .map((a) => ({
        name: a.name,
        description: a.description,
        attribute: a.preferredAttribute as NpcCombatAbility['attribute'],
        attributeBonus: a.attributeBonus ?? undefined,
        effects: a.effects,
        rol: a.rol,
        energyCost: a.energyCost,
        energyRegen: a.energyRegen,
        maxUsesPerCombat: a.maxUsesPerCombat,
      }));
    return {
      nombre: save.characterName,
      attributes: effectiveAttributesConDuracion(save.attributes as unknown as AttributeBlock, jugadorActiveEffects),
      condicionFisica: save.condicionFisica,
      energia: save.energia,
      abilities: abilities.length > 0 ? abilities : [ESQUIVAR_GENERICO],
      // Tope de usos por combate NO se enforce para la jugadora dentro de un CombatEncounter en
      // esta pasada (simplificación documentada, mismo espíritu que `esGrupo`) — su
      // `NpcState.abilityUsesThisEncounter` equivalente no existe en `Save`.
      usageCounts: {},
      activeEffects: jugadorActiveEffects,
    };
  }
  if (participant.tipo === 'NPC' && participant.npcId) {
    const npc = await tx.npc.findUnique({ where: { id: participant.npcId } });
    if (!npc) return null;
    // Miembro de grupo (condicionFisicaGrupo no nulo) — su condición real vive en el propio
    // CombatParticipant, NUNCA en NpcState (esa fila la comparten todos los miembros del grupo).
    // Energía/usageCounts se quedan "frescos" cada encuentro, ver comentario de `esGrupo` arriba.
    if (participant.condicionFisicaGrupo !== null) {
      return {
        nombre: npc.name,
        attributes: npcAttributesForLevel(npc.attributes as unknown as AttributeBlock, npc.level, npc.clase as Clase | null),
        condicionFisica: participant.condicionFisicaGrupo,
        energia: 100,
        abilities: npcCombatAbilitiesFor(toNpcForCombatAbilities(npc), weaponNames),
        usageCounts: {},
        activeEffects: [],
      };
    }
    const state = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: participant.npcScope } } });
    const npcActiveEffects = parseActiveEffects(state?.activeEffects);
    return {
      nombre: npc.name,
      attributes: effectiveAttributesConDuracion(npcAttributesForLevel(npc.attributes as unknown as AttributeBlock, npc.level, npc.clase as Clase | null), npcActiveEffects),
      condicionFisica: state?.condicionFisica ?? 'ILESO',
      energia: state?.energia ?? 100,
      abilities: npcCombatAbilitiesFor(toNpcForCombatAbilities(npc), weaponNames),
      usageCounts: (state?.abilityUsesThisEncounter as Record<string, number>) ?? {},
      activeEffects: npcActiveEffects,
    };
  }
  if (participant.tipo === 'INVOCACION' && participant.npcId) {
    const npc = await tx.npc.findUnique({ where: { id: participant.npcId } });
    if (!npc) return null;
    // INVOCACION real (Fase 3 § 3d, 2026-08-27) — no tiene HERIDO/GRAVE intermedios (ver
    // comentario de `CombatParticipant.invocacionVidaRestante` en schema.prisma): mientras le
    // queda vida es un objetivo válido normal (ILESO), en cuanto llega a 0 se trata exactamente
    // como CONVALECIENTE/MUERTO para `objetivosValidos`/enganches — MUERTO directo, un tótem
    // destruido no se "reanima" ni se saquea/desuella (no lleva loadout, `ataqueBaseFor` es lo
    // único que necesita de su ficha de catálogo).
    const vivo = (participant.invocacionVidaRestante ?? 0) > 0;
    return {
      nombre: npc.name,
      attributes: npc.attributes as unknown as AttributeBlock,
      condicionFisica: vivo ? 'ILESO' : 'MUERTO',
      energia: 100,
      abilities: npcCombatAbilitiesFor(toNpcForCombatAbilities(npc), weaponNames),
      usageCounts: {},
      activeEffects: [],
    };
  }
  if (participant.tipo === 'COMPANION' && participant.companionId) {
    const companion = await tx.companion.findUnique({ where: { id: participant.companionId } });
    if (!companion || !companion.attributes) return null;
    // Un compañero real de combate usa el roster del Npc de catálogo del que vino (§5 del doc:
    // "necesita atributos y vida propios", pero no un roster de habilidades propio — reutiliza el
    // de su origen, mismo criterio que sus atributos, copiados al confirmar el tameo/persuasión).
    // `companion.attributes` guarda el bloque CRUDO (nivel 1) del Npc origen — se escala aquí igual
    // que el resto de ramas, nunca se guarda ya escalado (fuente única de verdad: nivel del propio
    // catálogo, que no cambia para un compañero).
    const npcOrigen = companion.sourceSlug ? await tx.npc.findFirst({ where: { worldId, slug: companion.sourceSlug } }) : null;
    const companionActiveEffects = parseActiveEffects(companion.activeEffects);
    const companionAttributesBase = npcOrigen
      ? npcAttributesForLevel(companion.attributes as unknown as AttributeBlock, npcOrigen.level, npcOrigen.clase as Clase | null)
      : (companion.attributes as unknown as AttributeBlock);
    return {
      nombre: companion.name,
      attributes: effectiveAttributesConDuracion(companionAttributesBase, companionActiveEffects),
      condicionFisica: companion.condicionFisica,
      energia: 100,
      abilities: npcOrigen ? npcCombatAbilitiesFor(toNpcForCombatAbilities(npcOrigen), weaponNames) : [],
      usageCounts: {},
      activeEffects: companionActiveEffects,
    };
  }
  return null;
}

function toNpcForCombatAbilities(npc: Npc): NpcForCombatAbilities {
  return {
    level: npc.level,
    attributes: npc.attributes as unknown as AttributeBlock,
    raza: npc.raza,
    clase: npc.clase,
    especializacion: npc.especializacion,
    ataqueNatural: npc.ataqueNatural,
    habilidadesRaciales: (npc.habilidadesRaciales as unknown as NpcHabilidadRacialInScene[]) ?? [],
    // Sistema de categorías de raza de fauna (2026-09-02) — antes se perdía aquí mismo: un NPC de
    // fauna real en combate múltiple nunca recibía las 7 habilidades de su `faunaCategoria`.
    faunaCategoria: npc.faunaCategoria,
  };
}

/// Objetivo individual real (2026-08-26, docs/21-roadmap.md § Fase 3, `combateMultiple.ts §2b`) —
/// calcula el enganche (duelo/golpe gratis) de una ronda COMPLETA leyendo condición/inteligencia
/// reales de cada combatiente vivo. `jugadoraTargetId` es `null` mientras no se sepa a quién
/// quiere atacar ella todavía (recién empieza la ronda) — en ese caso el resultado deja su propia
/// entrada sin objetivo (aunque otros SÍ puedan reclamarla), y el caller debe fijarlo aparte en
/// cuanto lo sepa (`fijarEleccionRondaJugador`) antes de que NADA de la ronda pueda resolverse en
/// firme (ver comentario largo de `esperandoEleccionJugadora` en schema.prisma).
async function calcularEnganchesRonda(
  tx: Prisma.TransactionClient,
  worldId: string,
  saveId: string,
  encounter: { ordenIniciativa: string[]; participantes: (ParticipantRef & { bando: Bando })[] },
  weaponNamesPorDefecto: string[],
  jugadoraTargetId: string | null,
): Promise<{ enganches: Map<string, string | null>; esperandoJugadora: boolean }> {
  const datosPorParticipante = new Map<string, DatosCombatiente | null>();
  await Promise.all(
    encounter.participantes.map(async (p) => {
      datosPorParticipante.set(p.id, await datosVivosDe(tx, worldId, saveId, p, weaponNamesPorDefecto));
    }),
  );
  // Bug real jugando en vivo (2026-08-29, tercera causa encadenada del mismo hallazgo que
  // `bandoSigueEnCombate`/el guard de `resolverTurnoJugador`): esta lista de "vivos" decide quién
  // ENTRA en el cálculo de enganches de la ronda nueva — con la jugadora CONVALECIENTE excluida
  // aquí (mismo criterio estricto que un NPC), `jugadoraId` salía `null` cada vez que cruzaba de
  // ronda estando convaleciente, así que nunca se le recalculaba un objetivo nuevo tras la muerte
  // del anterior — se quedaba apuntando a un enemigo ya MUERTO (`resolverTurnoJugador` lo trataba
  // como "sin defensor", turno vacío sin narración real, mismo síntoma ya visto). Mismo criterio
  // que el resto de esta familia de fixes: solo MUERTO real saca a la JUGADORA del cálculo.
  const vivos = encounter.participantes.filter((p) => {
    const datos = datosPorParticipante.get(p.id);
    if (!datos) return false;
    if (p.tipo === 'JUGADOR') return datos.condicionFisica !== 'MUERTO';
    return datos.condicionFisica !== 'CONVALECIENTE' && datos.condicionFisica !== 'MUERTO';
  });
  const combatientes = vivos.map((p) => ({ participantId: p.id, bando: p.bando }));
  const jugadoraId = vivos.find((p) => p.tipo === 'JUGADOR')?.id ?? null;

  const elegirObjetivoPara = (id: string, candidatos: string[]): string | null => {
    if (id === jugadoraId) return jugadoraTargetId;
    // `esJugadorReal` (2026-08-29, mismo hallazgo que arriba): sin esto, un NPC con SOLO la
    // jugadora convaleciente como candidato nunca podía elegirla — `elegirObjetivo` la trataba
    // como cualquier otro CONVALECIENTE, `objetivoActualId` se quedaba `null` para siempre.
    const candidatosObj: ObjetivoCandidato[] = candidatos.map((cid) => ({
      participantId: cid,
      condicionFisica: datosPorParticipante.get(cid)?.condicionFisica ?? 'MUERTO',
      esJugadorReal: cid === jugadoraId,
    }));
    return elegirObjetivo(datosPorParticipante.get(id)?.attributes.inteligencia ?? 0, candidatosObj, Math.random);
  };

  // OCULTACION (Fase 3 § 3c) + EXPULSAR (Fase 3 § 3e, 2026-08-27) — excluidos de ser elegidos como
  // objetivo (salvo que sean el único vivo de su bando, `resolverEnganchesRonda` ya aplica esa
  // excepción por su cuenta) — misma exclusión, dos motivos distintos, ver comentario del parámetro.
  const ocultosOExpulsados = new Set(
    vivos.filter((p) => (p.ocultoPorRondas != null && p.ocultoPorRondas > 0) || (p.expulsadoPorRondas != null && p.expulsadoPorRondas > 0)).map((p) => p.id),
  );
  const enganches = resolverEnganchesRonda(encounter.ordenIniciativa, combatientes, elegirObjetivoPara, ocultosOExpulsados);
  const esperandoJugadora = jugadoraId !== null && enganches.get(jugadoraId) === null;
  return { enganches, esperandoJugadora };
}

async function escribirCondicionYEnergia(
  tx: Prisma.TransactionClient,
  saveId: string,
  participant: ParticipantRef,
  condicionFisica: CondicionFisica | null,
  energia: number | null,
  abilityNameUsada: string | null,
  usageCounts: Record<string, number>,
  /// Fase 3 § 3a de efectos de clase (2026-08-27) — ya decrementado/con el push de este turno
  /// (`decrementActiveEffects`+`pushActiveEffect`, calculado por el caller). `null` = no tocar
  /// (golpe gratis, camino sin `resolverIntercambioCompleto` de por medio). Reset a `[]` si
  /// `condicionFisica` (el parámetro, no el estado previo) llega como `'ILESO'` explícito — mismo
  /// criterio que `NpcState.activeEffects` en el motor 1vs1 (turnResolution.ts): este parámetro ya
  /// viene `null` en cualquier turno donde nada le pasó a este participante (ver los call-sites),
  /// así que nunca resetea "de fondo" a alguien que simplemente sigue ileso sin haber sido tocado.
  activeEffectsNext: ActiveEffect[] | null,
): Promise<void> {
  const nextUsageCounts = { ...usageCounts };
  if (abilityNameUsada) nextUsageCounts[abilityNameUsada] = (nextUsageCounts[abilityNameUsada] ?? 0) + 1;
  const activeEffectsToWrite = activeEffectsNext === null ? null : condicionFisica === 'ILESO' ? [] : activeEffectsNext;
  if (participant.condicionFisicaGrupo !== null) {
    // Miembro de grupo — su condición vive en el propio CombatParticipant (energía/usageCounts/
    // activeEffects deliberadamente no persisten entre turnos, ver comentario de `esGrupo`).
    if (condicionFisica) await tx.combatParticipant.update({ where: { id: participant.id }, data: { condicionFisicaGrupo: condicionFisica } });
    return;
  }
  if (participant.tipo === 'JUGADOR') {
    await tx.save.update({
      where: { id: saveId },
      data: {
        ...(condicionFisica ? { condicionFisica, salud: saludForCondicion(condicionFisica) } : {}),
        ...(energia !== null ? { energia } : {}),
        ...(activeEffectsToWrite !== null ? { activeEffects: activeEffectsToWrite as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    return;
  }
  if (participant.tipo === 'INVOCACION') {
    // INVOCACION real (Fase 3 § 3d, 2026-08-27) — sin HERIDO/GRAVE intermedios: cualquier golpe
    // recibido (`condicionFisica` no-null, ya calculado por `nextCondicionForAttack` de fuera)
    // resta 1 a la vida restante, sin mirar de qué condición viene — "aguanta 1 golpe" es literal.
    if (condicionFisica) {
      await tx.combatParticipant.update({
        where: { id: participant.id },
        data: { invocacionVidaRestante: Math.max(0, (participant.invocacionVidaRestante ?? 0) - 1) },
      });
    }
    return;
  }
  if (participant.tipo === 'NPC' && participant.npcId) {
    await tx.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: participant.npcId, scope: participant.npcScope } },
      create: {
        saveId,
        npcId: participant.npcId,
        scope: participant.npcScope,
        ...(condicionFisica ? { condicionFisica } : {}),
        ...(energia !== null ? { energia } : {}),
        ...(abilityNameUsada ? { abilityUsesThisEncounter: nextUsageCounts } : {}),
        ...(activeEffectsToWrite !== null ? { activeEffects: activeEffectsToWrite as unknown as Prisma.InputJsonValue } : {}),
      },
      update: {
        ...(condicionFisica ? { condicionFisica } : {}),
        ...(energia !== null ? { energia } : {}),
        ...(abilityNameUsada ? { abilityUsesThisEncounter: nextUsageCounts } : {}),
        ...(activeEffectsToWrite !== null ? { activeEffects: activeEffectsToWrite as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  } else if (participant.tipo === 'COMPANION' && participant.companionId) {
    await tx.companion.update({
      where: { id: participant.companionId },
      data: {
        ...(condicionFisica ? { condicionFisica } : {}),
        ...(activeEffectsToWrite !== null ? { activeEffects: activeEffectsToWrite as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  }
}

/// Grupo 3 § Mundo determinista, Capa 4 (docs/rpgtarkor/mundo-determinista.md, 2026-08-25) —
/// participante que este intercambio deja CONVALECIENTE/MUERTO, para que el caller
/// (turnResolution.ts) pueda enganchar XP/cierre de misión/reputación/población (mismo criterio
/// que ya hace `applyCombatExchangeToNpcState` para el combate 1v1) — sin esto, un `CombatEncounter`
/// real podía dejar NPCs muertos sin ningún efecto de juego más allá de la propia condición.
export interface ParticipanteCaidoInfo {
  tipo: string;
  npcId: string | null;
  nuevaCondicion: CondicionFisica;
}

export interface TurnoAutonomoResultado {
  narracion: string;
  atacanteNombre: string;
  defensorNombre: string;
  encounterTerminado: boolean;
  caidos: ParticipanteCaidoInfo[];
  /// INVOCACION real (Fase 3 § 3d, 2026-08-27) — narración(es) de cada tótem que atacó al cruzar de
  /// ronda justo después de este turno (`avanzarYComprobarFin` → `totemsQueAtacan`, resueltas por
  /// `resolverTotemsPendientes`) — un turno normal puede "arrastrar" 0, 1 o 2 golpes de tótem
  /// (uno por bando, como mucho, ver comentario de `resolverTotemsPendientes`). Vacío en el caso
  /// normal (nunca cruzó de ronda, o cruzó sin ningún tótem vivo). El caller
  /// (`resolverTurnosAutonomosHastaJugadora`) las añade a `narraciones` en el mismo orden.
  narracionesExtra: string[];
}

/// Campos compartidos por `ejecutarIntercambioYAvanzar`/`ejecutarGolpeGratisYAvanzar`/
/// `invocarTotemYAvanzar` (deuda técnica cerrada, auditoría 2026-09-01: las 3 tenían 9-13
/// parámetros posicionales, varios de tipos consecutivos idénticos —`ParticipantRef` seguido de
/// otro `ParticipantRef`, dos `boolean` seguidos— mismo patrón de riesgo que ya causó un bug real
/// esta sesión (`atacanteRol` fijo al string literal `'ataque'` en vez del rol real de la
/// habilidad, `combateMultipleOrquestacion.ts`, corregido en la ronda de consolidación). Un
/// objeto con nombres explícitos hace ese tipo de desliz imposible de cometer en silencio.
interface TurnoAutonomoBaseParams {
  prisma: PrismaClient;
  worldId: string;
  saveId: string;
  encounterId: string;
  encounter: { turnoActual: number; ordenIniciativa: string[]; participantes: (ParticipantRef & { bando: Bando })[] };
  actual: ParticipantRef;
  datosAtacante: DatosCombatiente;
  habilidadAtaque: HabilidadParaIntercambio;
  weaponNamesPorDefecto: string[];
  narrarFn: typeof narrarTurnoCombateMultiple;
}

interface EjecutarIntercambioParams extends TurnoAutonomoBaseParams {
  atacanteRol: 'ataque' | 'defensa' | 'utilidad';
  dualWieldBonus: boolean;
  defensor: ParticipantRef;
}

/// Núcleo compartido por `resolverTurnoAutonomo` (atacante NPC/COMPANION) y `resolverTurnoJugador`
/// (atacante la propia jugadora, 2026-08-25): resuelve el intercambio completo (paridad real vía
/// `resolverIntercambioCompleto`, combateMultiple.ts § 4), escribe condición/energía de AMBOS
/// lados (el atacante también puede recibir un contragolpe, a diferencia del 1v1 donde quien tiene
/// la iniciativa casi nunca recibe daño en el mismo intercambio), narra y avanza el encuentro.
///
/// Bug real (2026-08-25, cazado en partida real vía `PrismaClientKnownRequestError` de timeout):
/// esta función solía recibir un `tx` ya abierto por el caller y hacía TODO dentro — incluida la
/// llamada real a `narrarFn` (Ollama, 9-25s medidos en vivo). El timeout por defecto de una
/// transacción interactiva de Prisma es 5000ms, así que cualquier combate real reventaba con la
/// transacción ya cerrada. Ahora recibe el `PrismaClient` de verdad (no un `tx`) y abre DOS
/// transacciones cortas propias (solo escritura, sin narración dentro) alrededor de la llamada a
/// `narrarFn`, que corre fuera de cualquier transacción — mismo criterio que ya usa
/// `narrateAndPersistTurn` para `appendSessionFacts`/`captureLiveTeacherExample`.
async function ejecutarIntercambioYAvanzar(params: EjecutarIntercambioParams): Promise<TurnoAutonomoResultado> {
  const { prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque, atacanteRol, dualWieldBonus, defensor, weaponNamesPorDefecto, narrarFn } = params;
  const datosDefensor = await datosVivosDe(prisma, worldId, saveId, defensor, weaponNamesPorDefecto);
  if (!datosDefensor || datosDefensor.condicionFisica === 'CONVALECIENTE' || datosDefensor.condicionFisica === 'MUERTO') {
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);
  }
  const habilidadDefensa = chooseNpcAbility(datosDefensor.abilities, 'defensa', datosDefensor.energia, Math.random, datosDefensor.usageCounts);

  const resultado = resolverIntercambioCompleto(
    { nombre: datosAtacante.nombre, attributes: datosAtacante.attributes, condicionFisica: datosAtacante.condicionFisica },
    habilidadAtaque,
    atacanteRol,
    15,
    { nombre: datosDefensor.nombre, attributes: datosDefensor.attributes, condicionFisica: datosDefensor.condicionFisica },
    habilidadDefensa,
    15,
    dualWieldBonus,
  );

  const nuevaEnergiaAtacante = nextEnergia({
    current: datosAtacante.energia,
    max: energiaMaxFor(datosAtacante.attributes.constitucion),
    abilityEnergyCost: habilidadAtaque.energyCost,
    abilityEnergyRegen: habilidadAtaque.energyRegen + resultado.atacanteRecuperacionExtra,
    exchangeHappened: true,
    restSucceeds: false,
    restAttempted: false,
    itemRestoreAmount: null,
  });
  const nuevaEnergiaDefensor = nextEnergia({
    current: datosDefensor.energia,
    max: energiaMaxFor(datosDefensor.attributes.constitucion),
    abilityEnergyCost: habilidadDefensa.energyCost,
    abilityEnergyRegen: habilidadDefensa.energyRegen + resultado.defensorRecuperacionExtra,
    exchangeHappened: true,
    restSucceeds: false,
    restAttempted: false,
    itemRestoreAmount: null,
  });

  // Fase 3 § 3a de efectos de clase (2026-08-27) — mismo cuidado de orden que Fase 2
  // (turnResolution.ts § resolveCombatExchangePhase): decrementar los efectos YA activos antes de
  // entrar a este intercambio y añadir el nuevo (si lo hay) SIN decrementarlo — listo para leerse a
  // plena fuerza en el próximo intercambio.
  const defensorActiveEffectsNext = resultado.nuevoEfectoDefensor
    ? [...decrementActiveEffects(datosDefensor.activeEffects), resultado.nuevoEfectoDefensor]
    : decrementActiveEffects(datosDefensor.activeEffects);
  const atacanteActiveEffectsNext = resultado.nuevoEfectoAtacante
    ? [...decrementActiveEffects(datosAtacante.activeEffects), resultado.nuevoEfectoAtacante]
    : decrementActiveEffects(datosAtacante.activeEffects);

  // CONTROL real (Fase 3 § 3a) — quien disparó CONTROL controla al OTRO lado, nunca a sí mismo (ver
  // comentario de `ResultadoIntercambioCompleto.atacanteControlDisparado/defensorControlDisparado`).
  // Cifra fija de rondas (mismo criterio de simplificación que el resto de Fase 2/3: no hay ninguna
  // fila real de `clases.md` que combine CONTROL con una escalada de turnos por margen).
  const controlTargetId = resultado.atacanteControlDisparado ? defensor.id : resultado.defensorControlDisparado ? actual.id : null;

  // EXPULSAR real (Fase 3 § 3e, 2026-08-27) — Embate de Escudo expulsa a QUIEN RECIBE EL GOLPE (el
  // defensor de este intercambio, nunca a sí mismo) — cifra fija de rondas, ver comentario de
  // `ResultadoIntercambioCompleto.expulsarTriggered`.
  const expulsarTargetId = resultado.expulsarTriggered ? defensor.id : null;

  // "Analizar Rival" real en combate múltiple (2026-08-27, cierra el hueco que dejó Fase A/B: se
  // calculaba y se descartaba) — el atacante analiza siempre al defensor de ESTE intercambio (mismo
  // alcance exacto que el motor 1v1: `resolverIntercambioCompleto` solo dispara `analizarRivalExito`
  // desde el lado atacante-utilidad, nunca hay un equivalente simétrico "el defensor analiza al
  // atacante" en el código real — límite ya existente, no introducido aquí). Miembro de grupo
  // (`condicionFisicaGrupo !== null`) escribe en su PROPIO `CombatParticipant.analizadoGrupo`, nunca
  // en el `NpcState` compartido de la especie (ver comentario largo de la columna).
  const analizarTargetId = resultado.analizarRivalExito ? defensor.id : null;

  // MULTIPLE real (Fase 3 § 3b, 2026-08-27) — el mismo golpe también alcanza a un objetivo extra
  // del mismo bando que el defensor principal (aleatorio, nunca el mismo), golpe directo sin
  // tirada de defensa propia (mismo mecanismo que un golpe gratis) — ver comentario de
  // `ResultadoIntercambioCompleto.multipleTriggered`. Solo cubre `ATAQUE`+`MULTIPLE` (un enemigo
  // extra); `AUMENTO`/`AGUANTE`+`MULTIPLE` (buff a aliados) queda sin construir a propósito.
  let objetivoExtraParticipant: (ParticipantRef & { bando: Bando }) | null = null;
  let datosObjetivoExtra: DatosCombatiente | null = null;
  let nuevaCondicionExtra: CondicionFisica | null = null;
  let objetivoExtraActiveEffectsNext: ActiveEffect[] | null = null;
  if (resultado.multipleTriggered) {
    const defensorBando = encounter.participantes.find((p) => p.id === defensor.id)?.bando;
    const candidatosBando = encounter.participantes.filter((p) => p.bando === defensorBando);
    const datosPorCandidato = new Map<string, DatosCombatiente | null>();
    await Promise.all(candidatosBando.map(async (p) => datosPorCandidato.set(p.id, await datosVivosDe(prisma, worldId, saveId, p, weaponNamesPorDefecto))));
    const candidatosObj: ObjetivoCandidato[] = candidatosBando
      .filter((p) => datosPorCandidato.get(p.id))
      .map((p) => ({ participantId: p.id, condicionFisica: datosPorCandidato.get(p.id)!.condicionFisica }));
    const extraId = objetivoExtraFor(defensor.id, candidatosObj, Math.random);
    const extraParticipant = extraId ? (candidatosBando.find((p) => p.id === extraId) ?? null) : null;
    const extraDatos = extraId ? (datosPorCandidato.get(extraId) ?? null) : null;
    if (extraParticipant && extraDatos) {
      objetivoExtraParticipant = extraParticipant;
      datosObjetivoExtra = extraDatos;
      nuevaCondicionExtra = nextCondicionForAttack(habilidadAtaque.effects, extraDatos.condicionFisica);
      // Mismo efecto (si lo hay) que el defensor principal — la ficha real (Zancada Perforante)
      // describe la debilidad propagándose "a todos los enemigos", no una copia distinta por cada uno.
      objetivoExtraActiveEffectsNext = resultado.nuevoEfectoDefensor
        ? [...decrementActiveEffects(extraDatos.activeEffects), resultado.nuevoEfectoDefensor]
        : decrementActiveEffects(extraDatos.activeEffects);
    }
  }

  // DESVIAR real (Fase 3 § 3c, 2026-08-27) — el golpe entrante (que de todos modos NO iba a
  // conectar con la defensora, `defensorRecibeGolpe` ya es `false` en este desenlace) se redirige a
  // un objetivo aleatorio del bando del ATACANTE original (nunca el de la defensora, a diferencia
  // de MULTIPLE) — golpe directo con las propias `habilidadAtaque.effects`, mismo mecanismo que un
  // golpe gratis. Sin `DEBILIDAD` combinada (Comunión Salvaje no describe cifra propia, no se
  // construye — ver comentario de `desviarTriggered`).
  let objetivoDesviadoParticipant: (ParticipantRef & { bando: Bando }) | null = null;
  let datosObjetivoDesviado: DatosCombatiente | null = null;
  let nuevaCondicionDesviado: CondicionFisica | null = null;
  if (resultado.desviarTriggered) {
    const atacanteBando = encounter.participantes.find((p) => p.id === actual.id)?.bando;
    const candidatosBando = encounter.participantes.filter((p) => p.bando === atacanteBando);
    const datosPorCandidato = new Map<string, DatosCombatiente | null>();
    await Promise.all(candidatosBando.map(async (p) => datosPorCandidato.set(p.id, await datosVivosDe(prisma, worldId, saveId, p, weaponNamesPorDefecto))));
    const candidatosObj: ObjetivoCandidato[] = candidatosBando
      .filter((p) => datosPorCandidato.get(p.id))
      .map((p) => ({ participantId: p.id, condicionFisica: datosPorCandidato.get(p.id)!.condicionFisica }));
    const desviadoId = objetivoExtraFor(actual.id, candidatosObj, Math.random);
    const desviadoParticipant = desviadoId ? (candidatosBando.find((p) => p.id === desviadoId) ?? null) : null;
    const desviadoDatos = desviadoId ? (datosPorCandidato.get(desviadoId) ?? null) : null;
    if (desviadoParticipant && desviadoDatos) {
      objetivoDesviadoParticipant = desviadoParticipant;
      datosObjetivoDesviado = desviadoDatos;
      nuevaCondicionDesviado = nextCondicionForAttack(habilidadAtaque.effects, desviadoDatos.condicionFisica);
    }
  }

  // OCULTACION real (Fase 3 § 3c, 2026-08-27) — quien la dispara se oculta A SÍ MISMO (nunca al
  // rival). Se pierde de inmediato si el propio atacante ataca mientras ya estaba oculto (ficha
  // real de Camuflaje) — mutuamente excluyentes en la práctica (disparar OCULTACION exige
  // `atacanteRol==='utilidad'`, romperla exige `atacanteRol==='ataque'`), el guard es solo defensivo.
  const ocultarSelfId = resultado.atacanteOcultacionDisparada ? actual.id : resultado.defensorOcultacionDisparada ? defensor.id : null;
  const rompeOcultacionAtacanteId = atacanteRol === 'ataque' && actual.ocultoPorRondas ? actual.id : null;
  // Bug real cazado en integración (2026-08-27): `ejecutarIntercambioYAvanzar` SOLO se llama para
  // duelos mutuos reales (`esDuelo`, ver `resolverTurnoAutonomo`/`resolverTurnoJugador`) — el
  // propio `objetivoActualId` del defensor YA apunta a `actual`, es decir, el defensor TAMBIÉN lo
  // "atacó" con su propia elección de esta ronda (aunque en ESTE intercambio concreto actúe
  // defendiéndose). Sin este segundo chequeo, un oculto que solo tenía un candidato posible (y por
  // tanto reclamaba de vuelta a quien lo evitaba, anulando la exclusión vía la regla de reciprocidad
  // de `resolverEnganchesRonda`) se quedaba "oculto" para siempre pese a haber elegido combatir.
  const rompeOcultacionDefensorId = defensor.ocultoPorRondas ? defensor.id : null;

  // Transacción corta #1 — solo escritura, sin narración dentro: condición/energía de ambos lados
  // quedan atómicas entre sí, pero la transacción se cierra antes de llamar a Ollama.
  await prisma.$transaction(async (tx) => {
    await escribirCondicionYEnergia(
      tx,
      saveId,
      defensor,
      resultado.defensorRecibeGolpe ? resultado.nuevaCondicionDefensor : null,
      nuevaEnergiaDefensor,
      habilidadDefensa.name,
      datosDefensor.usageCounts,
      defensorActiveEffectsNext,
    );
    await escribirCondicionYEnergia(
      tx,
      saveId,
      actual,
      resultado.atacanteRecibeGolpe ? resultado.nuevaCondicionAtacante : null,
      nuevaEnergiaAtacante,
      habilidadAtaque.name,
      datosAtacante.usageCounts,
      atacanteActiveEffectsNext,
    );
    if (objetivoExtraParticipant && datosObjetivoExtra) {
      await escribirCondicionYEnergia(tx, saveId, objetivoExtraParticipant, nuevaCondicionExtra, null, null, datosObjetivoExtra.usageCounts, objetivoExtraActiveEffectsNext);
    }
    if (objetivoDesviadoParticipant && datosObjetivoDesviado) {
      await escribirCondicionYEnergia(tx, saveId, objetivoDesviadoParticipant, nuevaCondicionDesviado, null, null, datosObjetivoDesviado.usageCounts, decrementActiveEffects(datosObjetivoDesviado.activeEffects));
    }
    if (controlTargetId) await tx.combatParticipant.update({ where: { id: controlTargetId }, data: { controladoPorRondas: CONTROL_RONDAS } });
    if (ocultarSelfId) await tx.combatParticipant.update({ where: { id: ocultarSelfId }, data: { ocultoPorRondas: OCULTACION_RONDAS } });
    if (rompeOcultacionAtacanteId && rompeOcultacionAtacanteId !== ocultarSelfId) {
      await tx.combatParticipant.update({ where: { id: rompeOcultacionAtacanteId }, data: { ocultoPorRondas: null } });
    }
    if (rompeOcultacionDefensorId && rompeOcultacionDefensorId !== ocultarSelfId) {
      await tx.combatParticipant.update({ where: { id: rompeOcultacionDefensorId }, data: { ocultoPorRondas: null } });
    }
    if (expulsarTargetId) await tx.combatParticipant.update({ where: { id: expulsarTargetId }, data: { expulsadoPorRondas: EXPULSAR_RONDAS } });
    if (analizarTargetId) {
      if (defensor.condicionFisicaGrupo !== null) {
        await tx.combatParticipant.update({ where: { id: analizarTargetId }, data: { analizadoGrupo: true } });
      } else if (defensor.tipo === 'NPC' && defensor.npcId) {
        await tx.npcState.upsert({
          where: { saveId_npcId_scope: { saveId, npcId: defensor.npcId, scope: defensor.npcScope } },
          create: { saveId, npcId: defensor.npcId, scope: defensor.npcScope, analizado: true },
          update: { analizado: true },
        });
      }
    }
  });

  // Narración real (Ollama) FUERA de cualquier transacción — es la llamada lenta que reventaba el
  // timeout de 5000ms cuando vivía dentro de la transacción de arriba.
  let exchangeBlockAugmentado = resultado.exchangeBlock;
  if (objetivoExtraParticipant && datosObjetivoExtra) {
    exchangeBlockAugmentado += ` EFECTO DE HABILIDAD — YA RESUELTO: el mismo golpe también alcanza de lleno a ${datosObjetivoExtra.nombre}, sin oposición real — narra que el ataque impacta a los dos.`;
  }
  if (objetivoDesviadoParticipant && datosObjetivoDesviado) {
    exchangeBlockAugmentado += ` EFECTO DE HABILIDAD — YA RESUELTO: ${datosDefensor.nombre} desvía el golpe entrante, que en vez de fallar sin más alcanza de lleno a ${datosObjetivoDesviado.nombre} — narra la desviación, no un fallo simple.`;
  }
  if (ocultarSelfId === actual.id) {
    exchangeBlockAugmentado += ` EFECTO DE HABILIDAD — YA RESUELTO: ${datosAtacante.nombre} queda oculto del combate un par de turnos — narra que se camufla o se retira de la vista, sin desaparecer del todo.`;
  } else if (ocultarSelfId === defensor.id) {
    exchangeBlockAugmentado += ` EFECTO DE HABILIDAD — YA RESUELTO: ${datosDefensor.nombre} queda oculto del combate un par de turnos — narra que se camufla o se retira de la vista, sin desaparecer del todo.`;
  }
  if (expulsarTargetId) {
    exchangeBlockAugmentado += ` EFECTO DE HABILIDAD — YA RESUELTO: el golpe además empuja a ${datosDefensor.nombre} fuera del alcance del combate un par de turnos — narra el empujón/expulsión física, no solo el impacto.`;
  }
  const narracion = await narrarFn({
    atacanteNombre: datosAtacante.nombre,
    defensorNombre: datosDefensor.nombre,
    habilidadNombre: habilidadAtaque.name,
    exchangeBlock: exchangeBlockAugmentado,
    combatBothMissed: resultado.combatBothMissed,
    combatRealHitLanded: resultado.combatRealHitLanded,
    defensorQuedaConvalecienteEsteTurno: resultado.defensorRecibeGolpe && resultado.nuevaCondicionDefensor === 'CONVALECIENTE',
    defensorMuereEsteTurno: resultado.defensorRecibeGolpe && resultado.nuevaCondicionDefensor === 'MUERTO',
  });

  // Transacción corta #2 — relee condición fresca de todos y decide fin de combate/retargeting.
  const avance = await prisma.$transaction((tx) => avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto));

  const caidos: ParticipanteCaidoInfo[] = [];
  const defensorCae = resultado.defensorRecibeGolpe && (resultado.nuevaCondicionDefensor === 'CONVALECIENTE' || resultado.nuevaCondicionDefensor === 'MUERTO');
  if (defensorCae) caidos.push({ tipo: defensor.tipo, npcId: defensor.npcId, nuevaCondicion: resultado.nuevaCondicionDefensor });
  const atacanteCae = resultado.atacanteRecibeGolpe && (resultado.nuevaCondicionAtacante === 'CONVALECIENTE' || resultado.nuevaCondicionAtacante === 'MUERTO');
  if (atacanteCae) caidos.push({ tipo: actual.tipo, npcId: actual.npcId, nuevaCondicion: resultado.nuevaCondicionAtacante });
  if (objetivoExtraParticipant && nuevaCondicionExtra && (nuevaCondicionExtra === 'CONVALECIENTE' || nuevaCondicionExtra === 'MUERTO')) {
    caidos.push({ tipo: objetivoExtraParticipant.tipo, npcId: objetivoExtraParticipant.npcId, nuevaCondicion: nuevaCondicionExtra });
  }
  if (objetivoDesviadoParticipant && nuevaCondicionDesviado && (nuevaCondicionDesviado === 'CONVALECIENTE' || nuevaCondicionDesviado === 'MUERTO')) {
    caidos.push({ tipo: objetivoDesviadoParticipant.tipo, npcId: objetivoDesviadoParticipant.npcId, nuevaCondicion: nuevaCondicionDesviado });
  }

  // INVOCACION real (Fase 3 § 3d, 2026-08-27) — si este intercambio cruzó de ronda, resuelve ya
  // (narrado, fuera de transacción) el golpe de cualquier tótem con turno pendiente.
  const totems = await resolverTotemsPendientes(prisma, worldId, saveId, encounterId, avance.totemsQueAtacan, weaponNamesPorDefecto, narrarFn);
  caidos.push(...totems.caidos);

  return {
    narracion,
    atacanteNombre: datosAtacante.nombre,
    defensorNombre: datosDefensor.nombre,
    encounterTerminado: avance.terminado || totems.encounterTerminado,
    caidos,
    narracionesExtra: totems.narraciones,
  };
}

/// Golpe gratis, sin oposición real (2026-08-26, docs/21-roadmap.md § Fase 3, "objetivo
/// individual") — a diferencia de `ejecutarIntercambioYAvanzar`, el objetivo NO tira su propia
/// defensa: el golpe conecta directo (`nextCondicionForAttack`), salvo que tenga una habilidad
/// real con `AGUANTE`+`MULTIPLE` disponible (hoy no existe ninguna sembrada, ver Fase 1 del
/// roadmap — esta rama queda lista para cuando exista, pero no dispara todavía en partida real).
/// Mismo patrón de 2 transacciones cortas + narración fuera de ambas que `ejecutarIntercambioYAvanzar`
/// (ver su comentario de cabecera sobre el bug de timeout de 2026-08-25).
async function ejecutarGolpeGratisYAvanzar(params: TurnoAutonomoBaseParams & { defensor: ParticipantRef }): Promise<TurnoAutonomoResultado> {
  const { prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque, defensor, weaponNamesPorDefecto, narrarFn } = params;
  const datosDefensor = await datosVivosDe(prisma, worldId, saveId, defensor, weaponNamesPorDefecto);
  if (!datosDefensor || datosDefensor.condicionFisica === 'CONVALECIENTE' || datosDefensor.condicionFisica === 'MUERTO') {
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);
  }

  const aguanteMultiple = datosDefensor.abilities.find(
    (a) =>
      a.rol === 'defensa' &&
      a.effects.includes('AGUANTE') &&
      a.effects.includes('MULTIPLE') &&
      a.energyCost <= datosDefensor.energia &&
      (a.maxUsesPerCombat == null || (datosDefensor.usageCounts[a.name] ?? 0) < a.maxUsesPerCombat),
  );
  if (aguanteMultiple) {
    // Única forma real de defenderse de un golpe gratis — se resuelve como un intercambio
    // contestado normal, mismo camino que un duelo real.
    return ejecutarIntercambioYAvanzar({
      prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque,
      atacanteRol: 'ataque', dualWieldBonus: false, defensor, weaponNamesPorDefecto, narrarFn,
    });
  }

  const nuevaCondicionDefensor = nextCondicionForAttack(habilidadAtaque.effects, datosDefensor.condicionFisica);
  const nuevaEnergiaAtacante = nextEnergia({
    current: datosAtacante.energia,
    max: energiaMaxFor(datosAtacante.attributes.constitucion),
    abilityEnergyCost: habilidadAtaque.energyCost,
    abilityEnergyRegen: habilidadAtaque.energyRegen,
    exchangeHappened: true,
    restSucceeds: false,
    restAttempted: false,
    itemRestoreAmount: null,
  });

  // Fase 3 § 3a de efectos de clase (2026-08-27) — un golpe gratis también es un intercambio real
  // (un turno que pasa), así que los efectos activos de ambos lados se decrementan igual que en
  // `ejecutarIntercambioYAvanzar`. Sin push nuevo aquí: este camino no pasa por
  // `resolverIntercambioCompleto` (no hay margen que gatear AUMENTO/DEBILIDAD), ver comentario de
  // cabecera de esta función.
  const defensorActiveEffectsNext = decrementActiveEffects(datosDefensor.activeEffects);
  const atacanteActiveEffectsNext = decrementActiveEffects(datosAtacante.activeEffects);
  // OCULTACION real (Fase 3 § 3c) — un golpe gratis es, por definición, `actual` atacando: se
  // pierde de inmediato si ya estaba oculto (mismo criterio que `ejecutarIntercambioYAvanzar`).
  const rompeOcultacionId = actual.ocultoPorRondas ? actual.id : null;

  await prisma.$transaction(async (tx) => {
    await escribirCondicionYEnergia(tx, saveId, defensor, nuevaCondicionDefensor, null, null, datosDefensor.usageCounts, defensorActiveEffectsNext);
    await escribirCondicionYEnergia(tx, saveId, actual, null, nuevaEnergiaAtacante, habilidadAtaque.name, datosAtacante.usageCounts, atacanteActiveEffectsNext);
    if (rompeOcultacionId) await tx.combatParticipant.update({ where: { id: rompeOcultacionId }, data: { ocultoPorRondas: null } });
  });

  const narracion = await narrarFn({
    atacanteNombre: datosAtacante.nombre,
    defensorNombre: datosDefensor.nombre,
    habilidadNombre: habilidadAtaque.name,
    exchangeBlock: `EFECTO DE HABILIDAD — YA RESUELTO: ${datosAtacante.nombre} golpea a ${datosDefensor.nombre} sin oposición real (${datosDefensor.nombre} está ocupado defendiéndose de otro rival este mismo instante) — el golpe conecta de lleno, sin tirada de por medio.`,
    combatBothMissed: false,
    combatRealHitLanded: true,
    defensorQuedaConvalecienteEsteTurno: nuevaCondicionDefensor === 'CONVALECIENTE',
    defensorMuereEsteTurno: nuevaCondicionDefensor === 'MUERTO',
  });

  const avance = await prisma.$transaction((tx) => avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto));

  const caidos: ParticipanteCaidoInfo[] = [];
  if (nuevaCondicionDefensor === 'CONVALECIENTE' || nuevaCondicionDefensor === 'MUERTO') {
    caidos.push({ tipo: defensor.tipo, npcId: defensor.npcId, nuevaCondicion: nuevaCondicionDefensor });
  }

  const totems = await resolverTotemsPendientes(prisma, worldId, saveId, encounterId, avance.totemsQueAtacan, weaponNamesPorDefecto, narrarFn);
  caidos.push(...totems.caidos);

  return {
    narracion,
    atacanteNombre: datosAtacante.nombre,
    defensorNombre: datosDefensor.nombre,
    encounterTerminado: avance.terminado || totems.encounterTerminado,
    caidos,
    narracionesExtra: totems.narraciones,
  };
}

/// INVOCACION real (Fase 3 § 3d, 2026-08-27) — golpe de UN tótem concreto al cruzar de ronda
/// (`avanzarYComprobarFin` ya decidió que le toca, ver `totemsQueAtacan`) — mismo mecanismo directo
/// que un golpe gratis (sin tirada de defensa propia, "aguanta 1 golpe" es sobre lo que EL TÓTEM
/// recibe, no sobre cómo golpea). El objetivo es aleatorio del bando CONTRARIO al de su invocador
/// (reutiliza `elegirObjetivo` con inteligencia baja fija — el tótem "no piensa", ver su bio de
/// catálogo). NUNCA llama a `avanzarYComprobarFin` (eso ya lo hizo el turno normal que lo trajo
/// aquí, ver `resolverTotemsPendientes`) — solo escribe la condición del objetivo y narra, con sus
/// propias 2 transacciones cortas + narración fuera (mismo patrón de seguridad de todo este
/// archivo). `null` si el tótem ya no tiene objetivo vivo al que golpear (bando contrario agotado
/// justo antes de que le tocara) — no hay golpe que narrar en ese caso.
async function ejecutarAtaqueTotemYAvanzar(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  totem: ParticipantRef & { bando: Bando },
  participantes: (ParticipantRef & { bando: Bando })[],
  weaponNamesPorDefecto: string[],
  narrarFn: typeof narrarTurnoCombateMultiple,
): Promise<{ narracion: string; caido: ParticipanteCaidoInfo | null } | null> {
  const datosTotem = await datosVivosDe(prisma, worldId, saveId, totem, weaponNamesPorDefecto);
  if (!datosTotem) return null;
  const habilidadTotem = chooseNpcAbility(datosTotem.abilities, 'ataque', datosTotem.energia, Math.random, datosTotem.usageCounts);

  const candidatos = participantes.filter((p) => p.bando !== totem.bando);
  const datosPorCandidato = new Map<string, DatosCombatiente | null>();
  await Promise.all(candidatos.map(async (p) => datosPorCandidato.set(p.id, await datosVivosDe(prisma, worldId, saveId, p, weaponNamesPorDefecto))));
  // `esJugadorReal` (2026-08-29, mismo hallazgo) — un tótem con solo la jugadora convaleciente
  // como candidato del bando contrario debe poder seguir eligiéndola.
  const candidatosObj: ObjetivoCandidato[] = candidatos
    .filter((p) => datosPorCandidato.get(p.id))
    .map((p) => ({ participantId: p.id, condicionFisica: datosPorCandidato.get(p.id)!.condicionFisica, esJugadorReal: p.tipo === 'JUGADOR' }));
  const objetivoId = elegirObjetivo(0, candidatosObj, Math.random);
  const objetivo = objetivoId ? candidatos.find((p) => p.id === objetivoId) : null;
  const datosObjetivo = objetivoId ? datosPorCandidato.get(objetivoId) : null;
  if (!objetivo || !datosObjetivo) return null;

  const nuevaCondicionObjetivo = nextCondicionForAttack(habilidadTotem.effects, datosObjetivo.condicionFisica);

  await prisma.$transaction(async (tx) => {
    await escribirCondicionYEnergia(tx, saveId, objetivo, nuevaCondicionObjetivo, null, null, datosObjetivo.usageCounts, decrementActiveEffects(datosObjetivo.activeEffects));
  });

  const narracion = await narrarFn({
    atacanteNombre: datosTotem.nombre,
    defensorNombre: datosObjetivo.nombre,
    habilidadNombre: habilidadTotem.name,
    exchangeBlock: `EFECTO DE HABILIDAD — YA RESUELTO: ${datosTotem.nombre} golpea a ${datosObjetivo.nombre} sin oposición real, canalizando su ataque desde donde quedó clavado — el golpe conecta de lleno, sin tirada de por medio.`,
    combatBothMissed: false,
    combatRealHitLanded: true,
    defensorQuedaConvalecienteEsteTurno: nuevaCondicionObjetivo === 'CONVALECIENTE',
    defensorMuereEsteTurno: nuevaCondicionObjetivo === 'MUERTO',
  });

  const caido: ParticipanteCaidoInfo | null =
    nuevaCondicionObjetivo === 'CONVALECIENTE' || nuevaCondicionObjetivo === 'MUERTO'
      ? { tipo: objetivo.tipo, npcId: objetivo.npcId, nuevaCondicion: nuevaCondicionObjetivo }
      : null;
  return { narracion, caido };
}

/// INVOCACION real (Fase 3 § 3d, 2026-08-27) — resuelve TODOS los tótems que `avanzarYComprobarFin`
/// marcó como pendientes tras el cruce de ronda que acaba de pasar (como mucho 1 por bando, ver
/// candado de "no invocar más de uno del mismo tipo" — nunca más de 2 en total con el catálogo
/// sembrado hoy), agregando sus narraciones/caídos al resultado del turno que los trajo aquí. Si
/// el golpe de un tótem deja a un bando entero sin objetivos válidos, comprueba fin de combate por
/// su cuenta (`avanzarYComprobarFin` ya avanzó `turnoActual`/`ronda` antes de saber esto — un
/// tótem puede rematar al último enemigo del bando contrario en el mismo instante en que empieza
/// la ronda nueva).
async function resolverTotemsPendientes(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  totemIds: string[],
  weaponNamesPorDefecto: string[],
  narrarFn: typeof narrarTurnoCombateMultiple,
): Promise<{ narraciones: string[]; caidos: ParticipanteCaidoInfo[]; encounterTerminado: boolean }> {
  if (totemIds.length === 0) return { narraciones: [], caidos: [], encounterTerminado: false };
  const narraciones: string[] = [];
  const caidos: ParticipanteCaidoInfo[] = [];
  for (const totemId of totemIds) {
    const participantes = await prisma.combatParticipant.findMany({ where: { encounterId } });
    const totem = participantes.find((p) => p.id === totemId) as (ParticipantRef & { bando: Bando }) | undefined;
    if (!totem || (totem.invocacionVidaRestante ?? 0) <= 0) continue; // destruido entre medias por otro tótem/efecto
    const resultado = await ejecutarAtaqueTotemYAvanzar(prisma, worldId, saveId, totem, participantes as (ParticipantRef & { bando: Bando })[], weaponNamesPorDefecto, narrarFn);
    // Expira DESPUÉS de atacar (ver comentario largo en `avanzarYComprobarFin` sobre el bug real
    // de orden cazado en integración) — quien llega aquí con `invocacionRondasRestantes` ya en 0
    // (su último turno) agota su duración justo ahora, tras el golpe, nunca antes.
    if (totem.invocacionRondasRestantes === 0) {
      await prisma.combatParticipant.update({ where: { id: totem.id }, data: { invocacionVidaRestante: 0 } });
    }
    if (!resultado) continue;
    narraciones.push(resultado.narracion);
    if (resultado.caido) caidos.push(resultado.caido);
  }
  const participantesFrescos = await prisma.combatParticipant.findMany({ where: { encounterId } });
  const datosPorParticipante = await Promise.all(participantesFrescos.map(async (p) => ({ p, datos: await datosVivosDe(prisma, worldId, saveId, p, weaponNamesPorDefecto) })));
  const candidatosPorBando = (bando: Bando): ObjetivoCandidato[] =>
    datosPorParticipante
      .filter(({ p }) => p.bando === bando)
      .map(({ p, datos }) => ({ participantId: p.id, condicionFisica: datos?.condicionFisica ?? 'MUERTO', esJugadorReal: p.tipo === 'JUGADOR' }));
  const terminado = !bandoSigueEnCombate(candidatosPorBando('JUGADOR')) || !bandoSigueEnCombate(candidatosPorBando('ENEMIGO'));
  if (terminado) {
    await prisma.combatEncounter.update({ where: { id: encounterId }, data: { estado: 'RESUELTO', resolvedAt: new Date() } });
  }
  return { narraciones, caidos, encounterTerminado: terminado };
}

/// INVOCACION real (Fase 3 § 3d, 2026-08-27, docs/21-roadmap.md) — invocar consume el turno
/// entero del invocador (decisión explícita de diseño: sin golpe propio ese mismo turno, ver
/// comentario largo en `resolverTurnoJugador`/`resolverTurnoAutonomo`, punto de intercepción antes
/// de llegar a `ejecutarIntercambioYAvanzar`/`ejecutarGolpeGratisYAvanzar`). Solo Tótem de Guerra
/// sembrado hoy (candado real de su propia ficha: "NO se puede invocar más de un tótem de este
/// tipo" — comprobado buscando otra invocación viva del mismo `npcId` para el mismo invocador
/// antes de crear una nueva; si ya hay una, el turno se pierde sin más, mismo criterio que
/// `avanzarSinAtacar`). El tótem NO se inserta en `ordenIniciativa` (reordenar ese array en caliente
/// exigiría tocar la aritmética de `turnoActual % length` en pleno combate, fuera de alcance —
/// decisión explícita, ver plan de sesión) — actúa fuera de la cola, una vez al cruzar cada ronda
/// siguiente mientras le queden `invocacionRondasRestantes` (`actuarInvocacionesYAvanzar`, llamado
/// desde `avanzarYComprobarFin`, mismo punto donde ya se decrementan CONTROL/OCULTACION).
async function invocarTotemYAvanzar(
  params: Omit<TurnoAutonomoBaseParams, 'actual' | 'habilidadAtaque'> & { actual: ParticipantRef & { bando: Bando }; habilidadInvocacion: HabilidadParaIntercambio },
): Promise<TurnoAutonomoResultado> {
  const { prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadInvocacion, weaponNamesPorDefecto, narrarFn } = params;
  const totemNpc = await prisma.npc.findFirst({ where: { worldId, slug: TOTEM_DE_GUERRA_SLUG } });
  if (!totemNpc) {
    // Catálogo sin sembrar todavía (entorno recién creado sin `npm run seed-catalog`) — se pierde
    // el turno en vez de reventar el combate real, mismo criterio defensivo que el resto del motor.
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);
  }
  const yaHayUno = encounter.participantes.some(
    (p) => p.tipo === 'INVOCACION' && p.npcId === totemNpc.id && p.invocacionInvocadorId === actual.id && (p.invocacionVidaRestante ?? 0) > 0,
  );
  if (yaHayUno) {
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);
  }

  await prisma.$transaction(async (tx) => {
    await tx.combatParticipant.create({
      data: {
        encounterId,
        bando: actual.bando,
        tipo: 'INVOCACION',
        npcId: totemNpc.id,
        invocacionVidaRestante: TOTEM_DE_GUERRA_VIDA,
        invocacionRondasRestantes: TOTEM_DE_GUERRA_RONDAS,
        invocacionInvocadorId: actual.id,
      },
    });
  });

  const narracion = await narrarFn({
    atacanteNombre: datosAtacante.nombre,
    defensorNombre: totemNpc.name,
    habilidadNombre: habilidadInvocacion.name,
    exchangeBlock: `EFECTO DE HABILIDAD — YA RESUELTO: ${datosAtacante.nombre} invoca a ${totemNpc.name}, clavándolo en tierra junto a sí — narra la invocación en sí, el tótem no ataca todavía este mismo turno.`,
    combatBothMissed: false,
    combatRealHitLanded: false,
    defensorQuedaConvalecienteEsteTurno: false,
    defensorMuereEsteTurno: false,
  });

  const avance = await prisma.$transaction((tx) => avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto));
  const totems = await resolverTotemsPendientes(prisma, worldId, saveId, encounterId, avance.totemsQueAtacan, weaponNamesPorDefecto, narrarFn);

  return {
    narracion,
    atacanteNombre: datosAtacante.nombre,
    defensorNombre: totemNpc.name,
    encounterTerminado: avance.terminado || totems.encounterTerminado,
    caidos: totems.caidos,
    narracionesExtra: totems.narraciones,
  };
}

/// Objetivo individual real (2026-08-26) — ¿ya se resolvió este emparejamiento en el turno
/// (anterior en la cola) de la otra mitad del duelo? Un duelo mutuo (`esDueloMutuo`-equivalente:
/// ambos `objetivoActualId` se apuntan entre sí) solo se resuelve UNA vez, en el turno de quien
/// tenga más iniciativa (posición más temprana en `ordenIniciativa`) — la otra mitad, cuando le
/// toque, no vuelve a atacar. Un golpe gratis (el objetivo no le devuelve la mirada) nunca cae
/// aquí, cada uno de los que lo intentan actúa de verdad, sin oposición real (ver
/// `ejecutarGolpeGratisYAvanzar`).
function dueloYaResueltoPorElOtro(ordenIniciativa: string[], actualId: string, defensor: ParticipantRef): boolean {
  if (defensor.objetivoActualId !== actualId) return false; // no es un duelo mutuo con actual
  return ordenIniciativa.indexOf(defensor.id) < ordenIniciativa.indexOf(actualId);
}

/// CONTROL real (Fase 3 § 3a, 2026-08-27) — mientras `actual.controladoPorRondas > 0`, ataca a un
/// aliado propio en vez de al enganche normal (que solo empareja bandos contrarios, ver
/// `resolverEnganchesRonda`) — "tomas el control del rival para que ataque a sus aliados", la ficha
/// de ambas habilidades reales (Opresión Mental, Control Rúnico). Devuelve `null` si no hay ningún
/// aliado vivo al que redirigir (combatiente solo en su bando) — el caller cae entonces al
/// comportamiento normal (`objetivoActualId`).
async function objetivoControladoPara(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  actual: ParticipantRef & { bando: Bando },
  encounter: { participantes: (ParticipantRef & { bando: Bando })[] },
  weaponNamesPorDefecto: string[],
): Promise<ParticipantRef | null> {
  if (!actual.controladoPorRondas || actual.controladoPorRondas <= 0) return null;
  const aliados = encounter.participantes.filter((p) => p.bando === actual.bando && p.id !== actual.id);
  const datosPorAliado = new Map<string, DatosCombatiente | null>();
  await Promise.all(aliados.map(async (p) => datosPorAliado.set(p.id, await datosVivosDe(prisma, worldId, saveId, p, weaponNamesPorDefecto))));
  // `esJugadorReal` (2026-08-29, mismo hallazgo) — la jugadora convaleciente puede ser un aliado
  // válido a redirigir con CONTROL (un enemigo forzando a otro a atacarla a ella).
  const candidatos: ObjetivoCandidato[] = aliados
    .filter((p) => datosPorAliado.get(p.id))
    .map((p) => ({ participantId: p.id, condicionFisica: datosPorAliado.get(p.id)!.condicionFisica, esJugadorReal: p.tipo === 'JUGADOR' }));
  if (objetivosValidosParaAtacar(candidatos).length === 0) return null;
  const datosActual = await datosVivosDe(prisma, worldId, saveId, actual, weaponNamesPorDefecto);
  const elegidoId = elegirObjetivo(datosActual?.attributes.inteligencia ?? 0, candidatos, Math.random);
  return elegidoId ? (aliados.find((p) => p.id === elegidoId) ?? null) : null;
}

/// Resuelve el turno del combatiente ACTUAL de la cola de iniciativa — solo si es NPC/COMPANION
/// (nunca JUGADOR, ver `resolverTurnoJugador` para ese caso). Avanza `turnoActual` y marca el
/// encuentro RESUELTO si un bando entero se queda sin objetivos válidos. Ya NO re-empareja en
/// cada turno (2026-08-26, objetivo individual real) — el enganche de la ronda entera ya quedó
/// fijo en `objetivoActualId` al empezarla (`calcularEnganchesRonda`), aquí solo se CONSUME.
///
/// `narrarFn` inyectable (por defecto la llamada real a Ollama) — cada llamada real mide 9-25s en
/// partida real (dev-server.log, 2026-08-25; la cifra de 30-220s de narrador.ts es de otro modelo),
/// así que los tests pasan un doble rápido en vez de esperar de verdad; mismo criterio de
/// inyección que `random` en el resto de funciones puras de esta sesión.
///
/// Recibe el `PrismaClient` de verdad, NO un `tx` — desde el bug de timeout de 2026-08-25 (ver
/// comentario de `ejecutarIntercambioYAvanzar`), ningún turno autónomo vive dentro de una única
/// transacción que abarque también la narración real.
export async function resolverTurnoAutonomo(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  weaponNamesPorDefecto: string[] = [],
  narrarFn: typeof narrarTurnoCombateMultiple = narrarTurnoCombateMultiple,
): Promise<TurnoAutonomoResultado | null> {
  const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
  if (encounter.estado === 'RESUELTO' || encounter.ordenIniciativa.length === 0) return null;
  // Objetivo individual real (2026-08-26) — ningún intercambio de la ronda puede resolverse en
  // firme mientras no se sepa el objetivo de la jugadora (puede "alcanzar hacia atrás" y cancelar
  // el de alguien que, en la cola, actúa antes que ella). Ver comentario largo en schema.prisma.
  if (encounter.esperandoEleccionJugadora) return null;

  const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
  const actual = encounter.participantes.find((p) => p.id === actualId);
  if (!actual || actual.tipo === 'JUGADOR') return null;

  const datosAtacante = await datosVivosDe(prisma, worldId, saveId, actual, weaponNamesPorDefecto);
  if (!datosAtacante || objetivosValidos([{ participantId: actual.id, condicionFisica: datosAtacante.condicionFisica }]).length === 0) {
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);
  }

  // CONTROL real (Fase 3 § 3a, 2026-08-27) — antes de mirar el enganche normal (que solo empareja
  // bandos contrarios): si está controlado, se le fuerza contra un aliado propio, resuelto siempre
  // como un intercambio contestado normal (el aliado SÍ se defiende, ver `objetivoControladoPara`).
  const objetivoControlado = await objetivoControladoPara(prisma, worldId, saveId, actual, encounter, weaponNamesPorDefecto);
  if (objetivoControlado) {
    const habilidadControlada = chooseNpcAbility(datosAtacante.abilities, 'ataque', datosAtacante.energia, Math.random, datosAtacante.usageCounts);
    // `habilidadControlada.rol` real (no 'ataque' fijo, consolidación 2026-09-01) — casi siempre
    // coincide, salvo la excepción real de CONTROL (chooseNpcAbility('ataque', ...) SÍ puede
    // devolver una utilidad con effects:['CONTROL'], ver comentario de esa función). Con 'ataque'
    // fijo, resolverIntercambioCompleto nunca entraba en la rama independiente que dispara
    // atacanteControlDisparado — mismo patrón ya correcto que el turno de la jugadora, línea 1224.
    return ejecutarIntercambioYAvanzar({
      prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque: habilidadControlada,
      atacanteRol: habilidadControlada.rol, dualWieldBonus: false, defensor: objetivoControlado, weaponNamesPorDefecto, narrarFn,
    });
  }

  const habilidadAtaque = chooseNpcAbility(datosAtacante.abilities, 'ataque', datosAtacante.energia, Math.random, datosAtacante.usageCounts);

  // INVOCACION real (Fase 3 § 3d, 2026-08-27) — antes de mirar el enganche normal (invocar no
  // necesita objetivo, consume el turno entero, ver comentario largo de `invocarTotemYAvanzar`).
  if (habilidadAtaque.effects.includes('INVOCACION')) {
    return invocarTotemYAvanzar({ prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadInvocacion: habilidadAtaque, weaponNamesPorDefecto, narrarFn });
  }

  const defensorId = actual.objetivoActualId;
  const defensor = defensorId ? encounter.participantes.find((p) => p.id === defensorId) : null;
  if (!defensor) return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);
  if (dueloYaResueltoPorElOtro(encounter.ordenIniciativa, actual.id, defensor)) return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);

  const esDuelo = defensor.objetivoActualId === actual.id;
  if (esDuelo) {
    // `habilidadAtaque.rol` real, mismo motivo que el comentario de arriba (objetivoControlado).
    return ejecutarIntercambioYAvanzar({
      prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque,
      atacanteRol: habilidadAtaque.rol, dualWieldBonus: false, defensor, weaponNamesPorDefecto, narrarFn,
    });
  }
  return ejecutarGolpeGratisYAvanzar({ prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque, defensor, weaponNamesPorDefecto, narrarFn });
}

export interface AccionJugadorCombate {
  /// Habilidad ya elegida por la jugadora (botón pulsado o fallback determinista), construida por
  /// el caller a partir de su `SavedAction` real — mismo patrón que `selectedAbility`/
  /// `abilityEffects`/`abilityRol` en turnResolution.ts, nunca recalculado aquí.
  habilidad: HabilidadParaIntercambio;
  dualWieldBonus?: boolean;
}

/// Resuelve el turno de la JUGADORA cuando le toca en la cola de iniciativa de un `CombatEncounter`
/// real — equivalente exacto de `resolverTurnoAutonomo` pero con la habilidad decidida por ella
/// (nunca `chooseNpcAbility`). `null` si no es su turno todavía (el caller debe seguir resolviendo
/// turnos autónomos hasta que sí lo sea, ver el bucle de integración en turnResolution.ts).
///
/// A quién ataca ya NO se manda aquí (2026-08-26, objetivo individual real) — se decide al
/// EMPEZAR la ronda, vía `fijarEleccionRondaJugador`, antes de que nada de esa ronda pueda
/// resolverse en firme (ver comentario de `resolverTurnoAutonomo`); esta función solo consume el
/// `objetivoActualId` ya fijo de la jugadora, exactamente igual que un NPC/COMPANION.
export async function resolverTurnoJugador(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  accion: AccionJugadorCombate,
  weaponNamesPorDefecto: string[] = [],
  narrarFn: typeof narrarTurnoCombateMultiple = narrarTurnoCombateMultiple,
): Promise<TurnoAutonomoResultado | null> {
  const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
  if (encounter.estado === 'RESUELTO' || encounter.ordenIniciativa.length === 0) return null;
  if (encounter.esperandoEleccionJugadora) return null;

  const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
  const actual = encounter.participantes.find((p) => p.id === actualId);
  if (!actual || actual.tipo !== 'JUGADOR') return null;

  const datosAtacante = await datosVivosDe(prisma, worldId, saveId, actual, weaponNamesPorDefecto);
  // Bug real jugando en vivo (2026-08-29, primer combate múltiple real): a diferencia de
  // `resolverTurnoAutonomo` (arriba, solo NPC/aliados — CONVALECIENTE ahí SÍ los saca del combate,
  // correcto), este guard usaba el mismo criterio estricto de `objetivosValidos` para la JUGADORA
  // REAL, bloqueándola de atacar en absoluto una vez CONVALECIENTE — combinado con el fix de
  // `bandoSigueEnCombate` (CONVALECIENTE ya no termina el combate para ella), esto la dejaba
  // atascada sin turno real y sin salir del combate. Mismo criterio que el motor 1v1 clásico
  // ("puedes seguir intentándolo, muy penalizado" — CombatPanel.tsx): solo MUERTO le impide seguir
  // atacando; la penalización real ya la aplica `resolveExchange`/`condicionMalus`
  // (`combatExchange.ts`) dentro del propio intercambio, no hace falta duplicarla aquí.
  if (!datosAtacante || datosAtacante.condicionFisica === 'MUERTO') {
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);
  }

  // CONTROL real (Fase 3 § 3a, 2026-08-27) — un enemigo puede controlar también a la JUGADORA (mismo
  // efecto, cualquier lado), ver comentario largo de `objetivoControladoPara`. Sin cambio de flujo
  // visible: sigue eligiendo/pulsando como siempre, el backend redirige en silencio (mismo criterio
  // que el enganche por ronda).
  const objetivoControlado = await objetivoControladoPara(prisma, worldId, saveId, actual, encounter, weaponNamesPorDefecto);
  if (objetivoControlado) {
    return ejecutarIntercambioYAvanzar({
      prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque: accion.habilidad,
      atacanteRol: accion.habilidad.rol, dualWieldBonus: accion.dualWieldBonus ?? false, defensor: objetivoControlado, weaponNamesPorDefecto, narrarFn,
    });
  }

  // INVOCACION real (Fase 3 § 3d, 2026-08-27) — ver comentario largo de `invocarTotemYAvanzar`.
  if (accion.habilidad.effects.includes('INVOCACION')) {
    return invocarTotemYAvanzar({ prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadInvocacion: accion.habilidad, weaponNamesPorDefecto, narrarFn });
  }

  const defensorId = actual.objetivoActualId;
  const defensor = defensorId ? encounter.participantes.find((p) => p.id === defensorId) : null;
  if (!defensor) return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);
  if (dueloYaResueltoPorElOtro(encounter.ordenIniciativa, actual.id, defensor)) return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto, narrarFn);

  const esDuelo = defensor.objetivoActualId === actual.id;
  if (!esDuelo) {
    return ejecutarGolpeGratisYAvanzar({ prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque: accion.habilidad, defensor, weaponNamesPorDefecto, narrarFn });
  }

  return ejecutarIntercambioYAvanzar({
    prisma,
    worldId,
    saveId,
    encounterId,
    encounter,
    actual,
    datosAtacante,
    habilidadAtaque: accion.habilidad,
    atacanteRol: accion.habilidad.rol,
    dualWieldBonus: accion.dualWieldBonus ?? false,
    defensor,
    weaponNamesPorDefecto,
    narrarFn,
  });
}

/// Grupo 3 § Mundo determinista, Capa 4 (2026-08-25) — disparo real: resuelve turnos autónomos
/// (NPC/COMPANION) en bucle hasta que le toca a la jugadora o el encuentro termina. El caller
/// (turnResolution.ts) lo llama DOS veces por turno síncrono real: antes de la acción de la
/// jugadora (por si quedaba algo pendiente de una ronda anterior — no debería, pero defensivo) y
/// después (para que el resto de la ronda se resuelva "de una sentada" antes de devolverle el
/// control, mismo criterio que el modo autónomo del propio diseño). `maxIteraciones` es un tope de
/// seguridad real, no una cifra de diseño — con el límite de 4v4 nunca debería hacer falta tanto,
/// pero evita un bucle infinito real si algo se rompe.
export interface ResolucionRondaCombate {
  narraciones: string[];
  encounterTerminado: boolean;
  caidos: ParticipanteCaidoInfo[];
  /// true si el bucle paró porque le toca a la jugadora, o porque la ronda está esperando su
  /// elección (o el encuentro sigue en curso y no hay más turnos autónomos que resolver ahora) —
  /// false si terminó por resolverse del todo.
  esperandoAccionJugadora: boolean;
  /// Objetivo individual real (2026-08-26) — true específicamente cuando el motivo de parar es
  /// que la RONDA no tiene su objetivo fijado todavía (`esperandoEleccionJugadora`), distinto de
  /// "ya le toca actuar con su objetivo ya fijo". El caller debe llamar a
  /// `fijarEleccionRondaJugador` antes de poder seguir resolviendo nada de esta ronda.
  esperandoEleccionRonda: boolean;
}

export async function resolverTurnosAutonomosHastaJugadora(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  weaponNamesPorDefecto: string[] = [],
  narrarFn: typeof narrarTurnoCombateMultiple = narrarTurnoCombateMultiple,
  maxIteraciones: number = 30,
): Promise<ResolucionRondaCombate> {
  const narraciones: string[] = [];
  const caidos: ParticipanteCaidoInfo[] = [];
  for (let i = 0; i < maxIteraciones; i++) {
    const resultado = await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, weaponNamesPorDefecto, narrarFn);
    if (resultado === null) {
      const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
      return {
        narraciones,
        encounterTerminado: encounter.estado === 'RESUELTO',
        caidos,
        esperandoAccionJugadora: encounter.estado !== 'RESUELTO',
        esperandoEleccionRonda: encounter.estado !== 'RESUELTO' && encounter.esperandoEleccionJugadora,
      };
    }
    if (resultado.narracion) narraciones.push(resultado.narracion);
    narraciones.push(...resultado.narracionesExtra);
    caidos.push(...resultado.caidos);
    if (resultado.encounterTerminado) return { narraciones, encounterTerminado: true, caidos, esperandoAccionJugadora: false, esperandoEleccionRonda: false };
  }
  // Tope de seguridad alcanzado (2026-08-25) — no debería pasar nunca con el límite de 4v4, pero
  // devuelve el control a la jugadora en vez de colgar la petición HTTP indefinidamente.
  return { narraciones, encounterTerminado: false, caidos, esperandoAccionJugadora: true, esperandoEleccionRonda: false };
}

/// Bug real cazado en integración contra Postgres real (2026-08-26, objetivo individual): esto
/// solía SOLO avanzar `turnoActual`, sin pasar por `avanzarYComprobarFin` — inofensivo mientras
/// era un caso raro (atacante sin objetivo válido), pero con el enganche por ronda esto se dispara
/// MUY a menudo (la mitad "que ya resolvió su pareja" de cada duelo, cualquier objetivo que muera
/// a media ronda) — sin pasar por `avanzarYComprobarFin`, el combate nunca comprobaba si ya había
/// terminado en esos turnos, y si el turno que faltaba era justo el último de la ronda, el
/// enganche de la ronda siguiente nunca se recalculaba (quedaba con el de la ronda vieja para
/// siempre). Ahora reutiliza el mismo camino que un intercambio real.
async function avanzarSinAtacar(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  encounter: { turnoActual: number; ordenIniciativa: string[] },
  weaponNamesPorDefecto: string[],
  narrarFn: typeof narrarTurnoCombateMultiple,
): Promise<TurnoAutonomoResultado> {
  const avance = await prisma.$transaction((tx) => avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto));
  const totems = await resolverTotemsPendientes(prisma, worldId, saveId, encounterId, avance.totemsQueAtacan, weaponNamesPorDefecto, narrarFn);
  return {
    narracion: '',
    atacanteNombre: '',
    defensorNombre: '',
    encounterTerminado: avance.terminado || totems.encounterTerminado,
    caidos: totems.caidos,
    narracionesExtra: totems.narraciones,
  };
}

/// Avanza `turnoActual` y marca el encuentro RESUELTO en cuanto un bando se queda sin objetivos
/// válidos. Objetivo individual real (2026-08-26) — YA NO re-empareja en cada turno (antes: "§2 se
/// redecide en cada turno individual"); el enganche de una ronda es fijo una vez decidido. Solo al
/// CRUZAR a una ronda nueva (`turnoActual` volviendo a 0) se recalcula el enganche entero
/// (`calcularEnganchesRonda`) — si la jugadora sigue viva y queda sin reclamar, la ronda nueva
/// arranca `esperandoEleccionJugadora: true` y nada de ella podrá resolverse hasta que el caller
/// (turnResolution.ts, vía `fijarEleccionRondaJugador`) le fije el objetivo.
/// INVOCACION real (Fase 3 § 3d, 2026-08-27) — `totemsQueAtacan`: IDs de `CombatParticipant` tipo
/// INVOCACION cuyo turno de atacar toca en la ronda que ACABA de cruzarse (los que tenían
/// `invocacionRondasRestantes > 0` justo antes del decremento de esta misma función, ver más
/// abajo) — vacío si no cruzó de ronda o no hay ninguno vivo. Esta función NUNCA narra nada (sigue
/// siendo parte de una transacción pura, igual que antes) — el CALLER, ya fuera de cualquier
/// transacción en ese punto (`ejecutarIntercambioYAvanzar`/`ejecutarGolpeGratisYAvanzar`/
/// `invocarTotemYAvanzar`/`avanzarSinAtacar`, los únicos 4 call-sites), es quien de verdad resuelve
/// y narra el golpe de cada tótem (`ejecutarAtaqueTotemYAvanzar`), con el mismo patrón de 2
/// transacciones cortas + narración fuera que ya usa todo lo demás en este archivo.
interface AvanceResultado {
  terminado: boolean;
  totemsQueAtacan: string[];
}

async function avanzarYComprobarFin(
  tx: Prisma.TransactionClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  encounter: { turnoActual: number; ordenIniciativa: string[] },
  weaponNamesPorDefecto: string[],
): Promise<AvanceResultado> {
  // Bug real (2026-08-25, cazado cerrando saqueo/desuello de CombatEncounter): antes se usaba el
  // `encounter.participantes` que el CALLER ya traía cargado desde ANTES del intercambio que
  // acaba de resolverse — para un miembro de GRUPO, `datosVivosDe` lee su condición DIRECTAMENTE
  // de `participant.condicionFisicaGrupo` (nunca vuelve a tocar la DB, a diferencia de un
  // solitario, que sí relee `NpcState` fresco) — así que el golpe que acababa de dejarlo
  // CONVALECIENTE/MUERTO, ya escrito por `escribirCondicionYEnergia` unas líneas antes en la MISMA
  // transacción, nunca se veía aquí: el combate podía quedarse EN_CURSO para siempre con un grupo
  // entero ya derrotado. Releído fresco de `CombatParticipant` en vez de confiar en el snapshot.
  const participantesFrescos = await tx.combatParticipant.findMany({ where: { encounterId } });
  const condiciones = await Promise.all(
    participantesFrescos.map(async (p) => ({ p, datos: await datosVivosDe(tx, worldId, saveId, p, weaponNamesPorDefecto) })),
  );
  const candidatosPorBando = (bando: Bando): ObjetivoCandidato[] =>
    condiciones
      .filter(({ p }) => p.bando === bando)
      .map(({ p, datos }) => ({ participantId: p.id, condicionFisica: datos?.condicionFisica ?? 'MUERTO', esJugadorReal: p.tipo === 'JUGADOR' }));

  const terminado = !bandoSigueEnCombate(candidatosPorBando('JUGADOR')) || !bandoSigueEnCombate(candidatosPorBando('ENEMIGO'));

  if (terminado) {
    await tx.combatEncounter.update({ where: { id: encounterId }, data: { estado: 'RESUELTO', resolvedAt: new Date() } });
    return { terminado: true, totemsQueAtacan: [] };
  }

  const nuevoTurnoActual = (encounter.turnoActual + 1) % encounter.ordenIniciativa.length;
  if (nuevoTurnoActual !== 0) {
    // Sigue la misma ronda — el enganche ya fijado no se toca, ningún tótem actúa todavía.
    await tx.combatEncounter.update({ where: { id: encounterId }, data: { turnoActual: nuevoTurnoActual } });
    return { terminado: false, totemsQueAtacan: [] };
  }

  const encounterParaEnganche = { ordenIniciativa: encounter.ordenIniciativa, participantes: participantesFrescos as (ParticipantRef & { bando: Bando })[] };
  const { enganches, esperandoJugadora } = await calcularEnganchesRonda(tx, worldId, saveId, encounterParaEnganche, weaponNamesPorDefecto, null);
  await Promise.all([...enganches.entries()].map(([id, objetivo]) => tx.combatParticipant.update({ where: { id }, data: { objetivoActualId: objetivo } })));
  // CONTROL real (Fase 3 § 3a, 2026-08-27) — un turno de duración menos por cada ronda que cruza
  // (nunca dentro de la misma ronda en que se fija, mismo cuidado de orden que `ActiveEffect`).
  await Promise.all(
    participantesFrescos
      .filter((p) => p.controladoPorRondas != null && p.controladoPorRondas > 0)
      .map((p) => tx.combatParticipant.update({ where: { id: p.id }, data: { controladoPorRondas: p.controladoPorRondas! - 1 } })),
  );
  // OCULTACION real (Fase 3 § 3c, 2026-08-27) — mismo criterio de orden que CONTROL: la ronda
  // nueva ya calculó su enganche (arriba) respetando quién estaba oculto ANTES de este decremento.
  await Promise.all(
    participantesFrescos
      .filter((p) => p.ocultoPorRondas != null && p.ocultoPorRondas > 0)
      .map((p) => tx.combatParticipant.update({ where: { id: p.id }, data: { ocultoPorRondas: p.ocultoPorRondas! - 1 } })),
  );
  // INVOCACION real (Fase 3 § 3d, 2026-08-27) — mismo criterio de orden que CONTROL/OCULTACION: un
  // turno de duración menos por ronda que cruza. Solo tótems TODAVÍA vivos (`invocacionVidaRestante
  // > 0` — uno ya destruido a mitad de ronda por un golpe normal no "ataca" ni decrementa más,
  // aunque su fila siga en la tabla hasta el próximo `avanzarSinAtacar`/limpieza). Quien SIGUE con
  // rondas > 0 tras decrementar es quien ataca esta ronda nueva (`totemsQueAtacan`, calculado ANTES
  // del decremento para no perderse el último turno del tótem que agota su duración justo en esta
  // misma ronda) — bug real cazado en integración (2026-08-27): expirar aquí mismo
  // (`invocacionVidaRestante: 0`) en cuanto `invocacionRondasRestantes` llega a 0 dejaba al tótem
  // "ya destruido" antes de que `resolverTotemsPendientes` (que corre DESPUÉS, fuera de esta
  // transacción) llegara a resolver su último golpe — nunca atacaba en el turno en que agotaba su
  // duración. La expiración por rondas-agotadas se decide DESPUÉS de atacar, en
  // `resolverTotemsPendientes`, nunca aquí.
  const totemsVivos = participantesFrescos.filter((p) => p.tipo === 'INVOCACION' && (p.invocacionVidaRestante ?? 0) > 0);
  const totemsQueAtacan = totemsVivos.filter((p) => (p.invocacionRondasRestantes ?? 0) > 0).map((p) => p.id);
  await Promise.all(
    totemsVivos.map((p) =>
      tx.combatParticipant.update({ where: { id: p.id }, data: { invocacionRondasRestantes: Math.max(0, (p.invocacionRondasRestantes ?? 0) - 1) } }),
    ),
  );
  // EXPULSAR real (Fase 3 § 3e, 2026-08-27) — mismo criterio de orden que CONTROL/OCULTACION: la
  // ronda nueva ya calculó su enganche (arriba) respetando quién estaba expulsado ANTES de este
  // decremento.
  await Promise.all(
    participantesFrescos
      .filter((p) => p.expulsadoPorRondas != null && p.expulsadoPorRondas > 0)
      .map((p) => tx.combatParticipant.update({ where: { id: p.id }, data: { expulsadoPorRondas: p.expulsadoPorRondas! - 1 } })),
  );
  await tx.combatEncounter.update({
    where: { id: encounterId },
    data: { turnoActual: nuevoTurnoActual, ronda: { increment: 1 }, esperandoEleccionJugadora: esperandoJugadora },
  });
  return { terminado: false, totemsQueAtacan };
}

/// Fija el objetivo de la ronda ACTUAL de la jugadora (2026-08-26, objetivo individual real) — se
/// llama exactamente UNA vez por ronda, en cuanto se sabe a quién quiere atacar (mismo criterio
/// "nombre citado entre comillas" que ya usa el resto del turno, resuelto por el caller en
/// turnResolution.ts), ANTES de resolver ningún intercambio de esa ronda — ver comentario largo de
/// `esperandoEleccionJugadora` en schema.prisma sobre por qué no puede esperar a que le "toque su
/// turno" en `ordenIniciativa` si no es la primera. No-op si la ronda ya no está esperando nada de
/// ella (defensivo — dos llamadas seguidas, o ya quedó reclamada por alguien mientras tanto).
export async function fijarEleccionRondaJugador(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  jugadoraTargetId: string,
  weaponNamesPorDefecto: string[] = [],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const encounter = await tx.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    if (!encounter.esperandoEleccionJugadora) return;
    const { enganches } = await calcularEnganchesRonda(
      tx,
      worldId,
      saveId,
      { ordenIniciativa: encounter.ordenIniciativa, participantes: encounter.participantes as (ParticipantRef & { bando: Bando })[] },
      weaponNamesPorDefecto,
      jugadoraTargetId,
    );
    await Promise.all([...enganches.entries()].map(([id, objetivo]) => tx.combatParticipant.update({ where: { id }, data: { objetivoActualId: objetivo } })));
    await tx.combatEncounter.update({ where: { id: encounterId }, data: { esperandoEleccionJugadora: false } });
  });
}
