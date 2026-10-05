import { describe, it, expect, vi } from 'vitest';
import { enSegundoPlano, esperarSegundoPlano } from './avanceDiario.js';

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
});
