import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { edificiosRoutes } from './edificios.js';
import { COMERCIAR_PENDIENTE } from '../../services/fichaEdificio.js';

/// P178 (QA-27): «Interactuar» en la Herrería del Clan Serhu sacaba la tarjeta del NPC más cercano (el
/// alquimista) y el edificio no tenía ficha propia.
describe('edificios del mapa: ficha e Interactuar (P178)', () => {
  let saveId: string;
  let locationId: string;
  let herreria: string;
  let maestro: string;

  async function buildApp() {
    const app = Fastify();
    await app.register(edificiosRoutes);
    return app;
  }

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-serhu-interior' } });
    locationId = location.id;
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'Gorhorn P178', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G', currentLocationId: locationId, zonaPosX: 25, zonaPosY: 25,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480, fictionalDateLabel: 'Día 1, 08:00' } });
    herreria = (await prisma.zonePoint.create({ data: { locationId, saveId, x: 180, y: 300, tipo: 'EDIFICIO', targetSlug: 'herreria-serhu', label: 'Herrería del Clan Serhu', activo: true } })).id;
    maestro = (await prisma.zonePoint.create({ data: { locationId, saveId, x: 230, y: 300, tipo: 'NPC', targetSlug: 'maestro-herrero-serhu', activo: true } })).id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la ficha dice de quién es, cómo está, quién lo lleva y qué ofrece', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona/edificio/${herreria}` });
    expect(res.statusCode).toBe(200);
    const ficha = res.json();
    expect(ficha).toMatchObject({ nombre: 'Herrería del Clan Serhu', faccion: 'Clan Serhu', estado: 'En pie', nivel: 1 });
    // P195: sin descubrir iría por su raza (P165), pero la descripción de la herrería lo nombra («El Maestro
    // Herrero Serhu funde mena…»): leerla lo deja citado.
    expect(ficha.encargado).toEqual({ slug: 'maestro-herrero-serhu', nombre: 'Maestro Herrero Serhu', aqui: true });
    expect(await prisma.discoveredEntity.count({ where: { saveId, entityType: 'npc', entitySlug: 'maestro-herrero-serhu' } })).toBe(1);
    expect(ficha.ofrece).toContainEqual({ label: 'Comerciar', disponible: false, motivo: COMERCIAR_PENDIENTE });
    // Lo mismo que dará su menú: en esta partida el clan no escucha propuestas, así que sin encargos (`/code-review`).
    expect(ficha.ofrece).toContainEqual({ label: 'Encargos', disponible: false, motivo: 'Ahora no te lo ofrece' });
  });

  // P195 (QA-27): la descripción del salón nombra a la Terk'ikar; leerla la deja citada y la ficha la llama
  // por su nombre, no «Orca desconocida».
  it('quien nombra la descripción del edificio sale por su nombre en «Quién lo lleva»', async () => {
    const salon = (await prisma.zonePoint.create({ data: { locationId, saveId, x: 400, y: 300, tipo: 'EDIFICIO', targetSlug: 'ketg-sedsar', label: "Ketg'sedsar", activo: true } })).id;
    await prisma.zonePoint.create({ data: { locationId, saveId, x: 420, y: 300, tipo: 'NPC', targetSlug: 'ulkha-ketg', activo: true } });
    const app = await buildApp();
    const ficha = (await app.inject({ method: 'GET', url: `/saves/${saveId}/zona/edificio/${salon}` })).json();
    expect(ficha.descripcion).toContain('Ulkha Ketg');
    expect(ficha.encargado?.nombre).toBe('Ulkha Ketg');
  });

  it('Interactuar: lejos, 409; al lado, el menú de quien lo lleva, sin «Charlar» y con «Salir»', async () => {
    const app = await buildApp();
    const lejos = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/edificio/${herreria}/interactuar` });
    expect(lejos.statusCode).toBe(409);
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 225, zonaPosY: 325 } });
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/edificio/${herreria}/interactuar` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // P195: ya citado al leer la ficha de su herrería (test de arriba), su menú lo llama por su nombre.
    expect(body.menu).toMatchObject({ npcSlug: 'maestro-herrero-serhu', npcName: 'Maestro Herrero Serhu', desdeEncuentro: false });
    expect(body.menu.options).toContain('Salir');
    // P197 (QA-94): el menú de un maestro ya trae «Salir»; abierto desde su edificio no sale dos veces.
    expect(new Set(body.menu.options).size).toBe(body.menu.options.length);
    expect(body.menu.options).not.toContain('Charlar');
    expect(body.menu.options).not.toContain('¿Tienes trabajo?');
    expect(body.logEntry.text).toBe('Herrería del Clan Serhu: el Maestro Herrero Serhu atiende a Gorhorn P178.');
    const guardado = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(guardado.pendingNpcInteractionOffer).toMatchObject({ npcSlug: 'maestro-herrero-serhu', desdeEncuentro: false });
  });

  it('sin quien lo lleve en la zona, no hay menú y lo dice', async () => {
    await prisma.zonePoint.update({ where: { id: maestro }, data: { activo: false } });
    const app = await buildApp();
    const body = (await app.inject({ method: 'POST', url: `/saves/${saveId}/zona/edificio/${herreria}/interactuar` })).json();
    expect(body).toEqual({ menu: null, motivo: 'Herrería del Clan Serhu: no hay nadie atendiendo ahora mismo.' });
    await prisma.zonePoint.update({ where: { id: maestro }, data: { activo: true } });
  });
});
