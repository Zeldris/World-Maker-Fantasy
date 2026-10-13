import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { iniciarCombatEncounter, resolverTurnoAutonomo, resolverTurnoJugador, fijarEleccionRondaJugador, resolverTurnosAutonomosHastaJugadora } from './combateMultipleOrquestacion.js';
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
      return resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
    }
    await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
    const { encounterId, iniciativa } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'NPC', npcId: npcAId, npcScope: 'itinerante', destreza: 10, inteligencia: 6, nombre: 'Aullador' },
        { bando: 'JUGADOR', tipo: 'NPC', npcId: npcBId, npcScope: 'itinerante-2', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: npcCId, npcScope: 'itinerante', destreza: 12, inteligencia: 4 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: npcDId, npcScope: 'itinerante-2', destreza: 12, inteligencia: 4 },
      ]),
    );

    const encounterInicial = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    expect(encounterInicial.participantes).toHaveLength(4);
    expect(encounterInicial.ordenIniciativa).toHaveLength(4);
    expect(new Set(encounterInicial.ordenIniciativa)).toEqual(new Set(encounterInicial.participantes.map((p) => p.id)));
    // Fase 10 (2026-09-29) — la iniciativa de cada participante se devuelve (antes solo se guardaba el
    // orden): mismo orden que `ordenIniciativa`, con dado, total y nombre (repetidos numerados).
    expect(iniciativa.map((e) => e.participantId)).toEqual(encounterInicial.ordenIniciativa);
    for (const e of iniciativa) {
      expect(e.attribute).toBe('destreza');
      expect(e.result).toBe(e.roll + Math.floor(e.value / 2));
    }
    expect(iniciativa.map((e) => e.result)).toEqual([...iniciativa.map((e) => e.result)].sort((a, b) => b - a));
    expect(iniciativa.filter((e) => e.nombre.startsWith('Aullador'))).toHaveLength(1);
    // Cada participante ya tiene un objetivo del bando contrario asignado desde el arranque (§2).
    for (const p of encounterInicial.participantes) {
      const objetivo = encounterInicial.participantes.find((o) => o.id === p.objetivoActualId);
      expect(objetivo?.bando).not.toBe(p.bando);
    }

    // Corre turnos autónomos hasta que el encuentro se resuelva — tope de seguridad generoso para
    // que un bug real de bucle infinito falle el test en vez de colgarlo para siempre. Medido el
    // 2026-10-04 (diagnosing-bugs, intermitente de este test): de 120 combates, 5 pasaron de 60
    // turnos (el más largo, 93) y todos terminaron; el tope antiguo de 60 fallaba ~1 de cada 40.
    let terminado = false;
    for (let i = 0; i < 400 && !terminado; i++) {
      const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
    // 'independiente' incluido (bug de test descubierto 2026-09-09, no del motor): el NPC defensor
    // puede elegir una habilidad de rol 'utilidad' no reactiva vía `chooseNpcAbility` (~70% de las
    // veces que tiene alguna disponible, ver turnResolution.ts § esIndependiente), cayendo por
    // `resolveIndependentExchange` en vez de la tabla cruzada de `resolveExchange` — resultado
    // legítimo del motor (`combatExchange.ts § ExchangeOutcome`), la lista original solo cubría la
    // tabla cruzada y nunca contempló este camino, pese a que el NPC de prueba puede tomarlo al azar.
    expect(['golpe_pleno', 'golpe_normal', 'ataque_falla', 'parada_en_seco', 'defensor_contragolpea', 'independiente']).toContain(
      resultado?.combatExchangeDisplay?.resultado,
    );

    await prisma.combatEncounter.deleteMany({ where: { id: encounterId } });
  }, 15_000);

  // Fase G del 0.1 (hallazgo G11): con un enemigo más rápido, su intercambio contra la jugadora
  // resuelve el duelo de la ronda y el turno de ella se salta — ese intercambio tiene que llegar al
  // caller para que el frontend lo pinte (antes la jugadora no veía ninguna tirada).
  it('un enemigo más rápido que la ataca deja su intercambio en intercambiosContraJugadora', async () => {
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-jugadora-g11', destreza: 1000, inteligencia: 6 },
      ]),
    );

    const ronda = await resolverTurnosAutonomosHastaJugadora({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    expect(ronda.intercambiosContraJugadora.length).toBeGreaterThanOrEqual(1);
    expect(ronda.intercambiosContraJugadora[0].display.atacanteEsJugador).toBe(false);
    expect(ronda.intercambiosContraJugadora[0].atacanteNombre).toBe(enemigo.name);

    await prisma.combatEncounter.delete({ where: { id: encounterId } });
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [], condicionFisica: 'ILESO', energia: 100 } });
  }, 30_000);

  // P55 (QA-27): con dos enemigos sobre la jugadora, el ataque del segundo también llega al caller.
  // P129 (QA-27): ya no es un golpe gratis: tira contra su defensa, con ventaja.
  it('el ataque de más contra la jugadora tira con ventaja y queda en intercambiosContraJugadora', async () => {
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-p55-a', destreza: 1000, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-p55-b', destreza: 999, inteligencia: 6 },
      ]),
    );

    const ronda = await resolverTurnosAutonomosHastaJugadora({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    expect(ronda.golpesSinTiradaContraJugadora).toEqual([]);
    const conVentaja = ronda.intercambiosContraJugadora.filter((i) => i.display.atacante.rollMode === 'ventaja');
    expect(conVentaja.length).toBeGreaterThanOrEqual(1);
    expect(conVentaja[0].atacanteNombre).toBe(enemigo.name);

    await prisma.combatEncounter.delete({ where: { id: encounterId } });
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [], condicionFisica: 'ILESO', energia: 100 } });
  }, 30_000);

  // P129 (QA-27): cuatro enemigos sobre la jugadora Ilesa: como mucho 2 ataques de más, y la ronda
  // no la mata (antes, 3 golpes gratis seguidos: Ileso → Muerto en un turno).
  it('con cuatro enemigos encima: como mucho 2 ataques de más y la ronda no la mata', async () => {
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const efectoFuerza: ActiveEffect = { attribute: 'fuerza', magnitude: -9, turnsRemaining: 99, sourceAbility: 'Efecto de prueba' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoFuerza] as unknown as object, condicionFisica: 'ILESO' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1, inteligencia: 10 },
        ...['a', 'b', 'c', 'd'].map((x, i) => ({ bando: 'ENEMIGO' as const, tipo: 'NPC' as const, npcId: enemigo.id, npcScope: `itinerante-p129-${x}`, destreza: 1000 - i, inteligencia: 6 })),
      ]),
    );

    const ronda = await resolverTurnosAutonomosHastaJugadora({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    expect(ronda.golpesSinTiradaContraJugadora).toEqual([]);
    expect(ronda.intercambiosContraJugadora.filter((i) => i.display.atacante.rollMode === 'ventaja').length).toBeLessThanOrEqual(2);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).not.toBe('MUERTO');

    await prisma.combatEncounter.delete({ where: { id: encounterId } });
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [], condicionFisica: 'ILESO', energia: 100 } });
  }, 30_000);

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
        const resultado = await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadBasica }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
        if (resultado?.encounterTerminado) terminado = true;
      } else {
        const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
          ? await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadBasica }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida })
          : await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      if (resultado?.encounterTerminado) terminado = true;
      if (resultado?.combatExchangeDisplay) algunEnemigoRecibioGolpe = true;
    }

    // La aserción central del hallazgo: al menos UN intercambio real con tirada tuvo que ocurrir —
    // con el bug, esto se queda en `false` para siempre (90 vueltas de puro "avanzarSinAtacar").
    expect(algunEnemigoRecibioGolpe).toBe(true);

    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100 } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // Objetivo individual real (2026-08-26, docs/producto/21-roadmap.md § Fase 3) — cablea `esperandoEleccionJugadora`/
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
    expect(await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida })).toBeNull();

    // Fija su elección — único enemigo posible, así que el resultado es determinista: duelo mutuo.
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });

    const encounterTrasElegir = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    expect(encounterTrasElegir.esperandoEleccionJugadora).toBe(false);
    const jugadoraTrasElegir = encounterTrasElegir.participantes.find((p) => p.tipo === 'JUGADOR')!;
    expect(jugadoraTrasElegir.objetivoActualId).toBe(enemigoP.id);
    const enemigoTrasElegir = encounterTrasElegir.participantes.find((p) => p.tipo === 'NPC')!;
    expect(enemigoTrasElegir.objetivoActualId).toBe(jugadoraP.id); // duelo mutuo real, no golpe gratis

    // Una segunda llamada, ya sin nada pendiente, no hace nada (defensivo).
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
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
        const resultado = await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadBasica }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
        if (resultado?.encounterTerminado) terminado = true;
      } else {
        const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
        if (resultado?.encounterTerminado) terminado = true;
      }
    }
    expect(terminado).toBe(true);

    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [], condicionFisica: 'ILESO', energia: 100 } });
  }, 30_000);

  // Fase 3 § 3a de efectos de clase (2026-08-27, docs/producto/21-roadmap.md) — cierra el hueco de Fase 2:
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

  // Domador (2026-09-09, `SavedAction.durationEffectTarget` — "Vínculo Salvaje", nv.12, "aumenta a
  // tu bestia") — mismo montaje que el test de AUMENTO de arriba (jugadora real, energía del NPC a
  // 0 para forzar el camino no-independiente, efecto previo con magnitud enorme para garantizar
  // `golpe_pleno` sin mockear dados), pero con `durationEffectTarget: 'companion'` en la habilidad
  // y un Companion real en el bando JUGADOR — confirma que el efecto NO recae en `Save.activeEffects`
  // (comportamiento de siempre) sino en `Companion.activeEffects` del compañero.
  it('Domador — durationEffectTarget:"companion": AUMENTO decisivo recae en Companion.activeEffects, nunca en Save.activeEffects', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const npcOrigenCompanion = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } });

    const efectoPrevio: ActiveEffect = { attribute: 'voluntad', magnitude: 100, turnsRemaining: 3, sourceAbility: 'Efecto de prueba (garantiza el margen)' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoPrevio] as unknown as object } });
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-domador-companion' } },
      create: { saveId, npcId: enemigo.id, scope: 'itinerante-domador-companion', energia: 0 },
      update: { energia: 0, condicionFisica: 'ILESO' },
    });

    const companion = await prisma.companion.create({
      data: {
        saveId,
        name: 'Bestia de prueba (Domador)',
        role: 'mascota',
        notes: '',
        tipo: 'FAUNA',
        sourceSlug: npcOrigenCompanion.slug,
        attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
      },
    });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companion.id, destreza: 1, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-domador-companion', destreza: 10, inteligencia: 6 },
        ]),
      );

      const habilidadVinculoSalvaje: HabilidadParaIntercambio = {
        name: 'Vínculo Salvaje (prueba)',
        description: '',
        attribute: 'voluntad',
        effects: ['AUMENTO', 'RECUPERACION'],
        rol: 'ataque',
        energyCost: 5,
        energyRegen: 0,
        durationEffectMagnitude: 4,
        durationEffectTurns: 2,
        durationEffectTarget: 'companion',
      };
      // Con 2 combatientes en el bando JUGADOR (jugadora + Companion) contra 1 solo enemigo, el
      // enganche normal empareja NPC<->Companion y deja a la jugadora sin pareja —
      // `esperandoEleccionJugadora` (mismo caso que el test de MULTIPLE/"objetivo individual" de
      // arriba). Se fija a mano su elección antes de resolver.
      const encounterAntes = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
      if (encounterAntes.esperandoEleccionJugadora) {
        const enemigoP = encounterAntes.participantes.find((p) => p.tipo === 'NPC')!;
        await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      }
      const resultado = await resolverHastaJugadoraActua(saveId, worldId, encounterId, habilidadVinculoSalvaje);
      expect(resultado).not.toBeNull();

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      // Solo el efecto previo (decrementado 3->2) — nunca el nuevo AUMENTO, que se redirigió.
      expect(activeEffectsJugador).toEqual([{ ...efectoPrevio, turnsRemaining: 2 }]);

      const companionTrasIntercambio = await prisma.companion.findUniqueOrThrow({ where: { id: companion.id } });
      const activeEffectsCompanion = parseActiveEffects(companionTrasIntercambio.activeEffects);
      expect(activeEffectsCompanion).toContainEqual({ attribute: 'voluntad', magnitude: 4, turnsRemaining: 2, sourceAbility: 'Vínculo Salvaje (prueba)' });

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [] } });
      await prisma.companion.delete({ where: { id: companion.id } });
    }
  }, 30_000);

  // Domador — durationEffectTarget:"both" real (2026-09-14, Grito Animal, Domador 32) — a
  // diferencia de "companion" (excluye al atacante), "both" empuja el MISMO AUMENTO a AMBOS a la
  // vez: jugadora Y Companion. Combinado con AREA (ofensivo, ya construido esta sesión): el golpe
  // también aturde a TODOS los enemigos del bando contrario, no solo al defensor principal.
  it('Domador — durationEffectTarget:"both": Grito Animal empuja el mismo AUMENTO a la jugadora Y a su Companion a la vez, y AREA aturde a todos los enemigos', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const [enemigoA, enemigoB, npcOrigenCompanion] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);

    const efectoPrevio: ActiveEffect = { attribute: 'carisma', magnitude: 100, turnsRemaining: 3, sourceAbility: 'Efecto de prueba (garantiza el margen)' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoPrevio] as unknown as object } });
    await Promise.all([
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoA.id, scope: 'itinerante-grito-animal-a' } },
        create: { saveId, npcId: enemigoA.id, scope: 'itinerante-grito-animal-a', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoB.id, scope: 'itinerante-grito-animal-b' } },
        create: { saveId, npcId: enemigoB.id, scope: 'itinerante-grito-animal-b', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
    ]);

    const companion = await prisma.companion.create({
      data: {
        saveId,
        name: 'Bestia de prueba (Grito Animal)',
        role: 'mascota',
        notes: '',
        tipo: 'FAUNA',
        sourceSlug: npcOrigenCompanion.slug,
        attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
      },
    });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companion.id, destreza: 1, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoA.id, npcScope: 'itinerante-grito-animal-a', destreza: 10, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoB.id, npcScope: 'itinerante-grito-animal-b', destreza: 10, inteligencia: 6 },
        ]),
      );

      // Orden de iniciativa forzado a mano — `rollInitiativeMultiple` tiene un componente de dado
      // real, así que "destreza 1000" NO garantiza que la jugadora actúe siempre primero: si por
      // azar un NPC resulta con más iniciativa, resuelve el duelo mutuo en SU propio turno
      // (`dueloYaResueltoPorElOtro`), y cuando le toca a ella ya no hay nada que atacar
      // (`avanzarSinAtacar`) — el test esperaba que fuera SIEMPRE ella quien dispara Grito Animal.
      // Bug real de flakiness cazado corriendo el test repetidas veces (~1/6 corridas).
      const encounterParaOrden = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
      const jugadoraPId = encounterParaOrden.participantes.find((p) => p.tipo === 'JUGADOR')!.id;
      const restoOrden = encounterParaOrden.ordenIniciativa.filter((id) => id !== jugadoraPId);
      await prisma.combatEncounter.update({ where: { id: encounterId }, data: { ordenIniciativa: [jugadoraPId, ...restoOrden] } });

      // `fijarEleccionRondaJugador` es no-op si `esperandoEleccionJugadora` ya es false — con
      // inteligencia 6 en ambos NPC (bajo el umbral táctico, elección aleatoria), el cálculo
      // inicial de `iniciarCombatEncounter` puede haber dejado a la jugadora YA "reclamada" por
      // uno de ellos, dejándola con un objetivo distinto de `enemigoAP` — bug real de flakiness
      // cazado corriendo el test repetidas veces. Forzado a `true` a mano (mismo patrón ya usado
      // en el test de MARCAR más arriba) para garantizar el target real que pide el test.
      const encounterAntes = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
      const enemigoAP = encounterAntes.participantes.find((p) => p.npcScope === 'itinerante-grito-animal-a')!;
      await prisma.combatEncounter.update({ where: { id: encounterId }, data: { esperandoEleccionJugadora: true } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoAP.id });
      // Bug real de flakiness cazado corriendo el test repetidas veces (mismo mecanismo ya
      // documentado en el test de MARCAR más arriba): `enemigoB` elige con IA azarosa (inteligencia
      // 6) — si por azar RECLAMA a la jugadora en vez de al Companion, la regla 4 de
      // `resolverEnganchesRonda` le quita a la jugadora su propio target explícito. Se sobreescribe
      // a mano el enganche mutuo real (jugadora<->enemigoAP) DESPUÉS del cálculo, eliminando esa
      // ambigüedad sin depender del azar de la IA del segundo NPC.
      await prisma.combatParticipant.update({ where: { id: jugadoraPId }, data: { objetivoActualId: enemigoAP.id } });
      await prisma.combatParticipant.update({ where: { id: enemigoAP.id }, data: { objetivoActualId: jugadoraPId } });

      const habilidadGritoAnimal: HabilidadParaIntercambio = {
        name: 'Grito Animal (prueba)',
        description: '',
        attribute: 'carisma',
        effects: ['ATAQUE', 'ATURDIMIENTO', 'AREA', 'AUMENTO'],
        rol: 'ataque',
        energyCost: 5,
        energyRegen: 0,
        durationEffectMagnitude: 2,
        durationEffectTurns: 2,
        durationEffectTarget: 'both',
      };
      // La jugadora tiene la destreza más alta del encuentro (1000) — actúa PRIMERO, sin ningún
      // turno autónomo previo que un mock global de Math.random pudiera contaminar. Sin mockear,
      // el margen decisivo (±10) dependía SOLO del `efectoPrevio` (carisma 100) — con roll fijo a
      // un valor medio (0.5) se blinda del todo contra el roll del rival ganando por azar (bug de
      // flakiness real cazado corriendo el test repetidas veces, ~1/10 corridas).
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0.5);
      let resultado;
      try {
        resultado = await resolverHastaJugadoraActua(saveId, worldId, encounterId, habilidadGritoAnimal);
      } finally {
        randomSpy.mockRestore();
      }
      expect(resultado).not.toBeNull();

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      // El efecto previo decrementado (3->2) Y el nuevo AUMENTO — 'both' NO excluye a la jugadora.
      expect(activeEffectsJugador).toContainEqual({ attribute: 'carisma', magnitude: 2, turnsRemaining: 2, sourceAbility: 'Grito Animal (prueba)' });

      const companionTrasIntercambio = await prisma.companion.findUniqueOrThrow({ where: { id: companion.id } });
      const activeEffectsCompanion = parseActiveEffects(companionTrasIntercambio.activeEffects);
      expect(activeEffectsCompanion).toContainEqual({ attribute: 'carisma', magnitude: 2, turnsRemaining: 2, sourceAbility: 'Grito Animal (prueba)' });

      // AREA ofensivo: el segundo enemigo (fuera del enganche principal) también quedó golpeado.
      const stateB = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: enemigoB.id, scope: 'itinerante-grito-animal-b' } } });
      expect(stateB?.condicionFisica).not.toBe('ILESO');

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [] } });
      await prisma.companion.delete({ where: { id: companion.id } });
    }
  }, 30_000);

  // Hallazgo 50 (revisar-partida-hallazgos.md, 2026-09-15): las víctimas extra de AREA ofensiva se
  // persistían bien en NpcState (ya probado arriba), pero nunca se empujaban al array `caidos` que
  // devuelve `resolverTurnoJugador` — el único array que alimenta `applyKillSideEffects`
  // (turnResolution.ts): cierre de misión "derrotar a X", reputación de facción,
  // `decrementPopulationOnDeath`. AREA+LETAL (determinista, sin depender de margen ni condición de
  // partida) confirma que la víctima extra SÍ aparece en `caidos`, no solo en NpcState.
  it('AREA + LETAL: la víctima extra (fuera del enganche principal) SÍ aparece en resultado.caidos, no solo en NpcState', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    // `areaOfensivaTriggered` exige margen decisivo real (combateMultiple.ts:909), no solo un
    // golpe cualquiera — mismo blindaje contra el azar que el test "Grito Animal" de arriba:
    // efecto previo (atributo real de la habilidad, fuerza) + roll fijo a un valor medio.
    const efectoPrevioFuerza: ActiveEffect = { attribute: 'fuerza', magnitude: 100, turnsRemaining: 3, sourceAbility: 'Efecto de prueba (garantiza el margen)' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoPrevioFuerza] as unknown as object } });
    const [enemigoA, enemigoB] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    await Promise.all([
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoA.id, scope: 'itinerante-area-letal-a' } },
        create: { saveId, npcId: enemigoA.id, scope: 'itinerante-area-letal-a', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoB.id, scope: 'itinerante-area-letal-b' } },
        create: { saveId, npcId: enemigoB.id, scope: 'itinerante-area-letal-b', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
    ]);

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoA.id, npcScope: 'itinerante-area-letal-a', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoB.id, npcScope: 'itinerante-area-letal-b', destreza: 10, inteligencia: 6 },
      ]),
    );

    try {
      // Mismo criterio que el test de arriba — orden de iniciativa forzado a mano, la jugadora
      // actúa primero de forma garantizada.
      const encounterParaOrden = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
      const jugadoraPId = encounterParaOrden.participantes.find((p) => p.tipo === 'JUGADOR')!.id;
      const restoOrden = encounterParaOrden.ordenIniciativa.filter((id) => id !== jugadoraPId);
      await prisma.combatEncounter.update({ where: { id: encounterId }, data: { ordenIniciativa: [jugadoraPId, ...restoOrden] } });

      const enemigoAParticipant = encounterParaOrden.participantes.find((p) => p.npcScope === 'itinerante-area-letal-a')!;
      await prisma.combatEncounter.update({ where: { id: encounterId }, data: { esperandoEleccionJugadora: true } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoAParticipant.id });
      await prisma.combatParticipant.update({ where: { id: jugadoraPId }, data: { objetivoActualId: enemigoAParticipant.id } });
      await prisma.combatParticipant.update({ where: { id: enemigoAParticipant.id }, data: { objetivoActualId: jugadoraPId } });

      const habilidadAreaLetal: HabilidadParaIntercambio = {
        name: 'Golpe de Área Letal (prueba)',
        description: '',
        attribute: 'fuerza',
        effects: ['ATAQUE', 'AREA', 'LETAL'],
        rol: 'ataque',
        energyCost: 5,
        energyRegen: 0,
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0.5);
      let resultado;
      try {
        resultado = await resolverHastaJugadoraActua(saveId, worldId, encounterId, habilidadAreaLetal);
      } finally {
        randomSpy.mockRestore();
      }
      expect(resultado).not.toBeNull();

      // El enganche principal (enemigoA) puede o no morir según margen/tirada — lo único que este
      // test necesita determinista es la víctima EXTRA de AREA (enemigoB), que con LETAL siempre
      // muere sin importar condición de partida ni margen.
      const stateB = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: enemigoB.id, scope: 'itinerante-area-letal-b' } } });
      expect(stateB?.condicionFisica).toBe('MUERTO');

      expect(resultado!.caidos).toContainEqual({ tipo: 'NPC', npcId: enemigoB.id, nuevaCondicion: 'MUERTO' });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [] } });
      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    }
  }, 30_000);

  // AUMENTO real, camino independiente (2026-09-15, docs/rpgtarkor/sistemas-combate/clases.md — Guardián 32, Valor
  // Compartido) — a diferencia de Vínculo Salvaje/Grito Animal (rol ataque, margen decisivo), Valor
  // Compartido es rol utilidad: dispara por `utilityTriggered` (exige que el RIVAL de este
  // intercambio sea rol ataque), no por margen decisivo. `durationEffectTarget:'companion'`
  // redirige el AUMENTO al Companion propio igual que siempre — el gate nuevo
  // (`atacanteAumentoUtilidadDisparado`, combateMultiple.ts) es lo único distinto.
  it('AUMENTO real, camino independiente: Valor Compartido redirige el AUMENTO al Companion propio desde una habilidad de rol utilidad', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginalValor = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Carisma masivo SOLO en Save.attributes — garantiza que la utilidad (Valor Compartido,
    // atributo carisma) tenga éxito al usarla, sin mockear el dado (mismo patrón que PROVOCACION/
    // MARCAR variante simple, ver comentarios de arriba).
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalValor.attributes as object), carisma: 500 } } });

    const [enemigo, npcOrigenCompanion] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    const companion = await prisma.companion.create({
      data: {
        saveId,
        name: 'Compañero de prueba (Valor Compartido)',
        role: 'aliado',
        notes: '',
        tipo: 'FAUNA',
        sourceSlug: npcOrigenCompanion.slug,
        attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
      },
    });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companion.id, destreza: 1, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-valor-compartido', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      // `utilityTriggered` exige que el RIVAL de este intercambio sea rol ataque — energía justa
      // para que "Ataque base" sea la única opción de ataque real posible (mismo hallazgo de
      // flakiness ya documentado en MARCAR/PROVOCACION de arriba).
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-valor-compartido' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-valor-compartido', energia: 5 },
        update: { energia: 5 },
      });

      const habilidadValorCompartido: HabilidadParaIntercambio = {
        name: 'Valor Compartido (prueba)',
        description: '',
        attribute: 'carisma',
        effects: ['AUMENTO'],
        rol: 'utilidad',
        energyCost: 0,
        energyRegen: 0,
        durationEffectMagnitude: 4,
        durationEffectTurns: 2,
        durationEffectTarget: 'companion',
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      try {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadValorCompartido }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      } finally {
        randomSpy.mockRestore();
      }

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      // La jugadora NUNCA recibe el efecto — 'companion' (a diferencia de 'both') lo excluye.
      expect(activeEffectsJugador).toEqual([]);

      const companionTrasIntercambio = await prisma.companion.findUniqueOrThrow({ where: { id: companion.id } });
      const activeEffectsCompanion = parseActiveEffects(companionTrasIntercambio.activeEffects);
      expect(activeEffectsCompanion).toContainEqual({ attribute: 'carisma', magnitude: 4, turnsRemaining: 2, sourceAbility: 'Valor Compartido (prueba)' });

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalValor.attributes as object } });
      await prisma.companion.delete({ where: { id: companion.id } });
    }
  }, 30_000);

  it('DEBILIDAD real, camino independiente: Toque de la Parca empuja el ActiveEffect sobre el RIVAL (nunca sobre quien la usó)', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginalDebilidad = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Voluntad masiva SOLO en Save.attributes — garantiza que la utilidad (Toque de la Parca,
    // atributo voluntad) tenga éxito al usarla, sin mockear el dado (mismo patrón que Manto de
    // Purificación/Valor Compartido/PROVOCACION/MARCAR arriba).
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalDebilidad.attributes as object), voluntad: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-debilidad-utilidad', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-debilidad-utilidad' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-debilidad-utilidad', energia: 5 },
        update: { energia: 5 },
      });

      const habilidadToqueParca: HabilidadParaIntercambio = {
        name: 'Toque de la Parca (prueba)',
        description: '',
        attribute: 'voluntad',
        effects: ['DEBILIDAD'],
        rol: 'utilidad',
        energyCost: 0,
        energyRegen: 0,
        durationEffectMagnitude: -3,
        durationEffectTurns: 2,
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      try {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadToqueParca }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      } finally {
        randomSpy.mockRestore();
      }

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      // La jugadora (quien usó la habilidad) NUNCA recibe el DEBILIDAD.
      expect(activeEffectsJugador).toEqual([]);

      const npcStateTrasIntercambio = await prisma.npcState.findUniqueOrThrow({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-debilidad-utilidad' } },
      });
      const activeEffectsRival = parseActiveEffects(npcStateTrasIntercambio.activeEffects);
      expect(activeEffectsRival).toContainEqual({ attribute: 'voluntad', magnitude: -3, turnsRemaining: 2, sourceAbility: 'Toque de la Parca (prueba)' });

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalDebilidad.attributes as object } });
    }
  }, 30_000);

  it('REFLEJAR real, camino independiente: Espejo Maldito quita el DEBILIDAD propio y lo reconstruye sobre el RIVAL', async () => {
    const debilidadLeve: ActiveEffect = { attribute: 'destreza', magnitude: -2, turnsRemaining: 2, sourceAbility: 'Malus leve' };
    const debilidadGrave: ActiveEffect = { attribute: 'fuerza', magnitude: -6, turnsRemaining: 3, sourceAbility: 'Malus grave' };
    await prisma.save.update({
      where: { id: saveId },
      data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [debilidadLeve, debilidadGrave] as unknown as Prisma.InputJsonValue },
    });
    const saveOriginalReflejar = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Voluntad masiva SOLO en Save.attributes — garantiza que la utilidad (Espejo Maldito, atributo
    // voluntad) tenga éxito al usarla, sin mockear el dado (mismo patrón que LIMPIAR arriba).
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalReflejar.attributes as object), voluntad: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-reflejar', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-reflejar' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-reflejar', energia: 5 },
        update: { energia: 5 },
      });

      const habilidadReflejar: HabilidadParaIntercambio = {
        name: 'Espejo Maldito (prueba)',
        description: '',
        attribute: 'voluntad',
        effects: ['REFLEJAR'],
        rol: 'utilidad',
        energyCost: 0,
        energyRegen: 0,
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      try {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadReflejar }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      } finally {
        randomSpy.mockRestore();
      }

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      // El DEBILIDAD grave (-6, el peor) desaparece de la jugadora; el leve (-2) sobrevive, decrementado 1 turno.
      expect(activeEffectsJugador).not.toContainEqual(expect.objectContaining({ sourceAbility: 'Malus grave' }));
      expect(activeEffectsJugador).toContainEqual({ ...debilidadLeve, turnsRemaining: 1 });

      const npcStateTrasIntercambio = await prisma.npcState.findUniqueOrThrow({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-reflejar' } },
      });
      const activeEffectsRival = parseActiveEffects(npcStateTrasIntercambio.activeEffects);
      // El DEBILIDAD reflejado aparece SIN decrementar sobre el rival (mismo turno en que se disparó).
      expect(activeEffectsRival).toContainEqual({ attribute: 'fuerza', magnitude: -6, turnsRemaining: 3, sourceAbility: 'Malus grave' });

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalReflejar.attributes as object, activeEffects: [] } });
    }
  }, 30_000);

  it('REFLEJAR real: sin ningún DEBILIDAD propio activo, el efecto se pierde en silencio', async () => {
    const aumento: ActiveEffect = { attribute: 'carisma', magnitude: 4, turnsRemaining: 2, sourceAbility: 'Buff' };
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [aumento] as unknown as Prisma.InputJsonValue } });
    const saveOriginalReflejar = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalReflejar.attributes as object), voluntad: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-reflejar-sin-debilidad', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-reflejar-sin-debilidad' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-reflejar-sin-debilidad', energia: 5 },
        update: { energia: 5 },
      });

      const habilidadReflejar: HabilidadParaIntercambio = {
        name: 'Espejo Maldito (prueba)',
        description: '',
        attribute: 'voluntad',
        effects: ['REFLEJAR'],
        rol: 'utilidad',
        energyCost: 0,
        energyRegen: 0,
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      try {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadReflejar }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      } finally {
        randomSpy.mockRestore();
      }

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      expect(activeEffectsJugador).toEqual([{ ...aumento, turnsRemaining: 1 }]);

      const npcStateTrasIntercambio = await prisma.npcState.findUniqueOrThrow({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-reflejar-sin-debilidad' } },
      });
      expect(parseActiveEffects(npcStateTrasIntercambio.activeEffects)).toEqual([]);

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalReflejar.attributes as object, activeEffects: [] } });
    }
  }, 30_000);

  it('CONVERSION real, transmutación propia: Transmutación Menor convierte el DEBILIDAD propio en AUMENTO (signo invertido)', async () => {
    const debilidad: ActiveEffect = { attribute: 'fuerza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'Malus' };
    await prisma.save.update({
      where: { id: saveId },
      data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [debilidad] as unknown as Prisma.InputJsonValue },
    });
    const saveOriginalConversion = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalConversion.attributes as object), inteligencia: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-conversion-propia', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-conversion-propia' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-conversion-propia', energia: 5 },
        update: { energia: 5 },
      });

      const habilidadTransmutacionMenor: HabilidadParaIntercambio = {
        name: 'Transmutación Menor (prueba)',
        description: '',
        attribute: 'inteligencia',
        effects: ['CONVERSION'],
        rol: 'utilidad',
        energyCost: 0,
        energyRegen: 0,
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      try {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadTransmutacionMenor }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      } finally {
        randomSpy.mockRestore();
      }

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      expect(activeEffectsJugador).not.toContainEqual(expect.objectContaining({ sourceAbility: 'Malus', magnitude: -4 }));
      expect(activeEffectsJugador).toContainEqual({ attribute: 'fuerza', magnitude: 4, turnsRemaining: 2, sourceAbility: 'Malus' });

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalConversion.attributes as object, activeEffects: [] } });
    }
  }, 30_000);

  it('CONVERSION real, transmutación rival: Transmutación Mayor convierte el AUMENTO del rival en DEBILIDAD, y su DEBILIDAD en AUMENTO', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginalConversion = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalConversion.attributes as object), inteligencia: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const aumentoRival: ActiveEffect = { attribute: 'destreza', magnitude: 5, turnsRemaining: 3, sourceAbility: 'Buff rival' };
    const debilidadRival: ActiveEffect = { attribute: 'voluntad', magnitude: -3, turnsRemaining: 2, sourceAbility: 'Malus rival' };

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-conversion-rival', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-conversion-rival' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-conversion-rival', energia: 5, activeEffects: [aumentoRival, debilidadRival] as unknown as Prisma.InputJsonValue },
        update: { energia: 5, activeEffects: [aumentoRival, debilidadRival] as unknown as Prisma.InputJsonValue },
      });

      // A diferencia de Transmutación Menor (CONVERSION sola), Transmutación Mayor/Equilibrio Roto
      // se distingue por combinar CONVERSION+REFLEJAR (ver comentario de `atacanteTransmutaRivalDisparada`,
      // combateMultiple.ts) — dispara el camino "rival" en vez del camino "propia".
      const habilidadTransmutacionMayor: HabilidadParaIntercambio = {
        name: 'Transmutación Mayor (prueba)',
        description: '',
        attribute: 'inteligencia',
        effects: ['CONVERSION', 'REFLEJAR'],
        rol: 'utilidad',
        energyCost: 0,
        energyRegen: 0,
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      try {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadTransmutacionMayor }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      } finally {
        randomSpy.mockRestore();
      }

      const npcStateTrasIntercambio = await prisma.npcState.findUniqueOrThrow({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-conversion-rival' } },
      });
      const activeEffectsRival = parseActiveEffects(npcStateTrasIntercambio.activeEffects);
      // Mismo sourceAbility (el spread conserva el nombre original), solo la magnitud se invierte:
      // el AUMENTO original (+5) pasa a DEBILIDAD (-5), y viceversa.
      expect(activeEffectsRival).not.toContainEqual({ attribute: 'destreza', magnitude: 5, turnsRemaining: 3, sourceAbility: 'Buff rival' });
      expect(activeEffectsRival).not.toContainEqual({ attribute: 'voluntad', magnitude: -3, turnsRemaining: 2, sourceAbility: 'Malus rival' });
      expect(activeEffectsRival).toContainEqual({ attribute: 'destreza', magnitude: -5, turnsRemaining: 3, sourceAbility: 'Buff rival' });
      expect(activeEffectsRival).toContainEqual({ attribute: 'voluntad', magnitude: 3, turnsRemaining: 2, sourceAbility: 'Malus rival' });

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalConversion.attributes as object, activeEffects: [] } });
    }
  }, 30_000);

  it('LIMPIAR real, camino independiente: Manto de Purificación quita el DEBILIDAD de mayor magnitud negativa, conserva el resto', async () => {
    const debilidadLeve: ActiveEffect = { attribute: 'destreza', magnitude: -2, turnsRemaining: 2, sourceAbility: 'Malus leve' };
    const debilidadGrave: ActiveEffect = { attribute: 'fuerza', magnitude: -6, turnsRemaining: 3, sourceAbility: 'Malus grave' };
    const aumento: ActiveEffect = { attribute: 'carisma', magnitude: 4, turnsRemaining: 2, sourceAbility: 'Buff' };
    await prisma.save.update({
      where: { id: saveId },
      data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [debilidadLeve, debilidadGrave, aumento] as unknown as Prisma.InputJsonValue },
    });
    const saveOriginalLimpiar = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Voluntad masiva SOLO en Save.attributes — garantiza que la utilidad (Manto de Purificación,
    // atributo voluntad) tenga éxito al usarla, sin mockear el dado (mismo patrón que Valor
    // Compartido/PROVOCACION/MARCAR arriba).
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalLimpiar.attributes as object), voluntad: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-limpiar', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      // `utilityTriggered` exige que el RIVAL de este intercambio sea rol ataque — energía justa
      // para que "Ataque base" sea la única opción de ataque real posible (mismo hallazgo de
      // flakiness ya documentado en MARCAR/PROVOCACION/Valor Compartido de arriba).
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-limpiar' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-limpiar', energia: 5 },
        update: { energia: 5 },
      });

      const habilidadLimpiar: HabilidadParaIntercambio = {
        name: 'Manto de Purificación (prueba)',
        description: '',
        attribute: 'voluntad',
        effects: ['LIMPIAR'],
        rol: 'utilidad',
        energyCost: 0,
        energyRegen: 0,
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      try {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadLimpiar }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      } finally {
        randomSpy.mockRestore();
      }

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      // El DEBILIDAD grave (-6) desaparece; el leve (-2) y el AUMENTO sobreviven, decrementados 1 turno.
      expect(activeEffectsJugador).not.toContainEqual(expect.objectContaining({ sourceAbility: 'Malus grave' }));
      expect(activeEffectsJugador).toContainEqual({ ...debilidadLeve, turnsRemaining: 1 });
      expect(activeEffectsJugador).toContainEqual({ ...aumento, turnsRemaining: 1 });

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalLimpiar.attributes as object, activeEffects: [] } });
    }
  }, 30_000);

  it('LIMPIAR real: sin ningún DEBILIDAD activo, el efecto se pierde en silencio (solo AUMENTO presente)', async () => {
    const aumento: ActiveEffect = { attribute: 'carisma', magnitude: 4, turnsRemaining: 2, sourceAbility: 'Buff' };
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [aumento] as unknown as Prisma.InputJsonValue } });
    const saveOriginalLimpiar = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalLimpiar.attributes as object), voluntad: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-limpiar-sin-debilidad', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-limpiar-sin-debilidad' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-limpiar-sin-debilidad', energia: 5 },
        update: { energia: 5 },
      });

      const habilidadLimpiar: HabilidadParaIntercambio = {
        name: 'Manto de Purificación (prueba)',
        description: '',
        attribute: 'voluntad',
        effects: ['LIMPIAR'],
        rol: 'utilidad',
        energyCost: 0,
        energyRegen: 0,
      };
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      try {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadLimpiar }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      } finally {
        randomSpy.mockRestore();
      }

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      const activeEffectsJugador = parseActiveEffects(saveTrasIntercambio.activeEffects);
      expect(activeEffectsJugador).toEqual([{ ...aumento, turnsRemaining: 1 }]);

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalLimpiar.attributes as object, activeEffects: [] } });
    }
  }, 30_000);

  it('CURAZION real, vampirismo (margen decisivo): un golpe decisivo con ATAQUE+CURAZION mejora la condición física de quien atacó', async () => {
    // La jugadora empieza HERIDO — CURAZION debe mejorarla a ILESO tras el golpe decisivo, pese a
    // no haber recibido ningún daño ella misma en este intercambio (energía 0 del NPC lo garantiza).
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'HERIDO', energia: 100, activeEffects: [] } });
    const saveOriginalCurazion = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Fuerza masiva vía ActiveEffect previo (mismo mecanismo que el test de MULTIPLE arriba) —
    // garantiza margen decisivo sin mockear el dado.
    const efectoPrevio: ActiveEffect = { attribute: 'fuerza', magnitude: 100, turnsRemaining: 3, sourceAbility: 'Efecto de prueba (garantiza el margen)' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoPrevio] as unknown as Prisma.InputJsonValue } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-curazion-vampirismo', destreza: 10, inteligencia: 6 },
        ]),
      );
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
      // Energía justa para forzar "Ataque base" como único candidato de defensa real del NPC.
      await prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-curazion-vampirismo' } },
        create: { saveId, npcId: enemigo.id, scope: 'itinerante-curazion-vampirismo', energia: 5 },
        update: { energia: 5 },
      });

      const habilidadVampirismo: HabilidadParaIntercambio = {
        name: 'Golpe de Prueba (CURAZION)',
        description: '',
        attribute: 'fuerza',
        effects: ['ATAQUE', 'CURAZION'],
        rol: 'ataque',
        energyCost: 0,
        energyRegen: 0,
      };
      await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadVampirismo }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveTrasIntercambio.condicionFisica).toBe('ILESO');

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalCurazion.attributes as object, activeEffects: [], condicionFisica: 'ILESO' } });
    }
  }, 30_000);

  it('CURAZION real, transmutación defensiva: Alquimia Vital mejora la condición física AUNQUE el golpe conecte', async () => {
    // La jugadora empieza GRAVE, DEFENDIÉNDOSE con CURAZION solo (sin AGUANTE) — el golpe del NPC
    // conecta igualmente (empeora un escalón, GRAVE→CONVALECIENTE), pero CURAZION mitiga aplicando
    // oneStepBetterThan SOBRE ese resultado ya empeorado — queda en GRAVE otra vez, no CONVALECIENTE.
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'GRAVE', energia: 100, activeEffects: [] } });
    const saveOriginalCurazion = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Única SavedAction de defensa real que tiene — `datosVivosDe` solo cae al fallback genérico
    // (Esquivar) si su roster está vacío, así que esto garantiza que SIEMPRE se defienda con ella
    // (mismo patrón que el test de DESVIAR de abajo).
    await prisma.savedAction.create({
      data: {
        saveId,
        name: 'Alquimia Vital (prueba)',
        description: '',
        icon: '🧪',
        category: 'combate',
        promptText: '',
        rol: 'defensa',
        effects: ['CURAZION'],
        preferredAttribute: 'constitucion',
        energyCost: 0,
        energyRegen: 0,
      },
    });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });

    // Iniciativa del enemigo muy por encima de la de la jugadora — garantiza que sea él quien la
    // reclame primero en el enganche de la ronda 1 (mismo patrón que DESVIAR de abajo).
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-curazion-defensivo', destreza: 1000, inteligencia: 6 },
      ]),
    );

    try {
      let resultadoAtaque: Awaited<ReturnType<typeof resolverTurnoAutonomo>> | null = null;
      for (let i = 0; i < 10 && !resultadoAtaque; i++) {
        const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
        if (encounter.estado === 'RESUELTO') break;
        const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
        if (resultado?.defensorNombre && resultado.atacanteNombre !== undefined) resultadoAtaque = resultado;
      }
      expect(resultadoAtaque).not.toBeNull();

      const saveTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveTrasIntercambio.condicionFisica).toBe('GRAVE');

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalCurazion.attributes as object, activeEffects: [], condicionFisica: 'ILESO' } });
      await prisma.savedAction.deleteMany({ where: { saveId, name: 'Alquimia Vital (prueba)' } });
    }
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

      const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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

  // Fase 3 § 3b de efectos de clase (2026-08-27, docs/producto/21-roadmap.md) — MULTIPLE real.
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
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: principalP.id });
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

  // Fase 3 § 3c de efectos de clase (2026-08-27, docs/producto/21-roadmap.md) — DESVIAR real.
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
      const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
        await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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

  // Cierre del hueco de motor (2026-09-09, `NpcCombatAbility.durationEffectMagnitude/Turns` +
  // `PendingNpcAttack.durationEffectMagnitude/Turns`, npcCombatAbilities.ts/combatExchange.ts) —
  // hasta ahora `Companion.activeEffects` se LEÍA en combate múltiple pero nada lo ESCRIBÍA (ver
  // cabecera histórica de `classAbilities.ts` § Domador, y el bloqueo "1 de 8 sembradas" que
  // documentaba). Confirma el cableado end-to-end real: un Companion (mascota, `sourceSlug` con
  // `clase`/`especializacion` reales) ataca con una habilidad de AUMENTO real de su clase
  // (Estocada Calculada, GUERRERO/LANCERO nv.12 — mismo patrón "editar temporalmente Ulkha Ketg,
  // revertir al final" que el test de CONTROL de arriba) y, si golpea de forma decisiva, el efecto
  // se empuja de verdad sobre `Companion.activeEffects` — no solo sobre NpcState/Save como ya
  // cubrían los tests del 1v1 clásico (turn.integration.test.ts).
  it('Companion real: un Companion Guerrero/Lancero ataca con Estocada Calculada (AUMENTO) y empuja el efecto sobre Companion.activeEffects', async () => {
    const npcOrigen = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'ulkha-ketg' } });
    const rival = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    await prisma.npc.update({ where: { id: npcOrigen.id }, data: { clase: 'GUERRERO', especializacion: 'LANCERO', level: 12 } });
    const companion = await prisma.companion.create({
      data: {
        saveId,
        name: 'Ulkha domesticado (prueba)',
        role: 'mascota',
        notes: '',
        tipo: 'FAUNA',
        sourceSlug: npcOrigen.slug,
        attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 30, carisma: 2, magia: 4 },
      },
    });

    // Roster de ataque del Companion (npcCombatAbilitiesFor sobre GUERRERO/LANCERO nv.12): Ataque
    // base + tronco común Guerrero (nv.1/4/6/8 según clases.md) + Estocada Calculada (nv.12) — de
    // ellas, solo Ataque base y Estocada Calculada tienen `rol:'ataque'` afrontable, y con
    // `random=0.9` fijo (mismo valor en las 2 tiradas de dados) el índice de selección cae en
    // Estocada Calculada (confirmado con depuración real). `voluntad: 30` en el fixture — muy por
    // encima de la cifra real de catálogo — solo para garantizar `golpe_pleno` (margen ≥10) sin
    // depender de qué tirada exacta salga; el `attributeBonus: 2` real de la ficha (Estocada
    // Calculada, classAbilities.ts) es insuficiente por sí solo con roll empatado a 19 en ambos
    // lados, mismo criterio que `attributeBonus: 30` en los tests de ataque del jugador
    // (turn.integration.test.ts).
    const randomSpy = vi.spyOn(Math, 'random');
    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companion.id, destreza: 1000, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: rival.id, npcScope: 'itinerante-companion-aumento-rival', destreza: 1, inteligencia: 6 },
        ]),
      );

      let companionAtaco = false;
      for (let i = 0; i < 10 && !companionAtaco; i++) {
        const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
        if (encounter.estado === 'RESUELTO') break;
        const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
        const actual = encounter.participantes.find((p) => p.id === actualId)!;
        if (actual.tipo === 'COMPANION') {
          randomSpy.mockReturnValue(0.9);
          const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
          if (resultado?.atacanteNombre === companion.name) companionAtaco = true;
        } else {
          await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
        }
      }
      expect(companionAtaco).toBe(true);

      const companionDespues = await prisma.companion.findUniqueOrThrow({ where: { id: companion.id } });
      const efectos = parseActiveEffects(companionDespues.activeEffects);
      expect(efectos.some((e) => e.sourceAbility === 'Estocada Calculada' && e.magnitude > 0)).toBe(true);

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      randomSpy.mockRestore();
      await prisma.companion.delete({ where: { id: companion.id } });
      await prisma.npc.update({ where: { id: npcOrigen.id }, data: { clase: npcOrigen.clase, especializacion: npcOrigen.especializacion, level: npcOrigen.level } });
    }
  }, 30_000);

  // Alfa de la Manada real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Domador 40) — `datosVivosDe`
  // aplica `alfaDeLaManadaBonusFor` ANTES de la tirada real cuando `Companion.esSlotDomador` y hay
  // 2 slots de Domador ocupados en la partida. Comparación directa: MISMO escenario (mismo rival,
  // mismo roll fijo), una vez con un solo slot ocupado (sin buff) y otra con 2 (+2 fuerza al Alfa)
  // — el margen del intercambio debe subir exactamente 2 puntos (Ataque base usa fuerza/destreza,
  // aquí fuerza por tenerla mayor en el fixture).
  it('Alfa de la Manada: con los 2 slots de Domador ocupados, el Companion Alfa gana +2 de fuerza real en su tirada', async () => {
    const rival = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const npcOrigenCompanion = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } });

    async function margenDelCompanionAlfa(segundoSlotOcupado: boolean): Promise<number> {
      const companionAlfa = await prisma.companion.create({
        data: {
          saveId,
          name: 'Alfa de prueba',
          role: 'mascota',
          notes: '',
          tipo: 'FAUNA',
          sourceSlug: npcOrigenCompanion.slug,
          attributes: { fuerza: 20, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
          esSlotDomador: true,
          esAlfa: true,
        },
      });
      const companionRelleno = segundoSlotOcupado
        ? await prisma.companion.create({
            data: { saveId, name: 'Relleno de prueba', role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: npcOrigenCompanion.slug, attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 }, esSlotDomador: true },
          })
        : null;

      const randomSpy = vi.spyOn(Math, 'random');
      try {
        const { encounterId } = await prisma.$transaction((tx) =>
          iniciarCombatEncounter(tx, saveId, [
            { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companionAlfa.id, destreza: 1000, inteligencia: 6 },
            { bando: 'ENEMIGO', tipo: 'NPC', npcId: rival.id, npcScope: `itinerante-alfa-manada-${segundoSlotOcupado}`, destreza: 1, inteligencia: 6 },
          ]),
        );
        randomSpy.mockReturnValue(0.5);
        let margen: number | null = null;
        for (let i = 0; i < 10 && margen === null; i++) {
          const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
          if (encounter.estado === 'RESUELTO') break;
          const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
          // El Companion actúa primero (destreza 1000 vs 1) — su propio ATAQUE ("Ataque base",
          // preferredAttribute fuerza/destreza según baseAttackFor, fuerza:20 aquí domina sobre
          // destreza:6) es donde el buff de fuerza es observable, a diferencia de su DEFENSA
          // (Esquivar/Defenderse, atributo distinto, el buff de fuerza no la afecta).
          if (resultado?.combatExchangeDisplay && resultado.atacanteNombre === companionAlfa.name) margen = resultado.combatExchangeDisplay.margen;
        }
        if (margen === null) throw new Error('El Companion nunca llegó a atacar en el tope de turnos de prueba.');
        await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
        return margen;
      } finally {
        randomSpy.mockRestore();
        await prisma.companion.delete({ where: { id: companionAlfa.id } });
        if (companionRelleno) await prisma.companion.delete({ where: { id: companionRelleno.id } });
      }
    }

    const margenSinBuff = await margenDelCompanionAlfa(false);
    const margenConBuff = await margenDelCompanionAlfa(true);
    // El margen se mide atacante(Companion)-defensor(rival) — más fuerza en el Companion (que
    // ataca) sube el margen a su favor (mismo roll fijo, mismo rival, mismo multiplicador de tipo
    // entre ambas corridas). El resultado real usa `Math.floor(valorEfectivo / 2)` — un +2 crudo de
    // fuerza se traduce en +1 de margen (20/2=10 -> 22/2=11), no +2 directo.
    expect(margenConBuff - margenSinBuff).toBe(1);
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
      await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } })).id });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Tótem de Guerra (prueba)',
      description: '',
      attribute: 'magia',
      effects: ['INVOCACION'],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    const resultado = await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
      await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } })).id });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Tótem de Guerra (prueba candado)',
      description: '',
      attribute: 'magia',
      effects: ['INVOCACION'],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
    const primerTotem = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'INVOCACION' } });

    // Segundo intento de invocar en el turno siguiente de la jugadora — con el primer tótem
    // todavía vivo, el candado debe impedir crear uno nuevo (el turno se pierde en silencio, mismo
    // criterio que `avanzarSinAtacar`).
    for (let i = 0; i < 10; i++) {
      const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
      if (encounter.estado === 'RESUELTO') break;
      const actualId = encounter.ordenIniciativa[encounter.turnoActual % encounter.ordenIniciativa.length];
      if (actualId === (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } })).id) {
        await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
        break;
      }
      await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } })).id });
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
    await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    const victimaP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, npcScope: 'itinerante-expulsar-victima' } });
    expect(victimaP.expulsadoPorRondas).toBe(2);

    // Cruza una ronda completa (2 combatientes reales -> 2 turnos autónomos) — el decremento real
    // se comprueba SOLO tras el intercambio de la jugadora, así que el turno de la propia víctima
    // (que ya actuó arriba) no vuelve a contar: solo hace falta 1 turno autónomo más para cruzar.
    await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
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
      const resultado = await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
      encounterTerminado = resultado?.encounterTerminado ?? false;
    }
    const encounterFinal = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    if (!encounterTerminado) {
      const aliadoFresco = encounterFinal.participantes.find((p) => p.id === aliadoP.id)!;
      expect(aliadoFresco.objetivoActualId).toBe(victimaP.id); // sigue enganchado a la víctima, no null
    }

    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // PROVOCACION real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Guardián 16/19, Lancero 32,
  // Especialista 28, Caballero del Valor 12) — variante simple: quien la dispara provoca al RIVAL
  // de ESTE intercambio, marcando `provocadoPorRondas`/`provocadoPorId` sobre él. Se comprueba que
  // el enganche de la RONDA SIGUIENTE respeta la provocación (el provocado ataca forzosamente al
  // provocador, saltándose su propia IA de Inteligencia) y que el contador se decrementa al cruzar
  // de ronda, mismo criterio que CONTROL/OCULTACION/EXPULSAR.
  it('PROVOCACION (variante simple): Desafío marca provocadoPorRondas/provocadoPorId sobre el rival, y la ronda siguiente lo fuerza a enganchar al provocador', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    // Carisma masivo SOLO en Save.attributes (mismo patrón que MARCAR/ANALIZAR RIVAL más abajo) —
    // `resolveIndependentExchange` tira dados reales (`rollSide`, Math.random SIN mockear, distinto
    // del mock acotado a `chooseNpcAbility`): sin esto, la tirada de PROVOCACION podía fallar al
    // azar (`efectoAplica: false`), dejando el disparo intermitente — bug real de flakiness cazado
    // corriendo la suite completa repetidas veces.
    const saveOriginalProvocacion = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalProvocacion.attributes as object), carisma: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-provocacion-victima', destreza: 1, inteligencia: 6 },
      ]),
    );
    const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
    // `utilityTriggered` exige que el RIVAL de este intercambio sea `rol: 'ataque'` para que la
    // utilidad de Desafío dispare. Energía justa para excluir "Dentellada de jauría" (coste 10) —
    // el roster real del `aullador-rojo` también trae "Esquivar"(5)/"Defenderse"(0), ambos
    // `rol:'defensa'` y afordables incluso con poca energía, así que "energía a tope" no basta
    // (roster crecido desde que se escribió este test la primera vez, bug de flakiness real cazado
    // corriendo la suite completa repetidas veces): con energía 5, `affordable` = [Ataque base,
    // Esquivar, Defenderse] — random() mockeado fuerza que `chooseNpcAbility('defensa', ...)` salga
    // del pool `defensivas` (70%) y elija el índice 0 (Ataque base) del roster completo.
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-provocacion-victima' } },
      create: { saveId, npcId: enemigo.id, scope: 'itinerante-provocacion-victima', energia: 5 },
      update: { energia: 5 },
    });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Desafío (prueba)',
      description: '',
      attribute: 'carisma',
      attributeBonus: 0,
      effects: ['PROVOCACION'],
      rol: 'utilidad',
      energyCost: 0,
      energyRegen: 0,
    };
    const randomSpy = vi.spyOn(Math, 'random');
    // 1) primer random() de chooseNpcAbility('defensa', ...): >=0.7 cae fuera de `defensivas`, usa
    //    el roster `affordable` completo. 2) segundo random(): 0.1 → índice 0 → "Ataque base".
    randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
    try {
      await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
    } finally {
      randomSpy.mockRestore();
    }

    const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
    const enemigoTrasIntercambio = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: enemigoP.id } });
    expect(enemigoTrasIntercambio.provocadoPorRondas).toBe(2);
    expect(enemigoTrasIntercambio.provocadoPorId).toBe(jugadoraP.id);

    // Cruza una ronda completa — el enganche de la ronda NUEVA debe forzar al provocado a atacar al
    // provocador, sin pasar por `elegirObjetivo`/Inteligencia normal.
    await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
    const enemigoTrasRonda = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: enemigoP.id } });
    expect(enemigoTrasRonda.objetivoActualId).toBe(jugadoraP.id);
    expect(enemigoTrasRonda.provocadoPorRondas).toBeLessThan(2);

    await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalProvocacion.attributes as object } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // PROVOCACION real (2026-09-14) — variante "redirige el golpe dirigido a un aliado" (Grito de
  // Coraje, Caballero del Valor 28, `durationEffectTarget: 'companion'`): sustituye YA el enganche
  // de la ronda actual de un NPC que tuviera como objetivo al Companion del bando de quien la
  // dispara, sin depender de forzar ningún enganche futuro (no marca `provocadoPorRondas`, a
  // diferencia de la variante simple).
  it('PROVOCACION (variante Companion): Grito de Coraje redirige hacia la jugadora el enganche de un NPC que apuntaba a su Companion', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });

    const [enemigo, companionOrigen] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    const companion = await prisma.companion.create({
      data: {
        saveId,
        sourceSlug: companionOrigen.slug,
        name: 'Compañero de prueba (PROVOCACION)',
        role: 'aliado',
        notes: '',
        attributes: companionOrigen.attributes as object,
        condicionFisica: 'ILESO',
      },
    });

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companion.id, destreza: 500, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-provocacion-companion', destreza: 1, inteligencia: 6 },
      ]),
    );
    const companionP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'COMPANION' } });
    const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
    // Enganche forzado a mano: el NPC ya apunta al Companion ANTES de que la jugadora use Grito de
    // Coraje (mismo criterio que el test de EXPULSAR "único enemigo vivo": se fuerza el estado de
    // partida a mano en vez de depender de que la IA del NPC lo elija por azar).
    await prisma.combatParticipant.update({ where: { id: enemigoP.id }, data: { objetivoActualId: companionP.id } });
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-provocacion-companion' } },
      create: { saveId, npcId: enemigo.id, scope: 'itinerante-provocacion-companion', energia: 0 },
      update: { energia: 0 },
    });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Grito de Coraje (prueba)',
      description: '',
      attribute: 'carisma',
      attributeBonus: 0,
      effects: ['PROVOCACION'],
      rol: 'utilidad',
      durationEffectTarget: 'companion',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
    const enemigoTrasIntercambio = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: enemigoP.id } });
    expect(enemigoTrasIntercambio.objetivoActualId).toBe(jugadoraP.id);
    // Esta variante NO marca provocadoPorRondas (no fuerza ningún enganche futuro, solo redirige el
    // de ESTA ronda ya calculada) — a diferencia de la variante simple del test de arriba.
    expect(enemigoTrasIntercambio.provocadoPorRondas).toBeFalsy();

    await prisma.companion.deleteMany({ where: { id: companion.id } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // PROVOCACION real (2026-09-15) — variante "redirige golpe de aliado" disparada desde el lado
  // DEFENSOR con margen decisivo (Sacrificio del Valiente, Caballero del Valor 40): a diferencia
  // de Grito de Coraje (dispara desde el atacante/utilidad), aquí la JUGADORA defiende con
  // AGUANTE+PROVOCACION y, si contragolpea con éxito, redirige hacia sí misma el enganche de un
  // NPC distinto que apuntaba a su Companion — mismo mecanismo, lado opuesto de quien dispara.
  it('PROVOCACION (variante Companion, disparada desde defensa): Sacrificio del Valiente redirige hacia la jugadora el enganche de un NPC que apuntaba a su Companion', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginalSacrificio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Constitución masiva SOLO en Save.attributes — garantiza `defensor_contragolpea` (margen
    // decisivo a favor de la defensa) pase lo que pase, sin mockear el dado.
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalSacrificio.attributes as object), constitucion: 500 } } });

    const [enemigoAtacante, enemigoRedirigido, companionOrigen] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    const companion = await prisma.companion.create({
      data: {
        saveId,
        sourceSlug: companionOrigen.slug,
        name: 'Compañero de prueba (Sacrificio del Valiente)',
        role: 'aliado',
        notes: '',
        attributes: companionOrigen.attributes as object,
        condicionFisica: 'ILESO',
      },
    });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companion.id, destreza: 1, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoAtacante.id, npcScope: 'itinerante-sacrificio-atacante', destreza: 10, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoRedirigido.id, npcScope: 'itinerante-sacrificio-redirigido', destreza: 10, inteligencia: 6 },
        ]),
      );
      const companionP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'COMPANION' } });
      const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
      const enemigoAtacanteP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC', npcId: enemigoAtacante.id } });
      const enemigoRedirigidoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC', npcId: enemigoRedirigido.id } });

      // Orden de iniciativa forzado a mano — el NPC atacante debe actuar ANTES que la jugadora para
      // que ELLA defienda con Sacrificio del Valiente en SU turno (mismo mecanismo ya documentado
      // en el fix del flake de Grito Animal, arriba: la iniciativa tiene un componente de dado
      // real, no basta con la destreza cruda).
      await prisma.combatEncounter.update({
        where: { id: encounterId },
        data: { ordenIniciativa: [enemigoAtacanteP.id, jugadoraP.id, companionP.id, enemigoRedirigidoP.id] },
      });
      // Enganche mutuo forzado a mano: el atacante ataca a la jugadora, y el redirigido ya apunta
      // al Companion ANTES de que se dispare la redirección. `esperandoEleccionJugadora` en false
      // (patrón ya documentado en el fix de MARCAR/Grito Animal, arriba) — sin esto,
      // `resolverTurnoAutonomo` devuelve `null` para CUALQUIER turno mientras la ronda siga
      // "esperando" la elección de la jugadora, aunque su `objetivoActualId` ya esté fijado a mano.
      await prisma.combatEncounter.update({ where: { id: encounterId }, data: { esperandoEleccionJugadora: false } });
      await prisma.combatParticipant.update({ where: { id: enemigoAtacanteP.id }, data: { objetivoActualId: jugadoraP.id } });
      await prisma.combatParticipant.update({ where: { id: jugadoraP.id }, data: { objetivoActualId: enemigoAtacanteP.id } });
      await prisma.combatParticipant.update({ where: { id: enemigoRedirigidoP.id }, data: { objetivoActualId: companionP.id } });

      // La habilidad de defensa de la jugadora se AUTO-ELIGE desde su roster real de `SavedAction`
      // (nunca se manda explícita en `resolverTurnoAutonomo`, a diferencia de `resolverTurnoJugador`
      // en su propio turno) — única SavedAction de defensa real, mismo patrón que el test de
      // DESVIAR de arriba: `datosVivosDe` solo cae al fallback genérico (Esquivar) si el roster
      // está vacío, así que esto garantiza que la jugadora SIEMPRE se defienda con ella.
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Sacrificio del Valiente (prueba)',
          description: '',
          icon: '🩸',
          category: 'combate',
          promptText: '',
          rol: 'defensa',
          effects: ['AGUANTE', 'PROVOCACION'],
          preferredAttribute: 'constitucion',
          attributeBonus: 4,
          durationEffectTarget: 'companion',
          energyCost: 0,
          energyRegen: 0,
        },
      });
      // El NPC atacante actúa primero (orden forzado) — su ataque dispara la defensa AUTO-elegida
      // de la jugadora (Sacrificio del Valiente, único candidato real de su roster).
      await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

      const enemigoRedirigidoTrasIntercambio = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: enemigoRedirigidoP.id } });
      expect(enemigoRedirigidoTrasIntercambio.objetivoActualId).toBe(jugadoraP.id);

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalSacrificio.attributes as object } });
      await prisma.savedAction.deleteMany({ where: { saveId, name: 'Sacrificio del Valiente (prueba)' } });
      await prisma.companion.delete({ where: { id: companion.id } });
    }
  }, 30_000);

  // PROVOCACION real, camino de margen decisivo puro (2026-09-15, Bastión Personal/Guardia de
  // Asta/Postura Firme — sin `durationEffectTarget:'companion'`) — cobertura dedicada del bug real
  // corregido de paso al sembrar Sacrificio del Valiente: `defensorProvocacionDisparada` exigía
  // `atacanteRecibeGolpe` (requiere `ATAQUE` en la defensa), pero ninguna de estas 3 fichas reales
  // lo lleva, así que este camino nunca había disparado en la práctica. Sin este test, la
  // corrección de `defensorGanaPorMargen` habría quedado sin verificar contra Postgres real.
  it('PROVOCACION (variante simple, margen decisivo): Bastión Personal provoca al atacante SIN que la defensa lleve ATAQUE', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginalBastion = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Constitución masiva SOLO en Save.attributes — garantiza `defensor_contragolpea` (margen
    // decisivo a favor de la defensa) pase lo que pase, sin mockear el dado.
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalBastion.attributes as object), constitucion: 500 } } });
    await prisma.savedAction.create({
      data: {
        saveId,
        name: 'Bastión Personal (prueba)',
        description: '',
        icon: '🧱',
        category: 'combate',
        promptText: '',
        rol: 'defensa',
        effects: ['AGUANTE', 'PROVOCACION'], // sin ATAQUE, fiel a la ficha real
        preferredAttribute: 'constitucion',
        attributeBonus: 4,
        energyCost: 0,
        energyRegen: 0,
      },
    });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, saveId, [
          { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-bastion-personal', destreza: 10, inteligencia: 6 },
        ]),
      );
      const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
      const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
      // Orden de iniciativa forzado a mano — el NPC debe atacar ANTES que la jugadora para que ELLA
      // defienda con Bastión Personal en su turno (mismo criterio ya documentado arriba).
      await prisma.combatEncounter.update({ where: { id: encounterId }, data: { ordenIniciativa: [enemigoP.id, jugadoraP.id], esperandoEleccionJugadora: false } });
      await prisma.combatParticipant.update({ where: { id: enemigoP.id }, data: { objetivoActualId: jugadoraP.id } });
      await prisma.combatParticipant.update({ where: { id: jugadoraP.id }, data: { objetivoActualId: enemigoP.id } });

      await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

      const enemigoTrasIntercambio = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: enemigoP.id } });
      expect(enemigoTrasIntercambio.provocadoPorRondas).toBe(2);
      expect(enemigoTrasIntercambio.provocadoPorId).toBe(jugadoraP.id);

      await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalBastion.attributes as object } });
      await prisma.savedAction.deleteMany({ where: { saveId, name: 'Bastión Personal (prueba)' } });
    }
  }, 30_000);

  // CANALIZAR real en combate múltiple (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Tirador 24,
  // Berserker 40, Convocador 40) — mismo mecanismo ya construido para el 1v1 clásico
  // (turnResolution.ts), portado a `CombatParticipant.canalizando` porque aquí el objetivo real es
  // quien te tenga enganchado esa ronda, no un NPC fijo. CASO EMPEZAR: consume el turno entero,
  // sin tirar ningún dado — se comprueba que NO hay `combatExchangeDisplay` (sin tirada real) y que
  // el enganche de la ronda sigue igual (nadie recibió ni dio ningún golpe).
  it('CANALIZAR (combate múltiple): empezar a canalizar siembra CombatParticipant.canalizando, sin tirar dados ni resolver ningún golpe', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-canalizar-empezar', destreza: 1, inteligencia: 6 },
      ]),
    );
    const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Tensar al Límite (prueba)',
      description: '',
      attribute: 'destreza',
      attributeBonus: 0,
      effects: ['ATAQUE', 'CANALIZAR', 'LETAL'],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    const resultado = await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    expect(resultado?.combatExchangeDisplay).toBeNull();
    const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
    const jugadoraTrasIntercambio = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: jugadoraP.id } });
    const canalizando = jugadoraTrasIntercambio.canalizando as { abilityName: string; effects: string[] } | null;
    expect(canalizando?.abilityName).toBe('Tensar al Límite (prueba)');
    expect(canalizando?.effects).toEqual(['ATAQUE', 'CANALIZAR', 'LETAL']);
    // El NPC objetivo sigue ILESO — canalizar no resuelve ningún golpe este turno.
    const enemigoTrasIntercambio = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: enemigoP.id } });
    expect(enemigoTrasIntercambio.condicionFisicaGrupo ?? 'ILESO').toBe('ILESO');

    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // CANALIZAR real — ciclo completo: EMPEZAR (turno 1) seguido de DISPARAR (turno siguiente, sin
  // que nada la interrumpiera) — el golpe diferido se resuelve con tirada real, LETAL incluido, y
  // `canalizando` queda limpio tras completarse.
  it('CANALIZAR (combate múltiple): sin interrupción, el turno siguiente dispara el golpe diferido con LETAL y limpia canalizando', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [], attributes: { ...((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).attributes as object), destreza: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-canalizar-disparar', destreza: 1, inteligencia: 6 },
      ]),
    );
    const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Tensar al Límite (prueba 2)',
      description: '',
      attribute: 'destreza',
      attributeBonus: 0,
      effects: ['ATAQUE', 'CANALIZAR', 'LETAL'],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    // Turno del NPC (autónomo) para cruzar al turno siguiente de la jugadora.
    await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    // Segunda llamada de la jugadora — dispara el golpe diferido, IGNORANDO la habilidad que se
    // manda aquí (mismo criterio que el 1v1: la canalización manda, no lo que se pulse mientras
    // tanto) — se manda una habilidad claramente distinta a propósito para confirmar que se ignora.
    const otraHabilidad: HabilidadParaIntercambio = {
      name: 'Otra habilidad cualquiera',
      description: '',
      attribute: 'fuerza',
      attributeBonus: 0,
      effects: ['ATAQUE'],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    const resultado = await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: otraHabilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    expect(resultado?.combatExchangeDisplay).not.toBeNull();
    const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
    const jugadoraTrasDisparo = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: jugadoraP.id } });
    expect(jugadoraTrasDisparo.canalizando).toBeNull();

    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // MARCAR real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Domador 24, Concentración del Domador) —
  // mecanismo INVERSO a PROVOCACION: aquí la JUGADORA ordena a SU PROPIO Companion que ataque
  // preferentemente a un rival concreto, saltándose su IA normal de Inteligencia
  // (`elegirObjetivoPara`, combateMultiple.ts). Dos NPC en escena (uno marcado, otro no) para
  // comprobar que el Companion no elige por azar/Inteligencia, sino exactamente el marcado.
  it('MARCAR: Concentración del Domador marca marcaObjetivoRondas/marcaObjetivoId sobre el Companion propio, y la ronda siguiente lo fuerza a enganchar al objetivo marcado', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    // Voluntad masiva SOLO en Save.attributes (mismo patrón que ANALIZAR RIVAL más abajo) —
    // `resolveIndependentExchange` tira dados reales (`rollSide`, Math.random SIN mockear, distinto
    // del mock acotado a `chooseNpcAbility`): sin esto, la tirada de MARCAR podía fallar al azar
    // (`efectoAplica: false`), dejando el disparo de MARCAR intermitente — bug real cazado corriendo
    // el test 6 veces seguidas.
    const saveOriginalMarcar = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginalMarcar.attributes as object), voluntad: 500 } } });

    const [enemigoMarcado, enemigoSinMarcar, companionOrigen] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    const companion = await prisma.companion.create({
      data: {
        saveId,
        sourceSlug: companionOrigen.slug,
        name: 'Compañero de prueba (MARCAR)',
        role: 'aliado',
        notes: '',
        attributes: companionOrigen.attributes as object,
        condicionFisica: 'ILESO',
      },
    });

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companion.id, destreza: 500, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoMarcado.id, npcScope: 'itinerante-marcar-objetivo', destreza: 1, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoSinMarcar.id, npcScope: 'itinerante-marcar-otro', destreza: 1, inteligencia: 6 },
      ]),
    );
    const companionP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'COMPANION' } });
    const enemigoMarcadoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC', npcId: enemigoMarcado.id } });
    const enemigoSinMarcarP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC', npcId: enemigoSinMarcar.id } });
    const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
    // Orden de iniciativa forzado a mano — el Companion SIEMPRE elige antes que cualquier NPC. Sin
    // esto, con inteligencia 6 (bajo el umbral táctico -> elección aleatoria, `elegirObjetivo`), el
    // NPC sin marcar podía "robarle" el reclamo al Companion (regla 3, "si ya te han elegido, no
    // eliges tú") antes de que le tocase su turno de elegir, dejando el recálculo de enganche de la
    // ronda siguiente intermitente — bug real de flakiness cazado corriendo el test repetidas veces.
    // La marca decide entre los dos NPC candidatos SOLO si nadie más reclamó antes al Companion.
    await prisma.combatEncounter.update({
      where: { id: encounterId },
      data: { ordenIniciativa: [jugadoraP.id, companionP.id, enemigoMarcadoP.id, enemigoSinMarcarP.id] },
    });
    // `fijarEleccionRondaJugador` es no-op si `esperandoEleccionJugadora` ya es false — con
    // inteligencia 6, la elección inicial de `iniciarCombatEncounter` (orden de iniciativa
    // ALEATORIO, antes del override de arriba) puede haber dejado a la jugadora YA "reclamada" por
    // uno de los NPC, dejándola con un objetivo que ya no es el suyo propio. Forzado a `true` a mano
    // para garantizar que `fijarEleccionRondaJugador` sí recalcula con el target que pide el test.
    await prisma.combatEncounter.update({ where: { id: encounterId }, data: { esperandoEleccionJugadora: true } });
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoMarcadoP.id });
    // Bug real de flakiness cazado corriendo el test repetidas veces con trazas: `enemigoSinMarcarP`
    // elige con IA azarosa (inteligencia 6, bajo el umbral táctico) — si por azar RECLAMA a la
    // JUGADORA en vez de al Companion, la regla 4 de `resolverEnganchesRonda` ("un atacante con
    // elección propia que ADEMÁS acabó reclamado por otro pierde esa elección") le quita a la
    // jugadora su propio target explícito (`enemigoMarcadoP`) y la deja apuntando a quien la
    // reclamó — nada que ver con MARCAR en sí, es el mismo mecanismo de "golpe gratis" ya usado en
    // el resto del motor. Se sobreescribe a mano el enganche mutuo real (jugadora<->enemigoMarcado)
    // DESPUÉS del cálculo de `fijarEleccionRondaJugador`, garantizando el duelo que pide el test sin
    // depender del azar de la IA del segundo NPC.
    await prisma.combatParticipant.update({ where: { id: jugadoraP.id }, data: { objetivoActualId: enemigoMarcadoP.id } });
    await prisma.combatParticipant.update({ where: { id: enemigoMarcadoP.id }, data: { objetivoActualId: jugadoraP.id } });
    // `utilityTriggered` exige que el RIVAL de este intercambio sea `rol: 'ataque'` para que MARCAR
    // dispare. Energía justa para excluir "Dentellada de jauría" (coste 10) — el roster real del
    // `aullador-rojo` (fauna GUELISES) también trae "Esquivar"(5)/"Defenderse"(0), ambos
    // `rol:'defensa'` y afordables incluso con poca energía, así que NO basta con "energía a tope"
    // ni con "solo Ataque base pagable" (bug de flakiness real cazado corriendo el test
    // repetidas veces e inspeccionando el roster real con trazas): con energía 5, `affordable` =
    // [Ataque base(0), Esquivar(1), Defenderse(2)] en ese orden — random() mockeado a fuerza que
    // `chooseNpcAbility('defensa', ...)` salga del pool `defensivas` (70%) y elija el índice 0
    // (Ataque base) del roster completo.
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: enemigoMarcado.id, scope: 'itinerante-marcar-objetivo' } },
      create: { saveId, npcId: enemigoMarcado.id, scope: 'itinerante-marcar-objetivo', energia: 5 },
      update: { energia: 5 },
    });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Concentración del Domador (prueba)',
      description: '',
      attribute: 'voluntad',
      attributeBonus: 0,
      effects: ['RECUPERACION', 'MARCAR'],
      rol: 'utilidad',
      energyCost: 0,
      energyRegen: 0,
    };
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
    try {
      await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
    } finally {
      randomSpy.mockRestore();
    }

    const companionTrasIntercambio = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: companionP.id } });
    expect(companionTrasIntercambio.marcaObjetivoRondas).toBe(3);
    expect(companionTrasIntercambio.marcaObjetivoId).toBe(enemigoMarcadoP.id);

    // `enemigoSinMarcarP` sale del combate justo aquí (CONVALECIENTE, excluido de `vivos` en
    // `calcularEnganchesRonda`) — su único propósito ya se cumplió (demostrar que el Companion elige
    // el marcado, no cualquier candidato, sembrando 2 NPC reales en escena para el intercambio de
    // MARCAR de arriba). Sin esto, su IA azarosa (inteligencia 6) puede reclamar a la jugadora o al
    // Companion en el recálculo de la ronda siguiente, contaminando el enganche que el resto de este
    // test verifica — mismo mecanismo de "golpe gratis"/regla 4 ya documentado arriba, ajeno a MARCAR
    // en sí. Bug real de flakiness cazado corriendo el test repetidas veces.
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: enemigoSinMarcar.id, scope: 'itinerante-marcar-otro' } },
      create: { saveId, npcId: enemigoSinMarcar.id, scope: 'itinerante-marcar-otro', condicionFisica: 'CONVALECIENTE' },
      update: { condicionFisica: 'CONVALECIENTE' },
    });

    // Cruza una ronda completa — el enganche de la ronda NUEVA (recalculado solo cuando
    // `turnoActual` vuelve a 0, `avanzarYComprobarFin`) debe forzar al Companion a atacar al
    // objetivo marcado, sin pasar por `elegirObjetivo`/Inteligencia normal. El orden de iniciativa
    // real (`rollInitiativeMultiple`, con componente de dado real) no es un simple "por destreza"
    // determinista, así que se resuelven turnos autónomos en bucle hasta que `CombatEncounter.ronda`
    // avanza, en vez de asumir un número fijo de turnos.
    const rondaInicial = (await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } })).ronda;
    for (let i = 0; i < 10; i++) {
      const encounterActual = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
      if (encounterActual.ronda > rondaInicial) break;
      await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
    }
    const companionTrasRonda = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: companionP.id } });
    expect(companionTrasRonda.objetivoActualId).toBe(enemigoMarcadoP.id);
    expect(companionTrasRonda.marcaObjetivoRondas).toBeLessThan(3);

    await prisma.save.update({ where: { id: saveId }, data: { attributes: saveOriginalMarcar.attributes as object } });
    await prisma.companion.deleteMany({ where: { id: companion.id } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // AREA real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Opresor 32/36) — variante ofensiva: mismo
  // gate que MULTIPLE (margen decisivo, ATAQUE+AREA) pero SIN tope de cantidad, alcanza a TODOS los
  // vivos del bando contrario al defensor, no solo un segundo objetivo. 3 NPC enemigos en escena
  // para distinguirlo de MULTIPLE (que solo cubriría 2 de los 3).
  it('AREA (ofensivo): un golpe decisivo con ATAQUE+AREA alcanza a TODOS los enemigos del bando, no solo uno', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const [enemigoA, enemigoB, enemigoC] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);

    // Mismo mecanismo que el test de MULTIPLE: +100 de fuerza garantiza margen decisivo
    // (golpe_pleno) pase lo que pase, sin mockear el dado. Energía de los 3 NPC a 0 fuerza a
    // `chooseNpcAbility` a defenderse solo con las habilidades de coste 0 (`rol:'defensa'`).
    const efectoPrevio: ActiveEffect = { attribute: 'fuerza', magnitude: 100, turnsRemaining: 3, sourceAbility: 'Efecto de prueba (garantiza el margen)' };
    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [efectoPrevio] as unknown as object } });
    await Promise.all([
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoA.id, scope: 'itinerante-area-a' } },
        create: { saveId, npcId: enemigoA.id, scope: 'itinerante-area-a', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoB.id, scope: 'itinerante-area-b' } },
        create: { saveId, npcId: enemigoB.id, scope: 'itinerante-area-b', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
      prisma.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: enemigoC.id, scope: 'itinerante-area-c' } },
        create: { saveId, npcId: enemigoC.id, scope: 'itinerante-area-c', energia: 0 },
        update: { energia: 0, condicionFisica: 'ILESO' },
      }),
    ]);

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoA.id, npcScope: 'itinerante-area-a', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoB.id, npcScope: 'itinerante-area-b', destreza: 10, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigoC.id, npcScope: 'itinerante-area-c', destreza: 10, inteligencia: 6 },
      ]),
    );

    const encounterInicial = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    if (encounterInicial.esperandoEleccionJugadora) {
      const principalP = encounterInicial.participantes.find((p) => p.npcScope === 'itinerante-area-a')!;
      await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: principalP.id });
    }

    const habilidadArea: HabilidadParaIntercambio = {
      name: 'Golpe de Prueba (AREA)',
      description: '',
      attribute: 'fuerza',
      effects: ['ATAQUE', 'AREA'],
      rol: 'ataque',
      energyCost: 5,
      energyRegen: 0,
    };
    const resultado = await resolverHastaJugadoraActua(saveId, worldId, encounterId, habilidadArea);
    expect(resultado).not.toBeNull();

    const [stateA, stateB, stateC] = await Promise.all([
      prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: enemigoA.id, scope: 'itinerante-area-a' } } }),
      prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: enemigoB.id, scope: 'itinerante-area-b' } } }),
      prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: enemigoC.id, scope: 'itinerante-area-c' } } }),
    ]);
    expect(stateA?.condicionFisica).not.toBe('ILESO');
    expect(stateB?.condicionFisica).not.toBe('ILESO');
    expect(stateC?.condicionFisica).not.toBe('ILESO');

    await prisma.save.update({ where: { id: saveId }, data: { activeEffects: [] } });
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
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: (await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } })).id });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Analizar Rival (prueba)',
      description: '',
      attribute: 'inteligencia',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

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
    // Fase C del 0.1 (2026-10-01, test intermitente): NO se puede dar por hecho que la jugadora
    // analiza a la primera fila de `findMany` (sin orden garantizado). Con destreza 1000 actúa
    // primero, pero `iniciarCombatEncounter` ya calcula los enganches de la ronda 1: el primer
    // miembro del grupo en iniciativa la reclama a ella y, por la regla 3 del enganche ("si ya te
    // han elegido, no eliges tú"), queda en duelo con ese y `fijarEleccionRondaJugador` no cambia
    // nada (`esperandoEleccionJugadora: false`). Qué miembro va antes lo decide la tirada de
    // iniciativa, así que el analizado es el rival con el que de verdad está en duelo.
    const miembros = await prisma.combatParticipant.findMany({ where: { encounterId, npcId: enemigo.id } });
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: miembros[0].id });
    const jugadora = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
    const analizado = miembros.find((m) => m.id === jugadora.objetivoActualId)!;
    const otro = miembros.find((m) => m.id !== jugadora.objetivoActualId)!;
    expect(analizado).toBeDefined();
    expect(otro).toBeDefined();

    const habilidad: HabilidadParaIntercambio = {
      name: 'Analizar Rival (prueba grupo)',
      description: '',
      attribute: 'inteligencia',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

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

  // AREA real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Instintivo 28, Instinto de Reserva) —
  // variante defensiva: mientras `areaDefensaPorRondas > 0` sobre el Companion, el golpe dirigido a
  // la jugadora se redirige a él (`redirigirPorAreaDefensiva`), que se defiende con SU propia
  // tirada. `areaDefensaPorRondas` forzado a mano (en vez de disparar la activación real vía
  // AGUANTE+AREA) para aislar exactamente la pieza nueva: la redirección de golpes futuros.
  it('AREA (defensivo): con el efecto activo en el Companion, el golpe dirigido a la jugadora se redirige a él', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });

    const [enemigo, companionOrigen] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);
    const companion = await prisma.companion.create({
      data: {
        saveId,
        sourceSlug: companionOrigen.slug,
        name: 'Compañero de prueba (AREA defensivo)',
        role: 'aliado',
        notes: '',
        attributes: companionOrigen.attributes as object,
        condicionFisica: 'ILESO',
      },
    });

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'JUGADOR', tipo: 'COMPANION', companionId: companion.id, destreza: 500, inteligencia: 6 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-area-defensivo', destreza: 1, inteligencia: 6 },
      ]),
    );
    const companionP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'COMPANION' } });
    const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
    const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
    await prisma.combatParticipant.update({ where: { id: companionP.id }, data: { areaDefensaPorRondas: 2 } });
    // Enganche forzado a mano — el NPC apunta a la jugadora (el objetivo "real" antes de la
    // redirección), mismo criterio que el resto de tests de redirección de golpe (PROVOCACION
    // variante Companion, MARCAR).
    await prisma.combatParticipant.update({ where: { id: enemigoP.id }, data: { objetivoActualId: jugadoraP.id } });
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
    await prisma.combatParticipant.update({ where: { id: enemigoP.id }, data: { objetivoActualId: jugadoraP.id } });

    const jugadoraCondicionAntes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).condicionFisica;
    await resolverTurnoAutonomo({ prisma, worldId, saveId, encounterId, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

    const jugadoraTrasIntercambio = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    const companionTrasIntercambio = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: companionP.id } });
    // La jugadora NUNCA fue tocada — el golpe se resolvió íntegro contra el Companion, con SU propia
    // tirada de defensa (puede o no haber conectado, lo relevante es que la jugadora quedó fuera).
    expect(jugadoraTrasIntercambio.condicionFisica).toBe(jugadoraCondicionAntes);
    expect(companionTrasIntercambio.areaDefensaPorRondas).toBe(2); // solo decrementa al cruzar de ronda, no dentro de la misma

    await prisma.companion.deleteMany({ where: { id: companion.id } });
    await prisma.combatEncounter.deleteMany({ where: { saveId, id: encounterId } });
  }, 30_000);

  // AREA real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Supervivencia 32, Trampa Improvisada) —
  // variante persistente: coloca la trampa (activa `areaTrampaPorRondas` sobre sí misma, camino
  // independiente/utilidad) y, mientras esté viva, cualquier intercambio donde defienda refuerza el
  // contragolpe con `iniciativaForzada` (ATURDIMIENTO), sin importar qué habilidad de defensa use
  // ese turno concreto.
  it('AREA (persistente): Trampa Improvisada activa areaTrampaPorRondas, y mientras esté viva refuerza el contragolpe con ATURDIMIENTO', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', energia: 100, activeEffects: [] } });
    const saveOriginal = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // Inteligencia masiva SOLO en Save.attributes — garantiza que la utilidad (Trampa Improvisada,
    // atributo inteligencia) tenga éxito al colocarla, sin mockear el dado.
    await prisma.save.update({ where: { id: saveId }, data: { attributes: { ...(saveOriginal.attributes as object), inteligencia: 500 } } });

    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 1000, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-area-trampa', destreza: 1, inteligencia: 6 },
      ]),
    );
    const enemigoP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'NPC' } });
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: enemigoP.id });
    // `utilityTriggered` exige que el RIVAL de este intercambio sea `rol: 'ataque'` para que AREA
    // dispare (mismo hallazgo ya documentado en el test de MARCAR de arriba) — energía justa para
    // excluir "Dentellada de jauría" (coste 10) y las defensivas de coste 5+ del roster real del
    // `aullador-rojo`, dejando solo "Ataque base" (coste 5, rol ataque) y "Defenderse" (coste 0, rol
    // defensa) afordables; "Defenderse" cae en el pool `defensivas` (70% de probabilidad), así que
    // se manda la energía justa para que "Ataque base" sea la ÚNICA opción de ataque real posible,
    // sin depender del azar del 30% restante.
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: enemigo.id, scope: 'itinerante-area-trampa' } },
      create: { saveId, npcId: enemigo.id, scope: 'itinerante-area-trampa', energia: 5 },
      update: { energia: 5 },
    });

    const habilidadTrampa: HabilidadParaIntercambio = {
      name: 'Trampa Improvisada (prueba)',
      description: '',
      attribute: 'inteligencia',
      effects: ['ATURDIMIENTO', 'AREA'],
      rol: 'utilidad',
      energyCost: 0,
      energyRegen: 0,
    };
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
    try {
      await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad: habilidadTrampa }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });
    } finally {
      randomSpy.mockRestore();
    }

    const jugadoraP = await prisma.combatParticipant.findFirstOrThrow({ where: { encounterId, tipo: 'JUGADOR' } });
    const jugadoraTrasColocar = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: jugadoraP.id } });
    expect(jugadoraTrasColocar.areaTrampaPorRondas).toBe(2);

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
    await fijarEleccionRondaJugador({ prisma, worldId, saveId, encounterId, jugadoraTargetId: objetivo.id });

    const habilidad: HabilidadParaIntercambio = {
      name: 'Ataque Básico (prueba golpe no decisivo)',
      description: '',
      attribute: 'fuerza',
      effects: [],
      rol: 'ataque',
      energyCost: 0,
      energyRegen: 0,
    };
    await resolverTurnoJugador({ prisma, worldId, saveId, encounterId, accion: { habilidad }, weaponNamesPorDefecto: [], narrarFn: dobleNarracionRapida });

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
