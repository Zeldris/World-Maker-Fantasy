import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { sessionRoutes } from './session.js';

/// P116 (reabierto 2026-10-21): tras HUIR con éxito de un combate, Gorhorn volvía a la entrada pero la
/// oferta de combate forzado (`pendingDynamicModeOffer.combateForzado`) seguía guardada, y el servidor
/// contestaba 409 «no te deja marcharte» a cada movimiento. Además, si el punto de entrada guardado
/// quedaba fuera del radio seguro de las entradas, el mismo grupo volvía a cortar el paso. Las dos
/// huidas (`/combat/flee`, antes del combate, y `/combat/huir-en-curso`, dentro) usan la misma función
/// que la huida de «te corta el paso» (`datosDeHuidaDeZona`). La zona de prueba no tiene coordenadas:
/// su única salida es la puerta de abajo, (400,550), celda (8,11).
async function buildApp() {
  const app = Fastify();
  await app.register(sessionRoutes);
  return app;
}

const OFERTA_FORZADA = { tipo: 'FAUNA', targetSlug: 'aullador-rojo', targetName: 'Aulladores rojos', combateForzado: true };

describe('P116 — huir del combate vuelve a un sitio seguro y quita la oferta forzada', () => {
  let saveId: string;
  let npcSlug: string;
  let locationId: string;
  let vecinaId: string;
  let linkId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    npcSlug = npc.slug;
    const location = await prisma.location.create({ data: { worldId: world.id, slug: 'test-huida-zona', name: 'Zona de prueba huida', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: [] } });
    locationId = location.id;
    const vecina = await prisma.location.create({ data: { worldId: world.id, slug: 'test-huida-zona-vecina', name: 'Vecina de prueba huida', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: [] } });
    vecinaId = vecina.id;
    linkId = (await prisma.locationLink.create({ data: { fromId: locationId, toId: vecinaId, minutosBase: 10, terreno: 'llano' } })).id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (huida de zona)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 18, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  beforeEach(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // huida con éxito garantizada
    await prisma.save.update({
      where: { id: saveId },
      data: {
        pendingCombatNpcSlugs: [npcSlug],
        condicionFisica: 'ILESO',
        pendingDynamicModeOffer: OFERTA_FORZADA,
        zonaCaminoPendiente: [{ x: 300, y: 300 }],
        zonaPosX: 100,
        zonaPosY: 100,
        zonaPosEntradaX: 400,
        zonaPosEntradaY: 550,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.locationLink.delete({ where: { id: linkId } });
    await prisma.location.deleteMany({ where: { id: { in: [locationId, vecinaId] } } });
  });

  for (const [nombre, ruta] of [
    ['/combat/flee (antes de empezar)', 'flee'],
    ['/combat/huir-en-curso (dentro del combate)', 'huir-en-curso'],
  ] as const) {
    it(`${nombre}: quita la oferta de combate forzado y el camino pendiente, y vuelve a la entrada`, async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/${ruta}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().escaped).toBe(true);
      const despues = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect(despues.pendingCombatNpcSlugs).toEqual([]);
      expect(despues.pendingDynamicModeOffer).toBeNull();
      expect(despues.zonaCaminoPendiente).toBeNull();
      expect({ x: despues.zonaPosX, y: despues.zonaPosY }).toEqual({ x: 400, y: 550 });
    });

    it(`${nombre}: si la entrada guardada queda fuera del radio seguro, vuelve a la entrada más cercana`, async () => {
      await prisma.save.update({ where: { id: saveId }, data: { zonaPosEntradaX: 400, zonaPosEntradaY: 300 } }); // celda (8,6), a 5 de la puerta (8,11)
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/${ruta}` });
      expect(res.statusCode).toBe(200);
      const despues = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
      expect({ x: Math.floor(despues.zonaPosX! / 50), y: Math.floor(despues.zonaPosY! / 50) }).toEqual({ x: 8, y: 11 });
    });
  }

  it('un fallo al huir en curso no mueve a nadie ni toca la oferta', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/huir-en-curso` });
    expect(res.json().escaped).toBe(false);
    const despues = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(despues.pendingCombatNpcSlugs).toEqual([npcSlug]);
    expect(despues.pendingDynamicModeOffer).toEqual(OFERTA_FORZADA);
    expect({ x: despues.zonaPosX, y: despues.zonaPosY }).toEqual({ x: 100, y: 100 });
  });
});
