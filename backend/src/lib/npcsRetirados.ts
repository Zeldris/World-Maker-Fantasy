import type { Prisma } from '@prisma/client';

/// Añade un NPC a `Save.npcsRetiredForever` sin duplicarlo (2026-09-28, instalador de escritorio).
/// Antes se hacía con `{ push: slug }` en turnResolution.ts y routes/saves/quests.ts — `push` es
/// una operación de listas escalares de Postgres que no existe en SQLite, donde este campo es
/// `Json` (ver lib/schemaSqlite.ts). Leer + escribir la unión funciona igual en los dos motores y,
/// al ir dentro de la misma transacción que la actualización principal, conserva la atomicidad.
/// Además deja de poder duplicar el slug si el mismo camino se repitiera.
export async function anadirNpcRetirado(tx: Prisma.TransactionClient, saveId: string, npcSlug: string): Promise<void> {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { npcsRetiredForever: true } });
  const actuales = (save.npcsRetiredForever ?? []) as string[];
  if (actuales.includes(npcSlug)) return;
  await tx.save.update({ where: { id: saveId }, data: { npcsRetiredForever: [...actuales, npcSlug] } });
}
