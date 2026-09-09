import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { cazarRoutes, dispersionCooldownActivo, candidateFaunaFor } from './cazar.js';

/// Cobertura nueva (auditoría de código 2026-08-25, condición de carrera real): el guard temprano
/// de `/cazar/confirmar` (mira `CombatEncounter` EN_CURSO) deja una ventana real entre la lectura y
/// la creación del encuentro (varias consultas async de por medio: `candidateFaunaFor`,
/// `npc.findMany`) — un doble clic en "salgo a cazar" podía pasar el guard dos veces y crear dos
/// `CombatEncounter` para la misma partida. Arreglado releyendo el guard DENTRO de una transacción
/// con la fila de `Save` bloqueada (`SELECT ... FOR UPDATE`) justo antes de crear — este test
/// dispara las dos confirmaciones a la vez con `Promise.all` contra Postgres de verdad.
async function buildApp() {
  const app = Fastify();
  await app.register(cazarRoutes);
  return app;
}

describe('Cazar: condición de carrera en confirmaciones concurrentes (auditoría de código 2026-08-25)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (cazar, condición de carrera)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('dos "salgo a cazar" simultáneos contra el mismo grupo real crean como mucho 1 CombatEncounter', async () => {
    // 'zense-ceniza' (mismo bicho del crash real que originó este arreglo, dev-server.log
    // 2026-08-25): sin `faunaTerrainTag` propio (sin filtro de terreno, pasa en cualquier sitio) y
    // población real de sobra en Las Llanuras del Viento Rojo (capturablePct 50 -> 5 avistados,
    // `avistadosFor`) para disparar `hayGrupoReal` de verdad, sin necesitar seedear WorldPopulation
    // a mano.
    const app = await buildApp();
    const [resA, resB] = await Promise.all([
      app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['zense-ceniza'] } }),
      app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['zense-ceniza'] } }),
    ]);

    const codes = [resA.statusCode, resB.statusCode].sort();
    // La que pierde la carrera se rechaza con 400 ("ya hay un combate en curso"); la ganadora
    // termina en 200 con el actionText de siempre — nunca las dos en 200.
    expect(codes).toEqual([200, 400]);
    expect(await prisma.combatEncounter.count({ where: { saveId, estado: 'EN_CURSO' } })).toBe(1);
  }, 20_000);
});

