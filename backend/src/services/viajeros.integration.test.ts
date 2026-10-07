import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { avanzarViajeros, crearViajero, enlacesDelMundo, rutaMasCorta, TRABAJOS } from './viajeros.js';

/// CR-63 (63a): un viajero sale, camina por los enlaces reales del mundo, trabaja un día en su destino
/// y vuelve; el avance es idempotente y va día a día.
describe('viajeros (CR-63 63a) — en una partida', () => {
  let saveId: string;
  let origen: string;
  let destino: string;
  const llamadas: string[] = [];

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Viajera (CR-63)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'V',
        worldState: { create: { fictionalMinutes: 10 * 1440 } },
      },
    })).id;
    // Dos lugares a más de una jornada por la ruta más corta.
    const enlaces = await enlacesDelMundo(prisma, world.id);
    const ids = [...new Set(enlaces.flatMap((e) => [e.fromId, e.toId]))].sort();
    let par: [string, string] | null = null;
    for (const a of ids) for (const b of ids) {
      if (par || a === b) continue;
      const r = rutaMasCorta(enlaces, a, b);
      if (r && r.length >= 3) par = [a, b];
    }
    [origen, destino] = par!;
    TRABAJOS.PRUEBA = {
      alLlegar: async (_tx, v) => { llamadas.push(`llega:${v.ubicacionLocationId}`); },
      alVolver: async (_tx, v) => { llamadas.push(`vuelve:${v.ubicacionLocationId}`); },
    };
  });
  afterAll(async () => {
    delete TRABAJOS.PRUEBA;
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('va, trabaja un día en el destino, vuelve y termina; lleva el diario de por dónde pasó', async () => {
    const r = await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'PRUEBA', origenLocationId: origen, destinoLocationId: destino, dia: 10, miembros: [{ genericos: 4, rol: 'cazador' }] }));
    expect(r.ok).toBe(true);
    let dia = 10;
    while (dia < 60) {
      dia++;
      await avanzarViajeros(prisma, saveId, dia, () => 0.5);
      // El mismo día otra vez no lo mueve.
      await avanzarViajeros(prisma, saveId, dia, () => 0.5);
      if ((await prisma.viajero.findFirstOrThrow({ where: { saveId } })).estado === 'TERMINADO') break;
    }
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId }, include: { miembros: true } });
    expect(v).toMatchObject({ estado: 'TERMINADO', ubicacionLocationId: origen, ruta: [] });
    expect(llamadas).toEqual([`llega:${destino}`, `vuelve:${origen}`]);
    const diario = v.diario as { locationId: string; dia: number }[];
    expect(diario[0]).toEqual({ locationId: origen, dia: 10 });
    expect(diario.some((p) => p.locationId === destino)).toBe(true);
    expect(v.miembros).toEqual([expect.objectContaining({ genericos: 4, rol: 'cazador' })]);
  });

  it('sin camino no sale', async () => {
    const aislado = await prisma.location.findFirst({ where: { worldId: (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).worldId, linksFrom: { none: {} }, linksTo: { none: {} } } });
    if (!aislado) return;
    const r = await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'PRUEBA', origenLocationId: origen, destinoLocationId: aislado.id, dia: 10, miembros: [] }));
    expect(r).toEqual({ ok: false, motivo: 'No hay camino hasta allí.' });
  });
});
