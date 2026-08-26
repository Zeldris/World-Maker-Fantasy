import type { Prisma, PrismaClient, CondicionFisica, Npc, Clase } from '@prisma/client';
import type { AttributeBlock } from './dice.js';
import {
  rollInitiativeMultiple,
  objetivosValidos,
  elegirObjetivo,
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
}

interface DatosCombatiente {
  nombre: string;
  attributes: AttributeBlock;
  condicionFisica: CondicionFisica;
  energia: number;
  abilities: NpcCombatAbility[];
  usageCounts: Record<string, number>;
}

/// Resuelve los datos EN VIVO de un combatiente — nunca duplicados en `CombatParticipant`, ver
/// comentario del modelo en schema.prisma. `NpcState` se crea perezosa (mismo criterio que el
/// resto del motor: un NPC nunca tocado no tiene fila propia todavía).
/// Roster defensivo mínimo garantizado (mismo "Esquivar" que `npcCombatAbilitiesFor` añade siempre
/// al final de CUALQUIER NPC, npcCombatAbilities.ts) — la jugadora lo usa como último recurso si
/// no tiene ninguna `SavedAction` de defensa/utilidad todavía (personaje recién creado).
const ESQUIVAR_GENERICO: NpcCombatAbility = { name: 'Esquivar', description: 'Esquiva el golpe entrante.', attribute: 'destreza', effects: [], rol: 'defensa', energyCost: 0, energyRegen: 15 };

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
      attributes: save.attributes as unknown as AttributeBlock,
      condicionFisica: save.condicionFisica,
      energia: save.energia,
      abilities: abilities.length > 0 ? abilities : [ESQUIVAR_GENERICO],
      // Tope de usos por combate NO se enforce para la jugadora dentro de un CombatEncounter en
      // esta pasada (simplificación documentada, mismo espíritu que `esGrupo`) — su
      // `NpcState.abilityUsesThisEncounter` equivalente no existe en `Save`.
      usageCounts: {},
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
      };
    }
    const state = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: participant.npcScope } } });
    return {
      nombre: npc.name,
      attributes: npcAttributesForLevel(npc.attributes as unknown as AttributeBlock, npc.level, npc.clase as Clase | null),
      condicionFisica: state?.condicionFisica ?? 'ILESO',
      energia: state?.energia ?? 100,
      abilities: npcCombatAbilitiesFor(toNpcForCombatAbilities(npc), weaponNames),
      usageCounts: (state?.abilityUsesThisEncounter as Record<string, number>) ?? {},
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
    return {
      nombre: companion.name,
      attributes: npcOrigen
        ? npcAttributesForLevel(companion.attributes as unknown as AttributeBlock, npcOrigen.level, npcOrigen.clase as Clase | null)
        : (companion.attributes as unknown as AttributeBlock),
      condicionFisica: companion.condicionFisica,
      energia: 100,
      abilities: npcOrigen ? npcCombatAbilitiesFor(toNpcForCombatAbilities(npcOrigen), weaponNames) : [],
      usageCounts: {},
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
  const vivos = encounter.participantes.filter((p) => {
    const datos = datosPorParticipante.get(p.id);
    return !!datos && datos.condicionFisica !== 'CONVALECIENTE' && datos.condicionFisica !== 'MUERTO';
  });
  const combatientes = vivos.map((p) => ({ participantId: p.id, bando: p.bando }));
  const jugadoraId = vivos.find((p) => p.tipo === 'JUGADOR')?.id ?? null;

  const elegirObjetivoPara = (id: string, candidatos: string[]): string | null => {
    if (id === jugadoraId) return jugadoraTargetId;
    const candidatosObj: ObjetivoCandidato[] = candidatos.map((cid) => ({
      participantId: cid,
      condicionFisica: datosPorParticipante.get(cid)?.condicionFisica ?? 'MUERTO',
    }));
    return elegirObjetivo(datosPorParticipante.get(id)?.attributes.inteligencia ?? 0, candidatosObj, Math.random);
  };

  const enganches = resolverEnganchesRonda(encounter.ordenIniciativa, combatientes, elegirObjetivoPara);
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
): Promise<void> {
  const nextUsageCounts = { ...usageCounts };
  if (abilityNameUsada) nextUsageCounts[abilityNameUsada] = (nextUsageCounts[abilityNameUsada] ?? 0) + 1;
  if (participant.condicionFisicaGrupo !== null) {
    // Miembro de grupo — su condición vive en el propio CombatParticipant (energía/usageCounts
    // deliberadamente no persisten entre turnos, ver comentario de `esGrupo`).
    if (condicionFisica) await tx.combatParticipant.update({ where: { id: participant.id }, data: { condicionFisicaGrupo: condicionFisica } });
    return;
  }
  if (participant.tipo === 'JUGADOR') {
    await tx.save.update({
      where: { id: saveId },
      data: {
        ...(condicionFisica ? { condicionFisica, salud: saludForCondicion(condicionFisica) } : {}),
        ...(energia !== null ? { energia } : {}),
      },
    });
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
      },
      update: {
        ...(condicionFisica ? { condicionFisica } : {}),
        ...(energia !== null ? { energia } : {}),
        ...(abilityNameUsada ? { abilityUsesThisEncounter: nextUsageCounts } : {}),
      },
    });
  } else if (participant.tipo === 'COMPANION' && participant.companionId) {
    await tx.companion.update({
      where: { id: participant.companionId },
      data: { ...(condicionFisica ? { condicionFisica } : {}) },
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
async function ejecutarIntercambioYAvanzar(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  encounter: { turnoActual: number; ordenIniciativa: string[]; participantes: (ParticipantRef & { bando: Bando })[] },
  actual: ParticipantRef,
  datosAtacante: DatosCombatiente,
  habilidadAtaque: HabilidadParaIntercambio,
  atacanteRol: 'ataque' | 'defensa' | 'utilidad',
  dualWieldBonus: boolean,
  defensor: ParticipantRef,
  weaponNamesPorDefecto: string[],
  narrarFn: typeof narrarTurnoCombateMultiple,
): Promise<TurnoAutonomoResultado> {
  const datosDefensor = await datosVivosDe(prisma, worldId, saveId, defensor, weaponNamesPorDefecto);
  if (!datosDefensor || datosDefensor.condicionFisica === 'CONVALECIENTE' || datosDefensor.condicionFisica === 'MUERTO') {
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);
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
    );
    await escribirCondicionYEnergia(
      tx,
      saveId,
      actual,
      resultado.atacanteRecibeGolpe ? resultado.nuevaCondicionAtacante : null,
      nuevaEnergiaAtacante,
      habilidadAtaque.name,
      datosAtacante.usageCounts,
    );
  });

  // Narración real (Ollama) FUERA de cualquier transacción — es la llamada lenta que reventaba el
  // timeout de 5000ms cuando vivía dentro de la transacción de arriba.
  const narracion = await narrarFn({
    atacanteNombre: datosAtacante.nombre,
    defensorNombre: datosDefensor.nombre,
    habilidadNombre: habilidadAtaque.name,
    exchangeBlock: resultado.exchangeBlock,
    combatBothMissed: resultado.combatBothMissed,
    combatRealHitLanded: resultado.combatRealHitLanded,
    defensorQuedaConvalecienteEsteTurno: resultado.defensorRecibeGolpe && resultado.nuevaCondicionDefensor === 'CONVALECIENTE',
    defensorMuereEsteTurno: resultado.defensorRecibeGolpe && resultado.nuevaCondicionDefensor === 'MUERTO',
  });

  // Transacción corta #2 — relee condición fresca de todos y decide fin de combate/retargeting.
  const encounterTerminado = await prisma.$transaction((tx) => avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto));

  const caidos: ParticipanteCaidoInfo[] = [];
  const defensorCae = resultado.defensorRecibeGolpe && (resultado.nuevaCondicionDefensor === 'CONVALECIENTE' || resultado.nuevaCondicionDefensor === 'MUERTO');
  if (defensorCae) caidos.push({ tipo: defensor.tipo, npcId: defensor.npcId, nuevaCondicion: resultado.nuevaCondicionDefensor });
  const atacanteCae = resultado.atacanteRecibeGolpe && (resultado.nuevaCondicionAtacante === 'CONVALECIENTE' || resultado.nuevaCondicionAtacante === 'MUERTO');
  if (atacanteCae) caidos.push({ tipo: actual.tipo, npcId: actual.npcId, nuevaCondicion: resultado.nuevaCondicionAtacante });

  return { narracion, atacanteNombre: datosAtacante.nombre, defensorNombre: datosDefensor.nombre, encounterTerminado, caidos };
}

