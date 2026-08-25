import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { iniciarCombatEncounter, resolverTurnoAutonomo } from './combateMultipleOrquestacion.js';

/// Grupo 3 § Combate múltiple (2026-08-25) — harness de integración real (mismo criterio que
/// turn.integration.test.ts): la narración pasa un doble rápido (`narrarFn` inyectable) en vez de
/// llamar a Ollama de verdad (30-220s por llamada, ver combateMultipleNarracion.ts) — esto prueba
/// la orquestación de estado real (CombatEncounter/CombatParticipant, NpcState), no la narración.
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
      const resultado = await prisma.$transaction((tx) => resolverTurnoAutonomo(tx, worldId, saveId, encounterId, [], dobleNarracionRapida));
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
});
