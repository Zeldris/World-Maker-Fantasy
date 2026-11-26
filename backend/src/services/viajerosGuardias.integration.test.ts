import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Se espía `simularCombateDeFondo` para ver quién pelea en cada ronda (sin cambiar su resultado real, salvo en la
// ronda de «caen los guardias», que se fuerza).
const llamadas: { nombres: string[] }[] = [];
let forzarGuardiasCaidos = false;
let forzarTodosCaen = false;
vi.mock('./combateDeFondo.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./combateDeFondo.js')>();
  return {
    ...real,
    simularCombateDeFondo: (cs: Parameters<typeof real.simularCombateDeFondo>[0], random: () => number) => {
      llamadas.push({ nombres: cs.filter((c) => c.bando === 'A').map((c) => c.nombre) });
      if (forzarGuardiasCaidos && llamadas.length === 1) {
        return { ganador: 'B' as const, retiradas: [], subcombates: 1, rondas: 1, estados: cs.map((c) => ({ id: c.id, condicion: c.bando === 'A' ? ('CONVALECIENTE' as const) : ('ILESO' as const), huido: false, muerto: false })) };
      }
      if (forzarTodosCaen && llamadas.length === 1) {
        // Caen todos los guardias y también todos los enemigos.
        return { ganador: 'B' as const, retiradas: [], subcombates: 1, rondas: 1, estados: cs.map((c) => ({ id: c.id, condicion: 'CONVALECIENTE' as const, huido: false, muerto: false })) };
      }
      return real.simularCombateDeFondo(cs, random);
    },
  };
});

vi.resetModules(); // el setup ya cargó los módulos reales: sin esto el mock no se aplica
const { prisma } = await import('../lib/prisma.js');
const { getDefaultUserId } = await import('../lib/defaultUser.js');
const { crearViajero, enlacesDelMundo, rutaMasCorta } = await import('./viajeros.js');
const { pelearEncuentro } = await import('./viajerosEncuentros.js');

/// CR-36b (Q-41, Q-37): con guardias, los porteadores no pelean mientras quede alguno en pie.
describe('guardias y porteadores en el combate (CR-36b)', () => {
  let saveId: string;
  let viajeroId: string;
  let lugar: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    const e = enlaces.find((x) => rutaMasCorta(enlaces, x.fromId, x.toId))!;
    lugar = e.toId;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Observadora (CR-36b guardias)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O',
        worldState: { create: { fictionalMinutes: 10 * 1440 } },
      },
    })).id;
    const r = await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'ACOPIO', origenLocationId: e.fromId, destinoLocationId: e.toId, dia: 10, miembros: [{ genericos: 6, rol: 'porteador' }, { genericos: 2, rol: 'guardia' }] }));
    if (!r.ok) throw new Error(r.motivo);
    viajeroId = r.id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const pelear = async (cantidad: number, id = viajeroId) => {
    const punto = await prisma.zonePoint.create({ data: { saveId, locationId: lugar, tipo: 'FAUNA', targetSlug: 'rondador-de-brasas', x: 1, y: 1, cantidad } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { slug: 'rondador-de-brasas', saveId: null } });
    const v = await prisma.viajero.findUniqueOrThrow({ where: { id }, include: { miembros: true } });
    llamadas.length = 0;
    const ganan = await prisma.$transaction((tx) => pelearEncuentro(tx, v, { punto, npc }, 11, () => 0.5));
    await prisma.zonePoint.deleteMany({ where: { id: punto.id } });
    return ganan;
  };

  it('solo pelean los guardias mientras alguno siga en pie', async () => {
    forzarGuardiasCaidos = false;
    await pelear(1);
    expect(llamadas[0]!.nombres.sort()).toEqual(['Guardia', 'Guardia']);
  });

  it('si caen todos los guardias, los porteadores pelean una segunda ronda', async () => {
    forzarGuardiasCaidos = true;
    await pelear(2);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0]!.nombres).toEqual(['Guardia', 'Guardia']);
    expect(llamadas[1]!.nombres).toEqual(Array(6).fill('Porteador'));
  });

  it('si caen todos los guardias y también todos los enemigos, se quedan con el campo', async () => {
    forzarGuardiasCaidos = false;
    forzarTodosCaen = true;
    expect(await pelear(1)).toBe(true);
    forzarTodosCaen = false;
  });

  it('con más guardias que plazas, la 2.ª ronda mete primero a los guardias que no pelearon', async () => {
    forzarGuardiasCaidos = true;
    const r = await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'ACOPIO', origenLocationId: lugar, destinoLocationId: lugar, dia: 10, miembros: [{ genericos: 6, rol: 'porteador' }, { genericos: 10, rol: 'guardia' }] }));
    if (!r.ok) throw new Error(r.motivo);
    await pelear(2, r.id);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0]!.nombres).toEqual(Array(8).fill('Guardia'));
    expect(llamadas[1]!.nombres.sort()).toEqual(['Guardia', 'Guardia', ...Array(6).fill('Porteador')]);
    forzarGuardiasCaidos = false;
  });
});
