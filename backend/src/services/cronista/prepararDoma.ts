// QA-269 (2026-10-26): el animal atado de `domable:<especie>` en `prepararReino.ts` (CR-55 «Al corral»), con la escritura
// del juego y no a mano (QA-151): `atarEnJaula` es la misma que usa la partida de captura al volver (`descargarCaptura`):
// el animal queda capturado, GRAVE, con felicidad 0, en una Jaula libre apta para su especie. La confianza se gana
// jugando (`/tameo-pendientes/:npcSlug/intentar`) y después ya puede ir «Al corral».
import type { PrismaClient } from '@prisma/client';
import { atarEnJaula } from '../partidasCaptura.js';
import { esGanado } from './ganaderia.js';

export type ResultadoDomable = { especie: string; nombre: string };

export async function dejarDomableEnJaula(prisma: PrismaClient, { saveId, especie }: { saveId: string; especie: string }): Promise<ResultadoDomable | { error: string }> {
  if (!esGanado(especie)) return { error: `domable: «${especie}» no es una especie de ganado (no hay «Al corral» para ella).` };
  return prisma.$transaction(async (tx) => {
    const save = await tx.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
    if (!save) return { error: `domable: no hay partida ${saveId}.` };
    const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: especie }, select: { id: true, name: true } });
    if (!npc) return { error: `domable: no hay fauna ${especie}.` };
    const scope = `escenario-domable-${Date.now().toString(36)}`;
    if (!(await atarEnJaula(tx, saveId, npc.id, especie, scope))) return { error: `domable: no hay Jaula libre para ${npc.name} (dar-reino edificio:jaula-mediana o jaula-grande).` };
    return { especie, nombre: npc.name };
  });
}