/// Cobertura nueva (auditoría de código 2026-09-01, ronda de auditoría en 6 agentes — hallazgo real
/// jugando en vivo, confirmado con 2 peticiones simultáneas por curl): a diferencia del camino de
/// grupo de arriba (protegido desde 2026-08-25), el camino de "caza limpia" (presa única y débil,
/// sin combate) escribía directo sin releer el estado dentro de una transacción — doble clic
/// producía 2 LogEntry duplicados y 2 decrementos de población para el mismo evento. Mismo fix
/// exacto: `SELECT ... FOR UPDATE` + relectura de `pendingCombatNpcSlugs` antes de escribir.
describe('Cazar: condición de carrera en caza limpia (presa única, auditoría 2026-09-01)', () => {
  let saveId: string;
  // Instalado en `beforeAll`, no a nivel de módulo — ver comentario equivalente en el describe de
  // "cooldown de dispersión" más abajo (mismo archivo): dos `vi.spyOn(Math, 'random')` a nivel de
  // módulo se solapan durante la fase de collection de Vitest en vez de envolver `Math.random` real.
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    randomSpy = vi.spyOn(Math, 'random');
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (cazar, caza limpia concurrente)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        // Nivel 10 y destreza alta: 'zense-ceniza' es nivel 1 (debil = level <= playerLevel-2, ver
        // NIVEL_DIFERENCIA_PRESA_DEBIL) y la tirada de éxito (capturablePct + destreza, tope 90)
        // queda garantizada con Math.random mockeado a 0 más abajo, sin depender del azar real.
        level: 10,
        attributes: { fuerza: 10, destreza: 50, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    randomSpy.mockRestore();
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('dos "salgo a cazar" simultáneos contra la misma presa única y débil crean como mucho 1 LogEntry y decrementan la población una sola vez', async () => {
    randomSpy.mockReturnValue(0); // garantiza éxito en la tirada de caza limpia (chance siempre > 0)
    const poblacionAntes = (
      await prisma.worldPopulation.findFirstOrThrow({ where: { worldId: (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).worldId, targetSlug: 'zense-ceniza' } })
    ).poblacion;

    const app = await buildApp();
    const [resA, resB] = await Promise.all([
      app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['zense-ceniza'] } }),
      app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['zense-ceniza'] } }),
    ]);

    const codes = [resA.statusCode, resB.statusCode].sort();
    // La que pierde la carrera se rechaza con 409 (relectura dentro de la transacción encuentra el
    // slug ya en pendingCombatNpcSlugs); la ganadora termina en 200 — nunca las dos en 200.
    expect(codes).toEqual([200, 409]);

    // 'Buitre Cenizo' renombrado a 'Zense Ceniza' (2026-09-02/03), slug incluido.
    const logCount = await prisma.logEntry.count({ where: { saveId, text: { contains: 'Zense Ceniza' } } });
    expect(logCount).toBe(1);

    const world = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    const poblacionDespues = (await prisma.worldPopulation.findFirstOrThrow({ where: { worldId: world.worldId, targetSlug: 'zense-ceniza' } })).poblacion;
    expect(poblacionAntes - poblacionDespues).toBe(1);
  }, 20_000);

  /// Regresión (2026-09-08, reconfirmado jugando en vivo): la caza limpia mata a la presa
  /// directamente (MUERTO, sin combate real) pero seguía persistiendo su slug en
  /// `pendingCombatNpcSlugs` — como esta ruta nunca pasa por `narrateAndPersistTurn` (el único
  /// sitio que sabía limpiar ese campo), quedaba sucio para siempre y bloqueaba cualquier
  /// `/cazar/confirmar` futuro con "Ya hay un combate en curso" sin que la UI ofreciera ningún
  /// botón para resolverlo (el NPC ya estaba MUERTO, `detail.ts` no lo mostraba como combate
  /// pendiente). Ver memoria tarkor_bug_pendingcombatnpcslugs_atascado_cazar_2026-09-08.
  it('la caza limpia con éxito deja pendingCombatNpcSlugs vacío (no atasca la siguiente cacería)', async () => {
    randomSpy.mockReturnValue(0);
    const res = await app_inject_confirmar(saveId, ['zense-ceniza']);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).resuelveSinCombate).toBe(true);

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual([]);
  }, 20_000);
});

async function app_inject_confirmar(saveId: string, slugs: string[]) {
  const app = await buildApp();
  return app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs } });
}

