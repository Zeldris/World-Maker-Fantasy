import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { iniciarCombatEncounter, resolverTurnoAutonomo, resolverTurnoJugador, fijarEleccionRondaJugador } from './combateMultipleOrquestacion.js';
import type { HabilidadParaIntercambio } from './combateMultiple.js';
import { parseActiveEffects, type ActiveEffect } from './activeEffects.js';

/// Grupo 3 § Combate múltiple (2026-08-25) — harness de integración real (mismo criterio que
/// turn.integration.test.ts): la narración pasa un doble rápido (`narrarFn` inyectable) en vez de
/// llamar a Ollama de verdad (9-25s por llamada medido en partida real, 2026-08-25) — esto prueba
/// la orquestación de estado real (CombatEncounter/CombatParticipant, NpcState), no la narración.
/// Desde el arreglo del timeout de transacción (mismo día, ver cabecera de
/// combateMultipleOrquestacion.ts), `resolverTurnoAutonomo`/`resolverTurnoJugador` reciben `prisma`
/// directamente — ya NO se envuelven en `prisma.$transaction` desde este test.
///
/// 2 vs. 2 con NPC reales del catálogo (aullador-rojo/corredor-de-cauce, PLANTILLA — sin
/// entrelazado de misión, seguros de tocar) en ambos bandos vía `tipo: 'NPC'` (nunca `'JUGADOR'`
/// en esta pasada — el turno de la jugadora en persona sigue sin construirse, ver comentario de
/// cabecera del propio servicio) para poder correr la ronda entera de forma autónoma sin
/// necesitar un Save con atributos reales de personaje.
const dobleNarracionRapida = async () => 'Narración de prueba.';

/// Helper de tests (Fase 3 § 3a, 2026-08-27) — resuelve turnos autónomos hasta que le toca a la
/// jugadora (el orden de iniciativa es real, nunca garantiza que actúe primero) y entonces resuelve
/// SU turno con la habilidad dada, devolviendo ese resultado — mismo patrón de bucle que el test
/// 1v1 de arriba, extraído aquí para no repetirlo.
async function resolverHastaJugadoraActua(saveId: string, worldId: string, encounterId: string, habilidad: HabilidadParaIntercambio) {
  for (let i = 0; i < 30; i++) {
    const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    if (encounter.estado === 'RESUELTO') return null;
    const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
    const actual = encounter.participantes.find((p) => p.id === actualId)!;
    if (actual.tipo === 'JUGADOR') {
      return resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad }, [], dobleNarracionRapida);
    }
    await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
  }
  throw new Error('La jugadora nunca llegó a actuar en el tope de turnos de prueba.');
}

