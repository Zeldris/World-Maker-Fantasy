import type { Prisma, PrismaClient } from '@prisma/client';

/// P233: frontera del combate en curso (`Save.combateDesde`), para saber si un COMBATE_PERDIDO es de
/// este combate o de otro. Empieza cuando la lista de rivales (`pendingCombatNpcSlugs`) pasa de vacía a
/// llena o cambia del todo (ningún rival en común: una emboscada justo tras otro combate es otro
/// combate); sigue igual si comparten alguno (un agresor que se suma); se borra al vaciarse.
export function combateDesdeTras(previos: string[], nuevos: string[], actual: Date | null, ahora: Date = new Date()): Date | null {
  if (nuevos.length === 0) return null;
  if (!actual || !nuevos.some((s) => previos.includes(s))) return ahora;
  return actual;
}

type Db = PrismaClient | Prisma.TransactionClient;

/// Guarda la lista de rivales y su `combateDesde` a la vez. `ahora`: cuándo empieza el combate si
/// empieza con esta escritura (el turno pasa el instante en que empezó, antes de registrar nada).
export async function guardarSlugsDeCombate(
  db: Db,
  saveId: string,
  nuevos: string[],
  opciones: { ahora?: Date; extra?: Prisma.SaveUpdateInput } = {},
): Promise<void> {
  const save = await db.save.findUnique({ where: { id: saveId }, select: { pendingCombatNpcSlugs: true, combateDesde: true } });
  const previos = Array.isArray(save?.pendingCombatNpcSlugs) ? (save.pendingCombatNpcSlugs as string[]) : [];
  await db.save.update({
    where: { id: saveId },
    data: { ...opciones.extra, pendingCombatNpcSlugs: nuevos, combateDesde: combateDesdeTras(previos, nuevos, save?.combateDesde ?? null, opciones.ahora) },
  });
}
