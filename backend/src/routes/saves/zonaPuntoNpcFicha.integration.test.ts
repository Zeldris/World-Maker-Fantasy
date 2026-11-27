import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// P107/P462: el punto de un NPC fijo con etiqueta de escenario lleva, una vez descubierto, el nombre del NPC y la
/// facción del propio NPC (`ZonePoint.factionSlug` va vacío); sin descubrir sigue «???» y sin facción.
const { zonaRoutes } = await import('./zona.js');
const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };

describe('GET /saves/:id/zona — punto de NPC fijo (P107, P462)', () => {
  let saveId: string;
  let locId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const worldId = world.id;
    locId = (await prisma.location.create({ data: { worldId, slug: 'test-p107-zona', name: 'Zona P107', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona p107'] } })).id;
    const npc = await prisma.npc.create({ data: { worldId, kind: 'PRINCIPAL', slug: 'test-p107-orco', name: 'Orco P107', aliases: ['orco p107'], role: 'x', level: 5, attributes: ATTRS, bio: 'x', personality: 'x', raza: 'orcos', clase: 'GUERRERO', temperamento: 'CAUTELOSO', faction: 'Clan Serhu', homeLocationSlug: 'test-p107-zona' } });
    npcId = npc.id;
    const save = await prisma.save.create({ data: { userId, worldId, characterName: 'Gorhorn P107', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x', attributes: { ...ATTRS, magia: 10 }, portraitInitial: 'G', currentLocationId: locId } });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
    await prisma.zonePoint.create({ data: { locationId: locId, saveId, x: 400, y: 130, tipo: 'NPC', targetSlug: npc.slug, cantidad: 1, activo: true, label: 'Punto de vigilancia (Orco P107)' } });
  });

  afterAll(async () => {
    if (saveId) await prisma.discoveredEntity.deleteMany({ where: { saveId } });
    if (saveId) await prisma.zonePoint.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
    if (npcId) await prisma.npc.deleteMany({ where: { id: npcId } });
    if (locId) await prisma.location.deleteMany({ where: { id: locId } });
  });

  const punto = async () => {
    const app = Fastify();
    await app.register(zonaRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    expect(res.statusCode).toBe(200);
    return (res.json().puntos as { targetSlug: string; nombre: string; faccion?: string }[]).find((p) => p.targetSlug === 'test-p107-orco')!;
  };

  it('sin descubrir: «???» y sin facción', async () => {
    const p = await punto();
    expect(p.nombre).toBe('???');
    expect(p.faccion).toBeUndefined();
  });

  it('descubierto: nombre del NPC (no la etiqueta) y su facción', async () => {
    await prisma.discoveredEntity.create({ data: { saveId, entityType: 'npc', entitySlug: 'test-p107-orco' } });
    const p = await punto();
    expect(p.nombre).toBe('Orco P107');
    expect(p.faccion).toBe('Clan Serhu');
  });
});
