import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { companerosRoutes } from './companeros.js';
import { iniciarCombatEncounter } from '../../services/combateMultipleOrquestacion.js';

/// Cobertura nueva (auditoría de código 2026-08-25, condición de carrera real): la ruta
/// `/tameo-pendientes/:npcSlug/confirmar` no pasa por `claimTurnInFlight` (exclusivo de
/// `/turn/narrate`) — leía `companionCount`/`esSlotDomador` ANTES de escribir nada, así que dos
/// confirmaciones casi simultáneas (dos capturas pendientes distintas) podían pasar ambas el check
/// del tope de slots y crear ambas su Companion. Arreglado bloqueando la fila de `Save` con
/// `SELECT ... FOR UPDATE` dentro de una transacción (mismo patrón que `progression.ts` §
/// `/attribute-points`) — este test dispara las dos confirmaciones a la vez con `Promise.all` para
/// comprobarlo contra Postgres de verdad, no solo leyendo el código.
async function buildApp() {
  const app = Fastify();
  await app.register(companerosRoutes);
  return app;
}

describe('Compañeros: condición de carrera en confirmaciones concurrentes (auditoría de código 2026-08-25)', () => {
  let saveId: string;
  let auladorId: string;
  let corretolvasId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas' } });
    auladorId = aullador.id;
    corretolvasId = corretolvas.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (compañeros, condición de carrera)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;

    // Exactamente 1 slot de compañero real (recipeKey 'campamento' = companionSlots: 1,
    // construction.ts) — sin pasar por un turno completo, mismo atajo que otros describe de
    // condición de carrera de este proyecto (seedear el estado directo, no simular la narración).
    await prisma.building.create({
      data: { saveId, recipeKey: 'campamento', name: 'Campamento', kind: 'refugio', status: 'ACTIVO', description: 'x' },
    });

    // 2 capturas pendientes DISTINTAS, ambas ya con Felicidad suficiente para confirmar (umbral
    // general 80, FELICIDAD_UMBRAL_GENERAL en companionSupervivencia.ts) — el escenario real del
    // hallazgo: dos NPC distintos confirmados a la vez, no el mismo dos veces.
    await prisma.npcState.create({ data: { saveId, npcId: auladorId, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 90 } });
    await prisma.npcState.create({ data: { saveId, npcId: corretolvasId, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 90 } });
  });

  afterAll(async () => {
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.building.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('con 1 solo slot real, confirmar 2 capturas distintas a la vez crea como mucho 1 Companion', async () => {
    const app = await buildApp();
    const [resA, resB] = await Promise.all([
      app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/aullador-rojo/confirmar`, payload: {} }),
      app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/corretolvas/confirmar`, payload: {} }),
    ]);

    const codes = [resA.statusCode, resB.statusCode].sort();
    expect(codes).toEqual([200, 409]); // una gana el hueco, la otra se suelta sin hueco
    expect(await prisma.companion.count({ where: { saveId } })).toBe(1);
  }, 20_000);
});

