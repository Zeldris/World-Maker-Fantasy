import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { leyendasRoutes } from './leyendas.js';

/// P343: dentro de un mismo día Leyendas seguía el orden de las filas de Conocimiento (cuándo se
/// supo), no el del Libro (cuándo ocurrió): dos sucesos iguales y seguidos parecían un duplicado.
describe('Leyendas: orden dentro del día (P343)', () => {
  let saveId: string;
  const orden: string[] = []; // ids de suceso, del más antiguo al más reciente (orden del Libro)

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Orden', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O',
        worldState: { create: { fictionalMinutes: 40 * 1440 } },
      },
    });
    saveId = save.id;
    const base = Date.parse('2026-01-01T10:00:00Z');
    for (let i = 0; i < 4; i++) {
      const s = await prisma.suceso.create({
        data: { saveId, tipo: i % 2 === 0 ? 'ALIANZA' : 'CAMBIO', familia: 'FACCION', fictionalMinutes: 39 * 1440 + 100, origen: 'MUNDO', importancia: 3, datos: {}, semilla: `s${i}`, texto: `s${i}`, createdAt: new Date(base + i * 1000) },
      });
      orden.push(s.id);
    }
    // Se «saben» en orden inverso al de creación: el id del Conocimiento ya no coincide con el del suceso.
    for (const sucesoId of [...orden].reverse()) {
      await prisma.conocimiento.create({ data: { saveId, sucesoId, desde: 40 * 1440, via: 'NPC', confirmado: true } });
    }
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('el mismo día sale en el orden real de los sucesos, el más reciente primero', async () => {
    const a = Fastify();
    await a.register(leyendasRoutes);
    const res = await a.inject({ method: 'GET', url: `/saves/${saveId}/leyendas` });
    const { entradas } = JSON.parse(res.body) as { entradas: { sucesoId: string }[] };
    expect(entradas.map((e) => e.sucesoId)).toEqual([...orden].reverse());
  });
});
