import { prisma } from './src/lib/prisma.js';
import { esperarTodoElFondo } from './src/services/avanceDiario.js';

// UX-29/UX-35 (2026-10-05): el día que cruza un turno se avanza en segundo plano, después de
// responder. Los tests con base real borran su partida nada más terminar; si el avance sigue
// escribiendo, el borrado en cascada y el avance se bloquean en Postgres (40P01, visto en el CI).
// En el juego lo evita el `preHandler` de `registrarAvanceTrasAcciones`; aquí, el borrado directo
// con Prisma espera antes a que acabe todo el trabajo de fondo.
const partidas = prisma.save as unknown as Record<'delete' | 'deleteMany', (...args: unknown[]) => Promise<unknown>>;
for (const metodo of ['delete', 'deleteMany'] as const) {
  const original = partidas[metodo].bind(partidas);
  partidas[metodo] = async (...args: unknown[]) => {
    await esperarTodoElFondo();
    return original(...args);
  };
}
