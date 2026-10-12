import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { iniciarCaza, dispersionCooldownActivo, rollGroupEngagement, rollGroupEngagementDetail, groupVarianceClause, type CazaTarget } from './caza.js';
import type { AttributeBlock } from './dice.js';

/// Fase 4 (2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`) — `cazar.ts` (rutas
/// `/cazar/explorar`, `/cazar/confirmar`, población regional sin `ZonePoint`) se retira: Cazar solo
/// se dispara ya desde `POST /saves/:id/zona/cazar` (ver `zonaCazar.integration.test.ts`) o desde
/// el agresivo en grupo de `dynamicMode.ts`, ambos sobre `iniciarCaza` (este archivo). Esta
/// suite traslada la cobertura de `cazar.integration.test.ts`/`cazar.test.ts` que de verdad
/// probaba lógica de `caza.ts` (condición de carrera, sub-partición >4v4, cooldown de dispersión,
/// grupos de combate) a llamar `iniciarCaza` directamente — sin pasar por ninguna ruta HTTP, igual
/// de válido porque las guardas (bloqueo de fila, `activeEncounterFresco`) viven dentro del propio
/// servicio, no en el caller. `avistadosFor`/`rollSightings`/`candidateFaunaFor` (población
/// regional sin `ZonePoint`) se retiran sin sustituto — ninguna UI vuelve a llamarlas.
const attrs: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

describe('rollGroupEngagement', () => {
  it('roll 1-2 (r bajo): uno menos que lo elegido', () => {
    expect(rollGroupEngagement(3, 10, () => 0)).toBe(2); // floor(0*6)+1=1 -> delta -1
  });

  it('roll 3-4 (r medio): exactamente lo elegido', () => {
    expect(rollGroupEngagement(3, 10, () => 0.4)).toBe(3); // floor(0.4*6)+1=3 -> delta 0
  });

  it('roll 5-6 (r alto): uno más que lo elegido', () => {
    expect(rollGroupEngagement(3, 10, () => 0.99)).toBe(4); // floor(0.99*6)+1=6 -> delta +1
  });

  it('con cantidadElegida=1 y el peor roll, puede dar 0 (fallo total)', () => {
    expect(rollGroupEngagement(1, 10, () => 0)).toBe(0);
  });

  it('nunca baja de 0 (el suelo real, no 1)', () => {
    expect(rollGroupEngagement(0, 10, () => 0)).toBe(0);
  });

  it('nunca supera los avistados reales aunque el roll sume', () => {
    expect(rollGroupEngagement(5, 5, () => 0.99)).toBe(5);
  });
});

// Fase 10 (2026-09-29) — la tirada del grupo se expone (dado, delta, resultado topado).
describe('rollGroupEngagementDetail', () => {
  it('devuelve el d6 real, el delta y la cantidad tirada (misma que rollGroupEngagement)', () => {
    expect(rollGroupEngagementDetail(3, 10, () => 0)).toEqual({ roll: 1, delta: -1, cantidadTirada: 2 });
    expect(rollGroupEngagementDetail(3, 10, () => 0.4)).toEqual({ roll: 3, delta: 0, cantidadTirada: 3 });
    expect(rollGroupEngagementDetail(3, 10, () => 0.99)).toEqual({ roll: 6, delta: 1, cantidadTirada: 4 });
    expect(rollGroupEngagementDetail(5, 5, () => 0.99).cantidadTirada).toBe(rollGroupEngagement(5, 5, () => 0.99));
  });
});

describe('groupVarianceClause', () => {
  it('igual a lo elegido: sin cláusula (null)', () => {
    expect(groupVarianceClause(2, 2)).toBeNull();
  });

  it('sale MÁS de lo marcado: intrusión sorpresa', () => {
    expect(groupVarianceClause(1, 2)).toBe('aunque al acercarme, otro más se suma de repente, sin previo aviso');
    expect(groupVarianceClause(1, 3)).toBe('aunque al acercarme, 2 más se suman de repente, sin previo aviso');
  });

  it('sale MENOS de lo marcado: solo se consigue acorralar a algunos', () => {
    expect(groupVarianceClause(2, 1)).toBe('aunque al final solo consigo acorralar a uno de los que había marcado');
    expect(groupVarianceClause(4, 2)).toBe('aunque al final solo consigo acorralar a 2 de los que había marcado');
  });

  it('fallo total (cantidadReal 0): el grupo entero se dispersa', () => {
    expect(groupVarianceClause(3, 0)).toBe('aunque al final el grupo entero se dispersa antes de que pueda acorralar a ninguno');
  });
});

