import type { Prisma, CondicionFisica, Npc } from '@prisma/client';
import type { AttributeBlock } from './dice.js';
import {
  rollInitiativeMultiple,
  retargetBando,
  objetivosValidos,
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
import { saludForCondicion } from './death.js';

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
async function ejecutarIntercambioYAvanzar(
  tx: Prisma.TransactionClient,
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
  const datosDefensor = await datosVivosDe(tx, worldId, saveId, defensor, weaponNamesPorDefecto);
  if (!datosDefensor || datosDefensor.condicionFisica === 'CONVALECIENTE' || datosDefensor.condicionFisica === 'MUERTO') {
    return avanzarSinAtacar(tx, encounterId, encounter);
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

  const encounterTerminado = await avanzarYComprobarFin(tx, worldId, saveId, encounterId, encounter, weaponNamesPorDefecto);

  const caidos: ParticipanteCaidoInfo[] = [];
  const defensorCae = resultado.defensorRecibeGolpe && (resultado.nuevaCondicionDefensor === 'CONVALECIENTE' || resultado.nuevaCondicionDefensor === 'MUERTO');
  if (defensorCae) caidos.push({ tipo: defensor.tipo, npcId: defensor.npcId, nuevaCondicion: resultado.nuevaCondicionDefensor });
  const atacanteCae = resultado.atacanteRecibeGolpe && (resultado.nuevaCondicionAtacante === 'CONVALECIENTE' || resultado.nuevaCondicionAtacante === 'MUERTO');
  if (atacanteCae) caidos.push({ tipo: actual.tipo, npcId: actual.npcId, nuevaCondicion: resultado.nuevaCondicionAtacante });

  return { narracion, atacanteNombre: datosAtacante.nombre, defensorNombre: datosDefensor.nombre, encounterTerminado, caidos };
}

/// Resuelve el turno del combatiente ACTUAL de la cola de iniciativa — solo si es NPC/COMPANION
/// (nunca JUGADOR, ver `resolverTurnoJugador` para ese caso). Avanza `turnoActual`, retarget si
/// hace falta tras una baja, y marca el encuentro RESUELTO si un bando entero se queda sin
/// objetivos válidos.
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

  const habilidadAtaque = chooseNpcAbility(datosAtacante.abilities, 'ataque', datosAtacante.energia, Math.random, datosAtacante.usageCounts);
  return ejecutarIntercambioYAvanzar(tx, worldId, saveId, encounterId, encounter, actual, datosAtacante, habilidadAtaque, 'ataque', false, defensor, weaponNamesPorDefecto, narrarFn);
}

export interface AccionJugadorCombate {
  /// `CombatParticipant.id` del objetivo — resuelto por el caller (turnResolution.ts) con el
  /// mismo criterio "nombre citado entre comillas" que ya usa el resto del turno (npcsInScene),
  /// más "primer individuo vivo de esa especie" si hay varios miembros de un mismo grupo con el
  /// mismo nombre — no hace falta que el frontend distinga individuos por ahora, son mecánicamente
  /// intercambiables (mismo roster de habilidades, misma especie).
  targetParticipantId: string;
  /// Habilidad ya elegida por la jugadora (botón pulsado o fallback determinista), construida por
  /// el caller a partir de su `SavedAction` real — mismo patrón que `selectedAbility`/
  /// `abilityEffects`/`abilityRol` en turnResolution.ts, nunca recalculado aquí.
  habilidad: HabilidadParaIntercambio;
  dualWieldBonus?: boolean;
}

/// Resuelve el turno de la JUGADORA cuando le toca en la cola de iniciativa de un `CombatEncounter`
/// real — equivalente exacto de `resolverTurnoAutonomo` pero con la habilidad y el objetivo
/// decididos por ella (nunca `chooseNpcAbility`). `null` si no es su turno todavía (el caller debe
/// seguir resolviendo turnos autónomos hasta que sí lo sea, ver el bucle de integración en
/// turnResolution.ts).
export async function resolverTurnoJugador(
  tx: Prisma.TransactionClient,
  worldId: string,
  saveId: string,
  encounterId: string,
  accion: AccionJugadorCombate,
  weaponNamesPorDefecto: string[] = [],
  narrarFn: typeof narrarTurnoCombateMultiple = narrarTurnoCombateMultiple,
): Promise<TurnoAutonomoResultado | null> {
  const encounter = await tx.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
  if (encounter.estado === 'RESUELTO' || encounter.ordenIniciativa.length === 0) return null;

  const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
  const actual = encounter.participantes.find((p) => p.id === actualId);
  if (!actual || actual.tipo !== 'JUGADOR') return null;

  const datosAtacante = await datosVivosDe(tx, worldId, saveId, actual, weaponNamesPorDefecto);
  if (!datosAtacante || objetivosValidos([{ participantId: actual.id, condicionFisica: datosAtacante.condicionFisica }]).length === 0) {
    return avanzarSinAtacar(tx, encounterId, encounter);
  }

  const defensor = encounter.participantes.find((p) => p.id === accion.targetParticipantId);
  if (!defensor) return avanzarSinAtacar(tx, encounterId, encounter);

  return ejecutarIntercambioYAvanzar(
    tx,
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
  /// true si el bucle paró porque le toca a la jugadora (o el encuentro sigue en curso y no hay
  /// más turnos autónomos que resolver ahora) — false si terminó por resolverse del todo.
  esperandoAccionJugadora: boolean;
}

export async function resolverTurnosAutonomosHastaJugadora(
  tx: Prisma.TransactionClient,
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
    const resultado = await resolverTurnoAutonomo(tx, worldId, saveId, encounterId, weaponNamesPorDefecto, narrarFn);
    if (resultado === null) {
      const encounter = await tx.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
      return { narraciones, encounterTerminado: encounter.estado === 'RESUELTO', caidos, esperandoAccionJugadora: encounter.estado !== 'RESUELTO' };
    }
    if (resultado.narracion) narraciones.push(resultado.narracion);
    caidos.push(...resultado.caidos);
    if (resultado.encounterTerminado) return { narraciones, encounterTerminado: true, caidos, esperandoAccionJugadora: false };
  }
  // Tope de seguridad alcanzado (2026-08-25) — no debería pasar nunca con el límite de 4v4, pero
  // devuelve el control a la jugadora en vez de colgar la petición HTTP indefinidamente.
  return { narraciones, encounterTerminado: false, caidos, esperandoAccionJugadora: true };
}

async function avanzarSinAtacar(
  tx: Prisma.TransactionClient,
  encounterId: string,
  encounter: { turnoActual: number; ordenIniciativa: string[] },
): Promise<TurnoAutonomoResultado> {
  await tx.combatEncounter.update({ where: { id: encounterId }, data: { turnoActual: (encounter.turnoActual + 1) % encounter.ordenIniciativa.length } });
  return { narracion: '', atacanteNombre: '', defensorNombre: '', encounterTerminado: false, caidos: [] };
}

/// Avanza `turnoActual`, redecide el emparejamiento de ambos bandos (§2: se redecide en cada
/// turno, no solo tras una baja — barato de sobra para el tamaño máximo de 4v4) y marca el
/// encuentro RESUELTO en cuanto un bando se queda sin objetivos válidos.
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

  const atacantesJugador = condiciones.filter(({ p }) => p.bando === 'JUGADOR').map(({ p, datos }) => ({ participantId: p.id, inteligencia: datos?.attributes.inteligencia ?? 0 }));
  const atacantesEnemigo = condiciones.filter(({ p }) => p.bando === 'ENEMIGO').map(({ p, datos }) => ({ participantId: p.id, inteligencia: datos?.attributes.inteligencia ?? 0 }));
  const targetsJugador = retargetBando(atacantesJugador, vivosEnemigo);
  const targetsEnemigo = retargetBando(atacantesEnemigo, vivosJugador);

  await Promise.all(
    participantesFrescos.map((p) => {
      const objetivo = p.bando === 'JUGADOR' ? targetsJugador[p.id] : targetsEnemigo[p.id];
      return tx.combatParticipant.update({ where: { id: p.id }, data: { objetivoActualId: objetivo ?? null } });
    }),
  );
  await tx.combatEncounter.update({ where: { id: encounterId }, data: { turnoActual: (encounter.turnoActual + 1) % encounter.ordenIniciativa.length } });
  return false;
}
