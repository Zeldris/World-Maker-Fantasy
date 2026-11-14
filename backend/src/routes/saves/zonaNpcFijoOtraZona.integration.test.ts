import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// P254: Gistera Koh y el Orco Enfurecido (con su punto en la Hondonada) aparecían en Pilares Rotos al llegar la jugadora:
/// la misión activa que apunta al orco (y los hechos de sesión que los nombran) los hacían candidatos en cualquier zona, y
/// `GET /zona` les reasignaba posición y `zonaLocationId` allí. Harness real contra Postgres.
const { zonaRoutes } = await import('./zona.js');

const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };

describe('GET /saves/:id/zona — NPC fijo de otra zona (P254)', () => {
  let saveId: string;
  let locOrigenId: string;
  let locDestinoId: string;
  const npcIds: string[] = [];

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const worldId = world.id;
    locOrigenId = (await prisma.location.create({ data: { worldId, slug: 'test-p254-origen', name: 'Origen P254', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['origen p254'] } })).id;
    locDestinoId = (await prisma.location.create({ data: { worldId, slug: 'test-p254-destino', name: 'Destino P254', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['destino p254'] } })).id;
    const mk = async (slug: string, name: string) => {
      const n = await prisma.npc.create({ data: { worldId, kind: 'PRINCIPAL', slug, name, aliases: [name.toLowerCase()], role: 'x', level: 5, attributes: ATTRS, bio: 'x', personality: 'x', raza: 'orcos', clase: 'GUERRERO', temperamento: 'CAUTELOSO', homeLocationSlug: 'test-p254-origen' } });
      npcIds.push(n.id);
      return n;
    };
    const dadora = await mk('test-p254-dadora', 'Dadora P254');
    const objetivo = await mk('test-p254-objetivo', 'Objetivo P254');
    const save = await prisma.save.create({
      data: { userId, worldId, characterName: 'Gorhorn P254', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x', attributes: { ...ATTRS, magia: 10 }, portraitInitial: 'G', currentLocationId: locDestinoId },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
    // Ambos con su punto en el origen (uno desactivado, como el gateado por misión) y ninguno en el destino.
    await prisma.zonePoint.create({ data: { locationId: locOrigenId, saveId, x: 400, y: 300, tipo: 'NPC', targetSlug: dadora.slug, cantidad: 1, activo: false } });
    await prisma.zonePoint.create({ data: { locationId: locOrigenId, saveId, x: 200, y: 300, tipo: 'NPC', targetSlug: objetivo.slug, cantidad: 1, activo: true } });
    await prisma.quest.create({ data: { saveId, title: 'Derrota a Objetivo P254', description: 'x', status: 'ACTIVA', targetNpcId: objetivo.id } });
    await prisma.npcState.create({ data: { saveId, npcId: dadora.id, scope: 'global' } }).catch(() => undefined);
    await prisma.sessionFact.createMany({ data: [{ saveId, text: 'Dadora P254 y Objetivo P254 quedaron atrás.' }] });
  });

  afterAll(async () => {
    await prisma.sessionFact.deleteMany({ where: { saveId } });
    await prisma.quest.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.zonePoint.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.deleteMany({ where: { id: { in: npcIds } } });
    await prisma.location.deleteMany({ where: { id: { in: [locOrigenId, locDestinoId] } } });
  });

  it('en la zona a la que llega la jugadora no se pintan ni se reubican', async () => {
    const app = Fastify();
    await app.register(zonaRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    expect(res.statusCode).toBe(200);
    const slugs = (res.json().dinamicos as { slug: string }[]).map((d) => d.slug);
    expect(slugs).not.toContain('test-p254-dadora');
    expect(slugs).not.toContain('test-p254-objetivo');
    const estados = await prisma.npcState.findMany({ where: { saveId, zonaLocationId: locDestinoId } });
    expect(estados).toEqual([]);
  });
});