/// Cobertura nueva (checklist 2026-09-01, hallazgo real jugando en vivo): `particionarEnSubCombates`/
/// `MAX_COMBATIENTES_POR_BANDO` (combateMultiple.ts) existían desde 2026-08-28 con 6 tests
/// unitarios, pero nunca se enganchaban a este flujo real — cazar 5+ del mismo tipo (`zense-ceniza`,
/// capturablePct 50 -> 5 avistados, igual que el test de arriba) creaba un único `CombatEncounter`
/// con los 6 participantes (1 JUGADOR + 5 ENEMIGO) dentro, sin ningún tope de 4. Confirmado a mano
/// en Postgres esa misma sesión. Fix: el bando ENEMIGO se parte en fragmentos de
/// `MAX_COMBATIENTES_POR_BANDO`; solo el primero (con la jugadora) es `jugable: true`, el resto se
/// crea `jugable: false` y se resuelve de una sentada con `resolverTurnosAutonomosHastaJugadora`
/// (narración muda, sin llamar a Ollama — esos intercambios nunca se le muestran en directo).
describe('Cazar: sub-partición >4v4 (checklist 2026-09-01)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (cazar, sub-partición)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('cazar 5 Zense Ceniza a la vez parte el bando ENEMIGO en un CombatEncounter jugable (≤4) y uno autónomo ya RESUELTO', async () => {
    const app = await buildApp();
    // `rollGroupEngagement` (cazar.ts) mete un ±1 real sobre lo pedido — con avistados=5 (tope de
    // `zense-ceniza`, capturablePct 50) el resultado real puede caer en 4, que ya no dispara la
    // sub-partición. Reintenta la petición real (limpiando el CombatEncounter fallido cada vez)
    // hasta que el roll dé los 5 reales — sin mockear `Math.random` para no desacoplar el test del
    // camino HTTP real de punta a punta.
    let res;
    for (let intento = 0; intento < 20; intento++) {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      res = await app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['zense-ceniza'], cantidades: { 'zense-ceniza': 5 } } });
      expect(res.statusCode).toBe(200);
      const total = await prisma.combatParticipant.count({ where: { encounter: { saveId }, bando: 'ENEMIGO' } });
      if (total > 4) break;
    }

    const encounters = await prisma.combatEncounter.findMany({ where: { saveId }, include: { participantes: true } });
    const jugable = encounters.find((e) => e.jugable);
    const autonomos = encounters.filter((e) => !e.jugable);

    expect(jugable).toBeDefined();
    // Tope real: 1 JUGADOR + como mucho MAX_COMBATIENTES_POR_BANDO (4) ENEMIGO en el sub-combate jugable.
    expect(jugable!.participantes.filter((p) => p.bando === 'ENEMIGO').length).toBeLessThanOrEqual(4);
    expect(jugable!.estado).toBe('EN_CURSO');

    // El resto (5 - 4 = 1 enemigo restante) va a un CombatEncounter autónomo, ya resuelto de una
    // sentada nada más terminar la petición — sin bando contrario, se cierra RESUELTO enseguida.
    expect(autonomos.length).toBeGreaterThan(0);
    for (const enc of autonomos) {
      expect(enc.estado).toBe('RESUELTO');
    }
  }, 20_000);
});

