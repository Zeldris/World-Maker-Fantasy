import type { PrismaClient } from '@prisma/client';
import { lockRowForUpdate } from '../routes/saves/shared.js';
import { MAX_COMBATIENTES_POR_BANDO } from './combateMultiple.js';

/// Grupos de combate (2026-09-08, diseño de la usuaria: "grupos de 4 con los compañeros... el
/// Grupo 1 siempre estará el PJ a la cabeza... podrás mover tus compañeros entre los diferentes
/// grupos, un poco como las habilidades de combate") — funciones puras compartidas entre el
/// endpoint de gestión (routes/saves/combatGroups.ts) y cualquier consumidor futuro.

/// Grupo 1 (slotIndex 0) siempre existe implícitamente, con el PJ a la cabeza — nunca se crea como
/// fila de `CombatGroup` salvo que el jugador lo renombre (mismo criterio que `hasBaseSkillBar`,
/// pero aquí la base ni necesita fila para EXISTIR, solo para tener un nombre custom).
export const COMBAT_GROUP_BASE_SLOT = 0;

/// Puro: el próximo `slotIndex` libre para un grupo nuevo (nunca reutiliza el 0, ya reservado al
/// Grupo 1 implícito). Sin tope — a diferencia de `SKILL_BARS_MAX`, la usuaria no pidió un límite
/// de CUÁNTOS grupos puede haber, solo un límite de 4 combatientes POR grupo (ya aplicado en
/// cazar.ts al construir el bando JUGADOR).
export function nextFreeCombatGroupSlot(existingSlotIndexes: number[]): number {
  let i = COMBAT_GROUP_BASE_SLOT + 1;
  while (existingSlotIndexes.includes(i)) i++;
  return i;
}

/// Mover un compañero a otro grupo respeta el tope de 4 combatientes por bando (el PJ ocupa un hueco del Grupo 1). Lo usan el
/// endpoint `PATCH /saves/:id/companeros/:companionId/grupo` y el paso `sin-aliados` de `prepararReino.ts` (QA-266), para que la
/// preparación pase por la misma regla y no la rehaga a mano (QA-151). Devuelve `null` en `error` si va bien.
export type ResultadoMoverCompanero =
  | { ok: true; id: string; combatGroupSlotIndex: number }
  | { ok: false; status: 400 | 404; error: string };

export async function moverCompaneroDeGrupo(
  prisma: PrismaClient,
  { saveId, companionId, slotIndex }: { saveId: string; companionId: string; slotIndex: number },
): Promise<ResultadoMoverCompanero> {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) return { ok: false, status: 400, error: 'combatGroupSlotIndex inválido' };
  const companion = await prisma.companion.findFirst({ where: { id: companionId, saveId }, select: { id: true } });
  if (!companion) return { ok: false, status: 404, error: 'Compañero no encontrado' };

  const tope = slotIndex === COMBAT_GROUP_BASE_SLOT ? MAX_COMBATIENTES_POR_BANDO - 1 : MAX_COMBATIENTES_POR_BANDO;
  // Hallazgo 46 (revisar-partida-hallazgos.md, 2026-09-15): count+update como dos operaciones separadas dejaba una ventana de
  // carrera (dos arrastres concurrentes superaban el tope). `SELECT ... FOR UPDATE` sobre `Save` serializa de verdad bajo
  // READ COMMITTED: la segunda transacción espera a la primera y ya ve el estado actualizado.
  const updated = await prisma.$transaction(async (tx) => {
    await lockRowForUpdate(tx, 'Save', saveId, ['id']);
    const yaEnGrupo = await tx.companion.count({ where: { saveId, combatGroupSlotIndex: slotIndex } });
    if (yaEnGrupo >= tope) return null;
    return tx.companion.update({ where: { id: companion.id }, data: { combatGroupSlotIndex: slotIndex } });
  });
  if (!updated) return { ok: false, status: 400, error: `Ese grupo ya está lleno (máximo ${tope} compañeros)` };
  return { ok: true, id: updated.id, combatGroupSlotIndex: updated.combatGroupSlotIndex };
}
