// QA-270 (2026-10-26): el paso `convaleciente:<npc>:combate` de `prepararReino.ts` (P95, P320), con las escrituras del juego y no
// a mano (QA-151). Tras ganarle un combate a un rival suelto, el juego deja CONVALECIENTE al NPC y ausente de la zona 6 h
// (`dejarNpcConvaleciente`: así debe quedar, el animal vencido ya no está en el mapa) y mantiene el combate sin resolver en
// `Save.pendingCombatNpcSlugs` (`guardarSlugsDeCombate`, como `resolveCombatSlugsAndPersist` de `turnResolution.ts`): de ahí sale la tarjeta
// «<NPC> está convaleciente» con Matar, Capturar y Clemente que reconstruye `GET /saves/:id` (`combateIniciado`). Sin ese slug, la
// tarjeta no existe y el convaleciente no se ve en ninguna parte (tanda 33).
import type { PrismaClient } from '@prisma/client';
import { dejarNpcConvaleciente } from '../turnLootKill.js';
import { guardarSlugsDeCombate } from '../combateDesde.js';

export type ResultadoConvalecienteEnCombate = { nombre: string; scope: string; rivales: string[] };

class Rechazo extends Error {}

export async function dejarConvalecienteEnCombate(
  prisma: PrismaClient,
  { saveId, npcSlug }: { saveId: string; npcSlug: string },
): Promise<ResultadoConvalecienteEnCombate | { error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const save = await tx.save.findUnique({
        where: { id: saveId },
        select: { worldId: true, endedAt: true, currentLocationId: true, pendingCombatNpcSlugs: true, worldState: { select: { fictionalMinutes: true } } },
      });
      if (!save) throw new Rechazo(`convaleciente: no hay partida ${saveId}.`);
      if (save.endedAt) throw new Rechazo('convaleciente: la partida ha terminado.');
      if (!save.currentLocationId) throw new Rechazo('convaleciente: la partida no está en ningún lugar.');
      const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: npcSlug }, select: { id: true, name: true, slug: true, kind: true } });
      if (!npc) throw new Rechazo(`convaleciente: no hay NPC ${npcSlug}.`);
      if (await tx.combatEncounter.findFirst({ where: { saveId, estado: 'EN_CURSO' }, select: { id: true } })) {
        throw new Rechazo('convaleciente: ya hay un combate en curso (lo resuelve el combate, no este paso).');
      }
      const { scope } = await dejarNpcConvaleciente(tx, { saveId, npc, currentLocationId: save.currentLocationId, ahora: save.worldState?.fictionalMinutes ?? 0 });
      // Un miembro de un grupo con más vivos vuelve a ILESO (`datosNpcStateDeIntercambio`): no hay convaleciente que enseñar.
      const estado = await tx.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope } }, select: { condicionFisica: true } });
      if (estado.condicionFisica !== 'CONVALECIENTE') throw new Rechazo(`convaleciente: ${npc.name} es de un grupo con más miembros en pie y queda ${estado.condicionFisica}, no CONVALECIENTE.`);
      const previos = Array.isArray(save.pendingCombatNpcSlugs) ? (save.pendingCombatNpcSlugs as string[]) : [];
      const rivales = [...new Set([...previos, npc.slug])];
      await guardarSlugsDeCombate(tx, saveId, rivales);
      return { nombre: npc.name, scope, rivales };
    });
  } catch (e) {
    if (e instanceof Rechazo) return { error: e.message };
    throw e;
  }
}