/// Cobertura nueva (auditoría de deuda técnica 2026-08-25): companeros.ts (11 endpoints — captura,
/// tameo/persuasión, equipo, Almacén de Reino, plantillas) no tenía NINGÚN test de ruta pese a
/// tener lógica no trivial propia (búsqueda de jaula con hueco libre, claim de esSlotDomador, gates
/// de capacidad combinados). Cobertura de camino feliz para cada endpoint — la condición de carrera
/// de /confirmar ya tiene su propio describe arriba, no se repite aquí.
describe('Compañeros: cobertura de ruta — captura → tameo → confirmar (auditoría de deuda técnica 2026-08-25)', () => {
  let saveId: string;
  let hondonadaId: string;
  let corretolvasId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas' } });
    corretolvasId = corretolvas.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (companeros, cobertura de ruta)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;

    // corretolvas requiere Jaula MEDIANA (JAULA_TAMANO_REQUERIDO, companionSupervivencia.ts).
    await prisma.building.createMany({
      data: [
        { saveId, recipeKey: 'jaula-mediana', name: 'Jaula mediana', kind: 'jaula', status: 'ACTIVO', description: 'x' },
        { saveId, recipeKey: 'campamento', name: 'Campamento', kind: 'refugio', status: 'ACTIVO', description: 'x' },
      ],
    });
    await prisma.inventoryItem.create({ data: { saveId, name: 'Cuerdas', description: 'x', catalogSlug: 'cuerdas' } });
    // GRAVE = capturable (§1) — sin esto, /capturables no lo lista.
    await prisma.npcState.create({ data: { saveId, npcId: corretolvasId, scope: hondonadaId, condicionFisica: 'GRAVE' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.building.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET /capturables lista al Corretolvas GRAVE de la escena, con las cuerdas detectadas', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/capturables` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tieneCuerdas).toBe(true);
    expect(body.candidates).toEqual([{ npcSlug: 'corretolvas', name: 'Corretolvas', tipo: 'FAUNA' }]);
  });

  let capturaItemId: string;

  it('POST /capturar/:npcSlug ata al Corretolvas — se materializa como InventoryItem en tránsito (5 slots), consume las cuerdas, libera el NpcState', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/capturar/corretolvas` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ npcSlug: 'corretolvas', tipo: 'FAUNA' });
    expect(body.inventoryItemId).toBeTruthy();
    expect(body.capturaExpiraAtMinutes).toBe(480 + 6 * 60); // tier 1 de cuerda = 6h, arranca en 480 (Día 1)
    capturaItemId = body.inventoryItemId;

    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: capturaItemId } });
    expect(item.capturaNpcId).toBe(corretolvasId);
    expect(item.name).toBe('Corretolvas (Capturado) (5)'); // MEDIANA = 5 slots

    // El NpcState de origen se libera de nuevo — la captura ya no vive ahí, vive en el inventario.
    const state = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: corretolvasId } });
    expect(state.capturado).toBe(false);
    expect(state.capturaJaulaBuildingId).toBeNull();

    const cuerdas = await prisma.inventoryItem.findFirst({ where: { saveId, catalogSlug: 'cuerdas' } });
    expect(cuerdas).toBeNull();
  });

  it('POST /capturar/:npcSlug de un segundo objetivo falla — solo 1 captura activa a la vez', async () => {
    await prisma.inventoryItem.create({ data: { saveId, name: 'Cuerdas', description: 'x', catalogSlug: 'cuerdas' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/capturar/corretolvas` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/ya llevas una captura/i);
  });

  it('POST /capturas/:itemId/depositar mueve la captura del inventario a la Jaula — NpcState.capturado=true de nuevo', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/capturas/${capturaItemId}/depositar` });
    expect(res.statusCode).toBe(200);
    expect(res.json().jaulaBuildingId).toBeTruthy();

    expect(await prisma.inventoryItem.findUnique({ where: { id: capturaItemId } })).toBeNull();
    const state = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: corretolvasId } });
    expect(state.capturado).toBe(true);
    expect(state.capturaJaulaBuildingId).toBeTruthy();

    // La cuerda "de sobra" del test anterior sigue en el inventario, sin usarse — la limpia para
    // no interferir con el resto de tests de este describe.
    await prisma.inventoryItem.deleteMany({ where: { saveId, catalogSlug: 'cuerdas' } });
  });

  it('GET /tameo-pendientes ya lista al Corretolvas capturado, con Felicidad 0/umbral', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/tameo-pendientes` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pendientes).toEqual([expect.objectContaining({ npcSlug: 'corretolvas', tipo: 'FAUNA', felicidad: 0 })]);
  });

  it('POST /tameo-pendientes/:npcSlug/intentar resuelve una tirada opuesta real y persiste la Felicidad', async () => {
    // Mismo roll (20) en ambos lados — con fuerza 10 (jugadora) contra destreza 16 + el malus real
    // de disposicionPct (domesticablePct 40 de corretolvas, resolverIntento), la resistencia gana
    // de forma determinista: 20+floor(16/2)=28, +6 de malus=34, contra 20+floor(10/2)=25. Objetivo
    // del test: que la ruta pase el atributo/estado/disposicionPct reales a resolverIntento y
    // persista el resultado, no forzar una victoria concreta.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/tameo-pendientes/corretolvas/intentar`,
      payload: { attribute: 'fuerza' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.roll.gano).toBe(false);
    expect(body.felicidad).toBe(0); // FELICIDAD_PERDIDA (10) topada en 0

    const state = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: corretolvasId } });
    expect(state.capturaFelicidad).toBe(0);
  });

  it('POST /tameo-pendientes/:npcSlug/soltar libera la Jaula sin perder el capturado', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/corretolvas/soltar` });
    expect(res.statusCode).toBe(200);
    const state = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: corretolvasId } });
    expect(state.capturado).toBe(true); // sigue "atado" — no se vuelve a ofrecer capturar
    expect(state.capturaJaulaBuildingId).toBeNull();
  });

  it('POST /tameo-pendientes/:npcSlug/confirmar materializa el Companion real con Felicidad heredada', async () => {
    // Sube la Felicidad ya acumulada al umbral general (80, FELICIDAD_UMBRAL_GENERAL) — la ruta de
    // /intentar ya se probó aparte arriba, aquí solo se necesita cruzar el umbral.
    await prisma.npcState.updateMany({ where: { saveId, npcId: corretolvasId }, data: { capturaFelicidad: 90 } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/corretolvas/confirmar`, payload: {} });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.companion).toMatchObject({ sourceSlug: 'corretolvas', tipo: 'FAUNA', felicidad: 90 });
    expect(await prisma.companion.count({ where: { saveId, sourceSlug: 'corretolvas' } })).toBe(1);
  });
});

