import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';

// P371: `escenario.sh cargar` confirma qué escenario cargó y en qué día (subcomando `confirmar`, que `cargar` llama al final).
describe('escenario.sh confirmar (P371)', () => {
  const saveIds: string[] = [];
  afterAll(async () => { await prisma.save.deleteMany({ where: { id: { in: saveIds } } }); });

  it('dice el escenario y el día de la partida en vez de solo listar la fila del índice', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId: world.id }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Confirmar (P371)', characterArchetype: 'cazador', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 5, destreza: 10, constitucion: 5, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 480, fictionalDateLabel: 'Día 39, mañana' } },
      },
    });
    saveIds.push(save.id);
    const raiz = resolve(__dirname, '../../..');
    const url = process.env.DATABASE_URL ?? 'postgresql://tarkor:tarkor@localhost:5432/tarkor';
    const salida = execFileSync('bash', ['tools/qa/escenario.sh', 'confirmar', 'hondonada-inicio'], { cwd: raiz, env: { ...process.env, ESCENARIO_URL: url }, encoding: 'utf8' });
    expect(salida).toMatch(/^Cargado «hondonada-inicio»/m);
    expect(salida).toMatch(/Día \d+, \S+\./);
  });
});