describe('combate múltiple: orquestación real contra Postgres', () => {
  let saveId: string;
  let worldId: string;
  let npcAId: string;
  let npcBId: string;
  let npcCId: string;
  let npcDId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const [aullador1, aullador2, corredor1, corredor2] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    npcAId = aullador1.id;
    npcBId = aullador2.id;
    npcCId = corredor1.id;
    npcDId = corredor2.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (combate múltiple)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('crea el encuentro con iniciativa real y resuelve turnos autónomos hasta terminar', async () => {
    // Dos "bandos aliados" (tipo NPC en los dos lados, nunca JUGADOR en esta pasada) — dos
    // Aulladores Rojos (fuerza 8, destreza 10 en el catálogo) contra dos Corredores de Cauce.
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'NPC', npcId: npcAId, npcScope: 'itinerante', destreza: 10, inteligencia: 6 },
        { bando: 'JUGADOR', tipo: 'NPC', npcId: npcBId, npcScope: 'itinerante-2', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: npcCId, npcScope: 'itinerante', destreza: 12, inteligencia: 4 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: npcDId, npcScope: 'itinerante-2', destreza: 12, inteligencia: 4 },
      ]),
    );

    const encounterInicial = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    expect(encounterInicial.participantes).toHaveLength(4);
    expect(encounterInicial.ordenIniciativa).toHaveLength(4);
    expect(new Set(encounterInicial.ordenIniciativa)).toEqual(new Set(encounterInicial.participantes.map((p) => p.id)));
    // Cada participante ya tiene un objetivo del bando contrario asignado desde el arranque (§2).
    for (const p of encounterInicial.participantes) {
      const objetivo = encounterInicial.participantes.find((o) => o.id === p.objetivoActualId);
      expect(objetivo?.bando).not.toBe(p.bando);
    }

    // Corre turnos autónomos hasta que el encuentro se resuelva — tope de seguridad generoso
    // (nunca debería hacer falta tantos con solo 4 combatientes) para que un bug real de bucle
    // infinito falle el test en vez de colgarlo para siempre.
    let terminado = false;
    for (let i = 0; i < 60 && !terminado; i++) {
      const resultado = await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
      if (resultado?.encounterTerminado) terminado = true;
    }
    expect(terminado).toBe(true);

    const encounterFinal = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
    expect(encounterFinal.estado).toBe('RESUELTO');
    expect(encounterFinal.resolvedAt).not.toBeNull();

    // Al menos un bando entero quedó fuera de combate de verdad (GRAVE/CONVALECIENTE/MUERTO no
    // cuentan como objetivo válido) — confirma que la mecánica escribió condicionFisica real en
    // NpcState, no solo que el bucle se cortó por el tope de seguridad.
    const estados = await prisma.npcState.findMany({ where: { saveId } });
    const algunoFueraDeCombate = estados.some((s) => s.condicionFisica === 'CONVALECIENTE' || s.condicionFisica === 'MUERTO');
    expect(algunoFueraDeCombate).toBe(true);
  }, 30_000);

  // Auditoría "buscar tiradas de dados sin representar" (2026-09-04) — hallazgo real: el turno de
  // la jugadora en combate múltiple SIEMPRE tira con la misma mecánica que el 1v1, pero
  // `narrateAndPersistTurn` nunca construía `combatExchangeDisplay` para esta rama (variable
  // inicializada en `null`, nunca reasignada) — el jugador solo veía el texto narrado, sin el
  // desglose real de dados que sí ve en el 1v1 clásico (DiceRollReveal/CombatExchangeBadge).
  // Cobertura de integración real contra Postgres — más cerca de producción que el test unitario
  // de `combateMultiple.test.ts` (que solo verifica `resolverIntercambioCompleto` aislado).
  it('el turno real de la jugadora en combate múltiple expone combatExchangeDisplay con el desglose de dados', async () => {
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-jugadora-display', destreza: 10, inteligencia: 6 },
      ]),
    );
    const habilidadBasica: HabilidadParaIntercambio = {
      name: 'Ataque Básico',
      description: '',
      attribute: 'fuerza',
      effects: [],
      rol: 'ataque',
      energyCost: 5,
      energyRegen: 0,
    };

    const resultado = await resolverHastaJugadoraActua(saveId, worldId, encounterId, habilidadBasica);

    expect(resultado?.combatExchangeDisplay).not.toBeNull();
    expect(resultado?.combatExchangeDisplay?.atacanteEsJugador).toBe(true);
    expect(resultado?.combatExchangeDisplay?.atacante.roll).toBeGreaterThan(0);
    expect(resultado?.combatExchangeDisplay?.defensor.roll).toBeGreaterThan(0);
    expect(['golpe_pleno', 'golpe_normal', 'ataque_falla', 'parada_en_seco', 'defensor_contragolpea']).toContain(
      resultado?.combatExchangeDisplay?.resultado,
    );

    await prisma.combatEncounter.deleteMany({ where: { id: encounterId } });
  }, 15_000);

  it('con la jugadora en persona en un bando — resolverTurnoJugador ataca, resolverTurnoAutonomo cubre el resto', async () => {
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    // Destreza 1000 (mismo patrón que el test de `activeEffects` más abajo) — garantiza que la
    // jugadora actúe SIEMPRE primero en cada ronda, así el enemigo nunca llega a golpearla dos
    // veces antes de que ella lo remate con el bono de Fuerza.
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-jugadora', destreza: 10, inteligencia: 6 },
      ]),
    );

    // Fix real de `bandoSigueEnCombate` (2026-08-29): la jugadora CONVALECIENTE ya NO da el
    // combate por terminado (correcto, mismo criterio que el motor 1v1: "puedes seguir
    // intentándolo, muy penalizado") — con Fuerza 10 vs 10 el combate podía quedar sin resolverse
    // NUNCA en el tope de rondas de prueba (ninguno de los dos con margen decisivo suficiente para
    // llegar a MUERTO/CONVALECIENTE real del enemigo). +50 de Fuerza a la jugadora (mismo patrón
    // ya usado más abajo en el test de `activeEffects`) garantiza un margen decisivo cada intento
    // suyo, sin afectar lo que este test valida (el cableado real de `CombatParticipant`/
    // `CombatEncounter`, no quién gana).
    const efectoFuerza: ActiveEffect = { attribute: 'fuerza', magnitude: 100, turnsRemaining: 99, sourceAbility: 'Efecto de prueba' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoFuerza] as unknown as object } });

    const habilidadBasica: HabilidadParaIntercambio = {
      name: 'Ataque Básico',
      description: '',
      attribute: 'fuerza',
      effects: [],
      rol: 'ataque',
      energyCost: 5,
      energyRegen: 0,
    };

    // Tope 120 (2026-08-29): con `+50 Fuerza` casi siempre resuelve en pocas rondas, pero en el
    // caso límite donde AMBOS acaban CONVALECIENTE a la vez (el `condicionMalus` afecta a los dos
    // por igual, intercambios más lentos de decidirse) puede necesitar más margen — esto es un
    // artefacto real de la prueba (dos combatientes muy igualados en su peor estado), no un bug
    // del motor: el combate real de producción SÍ progresa turno a turno sin quedar bloqueado
    // (ver los otros 3 fixes de esta misma familia — `bandoSigueEnCombate`, el guard de
    // `resolverTurnoJugador`, `elegirObjetivo`/`objetivosValidosParaAtacar`).
    let terminado = false;
    for (let i = 0; i < 120 && !terminado; i++) {
      const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
      if (encounter.estado === 'RESUELTO') {
        terminado = true;
        break;
      }
      const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
      const actual = encounter.participantes.find((p) => p.id === actualId)!;
      if (actual.tipo === 'JUGADOR') {
        // Único enemigo posible en este 1v1 — el propio motor ya la reclama a ella
        // automáticamente al crear el encuentro (o al empezar cada ronda), nunca queda
        // `esperandoEleccionJugadora` — su objetivo ya viene fijo en `objetivoActualId`.
        const resultado = await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad: habilidadBasica }, [], dobleNarracionRapida);
        if (resultado?.encounterTerminado) terminado = true;
      } else {
        const resultado = await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
        if (resultado?.encounterTerminado) terminado = true;
      }
    }
    expect(terminado).toBe(true);

    const encounterFinal = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
    expect(encounterFinal.estado).toBe('RESUELTO');

    // La jugadora participó de verdad vía `Save` (nunca `NpcState`/`CombatParticipant` para ella)
    // — lo que prueba esto es que el combate terminó escribiendo en Save sin reventar, no un valor
    // concreto de condición (depende de tiradas reales, sin mockear Math.random en este test).
    const saveFinal = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO']).toContain(saveFinal.condicionFisica);

    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [], condicionFisica: 'ILESO', energia: 100 } });
  }, 30_000);

  // Bug real jugando en vivo (2026-09-07, "combate atascado para siempre, siempre el mismo mensaje
  // de guardia sin tirada"): a diferencia del test 1v1 de arriba (único enemigo posible, sin
  // `ordenIniciativa` que le gane la posición), con 2+ ENEMIGOS y la jugadora CONVALECIENTE, el
  // guard de `ejecutarIntercambioYAvanzar`/`ejecutarGolpeGratisYAvanzar` la trataba igual que a
  // cualquier NPC derrotado — ningún enemigo podía volver a resolver un intercambio real contra
  // ella, y como su propio turno también caía en `avanzarSinAtacar` (`dueloYaResueltoPorElOtro` da
  // por bueno ese "turno ya resuelto" del lado del enemigo con posición anterior), el combate
  // quedaba ciclando `turnoActual` sin que NADIE llegara a tirar nunca — ambos enemigos ILESO para
  // siempre. Reproduce el escenario exacto observado jugando: 2 enemigos, la jugadora se vuelve
  // CONVALECIENTE en algún punto y el combate debe seguir progresando después.
  it('con la jugadora convaleciente y 2+ enemigos, el combate SIGUE progresando (no se queda en bucle de "guardia sin resolver")', async () => {
    const [enemigo1, enemigo2] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    // Destreza baja a propósito para la jugadora — queda última en `ordenIniciativa`, el caso real
    // observado (los dos enemigos actúan ANTES que ella en cada ronda).
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo1.id, npcScope: 'itinerante-jugadora-convaleciente-1', destreza: 20, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo2.id, npcScope: 'itinerante-jugadora-convaleciente-2', destreza: 20, inteligencia: 6 },
      ]),
    );
    // Fuerza a la jugadora a CONVALECIENTE de entrada (sin depender de tiradas reales para llegar
    // ahí) — el propio escenario que dispara el bug, confirmado en partida real.
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'CONVALECIENTE' } });

    const habilidadBasica: HabilidadParaIntercambio = {
      name: 'Ataque Básico',
      description: '',
      attribute: 'fuerza',
      effects: [],
      rol: 'ataque',
      energyCost: 5,
      energyRegen: 0,
    };

    // Tope de seguridad generoso — con el bug real, `turnoActual` cicla sin fin sin que nadie tire
    // nunca, así que este test fallaría por timeout/tope antes que por una aserción, igual que el
    // resto de tests de "bucle infinito" de este archivo.
    let terminado = false;
    let algunEnemigoRecibioGolpe = false;
    for (let i = 0; i < 90 && !terminado; i++) {
      const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
      if (encounter.estado === 'RESUELTO') {
        terminado = true;
        break;
      }
      const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
      const actual = encounter.participantes.find((p) => p.id === actualId)!;
      const resultado =
        actual.tipo === 'JUGADOR'
          ? await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad: habilidadBasica }, [], dobleNarracionRapida)
          : await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
      if (resultado?.encounterTerminado) terminado = true;
      if (resultado?.combatExchangeDisplay) algunEnemigoRecibioGolpe = true;
    }

    // La aserción central del hallazgo: al menos UN intercambio real con tirada tuvo que ocurrir —
    // con el bug, esto se queda en `false` para siempre (90 vueltas de puro "avanzarSinAtacar").
    expect(algunEnemigoRecibioGolpe).toBe(true);

    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100 } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // Objetivo individual real (2026-08-26, docs/21-roadmap.md § Fase 3) — cablea `esperandoEleccionJugadora`/
  // `fijarEleccionRondaJugador` de punta a punta contra Postgres real: mientras la ronda está
  // esperando, NINGÚN turno se resuelve (ni el suyo ni los autónomos); en cuanto se fija su
  // elección, el encuentro queda libre para resolverse. Deliberadamente 1 vs. 1 (nada de un
  // segundo enemigo o aliado, con su propio empate de IA a romper) — el algoritmo de enganche en
  // sí (duelo/golpe gratis, cadenas de cancelación entre varios candidatos empatados) ya tiene
  // cobertura exhaustiva y determinista con `elegirObjetivoPara` mockeado a mano en
  // combateMultiple.test.ts; aquí solo importa que el CABLEADO real (persistencia en
  // `CombatParticipant`/`CombatEncounter`, bloqueo de `resolverTurnoAutonomo`/`resolverTurnoJugador`)
  // funcione contra la base de datos de verdad.
  it('objetivo individual: la ronda queda esperando su elección hasta fijarEleccionRondaJugador, y bloquea toda resolución hasta entonces', async () => {
    // El test anterior deja a la jugadora en cualquier condición real tras un combate sin sembrar
    // — `datosVivosDe` lee la condición REAL de `Save` en este test también (misma partida, mismo
    // `saveId` del describe), así que sin resetear aquí ella podría quedar fuera de "vivos"
    // (CONVALECIENTE/MUERTO) desde el primer cálculo de enganche, dejando este test flaky por una
    // razón ajena a lo que prueba.
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100 } });
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    // Mismo motivo que el test de arriba ("con la jugadora en persona..."): con Fuerza 10 vs 10 el
    // combate podía quedar sin resolverse en el tope de rondas de prueba desde el fix real de
    // `bandoSigueEnCombate` (2026-08-29, CONVALECIENTE ya no cuenta como "fuera de combate" para
    // la jugadora). +50 de Fuerza garantiza margen decisivo, sin afectar lo que este test valida
    // (el cableado de `esperandoEleccionJugadora`/`fijarEleccionRondaJugador`).
    const efectoFuerza: ActiveEffect = { attribute: 'fuerza', magnitude: 100, turnsRemaining: 99, sourceAbility: 'Efecto de prueba' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoFuerza] as unknown as object } });

    // Destreza 1000 (mismo motivo que el test de arriba) — nunca deja que el enemigo actúe
    // primero, así el margen decisivo de Fuerza siempre llega antes de que a ella le hagan daño.
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-espera', destreza: 10, inteligencia: 6 },
      ]),
    );

    const encounterInicial = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    const jugadoraP = encounterInicial.participantes.find((p) => p.tipo === 'JUGADOR')!;
    const enemigoP = encounterInicial.participantes.find((p) => p.tipo === 'NPC')!;

    // Con un único enemigo posible, el propio motor ya la reclama a ella automáticamente al crear
    // el encuentro (mismo comportamiento que el test 1v1 de arriba) — para probar el camino
    // "esperando", se fuerza a mano la precondición contraria (nadie la ha reclamado todavía),
    // exactamente el estado real que se da cuando SÍ hay más de un candidato posible y ninguno la
    // elige (caso real que motivó el diseño, jugando contra 2 cuervos).
    await prisma.combatEncounter.update({ where: { id: encounterId }, data: { esperandoEleccionJugadora: true } });
    await prisma.combatParticipant.update({ where: { id: jugadoraP.id }, data: { objetivoActualId: null } });
    await prisma.combatParticipant.update({ where: { id: enemigoP.id }, data: { objetivoActualId: null } });

    expect((await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } })).esperandoEleccionJugadora).toBe(true);

    // Ningún turno puede resolverse todavía — ni siquiera los autónomos.
    expect(await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida)).toBeNull();

    // Fija su elección — único enemigo posible, así que el resultado es determinista: duelo mutuo.
    await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, enemigoP.id);

    const encounterTrasElegir = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    expect(encounterTrasElegir.esperandoEleccionJugadora).toBe(false);
    const jugadoraTrasElegir = encounterTrasElegir.participantes.find((p) => p.tipo === 'JUGADOR')!;
    expect(jugadoraTrasElegir.objetivoActualId).toBe(enemigoP.id);
    const enemigoTrasElegir = encounterTrasElegir.participantes.find((p) => p.tipo === 'NPC')!;
    expect(enemigoTrasElegir.objetivoActualId).toBe(jugadoraP.id); // duelo mutuo real, no golpe gratis

    // Una segunda llamada, ya sin nada pendiente, no hace nada (defensivo).
    await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, enemigoP.id);
    const encounterSinCambios = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    expect(encounterSinCambios.participantes.find((p) => p.tipo === 'JUGADOR')!.objetivoActualId).toBe(enemigoP.id);

    // Ahora sí puede resolverse el resto de la ronda de una sentada (mismo bucle que el test 1v1
    // de arriba — único enemigo, así que nunca vuelve a quedar `esperandoEleccionJugadora` en
    // rondas siguientes, el propio motor la reclama sola cada vez).
    // Tope 120 (2026-08-29): con `+50 Fuerza` casi siempre resuelve en pocas rondas, pero en el
    // caso límite donde AMBOS acaban CONVALECIENTE a la vez (el `condicionMalus` afecta a los dos
    // por igual, intercambios más lentos de decidirse) puede necesitar más margen — esto es un
    // artefacto real de la prueba (dos combatientes muy igualados en su peor estado), no un bug
    // del motor: el combate real de producción SÍ progresa turno a turno sin quedar bloqueado
    // (ver los otros 3 fixes de esta misma familia — `bandoSigueEnCombate`, el guard de
    // `resolverTurnoJugador`, `elegirObjetivo`/`objetivosValidosParaAtacar`).
    let terminado = false;
    for (let i = 0; i < 120 && !terminado; i++) {
      const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
      if (encounter.estado === 'RESUELTO') {
        terminado = true;
        break;
      }
      const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
      const actual = encounter.participantes.find((p) => p.id === actualId)!;
      if (actual.tipo === 'JUGADOR') {
        const habilidadBasica: HabilidadParaIntercambio = { name: 'Ataque Básico', description: '', attribute: 'fuerza', effects: [], rol: 'ataque', energyCost: 5, energyRegen: 0 };
        const resultado = await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad: habilidadBasica }, [], dobleNarracionRapida);
        if (resultado?.encounterTerminado) terminado = true;
      } else {
        const resultado = await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
        if (resultado?.encounterTerminado) terminado = true;
      }
    }
    expect(terminado).toBe(true);

    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [], condicionFisica: 'ILESO', energia: 100 } });
  }, 30_000);

  // Fase 3 § 3a de efectos de clase (2026-08-27, docs/21-roadmap.md) — cierra el hueco de Fase 2:
  // `combateMultipleOrquestacion.ts` no leía/aplicaba `activeEffects` en absoluto hasta ahora.
  it('activeEffects: un efecto ya activo en Save se lee (afecta el intercambio) y se decrementa tras un intercambio real', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100 } });
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    // +50 de fuerza garantiza que la jugadora gane la tirada por margen decisivo pase lo que pase
    // (rango de dado 1-20, nunca hace falta mockear Math.random) — reutiliza el propio mecanismo
    // que se está probando para forzar un resultado determinista, mismo criterio que el resto de
    // este archivo evita mockear el dado en integración.
    const efectoPrevio: ActiveEffect = { attribute: 'fuerza', magnitude: 50, turnsRemaining: 3, sourceAbility: 'Efecto de prueba' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoPrevio] as unknown as object } });

    // Destreza de iniciativa desproporcionada (2026-08-27, ver `rollInitiativeMultiple`: `result =
    // roll + floor(destreza/2)`, rango de dado 1-20) — garantiza que actúe ANTES que el NPC pase lo
    // que pase, así el intercambio real que decrementa el efecto es siempre el de su propio turno,
    // nunca "resuelto de más" por un duelo mutuo que ya resolvió el NPC primero.
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-activeeffects', destreza: 10, inteligencia: 6 },
      ]),
    );

    const habilidadBasica: HabilidadParaIntercambio = { name: 'Ataque Básico', description: '', attribute: 'fuerza', effects: ['ATAQUE'], rol: 'ataque', energyCost: 5, energyRegen: 0 };
    const resultado = await resolverHastaJugadoraActua(saveId, worldId, encounterId, habilidadBasica);
    expect(resultado).not.toBeNull();

    const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    const activeEffectsTras = parseActiveEffects(saveTrasIntercambio.activeEffects);
    expect(activeEffectsTras).toEqual([{ ...efectoPrevio, turnsRemaining: 2 }]);

    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [] } });
  }, 30_000);

  it('activeEffects: AUMENTO con margen decisivo empuja un ActiveEffect nuevo, sin decrementarlo este mismo turno', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    // Magnitud grande de sobra (2026-08-27) — tiene que garantizar margen decisivo (golpe_pleno,
    // diferencia >=10) incluso en el peor caso de dados (ella saca 1, el NPC saca 20 defendiéndose
    // con Constitución), no solo "de media".
    const efectoPrevio: ActiveEffect = { attribute: 'magia', magnitude: 100, turnsRemaining: 3, sourceAbility: 'Efecto de prueba (garantiza el margen)' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoPrevio] as unknown as object } });

    // Energía del NPC a 0 (2026-08-27) — fuerza a `chooseNpcAbility` a defenderse SOLO con
    // "Defenderse"/"Descansar" (las 2 únicas de coste 0, ambas `rol:'defensa'`): sin esto, el 30%
    // de las veces (o si le toca su racial `utilidad` "Instinto Solitario") el intercambio cae en
    // el camino INDEPENDIENTE (`esIndependiente`, `defensorHabilidad.rol==='utilidad'`), donde
    // AUMENTO/DEBILIDAD nunca se dispara — mismo alcance exacto que Fase 2 (solo el camino NO
    // independiente), no un bug: solo hay que controlarlo para que el test sea determinista.
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-aumento' } },
      create: { saveId, npcId: enemigo.id, scope: 'itinerante-aumento', energia: 0 },
      update: { energia: 0 },
    });

    // Misma iniciativa forzada que el test anterior — el intercambio con AUMENTO tiene que ser
    // literalmente el de la habilidad que la jugadora elige (`accion.habilidad`), nunca la que
    // auto-elige un NPC al defenderse (`NpcCombatAbility` no lleva `durationEffectMagnitude/Turns`).
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-aumento', destreza: 10, inteligencia: 6 },
      ]),
    );

    const habilidadConAumento: HabilidadParaIntercambio = {
      name: 'Golpe de Prueba',
      description: '',
      attribute: 'magia',
      effects: ['ATAQUE', 'AUMENTO'],
      rol: 'ataque',
      energyCost: 5,
      energyRegen: 0,
      durationEffectMagnitude: 5,
      durationEffectTurns: 2,
    };
    const resultado = await resolverHastaJugadoraActua(saveId, worldId, encounterId, habilidadConAumento);
    expect(resultado).not.toBeNull();

    const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    const activeEffectsTras = parseActiveEffects(saveTrasIntercambio.activeEffects);
    // El previo decrementado (3->2) + el nuevo tal cual (sin decrementar este turno, 2 completos).
    expect(activeEffectsTras).toContainEqual({ ...efectoPrevio, turnsRemaining: 2 });
    expect(activeEffectsTras).toContainEqual({ attribute: 'magia', magnitude: 5, turnsRemaining: 2, sourceAbility: 'Golpe de Prueba' });

    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [] } });
  }, 30_000);

  // CONTROL real (Fase 3 § 3a) — forzado a mano vía `controladoPorRondas` (mismo criterio que el
  // test de `esperandoEleccionJugadora` de arriba: probar el CABLEADO real contra Postgres, sin
  // depender de que una tirada real dispare la condición de disparo, ya cubierta en
  // combateMultiple.test.ts).
  it('CONTROL real: un combatiente controlado ataca a su PROPIO bando, nunca al contrario, y se decrementa una ronda por vuelta', async () => {
    const jugadorNpc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const [controladoNpc, aliadoNpc] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'NPC', npcId: jugadorNpc.id, npcScope: 'itinerante-control-jugador', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: controladoNpc.id, npcScope: 'itinerante-control-controlado', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: aliadoNpc.id, npcScope: 'itinerante-control-aliado', destreza: 10, inteligencia: 6 },
      ]),
    );

    const encounterInicial = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    const controladoP = encounterInicial.participantes.find((p) => p.npcId === controladoNpc.id && p.npcScope === 'itinerante-control-controlado')!;
    await prisma.combatParticipant.update({ where: { id: controladoP.id }, data: { controladoPorRondas: 2 } });

    // Resuelve la ronda entera (3 combatientes) — nunca por resolverTurnoJugador (todos son NPC).
    // Se identifica el turno exacto del controlado ANTES de resolverlo (el propio golpe puede
    // fallar la tirada, así que lo que de verdad prueba el redirect es a quién declara el
    // resultado como defensor, no si el golpe llegó a conectar).
    let turnoControladoVisto = false;
    for (let i = 0; i < 3; i++) {
      const encounterAntes = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
      const actualIdAntes = encounterAntes.ordenIniciativa[encounterAntes.turnoActual % encounterAntes.ordenIniciativa.length];
      const esTurnoControlado = actualIdAntes === controladoP.id;

      const resultado = await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
      expect(resultado).not.toBeNull();

      if (esTurnoControlado) {
        turnoControladoVisto = true;
        // El enganche normal solo empareja bandos contrarios — que el defensor sea el propio
        // aliado (mismo bando) es IMPOSIBLE salvo por el redirect de CONTROL.
        expect(resultado!.atacanteNombre).toBe(controladoNpc.name);
        expect(resultado!.defensorNombre).toBe(aliadoNpc.name);
      }
    }
    expect(turnoControladoVisto).toBe(true);

    // Una ronda completa cruzada -> un turno de control menos (2 -> 1), mismo cuidado de orden que
    // `ActiveEffect.turnsRemaining` (nunca dentro de la misma ronda en que se fija).
    const controladoTrasRonda = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: controladoP.id } });
    expect(controladoTrasRonda.controladoPorRondas).toBe(1);

    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // Fase 3 § 3b de efectos de clase (2026-08-27, docs/21-roadmap.md) — MULTIPLE real.
  it('MULTIPLE: un golpe decisivo con ATAQUE+MULTIPLE también alcanza a un segundo enemigo del mismo bando', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const [enemigoPrincipal, enemigoExtra] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);

    // Mismo mecanismo que el test de AUMENTO: +100 de fuerza garantiza margen decisivo (golpe_pleno)
    // pase lo que pase, sin mockear el dado. Energía de ambos NPC a 0 (mismo motivo que el test de
    // AUMENTO): fuerza a `chooseNpcAbility` a defenderse solo con las 2 habilidades de coste 0
    // (`rol:'defensa'`), evitando el camino independiente donde MULTIPLE nunca dispara.
    const efectoPrevio: ActiveEffect = { attribute: 'fuerza', magnitude: 100, turnsRemaining: 3, sourceAbility: 'Efecto de prueba (garantiza el margen)' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoPrevio] as unknown as object } });
    await Promise.all([
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoPrincipal.id, scope: 'itinerante-multiple-principal' } },
        create: { saveId, npcId: enemigoPrincipal.id, scope: 'itinerante-multiple-principal', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoExtra.id, scope: 'itinerante-multiple-extra' } },
        create: { saveId, npcId: enemigoExtra.id, scope: 'itinerante-multiple-extra', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
    ]);

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoPrincipal.id, npcScope: 'itinerante-multiple-principal', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoExtra.id, npcScope: 'itinerante-multiple-extra', destreza: 10, inteligencia: 6 },
      ]),
    );

    // Con 2 enemigos posibles, el motor la deja `esperandoEleccionJugadora` (nunca la reclama sola
    // — a diferencia del 1v1) — se fija a mano su elección, mismo patrón que el test de "objetivo
    // individual" de arriba.
    const encounterInicial = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    if (encounterInicial.esperandoEleccionJugadora) {
      const principalP = encounterInicial.participantes.find((p) => p.npcScope === 'itinerante-multiple-principal')!;
      await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, principalP.id);
    }

    const habilidadMultiple: HabilidadParaIntercambio = {
      name: 'Golpe de Prueba (MULTIPLE)',
      description: '',
      attribute: 'fuerza',
      effects: ['ATAQUE', 'MULTIPLE'],
      rol: 'ataque',
      energyCost: 5,
      energyRegen: 0,
    };
    const resultado = await resolverHastaJugadoraActua(saveId, worldId, encounterId, habilidadMultiple);
    expect(resultado).not.toBeNull();

    // El único enemigo con el que NO se emparejó por el enganche normal (2 enemigos, 1 jugadora)
    // también quedó golpeado — bajo el enganche normal esto es imposible sin MULTIPLE, ya que la
    // jugadora solo tiene UN `objetivoActualId` por ronda.
    const [stateA, stateB] = await Promise.all([
      prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: enemigoPrincipal.id, scope: 'itinerante-multiple-principal' } } }),
      prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: enemigoExtra.id, scope: 'itinerante-multiple-extra' } } }),
    ]);
    expect(stateA?.condicionFisica).not.toBe('ILESO');
    expect(stateB?.condicionFisica).not.toBe('ILESO');

    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [] } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // Fase 3 § 3c de efectos de clase (2026-08-27, docs/21-roadmap.md) — DESVIAR real.
  it('DESVIAR: la defensora gana por margen decisivo -> el golpe entrante se redirige a un aliado del atacante', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginal = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Destreza masiva SOLO en Save.attributes (no en la iniciativa) — garantiza que su defensa
    // (DESVIAR, atributo destreza) gane por margen decisivo pase lo que pase, sin mockear el dado.
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginal.attributes as object), destreza: 500 } } });
    // Única SavedAction de defensa real que tiene — `datosVivosDe` solo cae al fallback genérico
    // (Esquivar) si su roster está vacío, así que esto garantiza que SIEMPRE se defienda con ella.
    await prisma.savedAction.create({
      data: {
        saveId,
        name: 'Comunión Salvaje (prueba)',
        description: '',
        icon: '🦌',
        category: 'combate',
        promptText: '',
        rol: 'defensa',
        effects: ['AGUANTE', 'DESVIAR'],
        preferredAttribute: 'destreza',
        attributeBonus: 6,
        energyCost: 0,
        energyRegen: 0,
      },
    });

    const [atacante, aliado] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);

    // Iniciativa del atacante muy por encima de la del aliado — garantiza que sea el atacante
    // quien la reclame a ella en el enganche de la ronda 1 (único candidato posible para ambos, el
    // primero en procesarse en `ordenIniciativa` gana el duelo mutuo real, ver combateMultiple.ts).
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 10, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: atacante.id, npcScope: 'itinerante-desviar-atacante', destreza: 1000, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: aliado.id, npcScope: 'itinerante-desviar-aliado', destreza: 1, inteligencia: 6 },
      ]),
    );

    let resultadoAtaque: Awaited<ReturnType<typeof resolverTurnoAutonomo>> | null = null;
    for (let i = 0; i < 10 && !resultadoAtaque; i++) {
      const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
      if (encounter.estado === 'RESUELTO') break;
      const resultado = await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
      if (resultado?.atacanteNombre === atacante.name) resultadoAtaque = resultado;
    }
    expect(resultadoAtaque).not.toBeNull();

    // El aliado (que nunca fue el objetivo del enganche normal — ni el atacante ni la jugadora lo
    // eligieron) queda golpeado — solo posible por el redirect de DESVIAR.
    const aliadoState = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: aliado.id, scope: 'itinerante-desviar-aliado' } } });
    expect(aliadoState?.condicionFisica).not.toBe('ILESO');

    await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginal.attributes as object } });
    await prisma.savedAction.deleteMany({ where: { saveId, name: 'Comunión Salvaje (prueba)' } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // Consolidación (auditoría 2026-09-01, "CONTROL estructuralmente inalcanzable para cualquier
  // NPC"): el efecto CONTROL en sí ya tenía cobertura unitaria (combateMultiple.test.ts, mockeando
  // la habilidad directamente) y `chooseNpcAbility` ya prueba por separado que SÍ elige una
  // utilidad con CONTROL al atacar — este test confirma el CABLEADO real end-to-end: un NPC
  // Chamán/Opresor real, con su roster real derivado del catálogo (npcCombatAbilitiesFor), ataca
  // de verdad con Opresión Mental y controla al rival. Ulkha Ketg (nivel 6 editable de forma
  // segura para pruebas, sin entrelazado de misión) se fuerza temporalmente a CHAMAN/OPRESOR/nivel
  // 16 (mínimo real para desbloquear Opresión Mental, classAbilities.ts) y se revierte al final —
  // Ulkha dejó de ser CHAMAN de base tras la auditoría de lore 2026-09-06 (pasó a CAZADOR/DOMADOR,
  // el "don de comunión" con las Gargantúas que justificaba su clase se quitó del lore), así que
  // aquí también hay que forzar `clase`, no solo `especializacion`.
  it('CONTROL real: un NPC Chamán/Opresor ataca con Opresión Mental y marca al rival como controlado', async () => {
    const opresor = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'ulkha-ketg' } });
    const rival = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    await prisma.npc.update({ where: { id: opresor.id }, data: { clase: 'CHAMAN', especializacion: 'OPRESOR', level: 16 } });

    // NPC vs NPC (no NPC vs jugadora): `datosVivosDe` da a la jugadora, cuando defiende, SOLO
    // habilidades rol:'defensa'/'utilidad' (sus propias SavedAction reales o el fallback fijo
    // ESQUIVAR_GENERICO) — nunca 'ataque'. Como `utilityTriggered` exige que el DEFENSOR responda
    // con rol:'ataque' para que CONTROL dispare, la jugadora nunca podría cumplirlo por diseño; un
    // rival NPC real sí puede, vía `chooseNpcAbility('defensa', ...)` cayendo al roster completo.
    //
    // Secuencia de Math.random mockeada por cada turno del opresor (2 llamadas reales antes de
    // llegar al roll de la tirada, confirmadas con depuración en vivo antes de fijar esta
    // secuencia):
    // 1) `chooseNpcAbility(opresor, 'ataque', ...)` — roster filtrado a rol:'ataque'+CONTROL da
    //    `[Ataque base, Carga Rúnica, Grillete Rúnico, Opresión Mental]` (4 — la racial activa
    //    "Sangre del Estallido" se quitó del roster de NPC, 2026-09-04, bug real jugando en vivo:
    //    "el Orco Enfurecido usó Sangre del Estallido... juraría que la descatalogamos", mismo
    //    criterio ya aplicado al jugador el 2026-09-01, ver npcCombatAbilities.ts). `Math.floor(0.9*4)=3`
    //    → Opresión Mental (índice 3, confirmado con debug_roster.mts contra el catálogo real).
    // 2) `chooseNpcAbility(rival, 'defensa', ...)` — primer random decide si prefiere defensiva
    //    (línea `random() < 0.7`); 0.99 (`>=0.7`) fuerza caer al roster COMPLETO (línea
    //    `affordable[...]`, no solo defensivas). Segundo random elige el índice: roster real del
    //    Aullador Rojo `[Ataque base, Posicion defensiva, Filos centella, Instinto Solitario,
    //    Esquivar, Defenderse, Descansar]` (7) — `Math.floor(0.1*7)=0` → Ataque base (`rol:'ataque'`,
    //    justo lo que exige `utilityTriggered`).
    // 3-4) `rollD20` del atacante y del defensor (combatExchange.ts) — ambos con roll alto
    //    (`Math.floor(0.9*20)+1=19`) para que la tirada del opresor tenga éxito con margen incluso
    //    con `magia:8` (bono +4, resultado 23 vs dificultad fija 15).
    const secuenciaPorTurno = [0.9, 0.99, 0.1, 0.9, 0.9];
    const randomSpy = vi.spyOn(Math, 'random');
    try {
      // 1v1 puro NPC vs NPC, sin jugadora (mismo patrón que otros tests de este archivo, MULTIPLE/
      // DESVIAR arriba) — `jugadorParticipantId` acepta null con seguridad.
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'NPC', npcId: opresor.id, npcScope: 'itinerante-control-opresor', destreza: 1000, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: rival.id, npcScope: 'itinerante-control-rival', destreza: 1, inteligencia: 6 },
        ]),
      );

      let opresorControlo = false;
      for (let i = 0; i < 10 && !opresorControlo; i++) {
        const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
        if (encounter.estado === 'RESUELTO') break;
        const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
        const actual = encounter.participantes.find((p) => p.id === actualId)!;
        if (actual.npcScope === 'itinerante-control-opresor') {
          for (const r of secuenciaPorTurno) randomSpy.mockReturnValueOnce(r);
        }
        await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
        const rivalP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, npcScope: 'itinerante-control-rival' } });
        if ((rivalP.controladoPorRondas ?? 0) > 0) opresorControlo = true;
      }
      expect(opresorControlo).toBe(true);

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      randomSpy.mockRestore();
      await prisma.npc.update({ where: { id: opresor.id }, data: { clase: opresor.clase, especializacion: opresor.especializacion, level: opresor.level } });
    }
  }, 30_000);

  // Fase 3 § 3c de efectos de clase (2026-08-27) — OCULTACION real: forzada a mano vía
  // `ocultoPorRondas` (mismo criterio que el test de CONTROL: probar el CABLEADO real, la condición
  // de disparo ya está cubierta en combateMultiple.test.ts). La exclusión de `resolverEnganchesRonda`
  // en sí (nunca elegido salvo ser el único vivo del bando) ya tiene cobertura exhaustiva y
  // determinista en combateMultiple.test.ts, con `elegirObjetivoPara` mockeado a mano — con un solo
  // enemigo real de por medio (sin mockear el dado, mismo criterio que el resto de este archivo),
  // el propio oculto SIGUE PUDIENDO reclamar de vuelta a quien lo evita (nada le impide elegir su
  // propio objetivo con normalidad, ver comentario de `resolverEnganchesRonda`) — cuando eso pasa,
  // rompe su propia ocultación al instante (bug real cazado en esta misma implementación: un oculto
  // reclamado de vuelta por sí mismo se quedaba "oculto" para siempre pese a haber elegido combatir,
  // porque la ruptura solo miraba al atacante de turno, nunca al defensor de un duelo mutuo real).
  // Lo que este test prueba de verdad contra Postgres real es justo eso: la ocultación SIEMPRE acaba
  // rompiéndose en cuanto el propio oculto participa de verdad en un intercambio, nunca se queda
  // "colgada" indefinidamente.
  it('OCULTACION: se rompe en cuanto el propio oculto participa de verdad en un intercambio', async () => {
    const [npcOculto, npcVisible, npcEnemigo] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'NPC', npcId: npcOculto.id, npcScope: 'itinerante-ocultacion-oculto', destreza: 10, inteligencia: 6 },
        { bando: 'JUGADOR', tipo: 'NPC', npcId: npcVisible.id, npcScope: 'itinerante-ocultacion-visible', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: npcEnemigo.id, npcScope: 'itinerante-ocultacion-enemigo', destreza: 1000, inteligencia: 6 },
      ]),
    );

    const encounterInicial = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    const ocultoP = encounterInicial.participantes.find((p) => p.npcScope === 'itinerante-ocultacion-oculto')!;
    await prisma.combatParticipant.update({ where: { id: ocultoP.id }, data: { ocultoPorRondas: 2 } });

    // Suficientes turnos autónomos para cubrir 2 rondas completas de sobra (3 combatientes -> 3
    // turnos por ronda) — con un solo enemigo real, el propio oculto acaba forzado a intercambiar
    // golpes con él tarde o temprano (no tiene ningún otro candidato posible al que atacar), momento
    // en el que su ocultación se rompe.
    for (let i = 0; i < 6; i++) {
      await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
    }

    const ocultoTrasCombate = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: ocultoP.id } });
    expect(ocultoTrasCombate.ocultoPorRondas).toBeNull();

    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // Fase 3 § 3d de efectos de clase (2026-08-27) — INVOCACION real: la jugadora invoca a Tótem de
  // Guerra (SavedAction real con `effects: ['INVOCACION']`) — su propio turno se consume entero
  // (sin golpe propio), y se crea un CombatParticipant tipo INVOCACION vivo del bando JUGADOR.
  it('INVOCACION: invocar crea el tótem, consume el turno entero (sin golpe propio) y lo engancha al bando del invocador', async () => {
    await prisma.savedAction.create({
      data: {
        saveId,
        name: 'Tótem de Guerra (prueba)',
        description: '',
        icon: '🗿',
        category: 'combate',
        promptText: '',
        rol: 'ataque',
        effects: ['INVOCACION'],
        preferredAttribute: 'magia',
        energyCost: 0,
        energyRegen: 0,
      },
    });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-invocacion-enemigo', destreza: 1, inteligencia: 6 },
      ]),
    );
    await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } })).id);

    const habilidad: HabilidadParaIntercambio = {
      name: 'Tótem de Guerra (prueba)',
      description: '',
      attribute: 'magia',
      effects: ['INVOCACION'],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    const resultado = await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad }, [], dobleNarracionRapida);
    expect(resultado).not.toBeNull();
    expect(resultado?.defensorNombre).toBe('Tótem de Guerra');

    const totem = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'INVOCACION' } });
    expect(totem.bando).toBe('JUGADOR');
    expect(totem.invocacionVidaRestante).toBe(1);
    expect(totem.invocacionRondasRestantes).toBe(2);

    await prisma.savedAction.deleteMany({ where: { saveId, name: 'Tótem de Guerra (prueba)' } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  it('INVOCACION: el tótem ataca al cruzar de ronda y desaparece al primer golpe recibido ("aguanta 1 golpe")', async () => {
    const [invocador, enemigo] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'NPC', npcId: invocador.id, npcScope: 'itinerante-invocacion-invocador', destreza: 1000, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-invocacion-victima', destreza: 1, inteligencia: 6 },
      ]),
    );
    const invocadorP = (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, npcScope: 'itinerante-invocacion-invocador' } })).id;

    // Tótem ya vivo (forzado a mano, mismo criterio que los tests de CONTROL/OCULTACION: probar
    // el CABLEADO real de "ataca al cruzar de ronda", la creación en sí ya está cubierta arriba) —
    // 1 ronda restante, para que el próximo cruce de ronda sea justo su último ataque.
    await prisma.combatParticipant.create({
      data: {
        encounterId,
        bando: 'JUGADOR',
        tipo: 'INVOCACION',
        npcId: (await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'totem-de-guerra' } })).id,
        invocacionVidaRestante: 1,
        invocacionRondasRestantes: 1,
        invocacionInvocadorId: invocadorP,
      },
    });

    // 2 combatientes reales en ordenIniciativa -> 2 turnos autónomos cruzan la ronda 1 entera.
    for (let i = 0; i < 2; i++) {
      await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
    }

    const victimaState = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-invocacion-victima' } } });
    expect(victimaState?.condicionFisica).not.toBe('ILESO'); // el tótem la golpeó al cruzar de ronda

    const totemTrasAtacar = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'INVOCACION' } });
    expect(totemTrasAtacar.invocacionRondasRestantes).toBe(0);
    expect(totemTrasAtacar.invocacionVidaRestante).toBe(0); // agotó su duración -> expira igual que si lo hubieran destruido

    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  it('INVOCACION: no se puede invocar un segundo tótem del mismo tipo mientras el primero siga vivo', async () => {
    await prisma.savedAction.create({
      data: {
        saveId,
        name: 'Tótem de Guerra (prueba candado)',
        description: '',
        icon: '🗿',
        category: 'combate',
        promptText: '',
        rol: 'ataque',
        effects: ['INVOCACION'],
        preferredAttribute: 'magia',
        energyCost: 0,
        energyRegen: 0,
      },
    });
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-invocacion-candado', destreza: 1, inteligencia: 6 },
      ]),
    );
    await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } })).id);

    const habilidad: HabilidadParaIntercambio = {
      name: 'Tótem de Guerra (prueba candado)',
      description: '',
      attribute: 'magia',
      effects: ['INVOCACION'],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad }, [], dobleNarracionRapida);
    const primerTotem = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'INVOCACION' } });

    // Segundo intento de invocar en el turno siguiente de la jugadora — con el primer tótem
    // todavía vivo, el candado debe impedir crear uno nuevo (el turno se pierde en silencio, mismo
    // criterio que `avanzarSinAtacar`).
    for (let i = 0; i < 10; i++) {
      const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
      if (encounter.estado === 'RESUELTO') break;
      const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
      if (actualId === (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } })).id) {
        await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad }, [], dobleNarracionRapida);
        break;
      }
      await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
    }

    const totemsVivos = await prisma.combatParticipant.findMany({ where: { encounterId, tipo: 'INVOCACION', invocacionVidaRestante: { gt: 0 } } });
    expect(totemsVivos).toHaveLength(1);
    expect(totemsVivos[0].id).toBe(primerTotem.id);

    await prisma.savedAction.deleteMany({ where: { saveId, name: 'Tótem de Guerra (prueba candado)' } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // Fase 3 § 3e de efectos de clase (2026-08-27) — EXPULSAR real: mismo mecanismo de exclusión que
  // OCULTACION (columna separada, `expulsadoPorRondas`), disparado por Embate de Escudo con margen
  // decisivo. Cableado real bajo prueba aquí: la habilidad SÍ marca `expulsadoPorRondas` sobre el
  // defensor golpeado (nunca sobre el atacante), y se decrementa al cruzar de ronda igual que
  // CONTROL/OCULTACION — la exclusión de `resolverEnganchesRonda` en sí (incluida la excepción de
  // "único vivo del bando") ya tiene cobertura exhaustiva y determinista en combateMultiple.test.ts.
  it('EXPULSAR: Embate de Escudo con margen decisivo marca expulsadoPorRondas sobre el defensor golpeado, y se decrementa al cruzar de ronda', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginal = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Constitución masiva SOLO en Save.attributes (no en la iniciativa) — garantiza que su ataque
    // (EXPULSAR, atributo constitución) gane por margen decisivo pase lo que pase, sin mockear el dado.
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginal.attributes as object), constitucion: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-expulsar-victima', destreza: 1, inteligencia: 6 },
      ]),
    );
    await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } })).id);
    // Energía a 0 (mismo gotcha ya cazado en el test de AUMENTO de 3a): sin esto, el NPC puede
    // defenderse con una habilidad racial `rol:'utilidad'` propia, cayendo en el camino
    // independiente — donde `expulsarTriggered` nunca se calcula — en vez del no-independiente.
    // Forzar energía a 0 garantiza que solo pueda pagar sus 2 habilidades genéricas de coste 0
    // (`rol:'defensa'`), asegurando el camino no-independiente sin mockear el dado.
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-expulsar-victima' } },
      create: { saveId, npcId: enemigo.id, scope: 'itinerante-expulsar-victima', energia: 0 },
      update: { energia: 0 },
    });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Embate de Escudo (prueba)',
      description: '',
      attribute: 'constitucion',
      attributeBonus: 4,
      effects: ['ATAQUE', 'EXPULSAR'],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad }, [], dobleNarracionRapida);

    const victimaP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, npcScope: 'itinerante-expulsar-victima' } });
    expect(victimaP.expulsadoPorRondas).toBe(2);

    // Cruza una ronda completa (2 combatientes reales -> 2 turnos autónomos) — el decremento real
    // se comprueba SOLO tras el intercambio de la jugadora, así que el turno de la propia víctima
    // (que ya actuó arriba) no vuelve a contar: solo hace falta 1 turno autónomo más para cruzar.
    await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
    const victimaTrasRonda = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: victimaP.id } });
    expect(victimaTrasRonda.expulsadoPorRondas).toBeLessThan(2);

    await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginal.attributes as object } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  it('EXPULSAR: si el expulsado es el único enemigo vivo, no impide que el combate lo siga enganchando (nunca deja el combate sin nadie)', async () => {
    const [victima, aliado] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'NPC', npcId: aliado.id, npcScope: 'itinerante-expulsar-unico-jugador', destreza: 1000, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: victima.id, npcScope: 'itinerante-expulsar-unico-enemigo', destreza: 1, inteligencia: 6 },
      ]),
    );
    const victimaP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, npcScope: 'itinerante-expulsar-unico-enemigo' } });
    await prisma.combatParticipant.update({ where: { id: victimaP.id }, data: { expulsadoPorRondas: 2 } });

    // Único enemigo real del encuentro — pese a estar "expulsado", sigue siendo el único candidato
    // posible: el aliado del bando JUGADOR debe seguir eligiéndolo como objetivo (nunca quedarse
    // sin nadie a quien atacar). No se espera a que el combate TERMINE (depende de dados de daño
    // reales, no del cableado de EXPULSAR bajo prueba aquí) — solo que el enganche real siga
    // funcionando pese a la exclusión.
    const aliadoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, npcScope: 'itinerante-expulsar-unico-jugador' } });
    let encounterTerminado = false;
    for (let i = 0; i < 3 && !encounterTerminado; i++) {
      const resultado = await resolverTurnoAutonomo(prisma, worldId, saveId, encounterId, [], dobleNarracionRapida);
      encounterTerminado = resultado?.encounterTerminado ?? false;
    }
    const encounterFinal = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    if (!encounterTerminado) {
      const aliadoFresco = encounterFinal.participantes.find((p) => p.id === aliadoP.id)!;
      expect(aliadoFresco.objetivoActualId).toBe(victimaP.id); // sigue enganchado a la víctima, no null
    }

    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // "Analizar Rival" real en combate múltiple (2026-08-27) — cierra el hueco que dejó Fase A/B: el
  // resultado se calculaba en `resolverIntercambioCompleto` y se descartaba, nunca llegaba a
  // `NpcState.analizado`. Solitario -> `NpcState.analizado`; miembro de grupo -> su PROPIO
  // `CombatParticipant.analizadoGrupo`, NUNCA el `NpcState` compartido de la especie (analizar a un
  // buitre no debe desbloquear la ficha del otro).
  it('ANALIZAR RIVAL: contra un enemigo solitario, marca NpcState.analizado real', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginal = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Inteligencia masiva SOLO en Save.attributes (no en la iniciativa) — garantiza que la utilidad
    // (ANALISIS, atributo inteligencia) tenga éxito pase lo que pase, sin mockear el dado.
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginal.attributes as object), inteligencia: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-analizar-solitario', destreza: 1, inteligencia: 6 },
      ]),
    );
    await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } })).id);

    const habilidad: HabilidadParaIntercambio = {
      name: 'Analizar Rival (prueba)',
      description: '',
      attribute: 'inteligencia',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad }, [], dobleNarracionRapida);

    const npcState = await prisma.npcState.findUniqueOrThrow({
      where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-analizar-solitario' } },
    });
    expect(npcState.analizado).toBe(true);

    await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginal.attributes as object } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  it('ANALIZAR RIVAL: contra un miembro de grupo, marca SOLO su propio CombatParticipant.analizadoGrupo, nunca el del otro individuo', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginal = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginal.attributes as object), inteligencia: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-analizar-grupo', destreza: 1, inteligencia: 6, esGrupo: true },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-analizar-grupo', destreza: 1, inteligencia: 6, esGrupo: true },
      ]),
    );
    const [analizado, otro] = await prisma.combatParticipant.findMany({ where: { encounterId, npcId: enemigo.id } });
    await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, analizado.id);

    const habilidad: HabilidadParaIntercambio = {
      name: 'Analizar Rival (prueba grupo)',
      description: '',
      attribute: 'inteligencia',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad }, [], dobleNarracionRapida);

    const analizadoFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: analizado.id } });
    const otroFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: otro.id } });
    expect(analizadoFresco.analizadoGrupo).toBe(true);
    expect(otroFresco.analizadoGrupo).not.toBe(true); // el otro individuo del grupo NO queda analizado de rebote

    // El NpcState compartido de la especie tampoco debe quedar marcado — el análisis de grupo vive
    // en el propio CombatParticipant, nunca contamina la fila compartida.
    const npcStateCompartido = await prisma.npcState.findUnique({
      where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-analizar-grupo' } },
    });
    expect(npcStateCompartido?.analizado ?? false).toBe(false);

    await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginal.attributes as object } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);
});

