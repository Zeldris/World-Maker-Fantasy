// Ayudar a un malherido (CR-12 paso 12d, hito 0.2 — decisión Q14 de la usuaria): opción «Ayudar»
// del menú de interacción con un NPC en estado GRAVE o CONVALECIENTE (p. ej. el herido de un campo
// de batalla del narrador de fondo). Le atiende lo justo para que vuelva con los suyos: pasa a
// HERIDO, su facción lo agradece en la reputación y el Libro lo registra (`AYUDA_PRESTADA`).
import type { PrismaClient } from '@prisma/client';
import { applyFactionRepDelta, parseFactionsStatus } from './reputation.js';
import { scopeFor } from './npcScene.js';
import { registrarSuceso } from './cronista/sucesos.js';

/// Reputación que gana la jugadora con la facción del NPC al que ayuda.
export const FACTION_REP_AYUDA_DELTA = 60;

/// Atiende al NPC; `null` si ya no está malherido (o no existe), con lo que no se puede ayudar.
export async function ayudarNpc(prisma: PrismaClient, saveId: string, npcSlug: string) {
  return prisma.$transaction(async (tx) => {
    const save = await tx.save.findUniqueOrThrow({
      where: { id: saveId },
      select: { id: true, worldId: true, characterName: true, currentLocationId: true, worldState: { select: { fictionalMinutes: true, fictionalDateLabel: true, factionsStatus: true } } },
    });
    const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, slug: npcSlug }, select: { id: true, name: true, kind: true, faction: true } });
    if (!npc) return null;
    const scope = scopeFor(npc.kind, save.currentLocationId);
    const estado = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope } } });
    if (!estado || (estado.condicionFisica !== 'GRAVE' && estado.condicionFisica !== 'CONVALECIENTE')) return null;

    await tx.npcState.update({ where: { id: estado.id }, data: { condicionFisica: 'HERIDO' } });
    const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
    if (npc.faction && save.worldState) {
      const factionsStatus = applyFactionRepDelta(parseFactionsStatus(save.worldState.factionsStatus), npc.faction, FACTION_REP_AYUDA_DELTA);
      await tx.worldState.update({ where: { saveId }, data: { factionsStatus } });
    }
    const entrada = await tx.logEntry.create({
      data: {
        saveId, channel: 'CHARACTER', isSystemMessage: true, fictionalMinutes, timeLabel: save.worldState?.fictionalDateLabel ?? '',
        text: `Atiendes las heridas de ${npc.name} lo justo para que pueda volver con los suyos.${npc.faction ? ` En ${npc.faction} lo sabrán.` : ''}`,
      },
    });
    await registrarSuceso(tx, {
      saveId, tipo: 'AYUDA_PRESTADA', fictionalMinutes, locationId: save.currentLocationId, origen: 'JUGADOR', logEntryId: entrada.id,
      actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }],
      datos: { personaje: save.characterName, a: npc.name },
    });
    return entrada;
  });
}
