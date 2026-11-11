// QA-270 (2026-10-26): el paso `convaleciente:<npc>:combate` de `prepararReino.ts` (P95, P320), con las escrituras del juego y no
// a mano (QA-151). Tras ganarle un combate a un rival suelto, el juego deja CONVALECIENTE al NPC y ausente de la zona 6 h
// (`dejarNpcConvaleciente`: así debe quedar, el animal vencido ya no está en el mapa) y mantiene el combate sin resolver en
// `Save.pendingCombatNpcSlugs` (`guardarSlugsDeCombate`, como `resolveCombatSlugsAndPersist` de `turnResolution.ts`): de ahí sale la tarjeta
// «<NPC> está convaleciente» con Matar, Capturar y Clemente que reconstruye `GET /saves/:id` (`combateIniciado`). Sin ese slug, la
// tarjeta no existe y el convaleciente no se ve en ninguna parte (tanda 33). P406 (2026-11-03): con un combate en curso, el rival
// suelto que ya está en él queda convaleciente sin tocar `pendingCombatNpcSlugs`; si no está en ese combate, se niega con el motivo.
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
      // P406: con un combate de grupo abierto (p. ej. `reino-combate-capitan`), el NPC tiene que ser uno de sus rivales: queda
      // CONVALECIENTE en su `NpcState` (el que lee el combate para un rival suelto) y sale con Matar, Capturar y Clemente.
      const encuentro = await tx.combatEncounter.findFirst({
        where: { saveId, estado: 'EN_CURSO' },
        select: { participantes: { where: { tipo: 'NPC' }, select: { npcId: true, npcScope: true, condicionFisicaGrupo: true, npc: { select: { slug: true } } } } },
      });
      if (encuentro) {
        const p = encuentro.participantes.find((x) => x.npcId === npc.id);
        if (!p) throw new Rechazo(`convaleciente: ${npc.name} no está en el combate en curso (rivales: ${encuentro.participantes.map((x) => x.npc?.slug).join(', ')}).`);
        if (p.condicionFisicaGrupo !== null) throw new Rechazo(`convaleciente: ${npc.name} va en grupo en el combate en curso; este paso es para un rival suelto.`);
        const { scope } = await dejarNpcConvaleciente(tx, { saveId, npc, currentLocationId: save.currentLocationId, ahora: save.worldState?.fictionalMinutes ?? 0 });
        if (scope !== p.npcScope) throw new Rechazo(`convaleciente: ${npc.name} combate en otro sitio (${p.npcScope}), no en el lugar actual.`);
        return { nombre: npc.name, scope, rivales: [...new Set(encuentro.participantes.map((x) => x.npc?.slug).filter((x): x is string => !!x))] };
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

export type ResultadoConvaleciente = { slug: string; scope: string };

// El paso `convaleciente:<npc>` (sin `:combate`): el NPC queda CONVALECIENTE en el lugar actual con `dejarNpcConvaleciente`
// (`turnLootKill.ts`), la misma escritura que la derrota real en combate: condición y reloj, ausencia de zona de 6 h y grupo.
export async function dejarConvalecienteSuelto(
  prisma: PrismaClient,
  { saveId, npcSlug }: { saveId: string; npcSlug: string },
): Promise<ResultadoConvaleciente | { error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const save = await tx.save.findUnique({ where: { id: saveId }, select: { worldId: true, currentLocationId: true, worldState: { select: { fictionalMinutes: true } } } });
      if (!save) throw new Rechazo(`convaleciente: no hay partida ${saveId}.`);
      const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: npcSlug }, select: { id: true, slug: true, kind: true } });
      if (!npc) throw new Rechazo(`convaleciente: no hay NPC ${npcSlug}.`);
      const { scope } = await dejarNpcConvaleciente(tx, { saveId, npc, currentLocationId: save.currentLocationId, ahora: save.worldState?.fictionalMinutes ?? 0 });
      return { slug: npc.slug, scope };
    });
  } catch (e) {
    if (e instanceof Rechazo) return { error: e.message };
    throw e;
  }
}
