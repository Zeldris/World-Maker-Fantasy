// P370 (2026-11-03): el paso `herido:<npc>[:grave|herido]` de `prepararReino.ts` (para ver P292). El capitán del bando enemigo
// (CR-45, `objetivoConcentrado`) señala al empezar cada ronda al más herido del otro bando y, a igual herida, al de menos
// Constitución: como todos golpean a la jugadora, ella es siempre la más herida y la orden nunca pasa a un compañero mientras viva.
// Este paso deja a un participante del combate en curso (un compañero, `COMPANION`, o un NPC) HERIDO o GRAVE con la misma
// escritura que un golpe recibido en el combate (`escribirCondicionYEnergia`, QA-151); la orden se recalcula en la ronda siguiente.
import type { PrismaClient } from '@prisma/client';
import { escribirCondicionYEnergia } from '../combateMultipleOrquestacion.js';

export type CondicionHerida = 'HERIDO' | 'GRAVE';
export type ResultadoHeridoEnCombate = { nombre: string; condicion: CondicionHerida; bando: string };

class Rechazo extends Error {}

export async function dejarHeridoEnCombate(
  prisma: PrismaClient,
  { saveId, npcSlug, condicion }: { saveId: string; npcSlug: string; condicion: CondicionHerida },
): Promise<ResultadoHeridoEnCombate | { error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const save = await tx.save.findUnique({ where: { id: saveId }, select: { worldId: true, endedAt: true } });
      if (!save) throw new Rechazo(`herido: no hay partida ${saveId}.`);
      if (save.endedAt) throw new Rechazo('herido: la partida ha terminado.');
      const encuentro = await tx.combatEncounter.findFirst({ where: { saveId, estado: 'EN_CURSO' }, include: { participantes: true } });
      if (!encuentro) throw new Rechazo('herido: no hay combate en curso (abre uno antes, p. ej. con combate:<npc>,…).');
      const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: npcSlug }, select: { id: true, name: true } });
      const companeros = await tx.companion.findMany({ where: { saveId, sourceSlug: npcSlug }, select: { id: true, name: true } });
      const participante = encuentro.participantes.find(
        (p) => (p.tipo === 'NPC' && npc && p.npcId === npc.id) || (p.tipo === 'COMPANION' && companeros.some((c) => c.id === p.companionId)),
      );
      if (!participante) throw new Rechazo(`herido: ${npc?.name ?? npcSlug} no está en el combate en curso.`);
      await escribirCondicionYEnergia({ tx, saveId, participant: participante, condicionFisica: condicion, energia: null, abilityNameUsada: null, usageCounts: {}, activeEffectsNext: null });
      const nombre = companeros.find((c) => c.id === participante.companionId)?.name ?? npc?.name ?? npcSlug;
      return { nombre, condicion, bando: participante.bando };
    });
  } catch (e) {
    if (e instanceof Rechazo) return { error: e.message };
    throw e;
  }
}
