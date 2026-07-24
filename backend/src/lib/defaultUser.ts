import { prisma } from './prisma.js';

let cachedUserId: string | null = null;
/// Carrera benigna cerrada (auditoría 2026-07-22): antes, dos peticiones concurrentes ANTES de
/// que existiera ningún `User` podían pasar ambas el `findFirst()` (todavía null) y crear cada
/// una su propia fila — ventana real solo en el primerísimo arranque. Memoizar la PROMESA en
/// vuelo (no solo el resultado ya resuelto) hace que la segunda petición espere a la primera en
/// vez de arrancar su propio `findFirst`/`create` en paralelo.
let inFlight: Promise<string> | null = null;

/// Decisión de producto 2 (02-decisiones.md): sin login real todavía — un único usuario
/// implícito. Reutiliza el primero que exista o crea uno la primera vez que hace falta.
export async function getDefaultUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const existing = await prisma.user.findFirst();
    if (existing) {
      cachedUserId = existing.id;
      return existing.id;
    }
    const created = await prisma.user.create({ data: {} });
    cachedUserId = created.id;
    return created.id;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
