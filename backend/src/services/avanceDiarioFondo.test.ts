import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { enSegundoPlano, esperarSegundoPlano, registrarAvanceTrasAcciones } from './avanceDiario.js';

/// UX-29 / UX-35: el trabajo de fondo de una partida va en fila y el turno siguiente puede esperarlo.
describe('trabajo de fondo por partida', () => {
  it('va en orden dentro de la partida, un fallo no corta la fila, y esperar acaba cuando acaba todo', async () => {
    const orden: string[] = [];
    const espera = (ms: number, nombre: string) => () => new Promise<void>((r) => setTimeout(() => { orden.push(nombre); r(); }, ms));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    void enSegundoPlano('a', espera(30, 'a1'));
    void enSegundoPlano('a', () => Promise.reject(new Error('falla')));
    void enSegundoPlano('a', espera(1, 'a2'));
    void enSegundoPlano('b', espera(1, 'b1'));
    await esperarSegundoPlano('a');
    expect(orden).toEqual(['b1', 'a1', 'a2']);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
    // Sin nada pendiente, no espera.
    await expect(esperarSegundoPlano('nadie')).resolves.toBeUndefined();
  });

  it('una acción de la partida no empieza hasta que acaba su trabajo de fondo', async () => {
    const app = Fastify();
    registrarAvanceTrasAcciones(app, {} as PrismaClient);
    const orden: string[] = [];
    // 400: el hook de después de la acción no encola nada (no hace falta base de datos).
    app.post('/saves/:id/accion', async (_req, reply) => {
      orden.push('accion');
      return reply.status(400).send({});
    });
    void enSegundoPlano('p1', () => new Promise<void>((r) => setTimeout(() => { orden.push('fondo'); r(); }, 20)));
    await app.inject({ method: 'POST', url: '/saves/p1/accion' });
    expect(orden).toEqual(['fondo', 'accion']);
    await app.close();
  });
});