/// Golpe gratis, sin oposición real (2026-08-26, docs/21-roadmap.md § Fase 3, "objetivo
/// individual") — a diferencia de `ejecutarIntercambioYAvanzar`, el objetivo NO tira su propia
/// defensa: el golpe conecta directo (`nextCondicionForAttack`), salvo que tenga una habilidad
/// real con `AGUANTE`+`MULTIPLE` disponible (hoy no existe ninguna sembrada, ver Fase 1 del
/// roadmap — esta rama queda lista para cuando exista, pero no dispara todavía en partida real).
/// Mismo patrón de 2 transacciones cortas + narración fuera de ambas que `ejecutarIntercambioYAvanzar`
/// (ver su comentario de cabecera sobre el bug de timeout de 2026-08-25).
async function ejecutarGolpeGratisYAvanzar(
  prisma: PrismaClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  encounter: { turnoActual: number; ordenIniciativa: string[]; participantes: (ParticipantRef & { bando: Bando })[] },
  actual: ParticipantRef,
  datosAtacante: DatosCombatiente,
  habilidadAtaque: HabilidadParaIntercambio,
  defensor: ParticipantRef,
  weaponNamesPorDefecto: string[],
  narrarFn: typeof narrarTurnoCombateMultiple,
): Promise<TurnoAutonomoResultado> {
  const datosDefensor = await datosVivosDe(prisma, worldId, saveId, defensor, weaponNamesPorDefecto);
  if (!datosDefensor || datosDefensor.condicionFisica === 'CONVALECIENTE' || datosDefensor.condicionFisica === 'MUERTO') {
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);
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
    return ejecutarIntercambioYAvanzar(prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque, 'ataque', false, defensor, weaponNamesPorDefecto, narrarFn);
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

  await prisma.$transaction(async (tx) => {
    await escribirCondicionYEnergia(tx, saveId, defensor, nuevaCondicionDefensor, null, null, datosDefensor.usageCounts);
    await escribirCondicionYEnergia(tx, saveId, actual, null, nuevaEnergiaAtacante, habilidadAtaque.name, datosAtacante.usageCounts);
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

  const encounterTerminado = await prisma.$transaction((tx) => avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto));

  const caidos: ParticipanteCaidoInfo[] = [];
  if (nuevaCondicionDefensor === 'CONVALECIENTE' || nuevaCondicionDefensor === 'MUERTO') {
    caidos.push({ tipo: defensor.tipo, npcId: defensor.npcId, nuevaCondicion: nuevaCondicionDefensor });
  }

  return { narracion, atacanteNombre: datosAtacante.nombre, defensorNombre: datosDefensor.nombre, encounterTerminado, caidos };
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
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);
  }

  const defensorId = actual.objetivoActualId;
  const defensor = defensorId ? encounter.participantes.find((p) => p.id === defensorId) : null;
  if (!defensor) return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);
  if (dueloYaResueltoPorElOtro(encounter.ordenIniciativa, actual.id, defensor)) return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);

  const habilidadAtaque = chooseNpcAbility(datosAtacante.abilities, 'ataque', datosAtacante.energia, Math.random, datosAtacante.usageCounts);
  const esDuelo = defensor.objetivoActualId === actual.id;
  if (esDuelo) {
    return ejecutarIntercambioYAvanzar(prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque, 'ataque', false, defensor, weaponNamesPorDefecto, narrarFn);
  }
  return ejecutarGolpeGratisYAvanzar(prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque, defensor, weaponNamesPorDefecto, narrarFn);
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
  if (!datosAtacante || objetivosValidos([{ participantId: actual.id, condicionFisica: datosAtacante.condicionFisica }]).length === 0) {
    return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);
  }

  const defensorId = actual.objetivoActualId;
  const defensor = defensorId ? encounter.participantes.find((p) => p.id === defensorId) : null;
  if (!defensor) return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);
  if (dueloYaResueltoPorElOtro(encounter.ordenIniciativa, actual.id, defensor)) return avanzarSinAtacar(prisma, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);

  const esDuelo = defensor.objetivoActualId === actual.id;
  if (!esDuelo) {
    return ejecutarGolpeGratisYAvanzar(prisma, worldId, saveId, encounterId, encounter, actual, datosAtacante, accion.habilidad, defensor, weaponNamesPorDefecto, narrarFn);
  }

  return ejecutarIntercambioYAvanzar(
    prisma,
    worldId,
    saveId,
    encounterId,
    encounter,
    actual,
    datosAtacante,
    accion.habilidad,
    accion.habilidad.rol,
    accion.dualWieldBonus ?? false,
    defensor,
    weaponNamesPorDefecto,
    narrarFn,
  );
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
): Promise<TurnoAutonomoResultado> {
  const encounterTerminado = await prisma.$transaction((tx) => avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto));
  return { narracion: '', atacanteNombre: '', defensorNombre: '', encounterTerminado, caidos: [] };
}

