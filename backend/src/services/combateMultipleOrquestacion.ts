import type { Prisma, CondicionFisica, Npc } from '@prisma/client';
import type { AttributeBlock } from './dice.js';
import { rollInitiativeMultiple, retargetBando, objetivosValidos, type CombatienteIniciativa, type Bando, type ObjetivoCandidato } from './combateMultiple.js';
import { npcCombatAbilitiesFor, chooseNpcAbility, type NpcCombatAbility, type NpcForCombatAbilities } from './npcCombatAbilities.js';
import { resolveExchange, exchangeContextBlock, type ExchangeParticipant } from './combatExchange.js';
import { nextCondicionForAttack } from './death.js';
import { narrarTurnoCombateMultiple } from './combateMultipleNarracion.js';
import type { NpcHabilidadRacialInScene } from './npcScene.js';

/// Grupo 3 § Combate múltiple (2026-08-25) — orquestación con estado real (crea/avanza un
/// `CombatEncounter`). Deliberadamente ACOTADO en esta pasada: resuelve turnos autónomos de NPC/
/// COMPANION (sin intervención de la jugadora) de principio a fin — mecánica + condición física/
/// energía real + narración — pero TODAVÍA no engancha XP/cierre de misión/loot al matar (eso
/// vive hoy en `applyCombatExchangeToNpcState`, turnResolution.ts, profundamente atado al resto
/// del turno síncrono) ni resuelve el turno de la propia jugadora (eso sigue siendo
/// `resolveCombatExchangePhase` de siempre hasta la pasada de integración real). Construido y
/// probado aislado a propósito, antes de tocar el motor de combate en uso.

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

  const porBando = (bando: Bando) => participantes.filter((p) => p.bando === bando);
  const objetivosPorDefecto = (bando: Bando): ObjetivoCandidato[] => porBando(bando).map((p) => ({ participantId: p.participantId, condicionFisica: 'ILESO' as CondicionFisica }));
  const targetsJugador = retargetBando(porBando('JUGADOR'), objetivosPorDefecto('ENEMIGO'));
  const targetsEnemigo = retargetBando(porBando('ENEMIGO'), objetivosPorDefecto('JUGADOR'));

  await Promise.all(
    participantes.map((p) => {
      const objetivo = p.bando === 'JUGADOR' ? targetsJugador[p.participantId] : targetsEnemigo[p.participantId];
      return tx.combatParticipant.update({ where: { id: p.participantId }, data: { objetivoActualId: objetivo ?? null } });
    }),
  );

  await tx.combatEncounter.update({ where: { id: encounter.id }, data: { ordenIniciativa: orden.map((e) => e.participantId) } });
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
async function datosVivosDe(
  tx: Prisma.TransactionClient,
  worldId: string,
  saveId: string,
  participant: ParticipantRef,
  weaponNames: string[],
): Promise<DatosCombatiente | null> {
  if (participant.tipo === 'NPC' && participant.npcId) {
    const npc = await tx.npc.findUnique({ where: { id: participant.npcId } });
    if (!npc) return null;
    // Miembro de grupo (condicionFisicaGrupo no nulo) — su condición real vive en el propio
    // CombatParticipant, NUNCA en NpcState (esa fila la comparten todos los miembros del grupo).
    // Energía/usageCounts se quedan "frescos" cada encuentro, ver comentario de `esGrupo` arriba.
    if (participant.condicionFisicaGrupo !== null) {
      return {
        nombre: npc.name,
        attributes: npc.attributes as unknown as AttributeBlock,
        condicionFisica: participant.condicionFisicaGrupo,
        energia: 100,
        abilities: npcCombatAbilitiesFor(toNpcForCombatAbilities(npc), weaponNames),
        usageCounts: {},
      };
    }
    const state = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: participant.npcScope } } });
    return {
      nombre: npc.name,
      attributes: npc.attributes as unknown as AttributeBlock,
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
    const npcOrigen = companion.sourceSlug ? await tx.npc.findFirst({ where: { worldId, slug: companion.sourceSlug } }) : null;
    return {
      nombre: companion.name,
      attributes: companion.attributes as unknown as AttributeBlock,
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

export interface TurnoAutonomoResultado {
  narracion: string;
  atacanteNombre: string;
  defensorNombre: string;
  encounterTerminado: boolean;
}

/// Resuelve el turno del combatiente ACTUAL de la cola de iniciativa — solo si es NPC/COMPANION
/// (nunca JUGADOR, ver comentario de cabecera: el turno de la jugadora sigue el camino de
/// siempre). Avanza `turnoActual`, retarget si hace falta tras una baja, y marca el encuentro
/// RESUELTO si un bando entero se queda sin objetivos válidos.
///
/// `narrarFn` inyectable (por defecto la llamada real a Ollama) — cada llamada real cuesta
/// 30-220s (narrador.ts), así que los tests pasan un doble rápido en vez de esperar de verdad;
/// mismo criterio de inyección que `random` en el resto de funciones puras de esta sesión.
export async function resolverTurnoAutonomo(
  tx: Prisma.TransactionClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  weaponNamesPorDefecto: string[] = [],
  narrarFn: typeof narrarTurnoCombateMultiple = narrarTurnoCombateMultiple,
): Promise<TurnoAutonomoResultado | null> {
  const encounter = await tx.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
  if (encounter.estado === 'RESUELTO' || encounter.ordenIniciativa.length === 0) return null;

  const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
  const actual = encounter.participantes.find((p) => p.id === actualId);
  if (!actual || actual.tipo === 'JUGADOR') return null;

  const datosAtacante = await datosVivosDe(tx, worldId, saveId, actual, weaponNamesPorDefecto);
  if (!datosAtacante || objetivosValidos([{ participantId: actual.id, condicionFisica: datosAtacante.condicionFisica }]).length === 0) {
    return avanzarSinAtacar(tx, encounterId, encounter);
  }

  const defensorId = actual.objetivoActualId;
  const defensor = defensorId ? encounter.participantes.find((p) => p.id === defensorId) : null;
  if (!defensor) return avanzarSinAtacar(tx, encounterId, encounter);
  const datosDefensor = await datosVivosDe(tx, worldId, saveId, defensor, weaponNamesPorDefecto);
  if (!datosDefensor || datosDefensor.condicionFisica === 'CONVALECIENTE' || datosDefensor.condicionFisica === 'MUERTO') {
    return avanzarSinAtacar(tx, encounterId, encounter);
  }

  const habilidadAtaque = chooseNpcAbility(datosAtacante.abilities, 'ataque', datosAtacante.energia, Math.random, datosAtacante.usageCounts);
  const habilidadDefensa = chooseNpcAbility(datosDefensor.abilities, 'defensa', datosDefensor.energia, Math.random, datosDefensor.usageCounts);

  const atacanteExchange: ExchangeParticipant = {
    attributes: datosAtacante.attributes,
    attribute: habilidadAtaque.attribute,
    attributeBonus: habilidadAtaque.attributeBonus,
    difficulty: 15,
    condicionFisica: datosAtacante.condicionFisica,
    rol: 'ataque',
  };
  const defensorExchange: ExchangeParticipant = {
    attributes: datosDefensor.attributes,
    attribute: habilidadDefensa.attribute,
    attributeBonus: habilidadDefensa.attributeBonus,
    difficulty: 15,
    condicionFisica: datosDefensor.condicionFisica,
    rol: 'defensa',
  };
  const exchange = resolveExchange(atacanteExchange, defensorExchange);
  const defensorHitOutcomes = new Set(['golpe_normal', 'golpe_pleno']);
  const defensorFueGolpeado = defensorHitOutcomes.has(exchange.resultado);
  const nuevaCondicionDefensor = defensorFueGolpeado ? nextCondicionForAttack(habilidadAtaque.effects, datosDefensor.condicionFisica) : datosDefensor.condicionFisica;

  await escribirCondicionYEnergia(
    tx,
    saveId,
    defensor,
    defensorFueGolpeado ? nuevaCondicionDefensor : null,
    null,
    habilidadDefensa.name,
    datosDefensor.usageCounts,
  );
  await escribirCondicionYEnergia(tx, saveId, actual, null, null, habilidadAtaque.name, datosAtacante.usageCounts);

  const exchangeBlock = exchangeContextBlock(exchange, datosAtacante.nombre, datosDefensor.nombre, habilidadDefensa.effects.includes('ATAQUE'));
  const narracion = await narrarFn({
    atacanteNombre: datosAtacante.nombre,
    defensorNombre: datosDefensor.nombre,
    habilidadNombre: habilidadAtaque.name,
    exchangeBlock,
    combatBothMissed: !defensorFueGolpeado && exchange.resultado !== 'defensor_contragolpea',
    combatRealHitLanded: defensorFueGolpeado,
    defensorQuedaConvalecienteEsteTurno: defensorFueGolpeado && nuevaCondicionDefensor === 'CONVALECIENTE',
    defensorMuereEsteTurno: defensorFueGolpeado && nuevaCondicionDefensor === 'MUERTO',
  });

  const encounterTerminado = await avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);
  return { narracion, atacanteNombre: datosAtacante.nombre, defensorNombre: datosDefensor.nombre, encounterTerminado };
}

async function avanzarSinAtacar(
  tx: Prisma.TransactionClient,
  encounterId: string,
  encounter: { turnoActual: number; ordenIniciativa: string[] },
): Promise<TurnoAutonomoResultado> {
  await tx.combatEncounter.update({ where: { id: encounterId }, data: { turnoActual: (encounter.turnoActual + 1) % encounter.ordenIniciativa.length } });
  return { narracion: '', atacanteNombre: '', defensorNombre: '', encounterTerminado: false };
}

/// Avanza `turnoActual`, redecide el emparejamiento de ambos bandos (§2: se redecide en cada
/// turno, no solo tras una baja — barato de sobra para el tamaño máximo de 4v4) y marca el
/// encuentro RESUELTO en cuanto un bando se queda sin objetivos válidos.
async function avanzarYComprobarFin(
  tx: Prisma.TransactionClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  encounter: { turnoActual: number; ordenIniciativa: string[]; participantes: (ParticipantRef & { bando: Bando })[] },
  weaponNamesPorDefecto: string[],
): Promise<boolean> {
  const condiciones = await Promise.all(
    encounter.participantes.map(async (p) => ({ p, datos: await datosVivosDe(tx, worldId, saveId, p, weaponNamesPorDefecto) })),
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

  const atacantesJugador = condiciones.filter(({ p }) => p.bando === 'JUGADOR').map(({ p, datos }) => ({ participantId: p.id, inteligencia: datos?.attributes.inteligencia ?? 0 }));
  const atacantesEnemigo = condiciones.filter(({ p }) => p.bando === 'ENEMIGO').map(({ p, datos }) => ({ participantId: p.id, inteligencia: datos?.attributes.inteligencia ?? 0 }));
  const targetsJugador = retargetBando(atacantesJugador, vivosEnemigo);
  const targetsEnemigo = retargetBando(atacantesEnemigo, vivosJugador);

  await Promise.all(
    encounter.participantes.map((p) => {
      const objetivo = p.bando === 'JUGADOR' ? targetsJugador[p.id] : targetsEnemigo[p.id];
      return tx.combatParticipant.update({ where: { id: p.id }, data: { objetivoActualId: objetivo ?? null } });
    }),
  );
  await tx.combatEncounter.update({ where: { id: encounterId }, data: { turnoActual: (encounter.turnoActual + 1) % encounter.ordenIniciativa.length } });
  return false;
}
