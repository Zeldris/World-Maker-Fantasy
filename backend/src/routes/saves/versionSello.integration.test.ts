import { describe, it, expect, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';

/// Versionado (2026-09-29): crear una partida sella `versionCreada`, y cargarla para jugar sella
/// `versionUltimaPartida` (solo si cambió). Postgres real, versión fija mockeada.
vi.mock('../../lib/version.js', () => ({ APP_VERSION: '9.9.9-test+abcdef0' }));

const { creationRoutes } = await import('./creation.js');
const { detailRoutes } = await import('./detail.js');
const { listRoutes } = await import('./list.js');

describe('sellos de versión de la partida', () => {
  const ids: string[] = [];

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: ids } } });
  });

  it('crear sella versionCreada, cargar sella versionUltimaPartida y el listado devuelve ambas', async () => {
    const app = Fastify();
    await app.register(creationRoutes);
    await app.register(detailRoutes);
    await app.register(listRoutes);

    const res = await app.inject({
      method: 'POST',
      url: '/saves',
      payload: {
        worldSlug: 'helek-sirik',
        characterName: 'Gorhorn de prueba (versión)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        introCharacterText: 'intro',
        introWorldText: 'intro',
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    const id = res.json().id as string;
    ids.push(id);

    const creada = await prisma.save.findUniqueOrThrow({ where: { id } });
    expect(creada.versionCreada).toBe('9.9.9-test+abcdef0');

    // Simula una partida antigua jugada con otra versión, y comprueba que cargarla la actualiza.
    await prisma.save.update({ where: { id }, data: { versionCreada: '0.0.1-alpha+aaaaaaa', versionUltimaPartida: '0.0.1-alpha+aaaaaaa' } });
    const carga = await app.inject({ method: 'GET', url: `/saves/${id}` });
    expect(carga.statusCode).toBe(200);

    const cargada = await prisma.save.findUniqueOrThrow({ where: { id } });
    expect(cargada.versionUltimaPartida).toBe('9.9.9-test+abcdef0');
    expect(cargada.versionCreada).toBe('0.0.1-alpha+aaaaaaa');

    const lista = await app.inject({ method: 'GET', url: '/saves' });
    const fila = (lista.json() as { id: string; versionCreada: string; versionUltimaPartida: string }[]).find((s) => s.id === id);
    expect(fila?.versionCreada).toBe('0.0.1-alpha+aaaaaaa');
    expect(fila?.versionUltimaPartida).toBe('9.9.9-test+abcdef0');
  }, 30_000);
});
