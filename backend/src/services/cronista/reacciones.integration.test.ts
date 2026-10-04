import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso, type ActorSuceso } from './sucesos.js';
import { procesarReacciones, TOPE_NIVEL_CASCADA, type Reaccion } from './reacciones.js';
import { aplicarEfecto } from './efectos.js';

// CR-10 (hito 0.2, roadmap-cronista.md § 7.1 y § 6.2) — reacciones en cola, procesadas en anchura con
// topes, contra el mundo de una partida (Postgres real).
describe('reacciones inmediatas (CR-10)', () => {
  let saveId: string;
  let worldId: string;
  const MIN = 2 * 1440;
  const faccion = (slug: string) => prisma.faction.findFirstOrThrow({ where: { saveId, slug } });
  const sucesos = (tipo: string) => prisma.suceso.findMany({ where: { saveId, tipo }, include: { causas: true } });
  const registrar = (tipo: 'MUERTE_CAUSADA' | 'MUERTE_NPC' | 'TORMENTA_EXTREMA', actores: ActorSuceso[], datos: object, regionSlug?: string) =>
    prisma.$transaction((tx) => registrarSuceso(tx, { saveId, tipo, fictionalMinutes: MIN, origen: 'JUGADOR', actores, datos: datos as never, regionSlug }));

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId,
        characterName: 'Reacciones (CR-10)',
        characterArchetype: 'guerrero',
        characterOrigin: 'x',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'R',
        worldState: { create: { fictionalMinutes: MIN } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    // El clonado deja su suceso de sistema en cola; no reacciona a nada.
    await procesarReacciones(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('matar a un NPC de una facción con Reino fundado sube la presión de esa facción contra el Reino', async () => {
    const reino = await prisma.faction.create({ data: { worldId, saveId, slug: `reino-${saveId}`, name: 'Reino de prueba', raza: 'orcos', description: 'x' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, faction: 'Clan Helsig' } });
    const helsig = await faccion('clan-helsig');
    await registrar('MUERTE_CAUSADA', [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'VICTIMA' }], { personaje: 'x', victima: npc.name });

    const r = await procesarReacciones(prisma, saveId);
    expect(r.procesados).toBeGreaterThan(0);
    const rel = await prisma.factionRelation.findUniqueOrThrow({ where: { sourceFactionId_targetFactionId: { sourceFactionId: helsig.id, targetFactionId: reino.id } } });
    expect(rel.presion).toBe(58);
    expect(rel.saveId).toBe(saveId);
    // Repetir no vuelve a reaccionar.
    expect((await procesarReacciones(prisma, saveId)).procesados).toBe(0);
  });

  it('la muerte del líder registra MUERTE_LIDER (causada por la muerte) y eso baja la cohesión 25', async () => {
    const serhu = await faccion('clan-serhu');
    const lider = await prisma.npc.findFirstOrThrow({ where: { worldId, faction: 'Clan Serhu' } });
    await prisma.faction.update({ where: { id: serhu.id }, data: { liderNpcId: lider.id, cohesion: 70 } });
    const muerte = await registrar('MUERTE_NPC', [{ entidadTipo: 'NPC', entidadId: lider.id, papel: 'VICTIMA' }], { npc: lider.name });

    await procesarReacciones(prisma, saveId);
    const [muerteLider] = await sucesos('MUERTE_LIDER');
    expect(muerteLider).toMatchObject({ nivelCascada: 1, origen: 'MOTOR' });
    expect(muerteLider!.causas.map((c) => c.causaId)).toEqual([muerte]);
    expect((await faccion('clan-serhu')).cohesion).toBe(45);
  });

  it('perder el último territorio hace caer la facción (FACCION_CAE en cascada)', async () => {
    const goshg = await faccion('clan-goshg');
    const territorio = await prisma.territory.create({ data: { factionId: goshg.id, name: 'Último bastión', region: 'Ciénaga Troncal', description: 'x' } });
    await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: MIN, origen: 'MOTOR' }, { tipo: 'cambiarControlTerritorio', territoryId: territorio.id, faccionSlug: 'clan-helsig', control: 'RECLAMADO' }));

    await procesarReacciones(prisma, saveId);
    expect((await faccion('clan-goshg')).disueltaEn).toBe(MIN);
    const [cae] = await sucesos('FACCION_CAE');
    expect(cae!.nivelCascada).toBe(1);
  });

  it('una tormenta extrema puede dañar los edificios activos del jugador en su región', async () => {
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const edificio = await prisma.building.create({ data: { saveId, locationId: location.id, name: 'Choza', kind: 'choza', description: 'x', status: 'ACTIVO' } });
    const { slugify } = await import('../../lib/slugify.js');
    await registrar('TORMENTA_EXTREMA', [], { region: location.region }, slugify(location.region));

    await procesarReacciones(prisma, saveId, () => 0);
    expect((await prisma.building.findUniqueOrThrow({ where: { id: edificio.id } })).status).toBe('DANADO');
    expect(await sucesos('EDIFICIO_DANADO')).toHaveLength(1);
  });

  it('una cascada que se alimenta a sí misma se corta en el tope de niveles y lo que sobra pasa al día siguiente', async () => {
    const eco: Reaccion = {
      id: 'ECO_DE_PRUEBA',
      escucha: ['TORMENTA'],
      prioridad: 1,
      condicion: async () => true,
      registra: async () => [{ tipo: 'TORMENTA', actores: [], datos: { region: 'Eco' } }],
    };
    await prisma.$transaction((tx) => registrarSuceso(tx, { saveId, tipo: 'TORMENTA', fictionalMinutes: MIN, origen: 'MOTOR', actores: [], datos: { region: 'Eco' } }));

    const r = await procesarReacciones(prisma, saveId, Math.random, [eco]);
    expect(r).toEqual({ procesados: TOPE_NIVEL_CASCADA, aplazados: 1 });
    const tormentas = await sucesos('TORMENTA');
    expect(Math.max(...tormentas.map((t) => t.nivelCascada))).toBe(TOPE_NIVEL_CASCADA);
    // CR-11: lo que pasa del tope queda como consecuencia del día siguiente.
    const aplazadas = await prisma.consecuencia.findMany({ where: { saveId, regla: 'REACCION_APLAZADA', estado: 'PENDIENTE' } });
    expect(aplazadas).toHaveLength(1);
    expect(aplazadas[0]!.desdeDia).toBe(Math.floor(MIN / 1440) + 1);
    expect(await prisma.suceso.count({ where: { saveId, reaccionesPendientes: true } })).toBe(0);
  });
});
