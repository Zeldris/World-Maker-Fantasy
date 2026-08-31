import { describe, it, expect } from 'vitest';
import { OllamaQueue } from './ollamaQueue.js';

describe('OllamaQueue', () => {
  it('resuelve tareas en orden cuando todas terminan bien', async () => {
    const queue = new OllamaQueue();
    const order: number[] = [];

    const a = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
      return 'a';
    });
    const b = queue.enqueue(async () => {
      order.push(2);
      return 'b';
    });

    expect(await a).toBe('a');
    expect(await b).toBe('b');
    expect(order).toEqual([1, 2]);
  });

  it('propaga el error real de una tarea que falla dentro del margen de cola', async () => {
    const queue = new OllamaQueue();
    await expect(
      queue.enqueue(async () => {
        throw new Error('fallo real de Ollama');
      }),
    ).rejects.toThrow('fallo real de Ollama');
  });

  it('una tarea zombie (nunca resuelve) rechaza ella misma tras su timeout de cola', async () => {
    const queue = new OllamaQueue();

    // Simula el cuelgue real de Ollama: el `fetch` interno nunca resuelve ni rechaza (el
    // AbortController no logró cortar la conexión a tiempo del lado de Node/undici).
    const zombie = queue.enqueue(() => new Promise(() => {}), 20);

    await expect(zombie).rejects.toThrow(/probable cuelgue/);
  }, 2000);

  it('AUTORRECUPERACIÓN: una tarea real encolada detrás de una zombie se ejecuta igualmente, sin reiniciar nada', async () => {
    const queue = new OllamaQueue();

    // Tarea 1: zombie, nunca resuelve por sí sola — su guard de cola es lo único que la libera.
    const zombie = queue.enqueue(() => new Promise(() => {}), 20);

    // Tarea 2: una tarea real y legítima detrás del zombie (p. ej. el turno siguiente, ya con
    // Ollama sano). Antes del fix, esto se habría quedado esperando para siempre porque `this.tail`
    // nunca avanzaba sin que el zombie resolviera de verdad — la única forma de destrabarlo era
    // reiniciar el proceso backend entero. Con el fix, la cola avanza en cuanto el guard del
    // zombie expira, así que esta tarea SÍ llega a ejecutar y resolver con normalidad.
    const second = queue.enqueue(async () => 'segunda tarea, ya con la cola libre', 500);

    await expect(zombie).rejects.toThrow(/probable cuelgue/);
    await expect(second).resolves.toBe('segunda tarea, ya con la cola libre');
  }, 2000);

  it('varias tareas zombie seguidas no impiden que una tarea real más adelante en la cola termine resolviendo', async () => {
    const queue = new OllamaQueue();

    const zombie1 = queue.enqueue(() => new Promise(() => {}), 15);
    const zombie2 = queue.enqueue(() => new Promise(() => {}), 15);
    const real = queue.enqueue(async () => 'por fin una tarea real', 500);

    await expect(zombie1).rejects.toThrow(/probable cuelgue/);
    await expect(zombie2).rejects.toThrow(/probable cuelgue/);
    await expect(real).resolves.toBe('por fin una tarea real');
  }, 2000);
});
