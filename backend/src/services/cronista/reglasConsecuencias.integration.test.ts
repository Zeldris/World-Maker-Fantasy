import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { aplicarEfecto } from './efectos.js';
import { evaluarConsecuencias } from './consecuencias.js';
import { procesarReacciones } from './reacciones.js';
import { candidatosALider } from './reglasConsecuencias.js';

// CR-11 (hito 0.2) — reglas SUCESION_PENDIENTE y REFUGIADOS de punta a punta, contra el mundo de una
// partida: muere el líder → MUERTE_LIDER (reacción) → sucesión a los 1-3 días según la cohesión.
describe('reglas de consecuencias: sucesión y refugiados (CR-11)', () => {
  const saveIds: string[] = [];
  const DIA = 1440;

  async function partida(nombre: string) {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'S',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    await procesarReacciones(prisma, save.id);
    return { saveId: save.id, worldId };
  }

  /// Fija la cohesión de Helsig, le pone líder, lo mata (MUERTE_NPC) y pasa 3 días.
  async function muereElLiderDeHelsig(saveId: string, worldId: string, cohesion: number, liderId?: string) {
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-helsig' } });
    const candidatos = await candidatosALider(prisma as never, saveId, worldId, helsig);
    const lider = candidatos.find((c) => c.id === liderId) ?? candidatos[0];
    await prisma.faction.update({ where: { id: helsig.id }, data: { liderNpcId: lider!.id, cohesion: cohesion + 25 } });
    await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: 480, origen: 'MOTOR' }, { tipo: 'matarNpc', npcId: lider!.id }));
    // MUERTE_LIDER → cohesión −25 → SUCESION_PENDIENTE (1-3 días).
    await procesarReacciones(prisma, saveId);
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: helsig.id } })).cohesion).toBe(cohesion);
    expect(await prisma.consecuencia.count({ where: { saveId, regla: 'SUCESION_PENDIENTE', estado: 'PENDIENTE' } })).toBe(1);
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + 3 * DIA } });
    await evaluarConsecuencias(prisma, saveId);
    await procesarReacciones(prisma, saveId);
    return { helsig, lider: lider! };
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('cohesión alta: sucesión normal, primero el heredero designado', async () => {
    const { saveId, worldId } = await partida('Sucesión (CR-11) alta');
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-helsig' } });
    const candidatos = await candidatosALider(prisma as never, saveId, worldId, helsig);
    const heredero = candidatos[candidatos.length - 1]!; // el de menos Inteligencia, para probar que manda el cargo
    await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: 480, origen: 'MOTOR' }, { tipo: 'asignarCargo', npcId: heredero.id, cargo: 'heredero', faccionSlug: 'clan-helsig' }));

    const { lider } = await muereElLiderDeHelsig(saveId, worldId, 80, candidatos[0]!.id);
    expect(heredero.id).not.toBe(lider.id);
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: helsig.id } })).liderNpcId).toBe(heredero.id);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'CAMBIO_LIDER' } })).toBe(1);
  });

  it('cohesión media: sucesión y escisión con nombre orco, que se lleva parte de la gente', async () => {
    const { saveId, worldId } = await partida('Sucesión (CR-11) media');
    await prisma.kingdomStats.updateMany({ where: { faction: { saveId, slug: 'clan-helsig' } }, data: { poblacion: 100 } });
    await muereElLiderDeHelsig(saveId, worldId, 35);

    const nueva = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig', slug: { not: 'clan-helsig' } }, include: { kingdomStats: true } });
    expect(nueva.name).toMatch(/^Clan \S+(ig|g)$/);
    expect(nueva.description).toContain('Helsig');
    expect(nueva.liderNpcId).not.toBeNull();
    expect(nueva.kingdomStats?.poblacion).toBe(30);
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { faction: { saveId, slug: 'clan-helsig' } } })).poblacion).toBe(70);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'FACCION_ESCINDIDA' } })).toBe(1);
  });

  it('cohesión baja: la facción cae y, días después, su gente se reparte por las regiones vecinas', async () => {
    const { saveId, worldId } = await partida('Sucesión (CR-11) baja');
    const { helsig } = await muereElLiderDeHelsig(saveId, worldId, 10);
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: helsig.id } })).disueltaEn).not.toBeNull();
    expect(await prisma.consecuencia.count({ where: { saveId, regla: 'REFUGIADOS', estado: 'PENDIENTE' } })).toBe(1);

    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + 10 * DIA } });
    await evaluarConsecuencias(prisma, saveId);
    const raza = await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'orcos-cristal-helado' } });
    const d = raza.distribucion as Record<string, number>;
    // Cristal Helado linda con las Llanuras y la Ciénaga: la mitad del peso se reparte entre las dos.
    expect(d['Cristal Helado']).toBeCloseTo(0.5);
    expect(d['Llanuras del Viento Rojo']).toBeCloseTo(0.25);
    expect(d['Ciénaga Troncal']).toBeCloseTo(0.25);
    expect((await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'clan-helsig-poblacion' } })).poblacion).toBe(0);
    // Sin ruido en el Libro: la gente que se dispersa no es fauna que migra ni un declive natural.
    expect(await prisma.suceso.count({ where: { saveId, tipo: { in: ['MIGRACION_FAUNA', 'DECLIVE_POBLACION'] } } })).toBe(0);
  });

  it('una muerte que llega por dos vías no registra dos veces la muerte del líder', async () => {
    const { saveId, worldId } = await partida('Sucesión (CR-11) doble vía');
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-helsig' } });
    const [lider] = await candidatosALider(prisma as never, saveId, worldId, helsig);
    await prisma.faction.update({ where: { id: helsig.id }, data: { liderNpcId: lider!.id, cohesion: 70 } });
    const { registrarSuceso } = await import('./sucesos.js');
    for (const tipo of ['MUERTE_CAUSADA', 'MUERTE_NPC'] as const) {
      await prisma.$transaction((tx) => registrarSuceso(tx, { saveId, tipo, fictionalMinutes: 480, origen: 'JUGADOR', actores: [{ entidadTipo: 'NPC', entidadId: lider!.id, papel: 'VICTIMA' }], datos: { npc: lider!.name, personaje: 'x', victima: lider!.name } as never }));
    }
    await procesarReacciones(prisma, saveId);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'MUERTE_LIDER' } })).toBe(1);
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: helsig.id } })).cohesion).toBe(45);
  });
});