/// Avanza `turnoActual` y marca el encuentro RESUELTO en cuanto un bando se queda sin objetivos
/// válidos. Objetivo individual real (2026-08-26) — YA NO re-empareja en cada turno (antes: "§2 se
/// redecide en cada turno individual"); el enganche de una ronda es fijo una vez decidido. Solo al
/// CRUZAR a una ronda nueva (`turnoActual` volviendo a 0) se recalcula el enganche entero
/// (`calcularEnganchesRonda`) — si la jugadora sigue viva y queda sin reclamar, la ronda nueva
/// arranca `esperandoEleccionJugadora: true` y nada de ella podrá resolverse hasta que el caller
/// (turnResolution.ts, vía `fijarEleccionRondaJugador`) le fije el objetivo.
async function avanzarYComprobarFin(
  tx: Prisma.TransactionClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  encounter: { turnoActual: number; ordenIniciativa: string[] },
  weaponNamesPorDefecto: string[],
): Promise<boolean> {
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
    condiciones.filter(({ p }) => p.bando === bando).map(({ p, datos }) => ({ participantId: p.id, condicionFisica: datos?.condicionFisica ?? 'MUERTO' }));

  const vivosJugador = objetivosValidos(candidatosPorBando('JUGADOR'));
  const vivosEnemigo = objetivosValidos(candidatosPorBando('ENEMIGO'));
  const terminado = vivosJugador.length === 0 || vivosEnemigo.length === 0;

  if (terminado) {
    await tx.combatEncounter.update({ where: { id: encounterId }, data: { estado: 'RESUELTO', resolvedAt: new Date() } });
    return true;
  }

  const nuevoTurnoActual = (encounter.turnoActual + 1) % encounter.ordenIniciativa.length;
  if (nuevoTurnoActual !== 0) {
    // Sigue la misma ronda — el enganche ya fijado no se toca.
    await tx.combatEncounter.update({ where: { id: encounterId }, data: { turnoActual: nuevoTurnoActual } });
    return false;
  }

  const encounterParaEnganche = { ordenIniciativa: encounter.ordenIniciativa, participantes: participantesFrescos as (ParticipantRef & { bando: Bando })[] };
  const { enganches, esperandoJugadora } = await calcularEnganchesRonda(tx, worldId, saveId, encounterParaEnganche, weaponNamesPorDefecto, null);
  await Promise.all([...enganches.entries()].map(([id, objetivo]) => tx.combatParticipant.update({ where: { id }, data: { objetivoActualId: objetivo } })));
  await tx.combatEncounter.update({
    where: { id: encounterId },
    data: { turnoActual: nuevoTurnoActual, ronda: { increment: 1 }, esperandoEleccionJugadora: esperandoJugadora },
  });
  return false;
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