/// Bug ORIGINAL que dispara todo el rediseño (2026-08-28, docs/rpgtarkor/captura-rediseno-2026-08-28.md
/// § "Bug original que dispara este documento"): capturar a UN individuo de un grupo cazado de 2+
/// del mismo tipo rompía la caza del resto — `NpcState` es una fila COMPARTIDA por especie+scope,
/// capturar marcaba `capturado: true` en ella sin saber nada de `groupSize`/`groupDefeated`. Este
/// test reproduce el escenario exacto (2 buitres cazados en grupo, capturar solo el primero) y
/// verifica que el segundo individuo sigue cazable con normalidad.
describe('Compañeros: captura en grupo — el bug original (2026-08-28)', () => {
  let saveId: string;
  let hondonadaId: string;
  let zenseId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    const zense = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'zense-ceniza' } });
    zenseId = zense.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (captura en grupo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.inventoryItem.create({ data: { saveId, name: 'Cuerdas', description: 'x', catalogSlug: 'cuerdas' } });
    // Grupo de 2 buitres, el primero ya GRAVE (capturable) — mismo shape que deja `cazar.ts` a
    // mitad de una caza en grupo real: 1 fila NpcState, groupSize=2, groupDefeated=0 (ninguno
    // MUERTO todavía, este está GRAVE = capturable sin necesidad de matarlo).
    await prisma.npcState.create({
      data: { saveId, npcId: zenseId, scope: hondonadaId, condicionFisica: 'GRAVE', groupSize: 2, groupDefeated: 0 },
    });
  });

  afterAll(async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('capturar al primer buitre GRAVE resucita la misma fila a ILESO para el segundo — el grupo sigue cazable', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/capturar/zense-ceniza` });
    expect(res.statusCode).toBe(200);

    // El bug original: antes esta fila se quedaba GRAVE+capturado=true para siempre, bloqueando al
    // segundo individuo del grupo. Ahora debe "resucitar" a ILESO — mismo criterio EXACTO que
    // `grupoContinua` en combate normal (turnResolution.ts).
    const state = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: zenseId } });
    expect(state.condicionFisica).toBe('ILESO');
    expect(state.groupDefeated).toBe(1);
    expect(state.capturado).toBe(false);

    // La captura del primero sigue viva, en el inventario, sin perderse.
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, capturaNpcId: zenseId } });
    // 'Buitre Cenizo' renombrado a 'Zense Ceniza' (2026-09-02/03), slug incluido.
    expect(item.name).toBe('Zense Ceniza (Capturado) (3)'); // PEQUEÑA = 3 slots
  });
});

describe('Compañeros: cobertura de ruta — equipo de compañero + Almacén de Reino (auditoría de deuda técnica 2026-08-25)', () => {
  let saveId: string;
  let companionId: string;
  let itemId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (companeros, equipo y almacén)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Compañero de prueba', role: 'guerrero', notes: '', tipo: 'NPC' },
    });
    companionId = companion.id;
    const item = await prisma.inventoryItem.create({
      data: { saveId, name: 'Cuchillo de hielo sílice', description: 'x', catalogSlug: 'cuchillo-hielo-silice' },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.almacenItem.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('PATCH /companeros/:companionId/equipo/:itemId equipa el objeto real en el compañero', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/saves/${saveId}/companeros/${companionId}/equipo/${itemId}`,
      payload: { slot: 'ARMA_PRINCIPAL' },
    });
    expect(res.statusCode).toBe(200);
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.slot).toBe('ARMA_PRINCIPAL');
    expect(item.companionId).toBe(companionId);
  });

  it('POST /almacen/depositar/:itemId mueve el objeto YA desequipado a AlmacenItem', async () => {
    // Desequipa primero (depositar exige slot: null/companionId: null/subjectId: null).
    await prisma.inventoryItem.update({ where: { id: itemId }, data: { slot: null, companionId: null } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/almacen/depositar/${itemId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    expect(await prisma.inventoryItem.findUnique({ where: { id: itemId } })).toBeNull();
    const almacenItem = await prisma.almacenItem.findFirstOrThrow({ where: { saveId } });
    expect(almacenItem).toMatchObject({ name: 'Cuchillo de hielo sílice', catalogSlug: 'cuchillo-hielo-silice' });
  });

  it('POST /almacen/retirar/:almacenItemId devuelve el objeto a la mochila personal, sin equiparlo', async () => {
    const almacenItem = await prisma.almacenItem.findFirstOrThrow({ where: { saveId } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/almacen/retirar/${almacenItem.id}` });
    expect(res.statusCode).toBe(200);

    expect(await prisma.almacenItem.findUnique({ where: { id: almacenItem.id } })).toBeNull();
    const retrieved = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, catalogSlug: 'cuchillo-hielo-silice' } });
    expect(retrieved.slot).toBeNull();
    expect(retrieved.origin).toBe('Almacén de Reino');
  });
});

describe('Compañeros: cobertura de ruta — plantillas de equipo (auditoría de deuda técnica 2026-08-25)', () => {
  let saveId: string;
  let companionId: string;
  let subjectId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (companeros, plantillas)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Guardia de prueba', role: 'guardia', notes: '', tipo: 'NPC' },
    });
    companionId = companion.id;
    const subject = await prisma.subject.create({ data: { saveId, name: 'Súbdito de prueba', role: 'guardia', notes: '' } });
    subjectId = subject.id;
  });

  afterAll(async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.almacenItem.deleteMany({ where: { saveId } });
    await prisma.subject.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.plantillaEquipo.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('POST /plantillas crea una plantilla real, PATCH la actualiza, DELETE la borra', async () => {
    const app = await buildApp();
    const created = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/plantillas`,
      payload: { name: 'Guardia con arma', rol: 'guardia', slots: { ARMA_PRINCIPAL: { category: 'arma' } }, prioridad: 0 },
    });
    expect(created.statusCode).toBe(200);
    const plantillaId = created.json().id;

    const updated = await app.inject({
      method: 'PATCH',
      url: `/saves/${saveId}/plantillas/${plantillaId}`,
      payload: { prioridad: 5 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().prioridad).toBe(5);

    const deleted = await app.inject({ method: 'DELETE', url: `/saves/${saveId}/plantillas/${plantillaId}` });
    expect(deleted.statusCode).toBe(200);
    expect(await prisma.plantillaEquipo.findUnique({ where: { id: plantillaId } })).toBeNull();
  });

  it('POST /companeros/:companionId/plantilla y /subjects/:subjectId/plantilla asignan la plantilla y disparan el auto-equipo real', async () => {
    const plantilla = await prisma.plantillaEquipo.create({
      data: { saveId, name: 'Guardia con arma', rol: 'guardia', slots: { ARMA_PRINCIPAL: { category: 'arma' } }, prioridad: 0 },
    });
    await prisma.almacenItem.create({ data: { saveId, name: 'Cuchillo de hielo sílice', description: 'x', catalogSlug: 'cuchillo-hielo-silice' } });

    const app = await buildApp();
    const resCompanion = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/companeros/${companionId}/plantilla`,
      payload: { plantillaEquipoId: plantilla.id, rolReino: 'guardia' },
    });
    expect(resCompanion.statusCode).toBe(200);

    // El único objeto del Almacén se lo lleva quien primero encuentre — el compañero, ya asignado
    // arriba (el súbdito de abajo se queda sin nada que equipar, y eso es correcto: solo había 1).
    const companion = await prisma.companion.findUniqueOrThrow({ where: { id: companionId } });
    expect(companion.plantillaEquipoId).toBe(plantilla.id);
    expect(await prisma.inventoryItem.count({ where: { saveId, companionId } })).toBe(1);
    expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(0);

    const resSubject = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/subjects/${subjectId}/plantilla`,
      payload: { plantillaEquipoId: plantilla.id },
    });
    expect(resSubject.statusCode).toBe(200);
    const subject = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } });
    expect(subject.plantillaEquipoId).toBe(plantilla.id);
  });
});