/// Cobertura de integración real (2026-09-02) — cooldown de dispersión tras caza en grupo fallida
/// (commit d6e8afc + esta pieza): con `cantidadElegida=1` y `Math.random` mockeado al peor roll,
/// `rollGroupEngagement` da 0 de verdad contra Postgres real, confirmando de punta a punta que (1)
/// la especie desaparece de los candidatos de ESA Location mientras el cooldown de 4h de ficción
/// sigue activo, y (2) reaparece en cuanto el reloj de ficción avanza lo suficiente.
describe('Cazar: cooldown de dispersión tras fallo total (2026-09-02)', () => {
  let saveId: string;
  let worldId: string;
  // `vi.spyOn` a nivel de módulo (fuera de `beforeAll`) se instala durante la fase de "collection"
  // de Vitest — todos los `describe()` del archivo se evalúan de forma síncrona ANTES de que corra
  // ningún `beforeAll`/`it`. El describe de arriba ("condición de carrera en caza limpia") también
  // hace `vi.spyOn(Math, 'random')` a ese mismo nivel: con los dos instalados en el mismo instante,
  // el segundo envuelve al primero en vez de a `Math.random` real, y el `mockRestore()` del primero
  // (en su propio afterAll) deja el mock de este describe apuntando a un spy ya descartado —
  // flake real confirmado en vivo (roll alto pese a `mockReturnValue(0)`, ~1/3 de las corridas).
  // Instalarlo dentro de `beforeAll` en vez de a nivel de módulo evita el solapamiento.
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    randomSpy = vi.spyOn(Math, 'random');
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (cazar, cooldown de dispersión)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        // Zense Ceniza (slug zense-ceniza) es CAUTELOSO, no AGRESIVO — el guard de "fauna
        // agresiva no se dispersa salvo superioridad clara" (cazar.ts) no debe interferir aquí.
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Aislamiento del estado compartido (mismo `targetSlug` que usa el describe anterior, "cazar 5
    // Zense Ceniza a la vez", cuyos reintentos con roll real sin mock pueden dejar un fallo total
    // real y escribir este mismo cooldown antes de que empiece este bloque) — sin este reset, un
    // cooldown ya activo hace que `zense-ceniza` desaparezca de `selected` desde el principio y el
    // test de abajo nunca llega a crear el combate real que espera.
    await prisma.worldPopulation.updateMany({
      where: { worldId, targetType: 'FAUNA', targetSlug: 'zense-ceniza' },
      data: { dispersadoEnLocationId: null, dispersadoDesdeMinutes: null },
    });
  });

  afterAll(async () => {
    randomSpy.mockRestore();
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.worldPopulation.updateMany({
      where: { worldId, targetType: 'FAUNA', targetSlug: 'zense-ceniza' },
      data: { dispersadoEnLocationId: null, dispersadoDesdeMinutes: null },
    });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('cantidadReal=0 escribe el cooldown y la especie desaparece de los candidatos de esa Location', async () => {
    const app = await buildApp();
    // roll bajo (0) -> floor(0*6)+1=1 -> delta -1 -> con cantidadElegida=1, cantidadReal = max(0, 1-1) = 0.
    randomSpy.mockReturnValue(0);
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/cazar/confirmar`,
      payload: { slugs: ['zense-ceniza'], cantidades: { 'zense-ceniza': 1 } },
    });
    expect(res.statusCode).toBe(200);

    const pop = await prisma.worldPopulation.findFirstOrThrow({ where: { worldId, targetType: 'FAUNA', targetSlug: 'zense-ceniza' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    expect(pop.dispersadoEnLocationId).toBe(hondonada.id);
    expect(pop.dispersadoDesdeMinutes).not.toBeNull();

    // Con el cooldown activo, Zense Ceniza ya no debe salir como candidato de caza en esta Location
    // — via /explorar (candidateFaunaFor real, no /GET que además filtra por sessionFacts ya
    // "localizados", cosa que este save recién creado nunca tiene). random=0.99 evita el fallo de
    // `rollSightings` (CAZA_EXPLORAR_CHANCE_FALLO=0.35) sin depender del azar real.
    randomSpy.mockReturnValue(0.99);
    const candidatos = await app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/explorar` });
    expect(candidatos.statusCode).toBe(200);
    expect(JSON.parse(candidatos.body).candidates.some((c: { slug: string }) => c.slug === 'zense-ceniza')).toBe(false);
  }, 20_000);

  it('pasadas las 4h de ficción, el cooldown de WorldPopulation deja de estar activo', async () => {
    // Verifica el estado real en vez del resultado de /explorar (tirada ponderada real: con más de
    // un candidato posible en la región, `rollSightings` puede elegir cualquiera de ellos, no
    // necesariamente Zense Ceniza — comprobarlo así habría sido un test frágil). Lo que de verdad
    // hay que confirmar es que `dispersionCooldownActivo` deja de bloquear pasadas las 4h de
    // ficción, mismo criterio puro que ya cubre `dispersionCooldownActivo` en el test unitario.
    const worldState = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    const pop = await prisma.worldPopulation.findFirstOrThrow({ where: { worldId, targetType: 'FAUNA', targetSlug: 'zense-ceniza' } });
    expect(dispersionCooldownActivo(pop.dispersadoDesdeMinutes, worldState.fictionalMinutes + 241)).toBe(false);
  });
});