describe('dispersionCooldownActivo', () => {
  it('sin dispersión previa (null), nunca bloquea', () => {
    expect(dispersionCooldownActivo(null, 1000)).toBe(false);
  });

  it('dentro de las 4h de ficción (240 min) desde que se dispersó, sigue bloqueado', () => {
    expect(dispersionCooldownActivo(480, 480 + 239)).toBe(true);
  });

  it('justo al cumplirse las 4h de ficción, deja de bloquear', () => {
    expect(dispersionCooldownActivo(480, 480 + 240)).toBe(false);
  });

  it('mucho después de las 4h, sigue sin bloquear', () => {
    expect(dispersionCooldownActivo(480, 480 + 10000)).toBe(false);
  });
});

describe('iniciarCaza — integración real (Postgres, sobre el catálogo de helek-sirik)', () => {
  let worldId: string;
  let locationId: string;
  let zenseCeniza: Awaited<ReturnType<typeof prisma.npc.findFirstOrThrow>>;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    locationId = hondonada.id;
    // Zense Ceniza (nivel 1, CAUTELOSO, con población real en Las Llanuras del Viento Rojo) —
    // mismo bicho que ya usaba `cazar.integration.test.ts` para esta misma cobertura.
    zenseCeniza = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'zense-ceniza' } });
  });

  async function crearSave(level: number, characterName: string) {
    const userId = await getDefaultUserId();
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName,
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        level,
        attributes: attrs,
        portraitInitial: 'G',
        currentLocationId: locationId,
      },
    });
    await prisma.worldState.create({ data: { saveId: save.id } });
    return save.id;
  }

  async function limpiarSave(saveId: string) {
    await prisma.combatParticipant.deleteMany({ where: { encounter: { saveId } } });
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  }

  async function saveParaCaza(saveId: string, level: number) {
    return { id: saveId, worldId, characterName: 'x', level, attributes: attrs, currentLocationId: locationId, region: 'Las Llanuras del Viento Rojo', fictionalMinutes: 480 };
  }

  /// Cobertura trasladada (auditoría de código 2026-08-25/2026-09-01, condición de carrera real):
  /// el guard de `activeEncounterFresco` releía el estado DENTRO de una transacción con la fila de
  /// `Save` bloqueada — dos "salgo a cazar" a la vez contra el mismo grupo real crean como mucho 1
  /// `CombatEncounter`.
  describe('condición de carrera en confirmaciones concurrentes', () => {
    let saveId: string;

    beforeAll(async () => {
      saveId = await crearSave(1, 'Gorhorn de prueba (caza.ts, condición de carrera en grupo)');
    });
    afterAll(() => limpiarSave(saveId));

    it('dos iniciarCaza simultáneos contra el mismo grupo real crean como mucho 1 CombatEncounter', async () => {
      const save = await saveParaCaza(saveId, 1);
      const targets: CazaTarget[] = [{ npc: zenseCeniza, cantidadObjetivo: 5 }];
      const [a, b] = await Promise.all([iniciarCaza({ save, targets }), iniciarCaza({ save, targets })]);
      const resultados = [a, b];
      const errores = resultados.filter((r) => 'error' in r);
      const exitosos = resultados.filter((r) => !('error' in r));
      // La que pierde la carrera se rechaza; la ganadora termina con éxito — nunca las dos.
      expect(errores.length).toBe(1);
      expect(exitosos.length).toBe(1);
      expect(await prisma.combatEncounter.count({ where: { saveId, estado: 'EN_CURSO' } })).toBe(1);
    }, 20_000);
  });

  /// Cobertura trasladada (auditoría 2026-09-01): la caza limpia (presa única y débil) también
  /// relee `pendingCombatNpcSlugs` dentro de la transacción antes de escribir — nunca duplica el
  /// `LogEntry` ni el decremento de población.
  describe('condición de carrera en caza limpia (presa única y débil)', () => {
    let saveId: string;
    let randomSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
      randomSpy = vi.spyOn(Math, 'random');
      saveId = await crearSave(10, 'Gorhorn de prueba (caza.ts, caza limpia concurrente)');
    });
    afterAll(async () => {
      randomSpy.mockRestore();
      await limpiarSave(saveId);
    });

    it('dos iniciarCaza simultáneos contra la misma presa débil crean como mucho 1 LogEntry y decrementan la población una sola vez', async () => {
      randomSpy.mockReturnValue(0); // garantiza éxito en la tirada de caza limpia
      // CR-6 (hito 0.2): la caza resta de la población de esta partida, no de la del mundo.
      await asegurarMundoDePartida(prisma, saveId);
      const poblacionAntes = (await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'zense-ceniza' } })).poblacion;

      const save = await saveParaCaza(saveId, 10);
      const targets: CazaTarget[] = [{ npc: zenseCeniza, cantidadObjetivo: 1 }];
      const [a, b] = await Promise.all([iniciarCaza({ save, targets }), iniciarCaza({ save, targets })]);
      const resultados = [a, b];
      expect(resultados.filter((r) => 'error' in r).length).toBe(1);
      expect(resultados.filter((r) => !('error' in r)).length).toBe(1);

      const logCount = await prisma.logEntry.count({ where: { saveId, text: { contains: 'Zense Ceniza' } } });
      expect(logCount).toBe(1);

      const poblacionDespues = (await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'zense-ceniza' } })).poblacion;
      expect(poblacionAntes - poblacionDespues).toBe(1);

      const saveTrasCaza = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(saveTrasCaza.pendingCombatNpcSlugs).toEqual([]);
    }, 20_000);
  });

  /// Cobertura trasladada (checklist 2026-09-01) — cazar 5 individuos a la vez parte el bando
  /// ENEMIGO en un `CombatEncounter` jugable (≤4) y el resto en uno autónomo ya resuelto.
  describe('sub-partición >4v4', () => {
    let saveId: string;

    beforeAll(async () => {
      saveId = await crearSave(1, 'Gorhorn de prueba (caza.ts, sub-partición)');
    });
    afterAll(() => limpiarSave(saveId));

    it('cazar 5 Zense Ceniza a la vez parte el bando ENEMIGO en un CombatEncounter jugable (≤4) y uno autónomo ya RESUELTO', async () => {
      const save = await saveParaCaza(saveId, 1);
      const targets: CazaTarget[] = [{ npc: zenseCeniza, cantidadObjetivo: 5, cantidadElegida: 5 }];
      // random=0.5 -> roll=4 -> delta 0 -> cantidadReal=5 (determinista, sin reintentos).
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      try {
        const resultado = await iniciarCaza({ save, targets });
        expect('error' in resultado).toBe(false);
        // P77 (QA-27): el diario dice cuántos se quedan fuera del combate en vivo.
        expect(JSON.stringify(resultado)).toContain('Solo 4 alcanzan a');
        expect(JSON.stringify(resultado)).toContain('el otro se queda rezagado');
      } finally {
        randomSpy.mockRestore();
      }

      const encounters = await prisma.combatEncounter.findMany({ where: { saveId }, include: { participantes: true } });
      const jugable = encounters.find((e) => e.jugable);
      const autonomos = encounters.filter((e) => !e.jugable);

      expect(jugable).toBeDefined();
      expect(jugable!.participantes.filter((p) => p.bando === 'ENEMIGO').length).toBeLessThanOrEqual(4);
      expect(jugable!.estado).toBe('EN_CURSO');
      expect(autonomos.length).toBeGreaterThan(0);
      for (const enc of autonomos) expect(enc.estado).toBe('RESUELTO');
    }, 20_000);
  });

  /// CR-62 (62d, ADR 0002): con más enemigos de los que caben, tu Grupo 2 pelea de fondo contra el
  /// grupo enemigo que sobra (antes ese grupo no tenía con quién pelear).
  describe('tus otros grupos pelean de fondo (CR-62)', () => {
    let saveId: string;
    beforeAll(async () => {
      saveId = await crearSave(1, 'Gorhorn de prueba (caza.ts, grupo 2 de fondo)');
    });
    afterAll(() => limpiarSave(saveId));

    it('el Grupo 2 entra en el sub-combate de fondo y su resumen sale en la narración', async () => {
      const atributos = { fuerza: 16, destreza: 16, constitucion: 16, inteligencia: 10, voluntad: 12, carisma: 8, magia: 0 };
      const ana = await prisma.companion.create({ data: { saveId, name: 'Ana', role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: 'aullador-rojo', attributes: atributos, combatGroupSlotIndex: 1 } });
      await prisma.combatGroup.create({ data: { saveId, slotIndex: 1, name: 'Retaguardia' } });
      const save = await saveParaCaza(saveId, 1);
      const targets: CazaTarget[] = [{ npc: zenseCeniza, cantidadObjetivo: 5, cantidadElegida: 5 }];
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      let resultado;
      try {
        resultado = await iniciarCaza({ save, targets });
      } finally {
        randomSpy.mockRestore();
      }
      expect('error' in resultado!).toBe(false);
      const autonomo = await prisma.combatEncounter.findFirstOrThrow({ where: { saveId, jugable: false }, include: { participantes: true } });
      expect(autonomo.participantes.some((p) => p.companionId === ana.id)).toBe(true);
      expect(autonomo.estado).toBe('RESUELTO');
      expect(JSON.stringify(resultado)).toContain('Retaguardia se enfrenta a');
      expect(JSON.stringify(resultado)).not.toContain('rezagado');
    }, 20_000);
  });

  /// Cobertura trasladada (2026-09-02) — fallo total del grupo (`cantidadReal=0`) escribe el
  /// cooldown de dispersión en `WorldPopulation` para ese `targetSlug`/Location.
  describe('cooldown de dispersión tras fallo total', () => {
    let saveId: string;

    beforeAll(async () => {
      saveId = await crearSave(1, 'Gorhorn de prueba (caza.ts, cooldown de dispersión)');
      // CR-6 (hito 0.2): el cooldown se escribe en la población de esta partida (se borra con ella).
      await asegurarMundoDePartida(prisma, saveId);
      await prisma.worldPopulation.updateMany({
        where: { saveId, targetType: 'FAUNA', targetSlug: 'zense-ceniza' },
        data: { dispersadoEnLocationId: null, dispersadoDesdeMinutes: null },
      });
    });
    afterAll(async () => {
      await limpiarSave(saveId);
    });

    it('cantidadReal=0 escribe el cooldown de dispersión de esa Location', async () => {
      const save = await saveParaCaza(saveId, 1);
      const targets: CazaTarget[] = [{ npc: zenseCeniza, cantidadObjetivo: 5, cantidadElegida: 1 }];
      // random=0 -> roll=1 -> delta -1 -> cantidadReal=max(0,1-1)=0.
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      try {
        await iniciarCaza({ save, targets });
      } finally {
        randomSpy.mockRestore();
      }

      const pop = await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetType: 'FAUNA', targetSlug: 'zense-ceniza' } });
      expect(pop.dispersadoEnLocationId).toBe(locationId);
      expect(pop.dispersadoDesdeMinutes).not.toBeNull();
    }, 20_000);
  });

  /// Cobertura trasladada (2026-09-08, `Companion.combatGroupSlotIndex`) — el compañero del Grupo
  /// 1 entra al bando JUGADOR del `CombatEncounter` real; uno de otro grupo, no.
  describe('grupos de combate — el Grupo 1 entra a combate junto al jugador', () => {
    let saveId: string;
    let companionGrupo1Id: string;
    let companionOtroGrupoId: string;

    beforeAll(async () => {
      saveId = await crearSave(1, 'Gorhorn de prueba (caza.ts, grupos de combate)');
      const companionAttrs = { fuerza: 6, destreza: 8, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 };
      const grupo1 = await prisma.companion.create({
        data: { saveId, name: 'Ceniza', role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: 'zense-ceniza', attributes: companionAttrs, combatGroupSlotIndex: 0 },
      });
      companionGrupo1Id = grupo1.id;
      const otroGrupo = await prisma.companion.create({
        data: { saveId, name: 'Gesgurio', role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: 'gesgurio', attributes: companionAttrs, combatGroupSlotIndex: 1 },
      });
      companionOtroGrupoId = otroGrupo.id;
    });
    afterAll(() => limpiarSave(saveId));

    it('el compañero del Grupo 1 aparece como CombatParticipant en el bando JUGADOR; el de otro grupo no', async () => {
      const save = await saveParaCaza(saveId, 1);
      const targets: CazaTarget[] = [{ npc: zenseCeniza, cantidadObjetivo: 3, cantidadElegida: 3 }];
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // roll 4 -> delta 0 -> cantidadReal=3
      try {
        const resultado = await iniciarCaza({ save, targets });
        expect('error' in resultado).toBe(false);
      } finally {
        randomSpy.mockRestore();
      }

      const encounter = await prisma.combatEncounter.findFirstOrThrow({ where: { saveId, estado: 'EN_CURSO' } });
      const participantes = await prisma.combatParticipant.findMany({ where: { encounterId: encounter.id } });
      const jugadorBando = participantes.filter((p) => p.bando === 'JUGADOR');
      expect(jugadorBando.some((p) => p.tipo === 'COMPANION' && p.companionId === companionGrupo1Id)).toBe(true);
      expect(participantes.some((p) => p.companionId === companionOtroGrupoId)).toBe(false);
    }, 20_000);
  });
});