// BUG CERRADO (2026-08-29, ver comentario de `CombatParticipant.dismissedGrupo` en schema.prisma —
// mismo hueco exacto que Clemente, confirmado por code review antes de este fix): dentro de un
// `CombatEncounter` real, un miembro de grupo tiene su condición real en
// `CombatParticipant.condicionFisicaGrupo`, no en `NpcState` (fila compartida por la especie) — el
// camino sin `participantId` nunca la resolvía bien. Con `participantId`, Capturar ahora lee esa
// condición real y marca `dismissedGrupo: true` en el propio `CombatParticipant` al atar con éxito.
describe('POST /saves/:id/capturar/:npcSlug con participantId (combate múltiple real, bug real 2026-08-29)', () => {
  let saveId: string;
  let encounterId: string;
  let objetivo: { id: string };
  let otro: { id: string };
  let auladorId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    auladorId = aullador.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (capturar grupo)',
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
    await prisma.inventoryItem.create({ data: { saveId, name: 'Cuerdas', description: 'x', catalogSlug: 'cuerdas' } });

    const { encounterId: eid } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: 10, inteligencia: 10 },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: auladorId, npcScope: 'itinerante-capturar-grupo', destreza: 8, inteligencia: 4, esGrupo: true },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: auladorId, npcScope: 'itinerante-capturar-grupo', destreza: 8, inteligencia: 4, esGrupo: true },
      ]),
    );
    encounterId = eid;
    [objetivo, otro] = await prisma.combatParticipant.findMany({ where: { encounterId, npcId: auladorId }, orderBy: { id: 'asc' } });
    await prisma.combatParticipant.update({ where: { id: objetivo.id }, data: { condicionFisicaGrupo: 'CONVALECIENTE' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('ata al participante indicado, marca dismissedGrupo SOLO en él y consume las cuerdas', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/capturar/aullador-rojo`,
      payload: { participantId: objetivo.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ npcSlug: 'aullador-rojo', tipo: 'FAUNA' });
    expect(body.inventoryItemId).toBeTruthy();

    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: body.inventoryItemId } });
    expect(item.capturaNpcId).toBe(auladorId);
    expect(item.capturaScope).toBe('itinerante-capturar-grupo');

    const cuerdas = await prisma.inventoryItem.findFirst({ where: { saveId, catalogSlug: 'cuerdas' } });
    expect(cuerdas).toBeNull(); // consumida

    const objetivoFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: objetivo.id } });
    const otroFresco = await prisma.combatParticipant.findUniqueOrThrow({ where: { id: otro.id } });
    expect(objetivoFresco.dismissedGrupo).toBe(true);
    expect(otroFresco.dismissedGrupo).not.toBe(true); // el otro individuo del grupo no se ve afectado
  });

  it('400 si se intenta atar de nuevo al mismo participante ya resuelto', async () => {
    // Suelta la captura en tránsito del test anterior (mismo criterio que "solo 1 captura activa a
    // la vez") para poder llegar al chequeo real de `dismissedGrupo`, no al de "ya llevas una
    // captura sin resolver".
    await prisma.inventoryItem.deleteMany({ where: { saveId, capturaNpcId: { not: null } } });
    await prisma.inventoryItem.create({ data: { saveId, name: 'Cuerdas', description: 'x', catalogSlug: 'cuerdas' } });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/capturar/aullador-rojo`,
      payload: { participantId: objetivo.id },
    });
    expect(res.statusCode).toBe(400);
  });
});