/// Cobertura de integración real (hallazgo 29b, revisar-partida-hallazgos.md 2026-09-07) —
/// `candidateFaunaFor` nunca consultaba `harvestSourceHomeLocationSlug` (worldCatalog.ts), así que
/// TODA la fauna cazable con población real en una región aparecía por igual en cualquier Location
/// de esa región, sin distinguir la Location exacta — causa raíz confirmada de "ya me sale lo
/// mismo en esas habilidades que me salía en la Hondonada" al llegar a otra Location. `murgol`
/// (candado a una sola Location) y `zense-ceniza` (candado a 2 Locations a la vez, "carroñera
/// errante") ya tienen población real sembrada en Las Llanuras del Viento Rojo — se llama a
/// `candidateFaunaFor` directamente (puro, sin `Save`) contra Locations reales del catálogo.
describe('Cazar: candidateFaunaFor respeta harvestSourceHomeLocationSlug (hallazgo 29b, 2026-09-07)', () => {
  let worldId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
  });

  it('Murgol (candado a una sola Location) SÍ aparece en el Oasis de Chudos Rojos, NUNCA en otra Location de la misma región', async () => {
    const enOasis = await candidateFaunaFor(worldId, 'Las Llanuras del Viento Rojo', 1, 'oasis-de-chudos-rojos', null, 0);
    expect(enOasis.some((c) => c.slug === 'murgol')).toBe(true);

    const enHondonada = await candidateFaunaFor(worldId, 'Las Llanuras del Viento Rojo', 1, 'hondonada-del-eco', null, 0);
    expect(enHondonada.some((c) => c.slug === 'murgol')).toBe(false);
  });

  it('Zense Ceniza (sin candado a propósito, "carroñera errante" sin hogar fijo — mismo criterio que Ruptidar) sigue apareciendo en toda la región, sin regresión', async () => {
    const enHondonada = await candidateFaunaFor(worldId, 'Las Llanuras del Viento Rojo', 1, 'hondonada-del-eco', null, 0);
    const enFilo = await candidateFaunaFor(worldId, 'Las Llanuras del Viento Rojo', 1, 'filo-de-las-brasas', null, 0);
    expect(enHondonada.some((c) => c.slug === 'zense-ceniza')).toBe(true);
    expect(enFilo.some((c) => c.slug === 'zense-ceniza')).toBe(true);
  });

  it('Ruptidar (sin candado a propósito, "presente en cualquier zona arenosa") sigue apareciendo en toda la región, sin regresión', async () => {
    const enHondonada = await candidateFaunaFor(worldId, 'Las Llanuras del Viento Rojo', 1, 'hondonada-del-eco', null, 0);
    const enPilares = await candidateFaunaFor(worldId, 'Las Llanuras del Viento Rojo', 1, 'pilares-rotos', null, 0);
    expect(enHondonada.some((c) => c.slug === 'ruptidar')).toBe(true);
    expect(enPilares.some((c) => c.slug === 'ruptidar')).toBe(true);
  });
});

/// Cobertura nueva (2026-09-08, diseño de grupos de combate — ver Companion.combatGroupSlotIndex
/// en schema.prisma): hallazgo real jugando en vivo, un Companion domesticado NUNCA entraba a
/// combate real pese a que el motor de combate múltiple ya sabía procesar `tipo: 'COMPANION'`
/// (`datosVivosDe`) — el único caller real (`cazar.ts`) nunca lo añadía al array de combatientes.
/// Este test confirma que un compañero del Grupo 1 (combatGroupSlotIndex: 0, default) SÍ entra al
/// bando JUGADOR del `CombatEncounter` real, y que uno movido a otro grupo NO entra.
describe('Cazar: grupos de combate — el Grupo 1 entra a combate junto al jugador (2026-09-08)', () => {
  let saveId: string;
  let companionGrupo1Id: string;
  let companionOtroGrupoId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (grupos de combate)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
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

  afterAll(async () => {
    await prisma.combatParticipant.deleteMany({ where: { encounter: { saveId } } });
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el compañero del Grupo 1 aparece como CombatParticipant en el bando JUGADOR; el de otro grupo no', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['zense-ceniza'] } });
    expect(res.statusCode).toBe(200);

    const encounter = await prisma.combatEncounter.findFirstOrThrow({ where: { saveId, estado: 'EN_CURSO' } });
    const participantes = await prisma.combatParticipant.findMany({ where: { encounterId: encounter.id } });

    const jugadorBando = participantes.filter((p) => p.bando === 'JUGADOR');
    expect(jugadorBando.some((p) => p.tipo === 'COMPANION' && p.companionId === companionGrupo1Id)).toBe(true);
    expect(participantes.some((p) => p.companionId === companionOtroGrupoId)).toBe(false);
  }, 20_000);
});
