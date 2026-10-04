import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { aplicarEfecto, aplicarEfectos, type CtxEfecto, type Efecto } from './efectos.js';

// CR-9 (hito 0.2, roadmap-cronista.md § 7.5) — cada efecto valida, aplica y registra su suceso, sobre
// el mundo de UNA partida (Postgres real). Lo que no se puede aplicar no hace nada.
describe('efectos del motor (CR-9)', () => {
  let saveId: string;
  let worldId: string;
  const aplicar = (e: Efecto) => prisma.$transaction((tx) => aplicarEfecto(ctx(tx), e));
  const ctx = (tx: CtxEfecto['tx']): CtxEfecto => ({ tx, saveId, worldId, fictionalMinutes: 3 * 1440, origen: 'MOTOR' });
  const sucesos = (tipo: string) => prisma.suceso.findMany({ where: { saveId, tipo: tipo as never }, include: { actores: true } });
  const faccion = (slug: string) => prisma.faction.findFirstOrThrow({ where: { saveId, slug } });

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId,
        characterName: 'Efectos del motor (CR-9)',
        characterArchetype: 'guerrero',
        characterOrigin: 'x',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'E',
        worldState: { create: { fictionalMinutes: 3 * 1440 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('cambiarPresion sube la presión entre dos facciones de la partida (no las del catálogo)', async () => {
    const [serhu, helsig] = await Promise.all([faccion('clan-serhu'), faccion('clan-helsig')]);
    const rel = () => prisma.factionRelation.findUnique({ where: { sourceFactionId_targetFactionId: { sourceFactionId: serhu.id, targetFactionId: helsig.id } } });
    const antes = (await rel())?.presion ?? 50;
    const r = await aplicar({ tipo: 'cambiarPresion', origenSlug: 'clan-serhu', destinoSlug: 'clan-helsig', evento: 'BAJA_DE_GUERRA' });
    expect(r.aplicado).toBe(true);
    expect((await rel())!.presion).toBe(Math.min(100, antes + 8));
    expect(await aplicar({ tipo: 'cambiarPresion', origenSlug: 'clan-serhu', destinoSlug: 'no-existe', evento: 'BAJA_DE_GUERRA' })).toMatchObject({ aplicado: false });
  });

  it('matarNpc lo marca muerto en la partida, registra MUERTE_NPC y no repite', async () => {
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, muertoEnMundo: false }, orderBy: { slug: 'asc' } });
    const r = await aplicar({ tipo: 'matarNpc', npcId: npc.id, causa: 'una emboscada' });
    expect(r.aplicado).toBe(true);
    const estado = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: '' } } });
    expect(estado).toMatchObject({ muerto: true, muertoEn: 3 * 1440 });
    const [suceso] = await sucesos('MUERTE_NPC');
    expect(suceso!.actores).toContainEqual(expect.objectContaining({ entidadTipo: 'NPC', entidadId: npc.id, papel: 'VICTIMA' }));
    expect(await aplicar({ tipo: 'matarNpc', npcId: npc.id })).toMatchObject({ aplicado: false });
    expect(await sucesos('MUERTE_NPC')).toHaveLength(1);
  });

  it('cambiarCohesion acota entre 0 y 100 y no registra suceso', async () => {
    await aplicar({ tipo: 'cambiarCohesion', faccionSlug: 'clan-goshg', delta: -500 });
    expect((await faccion('clan-goshg')).cohesion).toBe(0);
    expect(await aplicar({ tipo: 'cambiarCohesion', faccionSlug: 'clan-goshg', delta: -5 })).toMatchObject({ aplicado: false });
    await aplicar({ tipo: 'cambiarCohesion', faccionSlug: 'clan-goshg', delta: 30 });
    expect((await faccion('clan-goshg')).cohesion).toBe(30);
  });

  it('cambiarLider y asignarCargo (heredero) actualizan la facción y el NPC y registran sus sucesos', async () => {
    const helsig = await faccion('clan-helsig');
    const [nuevo, heredero] = await prisma.npc.findMany({ where: { worldId, muertoEnMundo: false, id: { not: helsig.liderNpcId ?? undefined } }, orderBy: { slug: 'desc' }, take: 2 });
    expect((await aplicar({ tipo: 'cambiarLider', faccionSlug: 'clan-helsig', npcId: nuevo!.id })).aplicado).toBe(true);
    expect((await faccion('clan-helsig')).liderNpcId).toBe(nuevo!.id);
    expect(await sucesos('CAMBIO_LIDER')).toHaveLength(1);
    expect(await aplicar({ tipo: 'cambiarLider', faccionSlug: 'clan-helsig', npcId: nuevo!.id })).toMatchObject({ aplicado: false });

    expect((await aplicar({ tipo: 'asignarCargo', npcId: heredero!.id, cargo: 'heredero', faccionSlug: 'clan-helsig' })).sucesoId).not.toBeNull();
    const estado = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: heredero!.id, scope: '' } } });
    expect(estado).toMatchObject({ cargo: 'heredero', lealtadFaccionId: helsig.id });
    // Un cargo cualquiera es estado, sin suceso.
    expect(await aplicar({ tipo: 'asignarCargo', npcId: heredero!.id, cargo: 'recolector' })).toEqual({ aplicado: true, sucesoId: null });
  });

  it('crearFaccion por escisión hereda el origen de la madre y nace con su reino; repetir el slug no hace nada', async () => {
    const r = await aplicar({ tipo: 'crearFaccion', slug: 'helsig-del-norte', nombre: 'Helsig del Norte', raza: 'orcos', descripcion: 'x', escindidaDe: 'clan-helsig' });
    expect(r.aplicado).toBe(true);
    const nueva = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'helsig-del-norte' }, include: { kingdomStats: true } });
    expect(nueva).toMatchObject({ origenSlug: 'clan-helsig', fundadaEn: 3 * 1440 });
    expect(nueva.kingdomStats).not.toBeNull();
    expect(await sucesos('FACCION_ESCINDIDA')).toHaveLength(1);
    expect(await aplicar({ tipo: 'crearFaccion', slug: 'helsig-del-norte', nombre: 'x', raza: 'orcos', descripcion: 'x' })).toMatchObject({ aplicado: false });
  });

  it('absorberFaccion pasa gente y territorios a la absorbente y disuelve la absorbida; disolver una ya disuelta no hace nada', async () => {
    const [absorbida, absorbente] = await Promise.all([faccion('helsig-del-norte'), faccion('clan-helsig')]);
    await prisma.kingdomStats.update({ where: { factionId: absorbida.id }, data: { poblacion: 40 } });
    const antes = (await prisma.kingdomStats.findUniqueOrThrow({ where: { factionId: absorbente.id } })).poblacion;

    expect((await aplicar({ tipo: 'absorberFaccion', faccionSlug: 'helsig-del-norte', absorbenteSlug: 'clan-helsig' })).aplicado).toBe(true);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { factionId: absorbente.id } })).poblacion).toBe(antes + 40);
    expect((await faccion('helsig-del-norte')).disueltaEn).toBe(3 * 1440);
    expect(await sucesos('FACCION_ABSORBIDA')).toHaveLength(1);
    expect(await aplicar({ tipo: 'disolverFaccion', faccionSlug: 'helsig-del-norte' })).toMatchObject({ aplicado: false });
  });

  it('disolverFaccion borra sus relaciones y registra FACCION_CAE; nunca disuelve el Reino del jugador', async () => {
    const goshg = await faccion('clan-goshg');
    const r = await prisma.$transaction((tx) => aplicarEfectos(ctx(tx), [
      { tipo: 'disolverFaccion', faccionSlug: 'clan-goshg' },
      { tipo: 'cambiarCohesion', faccionSlug: 'clan-goshg', delta: 10 },
    ]));
    expect(r.map((x) => x.aplicado)).toEqual([true, false]);
    expect(await prisma.factionRelation.count({ where: { OR: [{ sourceFactionId: goshg.id }, { targetFactionId: goshg.id }] } })).toBe(0);
    expect(await sucesos('FACCION_CAE')).toHaveLength(1);

    await prisma.faction.create({ data: { worldId, saveId, slug: `reino-${saveId}`, name: 'Reino de prueba', raza: 'orcos', description: 'x' } });
    expect(await aplicar({ tipo: 'disolverFaccion', faccionSlug: `reino-${saveId}` })).toMatchObject({ aplicado: false });
  });
});
