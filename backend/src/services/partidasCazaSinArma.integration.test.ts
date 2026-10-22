import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { crearViajero, enlacesDelMundo } from './viajeros.js';
import { cazarEnDestino } from './partidasCaza.js';
import { DIAS_VISIBLE_VUELTA, lanzarPartida, opcionesDePartida, partidasDelReino } from './partidasReino.js';
import { guerrerosLibres } from './ataquesCampamento.js';
import { subditosSinArma } from './cronista/subditos.js';

/// P280/P281/P283 (CR-63, Q3 y Q4): un cazador sin arma no sale; si sale, el diario cuenta el fracaso;
/// la que ya volvió dice el día y deja de listarse pasada una semana.
function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

describe('partidas de caza: arma y vuelta (P280, P281, P283)', () => {
  let saveId: string;
  let casa: string;
  let coto: string;
  let armado: string;
  let desarmado: string;
  const HOY = 20;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Cazadora sin arma', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'C',
        worldState: { create: { fictionalMinutes: HOY * 1440 } },
      },
    })).id;
    // Una sola alta sin arma: la más reciente.
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), comida: 0, poblacion: 8, sinArma: 1 } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    casa = enlaces[0]!.fromId;
    coto = enlaces[0]!.toId;
    await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'ayuntamiento', name: 'Ayuntamiento', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } });
    await prisma.locationVisit.create({ data: { saveId, locationId: coto } });
    await prisma.zonePoint.create({ data: { saveId, locationId: coto, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', x: 1, y: 1, cantidad: 3 } });
    armado = (await prisma.subject.create({ data: { saveId, name: 'Armada', role: 'cazador', notes: '', pueblo: 'orcos', createdAt: new Date(Date.now() - 60000) } })).id;
    desarmado = (await prisma.subject.create({ data: { saveId, name: 'Rildagh', role: 'cazador', notes: '', pueblo: 'orcos', nacidoEn: HOY * 1440 - 13 * 120 * 1440 } })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('subditosSinArma marca al alta más reciente', async () => {
    expect([...(await subditosSinArma(prisma, saveId, HOY * 1440))]).toEqual([desarmado]);
  });

  it('las opciones marcan al sin arma y lanzarPartida lo rechaza (P281)', async () => {
    const op = await opcionesDePartida(prisma, saveId, HOY * 1440);
    expect(op.cazadores).toEqual(expect.arrayContaining([{ id: desarmado, name: 'Rildagh', sinArma: true }, { id: armado, name: 'Armada', sinArma: false }]));
    const r = await prisma.$transaction((tx) => lanzarPartida(tx, saveId, { tipo: 'CAZA', especie: 'kirelon-arenoso', destinoLocationId: coto, subjectIds: [desarmado] }, HOY * 1440));
    expect(r.ok).toBe(false);
    expect((r as { motivo: string }).motivo).toMatch(/Rildagh no tiene arma/);
    // Tampoco va a un ataque.
    expect((await guerrerosLibres(prisma, saveId, HOY * 1440)).map((g) => g.id)).toEqual([armado]);
  });

  it('un sin arma que llega al destino pierde y el diario lo cuenta (P280)', async () => {
    const v = await prisma.$transaction(async (tx) => {
      const r = await crearViajero(tx, { saveId, tipo: 'CAZA', objetivo: 'kirelon-arenoso', origenLocationId: casa, destinoLocationId: coto, dia: HOY, miembros: [{ subjectId: desarmado, rol: 'cazador' }] });
      expect(r.ok).toBe(true);
      const f = await tx.viajero.findFirstOrThrow({ where: { saveId, objetivo: 'kirelon-arenoso' } });
      return tx.viajero.update({ where: { id: f.id }, data: { ubicacionLocationId: coto }, include: { miembros: true } });
    });
    const carga = await prisma.$transaction((tx) => cazarEnDestino(tx, v as never, HOY, semilla(1)));
    expect(carga.piezas).toBe(0);
    expect(carga.resumen).toMatch(/sin arma/);
    expect(carga.resumen).toMatch(/no abate ninguno/);
  });

  it('la partida que volvió dice el día y se deja de listar tras una semana (P283)', async () => {
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId, objetivo: 'kirelon-arenoso' } });
    await prisma.viajero.update({ where: { id: v.id }, data: { estado: 'TERMINADO', ultimoDia: HOY - 2 } });
    let ps = await partidasDelReino(prisma, saveId);
    expect(ps.find((p) => p.id === v.id)).toMatchObject({ estado: 'TERMINADO', vueltaDia: HOY - 2 });
    await prisma.viajero.update({ where: { id: v.id }, data: { ultimoDia: HOY - DIAS_VISIBLE_VUELTA - 1 } });
    ps = await partidasDelReino(prisma, saveId);
    expect(ps.find((p) => p.id === v.id)).toBeUndefined();
  });

  it('con el cazador fuera, las opciones lo dicen en cazadoresFuera (P283)', async () => {
    await prisma.$transaction((tx) => lanzarPartida(tx, saveId, { tipo: 'CAZA', especie: 'kirelon-arenoso', destinoLocationId: coto, subjectIds: [armado] }, HOY * 1440));
    const op = await opcionesDePartida(prisma, saveId, HOY * 1440);
    expect(op.cazadoresFuera).toEqual(['Armada']);
    expect(op.cazadores.map((c) => c.id)).toEqual([desarmado]);
  });
});
