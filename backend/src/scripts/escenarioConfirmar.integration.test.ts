import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
    const dir = mkdtempSync(join(tmpdir(), 'escenario-'));
    const indice = join(dir, 'README.md');
    const corre = (nombre: string) => execFileSync('bash', ['tools/qa/escenario.sh', 'confirmar', nombre], { cwd: raiz, env: { ...process.env, ESCENARIO_URL: url, ESCENARIO_INDICE: indice }, encoding: 'utf8' });
    try {
      writeFileSync(indice, `| \`prueba-p371\` | \`${save.id}\` | x y | 2026-11-11 |\n| \`otra-p371\` | \`noexiste0000\` | x y | 2026-11-11 |\n`);
      // La partida del índice existe: sale SU día (hay otras partidas con otro día en la base).
      const salida = corre('prueba-p371');
      expect(salida).toMatch(/^Cargado «prueba-p371» en \w+: partida /m);
      expect(salida).toContain(`partida ${save.id}, Día 39, mañana.`);
      // La del índice no existe: no se cuela el día de otra.
      expect(corre('otra-p371')).toContain('partida noexiste0000, día desconocido.');
      // Sin fila en el índice: tampoco.
      expect(corre('no-esta')).toContain('partida ?, día desconocido.');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