// Hallazgo colateral de un agente jugando en vivo (2026-08-29, reverificando otro bug): "varios
// ataques con 'Éxito con coste' contra un miembro de grupo (3 Gesgurio) no bajaban su condición —
// se quedaba en Ileso 100 tras 6+ golpes conectados", sospecha propia del agente de mismatch de
// `participantId`. Investigado por código antes de aceptar el diagnóstico: `escribirCondicionYEnergia`
// SÍ comprueba `condicionFisicaGrupo !== null` primero y escribe en el propio `CombatParticipant`
// (nunca en el `NpcState` compartido) — el código parece correcto. Sospecha alternativa, más
// probable: el agente consultó `NpcState.condicionFisica` directamente (fila COMPARTIDA por todos
// los individuos de la especie, fija en ILESO durante el combate por diseño — la condición real de
// cada individuo vive en `CombatParticipant.condicionFisicaGrupo`) en vez de `GET /saves/:id`,
// falso positivo de método de verificación, no un bug real. Test aislado y determinista, construido
// para confirmar cuál de las dos hipótesis es la correcta: golpe NO decisivo ('golpe_normal', el
// caso real reportado — "éxito con coste") contra UN miembro de un grupo de 2. **CONFIRMADO: el
// código está bien** — `condicionFisicaGrupo` del golpeado sí baja (ILESO → HERIDO), el otro
// individuo y el `NpcState` compartido no se ven afectados. La hipótesis del falso positivo de
// verificación queda como la explicación más probable del hallazgo original del agente.
describe('Golpe no decisivo ("golpe_normal") contra un miembro de grupo SÍ baja su condicionFisicaGrupo (investigación 2026-08-29, CONFIRMADO CORRECTO)', () => {
  let saveId: string;
  let worldId: string;

  afterAll(async () => {
    vi.restoreAllMocks();
    if (saveId) {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      await prisma.npcState.deleteMany({ where: { saveId } });
      await prisma.save.delete({ where: { id: saveId } });
    }
  });

  it('un golpe no decisivo (margen 8, "golpe_normal") baja la condición SOLO del defensor golpeado, nunca del otro individuo del grupo ni del NpcState compartido', async () => {
    // Math.random fijo a 0.5 → roll=11 para AMBOS lados del intercambio (mismo Math.random()
    // mockeado sin secuencia). El Corredor de Cauce defiende con destreza (`preferredAttribute`,
    // baseAttackFor: destreza=12 > fuerza=6 en su catálogo) — 1 paso por delante de fuerza en la
    // rueda de tipos (attributeWheel.ts), así que tiene ventaja ×1.5 defendiéndose contra mi
    // ataque en fuerza: valor efectivo round(6*1.5)=9, bono floor(9/2)=4, result=11+4=15. Jugadora
    // fuerza=25 (sin ventaja de tipo en mi lado, mismo atributo que mi propio ataque): bono
    // floor(25/2)=12, result=11+12=23. Margen=8, por debajo de DECISIVE_MARGIN=10 → 'golpe_normal',
    // el caso real reportado ("éxito con coste"), no un golpe decisivo.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const corredor = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (golpe no decisivo vs grupo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 25, destreza: 1000, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: corredor.id, npcScope: 'itinerante-golpe-no-decisivo', destreza: 1, inteligencia: 4, esGrupo: true },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: corredor.id, npcScope: 'itinerante-golpe-no-decisivo', destreza: 1, inteligencia: 4, esGrupo: true },
      ]),
    );
    // `findMany` sin `orderBy` no garantiza orden — usar `id` explícito evita un flake real (el
    // objetivo fijado y el comprobado después podían no ser el mismo individuo entre corridas).
    const [objetivo, otro] = (await prisma.combatParticipant.findMany({ where: { encounterId, npcId: corredor.id }, orderBy: { id: 'asc' } }));
    await fijarEleccionRondaJugador(prisma, worldId, saveId, encounterId, objetivo.id);

    const habilidad: HabilidadParaIntercambio = {
      name: 'Ataque Básico (prueba golpe no decisivo)',
      description: '',
      attribute: 'fuerza',
      effects: [],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador(prisma, worldId, saveId, encounterId, { habilidad }, [], dobleNarracionRapida);

    const objetivoFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: objetivo.id } });
    const otroFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: otro.id } });
    expect(objetivoFresco.condicionFisicaGrupo).not.toBe('ILESO'); // el golpeado SÍ baja de condición
    expect(otroFresco.condicionFisicaGrupo).toBe('ILESO'); // el otro individuo del grupo no se ve afectado

    const npcStateCompartido = await prisma.npcState.findUnique({
      where: { saveId_npcId_scope: { saveId, npcId: corredor.id, scope: 'itinerante-golpe-no-decisivo' } },
    });
    // El NpcState compartido de la especie NO refleja la condición individual — se queda tal cual
    // (null o ILESO), la fuente de verdad real es CombatParticipant.condicionFisicaGrupo. Confirma
    // que consultar NpcState directamente (en vez de GET /saves/:id) da un falso "Ileso" engañoso.
    expect(npcStateCompartido?.condicionFisica ?? 'ILESO').toBe('ILESO');
  }, 30_000);
});