/// Guard de save.endedAt añadido (auditoría de deuda técnica 2026-09-07, decisión confirmada con la
/// usuaria: "todos igual, mismo guard estándar") a los 9 endpoints de captura/almacén/plantillas que
/// no lo tenían — 4 endpoints de este mismo archivo ya lo tenían desde antes (capturar, ambos
/// tameo-pendientes/intentar+confirmar). Los ids de las URLs son inventados a propósito: el guard
/// debe cortar en 409 ANTES de que la ruta llegue a buscar esas filas, así que no hace falta
/// sembrar captura/compañero/plantilla reales para probarlo.
describe('Compañeros: guard de save.endedAt en captura/almacén/plantillas (auditoría de deuda técnica 2026-09-07)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (companeros, partida ya terminada)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        endedAt: new Date('2026-09-07T12:00:00Z'),
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('POST /capturas/:itemId/depositar → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/capturas/item-inexistente/depositar` });
    expect(res.statusCode).toBe(409);
  });

  it('POST /capturas/:itemId/soltar → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/capturas/item-inexistente/soltar` });
    expect(res.statusCode).toBe(409);
  });

  it('POST /tameo-pendientes/:npcSlug/soltar → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/tameo-pendientes/corretolvas/soltar` });
    expect(res.statusCode).toBe(409);
  });

  it('PATCH /companeros/:companionId/equipo/:itemId → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/saves/${saveId}/companeros/companion-inexistente/equipo/item-inexistente`,
      payload: { slot: 'ARMA_PRINCIPAL' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /almacen/depositar/:itemId → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/almacen/depositar/item-inexistente` });
    expect(res.statusCode).toBe(409);
  });

  it('POST /almacen/retirar/:almacenItemId → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/almacen/retirar/almacen-item-inexistente` });
    expect(res.statusCode).toBe(409);
  });

  it('POST /plantillas → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/plantillas`,
      payload: { name: 'x', rol: 'guardia', slots: { ARMA_PRINCIPAL: { category: 'arma' } } },
    });
    expect(res.statusCode).toBe(409);
  });

  it('PATCH /plantillas/:plantillaId → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'PATCH', url: `/saves/${saveId}/plantillas/plantilla-inexistente`, payload: { prioridad: 1 } });
    expect(res.statusCode).toBe(409);
  });

  it('DELETE /plantillas/:plantillaId → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/saves/${saveId}/plantillas/plantilla-inexistente` });
    expect(res.statusCode).toBe(409);
  });

  it('POST /companeros/:companionId/plantilla → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/companeros/companion-inexistente/plantilla`,
      payload: { plantillaEquipoId: null },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /subjects/:subjectId/plantilla → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/subjects/subject-inexistente/plantilla`,
      payload: { plantillaEquipoId: null },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('Compañeros: guard de save.pendingDeathResolution en captura/almacén/plantillas (auditoría de código backend 2026-09-07)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (companeros, muerte pendiente)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        pendingDeathResolution: true,
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('POST /capturas/:itemId/soltar → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/capturas/item-inexistente/soltar` });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).pendingDeathResolution).toBe(true);
  });

  it('POST /almacen/depositar/:itemId → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/almacen/depositar/item-inexistente` });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).pendingDeathResolution).toBe(true);
  });

  it('POST /plantillas → 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/plantillas`,
      payload: { name: 'x', rol: 'guardia', slots: { ARMA_PRINCIPAL: { category: 'arma' } } },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).pendingDeathResolution).toBe(true);
  });
});
