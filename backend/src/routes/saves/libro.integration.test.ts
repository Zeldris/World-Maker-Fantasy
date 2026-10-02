import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { libroRoutes } from './libro.js';
import { registrarSuceso } from '../../services/cronista/sucesos.js';

// CR-4 (hito 0.2): vista de administración del Libro de Sucesos, solo lectura.
describe('GET /saves/:id/libro', () => {
  let saveId: string;
  let muerteId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn de prueba (vista del Libro)', characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor', characterMotivation: 'x', portraitInitial: 'G',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
      },
    });
    saveId = save.id;
    await registrarSuceso(prisma, { saveId, tipo: 'TORMENTA', fictionalMinutes: 1440, origen: 'MUNDO', actores: [], datos: { region: 'las Llanuras del Viento Rojo' } });
    muerteId = await registrarSuceso(prisma, {
      saveId, tipo: 'MUERTE_CAUSADA', fictionalMinutes: 2000, origen: 'JUGADOR',
      actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }], datos: { personaje: 'Gorhorn', victima: 'el Aullador' },
    });
    await registrarSuceso(prisma, {
      saveId, tipo: 'MISION_COMPLETADA', fictionalMinutes: 2001, origen: 'JUGADOR', causas: [muerteId],
      actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }], datos: { personaje: 'Gorhorn', mision: 'Cazar al Aullador' },
    });
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  async function pedir(query = '') {
    const app = Fastify();
    await app.register(libroRoutes);
    return app.inject({ method: 'GET', url: `/saves/${saveId}/libro${query}` });
  }

  it('devuelve lo más reciente primero, con fecha legible, actores y la cadena causa → efecto', async () => {
    const res = await pedir();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.sucesos.map((s: { tipo: string }) => s.tipo)).toEqual(['MISION_COMPLETADA', 'MUERTE_CAUSADA', 'TORMENTA']);
    const muerte = body.sucesos.find((s: { id: string }) => s.id === muerteId);
    expect(muerte.fecha).toBeTruthy();
    expect(muerte.actores).toEqual([{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }]);
    expect(muerte.efectoIds).toHaveLength(1);
  });

  it('filtra por familia e importancia mínima, y pagina con antesDe', async () => {
    const clima = (await pedir('?familia=CLIMA')).json();
    expect(clima.sucesos.map((s: { tipo: string }) => s.tipo)).toEqual(['TORMENTA']);
    const importantes = (await pedir('?importanciaMin=5')).json();
    expect(importantes.sucesos.every((s: { importancia: number }) => s.importancia >= 5)).toBe(true);
    const primera = (await pedir('?limite=1')).json();
    expect(primera.hayMas).toBe(true);
    const segunda = (await pedir(`?limite=1&antesDe=${primera.sucesos[0].id}`)).json();
    expect(segunda.sucesos[0].tipo).toBe('MUERTE_CAUSADA');
  });

  it('404 sin partida y 400 con una familia que no existe', async () => {
    const app = Fastify();
    await app.register(libroRoutes);
    expect((await app.inject({ method: 'GET', url: '/saves/no-existe/libro' })).statusCode).toBe(404);
    expect((await pedir('?familia=INVENTADA')).statusCode).toBe(400);
  });
});
