import { describe, expect, it, vi } from 'vitest';

// Fuerza el modo SQLite solo para este fichero: prueba la cola de transacciones de prisma.ts sin
// base de datos real (el `$transaction` original se sustituye por uno que solo registra).
vi.mock('./proveedorBd.js', () => ({ esSqlite: true }));

describe('prisma.ts en SQLite: transacciones de una en una', () => {
  it('no solapa transacciones, permite anidar y la marca de "dentro" caduca', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const registro: string[] = [];
    let abiertas = 0;
    const falso = vi.spyOn(PrismaClient.prototype, '$transaction').mockImplementation((async (fn: () => Promise<unknown>) => {
      abiertas += 1;
      registro.push(`abre (${abiertas} abiertas)`);
      try {
        return await fn();
      } finally {
        abiertas -= 1;
      }
    }) as never);
    const { prisma } = await import('./prisma.js');
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let tardia: Promise<unknown> | null = null;
    await Promise.all([
      prisma.$transaction(async () => {
        // Anidada: no espera a la cola (esperaría a esta misma transacción).
        await prisma.$transaction(async () => undefined);
        // Lanzada sin await: abrirá su transacción a los 40 ms, cuando esta ya haya terminado y
        // mientras la "larga" de abajo sigue abierta. Debe esperar a la cola, no colarse.
        tardia = espera(40).then(() => prisma.$transaction(async () => espera(5)));
        await espera(20);
      }),
      prisma.$transaction(async () => espera(60)),
    ]);
    await tardia;

    // Solo la anidada llega a ver 2 abiertas; la larga y la tardía esperan su turno.
    expect(registro).toEqual(['abre (1 abiertas)', 'abre (2 abiertas)', 'abre (1 abiertas)', 'abre (1 abiertas)']);
    falso.mockRestore();
  });
});
