import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Harness de integración real (mismo criterio que dynamicMode.integration.test.ts — Postgres local
/// real, nada mockeado aquí porque esta ruta no llama a Ollama) para el menú contextual de
/// interacción con NPC (2026-09-06).
const { npcInteractionRoutes } = await import('./npcInteraction.js');

async function buildApp() {
  const app = Fastify();
  await app.register(npcInteractionRoutes);
  return app;
}

describe('POST /saves/:id/npc-interaction/:npcSlug/elegir', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba npc-interaction',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  beforeEach(async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingNpcInteractionOffer: { npcSlug: 'un-maestro', npcName: 'Un Maestro', options: ['Charlar', 'Aprender profesión', 'Combatir', 'Salir'] } },
    });
  });

  it('sin oferta pendiente: 409', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { pendingNpcInteractionOffer: Prisma.JsonNull } });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/npc-interaction/un-maestro/elegir`,
      payload: { opcion: 'Charlar' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('npcSlug no coincide con la oferta vigente: 409', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/npc-interaction/otro-npc/elegir`,
      payload: { opcion: 'Charlar' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('opción no está en la lista de la oferta: 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/npc-interaction/un-maestro/elegir`,
      payload: { opcion: 'Reclutar' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('Aprender profesión: limpia la oferta y responde ABRIR_APRENDER_OFICIO', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/npc-interaction/un-maestro/elegir`,
      payload: { opcion: 'Aprender profesión' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ accion: 'ABRIR_APRENDER_OFICIO' });
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingNpcInteractionOffer).toBeNull();
  });

  it('Combatir: limpia la oferta y responde FORZAR_COMBATE con el npcSlug', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/npc-interaction/un-maestro/elegir`,
      payload: { opcion: 'Combatir' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ accion: 'FORZAR_COMBATE', npcSlug: 'un-maestro' });
  });

  it('Salir: limpia la oferta y responde CERRAR', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/npc-interaction/un-maestro/elegir`,
      payload: { opcion: 'Salir' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ accion: 'CERRAR' });
  });

  // CR-18 (18c): la frase del NPC va al registro del personaje.
  it('¿Qué se cuenta?: responde CONTADO con la frase del NPC en el registro', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingNpcInteractionOffer: { npcSlug: 'maestro-cocinero-serhu', npcName: 'El cocinero', options: ['Charlar', '¿Qué se cuenta?', 'Salir'] } },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc-interaction/maestro-cocinero-serhu/elegir`, payload: { opcion: '¿Qué se cuenta?' } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { accion: string; logEntry: { text: string; channel: string } };
    expect(body.accion).toBe('CONTADO');
    expect(body.logEntry.text).toContain('«Por aquí no se habla de otra cosa que del tiempo.»');
  });

  it('Misión: <título>: limpia la oferta y responde MOSTRAR_OFERTA_MISION', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingNpcInteractionOffer: { npcSlug: 'un-maestro', npcName: 'Un Maestro', options: ['Charlar', 'Misión: La deuda de Ulkha', 'Combatir', 'Salir'] } },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/npc-interaction/un-maestro/elegir`,
      payload: { opcion: 'Misión: La deuda de Ulkha' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ accion: 'MOSTRAR_OFERTA_MISION' });
  });
});

// P142: el menú fijo se abre desde la tarjeta del encuentro del mapa; «Charlar» lleva a la escena libre.
describe('POST /saves/:id/npc-interaction/:npcSlug/abrir', () => {
  let saveId: string;
  const encuentro = (slug: string, extra: Record<string, unknown> = {}) => ({ tipo: 'NPC', targetSlug: slug, targetName: 'Alguien', ...extra });

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'Gorhorn de prueba menú desde el mapa', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor',
        characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  beforeEach(async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingNpcInteractionOffer: Prisma.JsonNull, pendingDynamicModeOffer: encuentro('maestro-cocinero-serhu'), pendingDeathResolution: false, pendingDynamicMode: Prisma.JsonNull },
    });
  });

  async function abrir(slug: string) {
    const app = await buildApp();
    return app.inject({ method: 'POST', url: `/saves/${saveId}/npc-interaction/${slug}/abrir` });
  }

  it('maestro de oficio: abre su menú con el nombre de la tarjeta y lo deja pendiente', async () => {
    const res = await abrir('maestro-cocinero-serhu');
    expect(res.statusCode).toBe(200);
    const { menu } = JSON.parse(res.body) as { menu: { npcName: string; options: string[] } };
    expect(menu.npcName).toBe('Alguien');
    expect(menu.options).toEqual(expect.arrayContaining(['Charlar', 'Aprender profesión', 'Combatir', 'Salir']));
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingNpcInteractionOffer).toMatchObject({ npcSlug: 'maestro-cocinero-serhu', desdeEncuentro: true });
  });

  it('NPC sin menú propio: menu null (la tarjeta abre la escena libre)', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: encuentro('herrero-serhu') } });
    const res = await abrir('herrero-serhu');
    expect(JSON.parse(res.body)).toEqual({ menu: null });
  });

  it('sin encuentro pendiente de ese NPC: 409', async () => {
    const res = await abrir('herrero-serhu');
    expect(res.statusCode).toBe(409);
  });

  it('te corta el paso: sin menú', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: encuentro('maestro-cocinero-serhu', { combateForzado: true }) } });
    const res = await abrir('maestro-cocinero-serhu');
    expect(JSON.parse(res.body)).toEqual({ menu: null });
  });

  it('Charlar desde el mapa: CHARLAR y el encuentro sigue pendiente para la escena', async () => {
    await abrir('maestro-cocinero-serhu');
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc-interaction/maestro-cocinero-serhu/elegir`, payload: { opcion: 'Charlar' } });
    expect(JSON.parse(res.body)).toEqual({ accion: 'CHARLAR' });
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingDynamicModeOffer).toMatchObject({ targetSlug: 'maestro-cocinero-serhu' });
  });

  it('Salir desde el mapa: descarta también el encuentro', async () => {
    await abrir('maestro-cocinero-serhu');
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc-interaction/maestro-cocinero-serhu/elegir`, payload: { opcion: 'Salir' } });
    expect(JSON.parse(res.body)).toEqual({ accion: 'CERRAR' });
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingDynamicModeOffer).toBeNull();
  });

  it('con una muerte pendiente o una escena abierta no abre el menú: 409 y no deja menú pendiente', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { pendingDeathResolution: true } });
    expect((await abrir('maestro-cocinero-serhu')).statusCode).toBe(409);
    await prisma.save.update({ where: { id: saveId }, data: { pendingDeathResolution: false, pendingDynamicMode: { tipo: 'NPC', targetSlug: 'herrero-serhu' } } });
    expect((await abrir('maestro-cocinero-serhu')).statusCode).toBe(409);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingNpcInteractionOffer).toBeNull();
  });

  it('menú caducado (el encuentro ya es de otro NPC): 409 y el encuentro nuevo no se toca', async () => {
    await abrir('maestro-cocinero-serhu');
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicModeOffer: encuentro('herrero-serhu') } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc-interaction/maestro-cocinero-serhu/elegir`, payload: { opcion: 'Salir' } });
    expect(res.statusCode).toBe(409);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingDynamicModeOffer).toMatchObject({ targetSlug: 'herrero-serhu' });
    expect(save.pendingNpcInteractionOffer).toBeNull();
  });

  it('Combatir desde el mapa: combate desde el encuentro', async () => {
    await abrir('maestro-cocinero-serhu');
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc-interaction/maestro-cocinero-serhu/elegir`, payload: { opcion: 'Combatir' } });
    expect(JSON.parse(res.body)).toEqual({ accion: 'FORZAR_COMBATE', npcSlug: 'maestro-cocinero-serhu', desdeEncuentro: true });
  });
});
