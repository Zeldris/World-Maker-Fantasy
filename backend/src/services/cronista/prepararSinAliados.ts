// QA-262 (2026-10-26): el paso `sin-aliados` de `prepararReino.ts` (P128: llegar a la 4.ª muerte en dificultad Media con el
// combate abierto sin compañeros). Saca a los compañeros del Grupo 1 (el que combate con el personaje, `abrirCombateDePersonas`)
// a otro grupo con la misma regla que el arrastre del panel (`moverCompaneroDeGrupo`, tope de 4 por grupo): no se borra ni se
// duerme a nadie a mano (QA-151). Los grupos nuevos salen con `nextFreeCombatGroupSlot`, como `POST /saves/:id/combat-groups`.
import type { PrismaClient } from '@prisma/client';
import { COMBAT_GROUP_BASE_SLOT, moverCompaneroDeGrupo, nextFreeCombatGroupSlot } from '../combatGroups.js';
import { MAX_COMBATIENTES_POR_BANDO } from '../combateMultiple.js';

export type ResultadoSinAliados = { movidos: string[]; grupos: number[]; yaEstaba: boolean };

export async function dejarSinAliados(prisma: PrismaClient, { saveId }: { saveId: string }): Promise<ResultadoSinAliados | { error: string }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { endedAt: true } });
  if (!save) return { error: `sin-aliados: no hay partida ${saveId}.` };
  if (save.endedAt) return { error: 'sin-aliados: la partida ha terminado.' };
  const aliados = await prisma.companion.findMany({ where: { saveId, combatGroupSlotIndex: COMBAT_GROUP_BASE_SLOT }, select: { id: true, name: true }, orderBy: { id: 'asc' } });
  if (aliados.length === 0) return { movidos: [], grupos: [], yaEstaba: true };

  const movidos: string[] = [];
  const grupos: number[] = [];
  for (const aliado of aliados) {
    const filas = await prisma.combatGroup.findMany({ where: { saveId }, select: { slotIndex: true } });
    const conCompaneros = await prisma.companion.groupBy({ by: ['combatGroupSlotIndex'], where: { saveId, combatGroupSlotIndex: { not: COMBAT_GROUP_BASE_SLOT } }, _count: { _all: true } });
    const ocupados = new Map(conCompaneros.map((g) => [g.combatGroupSlotIndex, g._count._all]));
    // Un grupo ya existente con hueco; si no, uno nuevo.
    let slotIndex = [...filas.map((f) => f.slotIndex), ...ocupados.keys()].filter((s) => s !== COMBAT_GROUP_BASE_SLOT).sort((a, b) => a - b).find((s) => (ocupados.get(s) ?? 0) < MAX_COMBATIENTES_POR_BANDO);
    if (slotIndex == null) {
      slotIndex = nextFreeCombatGroupSlot([...filas.map((f) => f.slotIndex), ...ocupados.keys()]);
      await prisma.combatGroup.create({ data: { saveId, slotIndex, name: `Grupo ${slotIndex + 1}` } });
    }
    const r = await moverCompaneroDeGrupo(prisma, { saveId, companionId: aliado.id, slotIndex });
    if (!r.ok) return { error: `sin-aliados: no pude mover a ${aliado.name} al grupo ${slotIndex + 1}: ${r.error}.` };
    movidos.push(aliado.name);
    if (!grupos.includes(slotIndex)) grupos.push(slotIndex);
  }
  return { movidos, grupos, yaEstaba: false };
}
