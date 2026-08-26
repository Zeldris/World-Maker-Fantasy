import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { iniciarCombatEncounter, resolverTurnoAutonomo, resolverTurnoJugador, fijarEleccionRondaJugador } from './combateMultipleOrquestacion.js';
import type { HabilidadParaIntercambio } from './combateMultiple.js';

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
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
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

  it('con la jugadora en persona en un bando — resolverTurnoJugador ataca, resolverTurnoAutonomo cubre el resto', async () => {
    const enemigo = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 10, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: enemigo.id, npcScope: 'itinerante-jugadora', destreza: 10, inteligencia: 6 },
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

    let terminado = false;
    for (let i = 0; i < 60 && !terminado; i++) {
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

    const { encounterId } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 10, inteligencia: 10 },
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
    let terminado = false;
    for (let i = 0; i < 60 && !terminado; i++) {
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
  }, 30_000);
});
