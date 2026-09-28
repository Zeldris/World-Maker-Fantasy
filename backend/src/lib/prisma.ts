import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@prisma/client';
import { esSqlite } from './proveedorBd.js';

/// En SQLite (instalador de escritorio, 2026-09-28) las transacciones interactivas se ejecutan de
/// una en una. SQLite admite un solo escritor a la vez: dos transacciones que leen y luego escriben
/// la misma partida (doble clic, dos peticiones casi simultáneas) chocarían con "database is
/// locked" en vez de esperarse. Es además lo que sustituye al `SELECT ... FOR UPDATE` de
/// `lockRowForUpdate` (routes/saves/shared.ts), que SQLite no tiene: si nunca hay dos transacciones
/// a la vez, la fila leída dentro de una no puede cambiar hasta que termine. Una transacción abierta
/// desde DENTRO de otra no espera a la cola (se detecta con AsyncLocalStorage): esperaría a que
/// acabe la de fuera, que a su vez la espera a ella. La marca de "dentro" caduca al terminar la
/// transacción de fuera: una tarea lanzada sin `await` desde dentro (p. ej.
/// `startEagerTransitResolution`) hereda el contexto, y sin esto se saltaría la cola cuando abra
/// su propia transacción mucho después. En Postgres no cambia nada.
function serializarTransacciones(cliente: PrismaClient): PrismaClient {
  const dentro = new AsyncLocalStorage<{ activa: boolean }>();
  let cola: Promise<unknown> = Promise.resolve();
  const original = cliente.$transaction.bind(cliente) as (...args: unknown[]) => Promise<unknown>;
  const serializada = (...args: unknown[]) => {
    if (dentro.getStore()?.activa) return original(...args);
    const turno = cola.then(async () => {
      const marca = { activa: true };
      try {
        return await dentro.run(marca, () => original(...args));
      } finally {
        marca.activa = false;
      }
    });
    cola = turno.catch(() => undefined);
    return turno;
  };
  cliente.$transaction = serializada as typeof cliente.$transaction;
  return cliente;
}

export const prisma = esSqlite ? serializarTransacciones(new PrismaClient()) : new PrismaClient();
