import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { buildNpcInScene, type NpcWithItems } from './npcScene.js';
import { npcCombatAbilitiesFor } from './npcCombatAbilities.js';
import { iniciarCombatEncounter, resolverTurnoAutonomo } from './combateMultipleOrquestacion.js';

/// Sistema de categorías de raza de fauna (2026-09-02) — a diferencia de npcCombatAbilities.test.ts
/// (unitario, roster mockeado a mano), este test carga el Npc REAL "aullador-rojo" ya sembrado por
/// worldCatalog.ts/seed-catalog.ts contra Postgres, y confirma que `faunaCategoria: 'GUELISES'`
/// llega intacto desde la fila real hasta el roster de combate — cubriendo los dos puntos de
/// conversión reales que alimentan el motor (`buildNpcInScene`, npcScene.ts — camino 1v1 clásico —
/// y `toNpcForCombatAbilities`, combateMultipleOrquestacion.ts — camino de combate múltiple), no
/// solo la función pura `faunaCategoriaAbilityUnlocksFor` ya cubierta en el unitario.
describe('sistema de categorías de raza de fauna: integración real contra Postgres', () => {
  let worldId: string;
  let auladorRojo: NpcWithItems;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    auladorRojo = await prisma.npc.findFirstOrThrow({
      where: { worldId, slug: 'aullador-rojo' },
      include: { items: { include: { item: true } } },
    });
  });

  it('la fila real de Aullador Rojo en Postgres tiene faunaCategoria GUELISES (sembrado por worldCatalog.ts)', () => {
    expect(auladorRojo.faunaCategoria).toBe('GUELISES');
    // Las 3 específicas propias (worldCatalog.ts) ya llevan level/effects reales, no el shape
    // viejo sin ellos.
    const raciales = auladorRojo.habilidadesRaciales as unknown as Array<{ name: string; level: number; effects: string[] }>;
    expect(raciales).toHaveLength(3);
    for (const r of raciales) {
      expect(typeof r.level).toBe('number');
      expect(Array.isArray(r.effects)).toBe(true);
      expect(r.effects.length).toBeGreaterThan(0);
    }
  });

  it('camino 1v1 clásico (buildNpcInScene → npcCombatAbilitiesFor): a nivel 1 recibe solo las 3 de categoría GUELISES, ninguna específica propia (todas son nivel 4+)', () => {
    const npcInScene = buildNpcInScene({ ...auladorRojo, level: 1 }, undefined);
    expect(npcInScene.faunaCategoria).toBe('GUELISES');
    const abilities = npcCombatAbilitiesFor(npcInScene, []);
    // GUELISES a nivel 1: Dentellada de jauría (ataque) + Flanqueo instintivo (defensa) +
    // Presión de caza (utilidad) — ver faunaAbilities.ts. "Presión de manada" renombrada a
    // "Presión de caza" 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1").
    expect(abilities.some((a) => a.name === 'Dentellada de jauría')).toBe(true);
    expect(abilities.some((a) => a.name === 'Flanqueo instintivo')).toBe(true);
    expect(abilities.some((a) => a.name === 'Presión de caza')).toBe(true);
    // Ninguna de las 3 específicas propias del Aullador Rojo (todas nivel 4+, worldCatalog.ts):
    // Posicion defensiva (4), Filos centella (12), Instinto Solitario (20).
    expect(abilities.some((a) => a.name === 'Posicion defensiva')).toBe(false);
    expect(abilities.some((a) => a.name === 'Filos centella')).toBe(false);
    expect(abilities.some((a) => a.name === 'Instinto Solitario')).toBe(false);
    // Ninguna de categoría de nivel superior (8/16/24/32).
    expect(abilities.some((a) => a.name === 'Aturdir por el flanco')).toBe(false);
  });

  it('camino 1v1 clásico: a nivel 20 combina categoría (1/1/1/8/16) + las 3 específicas propias, cada una con sus effects reales', () => {
    const npcInScene = buildNpcInScene({ ...auladorRojo, level: 20 }, undefined);
    const abilities = npcCombatAbilitiesFor(npcInScene, []);

    // 3 de categoría nivel 1 + 2 más (nivel 8 y 16) = 5 de categoría hasta nivel 20.
    expect(abilities.some((a) => a.name === 'Dentellada de jauría')).toBe(true);
    expect(abilities.some((a) => a.name === 'Aturdir por el flanco')).toBe(true); // nivel 8
    expect(abilities.some((a) => a.name === 'Contragolpe de colmillos')).toBe(true); // nivel 16
    expect(abilities.some((a) => a.name === 'Aullido de acoso')).toBe(false); // nivel 24, todavía no

    // Las 3 específicas propias, todas desbloqueadas a nivel 20.
    const posicionDefensiva = abilities.find((a) => a.name === 'Posicion defensiva');
    const filosCentella = abilities.find((a) => a.name === 'Filos centella');
    const instintoSolitario = abilities.find((a) => a.name === 'Instinto Solitario');
    expect(posicionDefensiva).toBeDefined();
    expect(filosCentella).toBeDefined();
    expect(instintoSolitario).toBeDefined();
    // Antes del sistema de categorías, las 3 llevaban SIEMPRE effects: [] (puramente
    // descriptivas) — ahora llevan mecánica real (worldCatalog.ts).
    expect(posicionDefensiva!.effects).toEqual(['AGUANTE']);
    expect(filosCentella!.effects).toEqual(['ATAQUE']);
    expect(instintoSolitario!.effects).toEqual(['AGUANTE']);
  });

  it('camino de combate múltiple real (iniciarCombatEncounter + resolverTurnoAutonomo, orquestación real contra Postgres): un Aullador Rojo de nivel alto puede llegar a usar una habilidad de su faunaCategoria en un intercambio real', async () => {
    // Sube el nivel real del catálogo a 20 para la duración de este test (revertido en el
    // finally) — el nivel de catálogo real es 1-4 (levelMax 4), insuficiente para desbloquear
    // ninguna de las 4 habilidades de categoría de nivel 8+ ni las 2 últimas específicas propias;
    // se necesita un nivel alto real para que el roster de combate múltiple las incluya de verdad,
    // mismo criterio que combateMultipleOrquestacion.integration.test.ts (usa NPC reales del
    // catálogo, nunca mocks).
    const original = await prisma.npc.findUniqueOrThrow({ where: { id: auladorRojo.id } });
    await prisma.npc.update({ where: { id: auladorRojo.id }, data: { level: 20, levelMax: 20 } });

    const userId = await getDefaultUserId();
    const [aullador1, corredor1] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } }),
      prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corredor-de-cauce' } }),
    ]);

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Prueba faunaCategoria (Aullador Rojo GUELISES)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });

    try {
      const { encounterId } = await prisma.$transaction((tx) =>
        iniciarCombatEncounter(tx, save.id, [
          { bando: 'JUGADOR', tipo: 'NPC', npcId: aullador1.id, npcScope: 'itinerante', destreza: 15, inteligencia: 6 },
          { bando: 'ENEMIGO', tipo: 'NPC', npcId: corredor1.id, npcScope: 'itinerante', destreza: 12, inteligencia: 4 },
        ]),
      );

      const narrarFn = async () => 'Narración de prueba.';
      // Roster de habilidades real usado por chooseNpcAbility en cada intercambio — se confirma
      // por su NOMBRE en los LogEntry narrados de este combate (abilityEffectHint/nombre de
      // habilidad viajan al participante), pero el dato más simple y determinista de verificar
      // aquí es que el propio roster calculado para el Aullador Rojo (nivel 20 real en BD tras el
      // update de arriba) incluye ya las de su categoría — se re-verifica leyendo el Npc directo,
      // en vez de parsear la narración de texto libre.
      const npcRow = await prisma.npc.findUniqueOrThrow({ where: { id: aullador1.id }, include: { items: { include: { item: true } } } });
      const npcInScene = buildNpcInScene(npcRow, undefined);
      expect(npcInScene.faunaCategoria).toBe('GUELISES');
      const abilities = npcCombatAbilitiesFor(npcInScene, []);
      expect(abilities.some((a) => a.name === 'Aturdir por el flanco' && a.effects.includes('ATURDIMIENTO'))).toBe(true);
      expect(abilities.some((a) => a.name === 'Contragolpe de colmillos' && a.effects.includes('CONTRA'))).toBe(true);

      // Corre unos turnos autónomos reales — confirma que el motor de combate múltiple no
      // revienta con un roster de fauna ampliado (categoría + propias), mismo criterio de "no
      // solo unitarios mockeados" pedido para esta verificación.
      for (let i = 0; i < 5; i++) {
        const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
        if (encounter.estado === 'RESUELTO') break;
        await resolverTurnoAutonomo(prisma, worldId, save.id, encounterId, [], narrarFn);
      }
      const encounterFinal = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
      expect(['EN_CURSO', 'RESUELTO']).toContain(encounterFinal.estado);
    } finally {
      await prisma.combatEncounter.deleteMany({ where: { saveId: save.id } });
      await prisma.npcState.deleteMany({ where: { saveId: save.id } });
      await prisma.save.delete({ where: { id: save.id } });
      await prisma.npc.update({ where: { id: auladorRojo.id }, data: { level: original.level, levelMax: original.levelMax } });
    }
  });

  afterAll(async () => {
    // Salvaguarda adicional: confirma que el nivel real del catálogo quedó restaurado (por si el
    // test de arriba lanzara antes de llegar al finally).
    const row = await prisma.npc.findUniqueOrThrow({ where: { id: auladorRojo.id } });
    expect(row.level).toBe(auladorRojo.level);
  });
});
