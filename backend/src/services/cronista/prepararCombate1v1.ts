// QA-293 (P373): el paso `combate1v1:<npc>` de `prepararReino.ts`. Abre el combate 1v1 clásico (el de `combateActivo` en
// `turnResolution.ts`, sin `CombatEncounter`) contra un NPC que no tiene por qué vivir en la zona, para probar lo que solo
// pasa ahí (la huida por habilidad de la fauna, `decidirHuidaPorHabilidad`). En el juego, ese combate empieza cuando un
// agresor se lanza contra la jugadora (viaje interrumpido, «Combatir» de la tarjeta de encuentro, el Cronista): el rival
// queda en `Save.pendingCombatNpcSlugs` (`guardarSlugsDeCombate`), `GET /saves/:id` lo devuelve en `combateIniciado`, el
// panel se abre solo al cargar (P405) y cada turno con `enCombate` lo pone en escena (`enCombateConDelTurno`). Aquí lo
// escribe el efecto `forzarCombate` del Cronista, el mismo de un NPC que se lanza contra ella, con su línea en el diario.
import type { PrismaClient } from '@prisma/client';
import { aplicarEfecto } from './efectos.js';
import { scopeFor } from '../npcScene.js';

export type ResultadoCombate1v1 = { nombre: string; scope: string };

class Rechazo extends Error {}

export async function abrirCombate1v1(
  prisma: PrismaClient,
  { saveId, npcSlug }: { saveId: string; npcSlug: string },
): Promise<ResultadoCombate1v1 | { error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const save = await tx.save.findUnique({
        where: { id: saveId },
        select: { worldId: true, endedAt: true, currentLocationId: true, pendingCombatNpcSlugs: true, worldState: { select: { fictionalMinutes: true } } },
      });
      if (!save) throw new Rechazo(`combate1v1: no hay partida ${saveId}.`);
      if (save.endedAt) throw new Rechazo('combate1v1: la partida ha terminado.');
      if (!save.currentLocationId) throw new Rechazo('combate1v1: la partida no está en ningún lugar.');
      const pendientes = Array.isArray(save.pendingCombatNpcSlugs) ? (save.pendingCombatNpcSlugs as string[]) : [];
      const encuentro = await tx.combatEncounter.findFirst({ where: { saveId, estado: 'EN_CURSO' }, select: { id: true } });
      if (encuentro || pendientes.length) throw new Rechazo(`combate1v1: ya hay un combate en curso${pendientes.length ? ` (rivales: ${pendientes.join(', ')})` : ' (de grupo)'}.`);
      const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: npcSlug }, select: { id: true, name: true, kind: true } });
      if (!npc) throw new Rechazo(`combate1v1: no hay NPC ${npcSlug}.`);
      const scope = scopeFor(npc.kind, save.currentLocationId);
      const estado = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope } }, select: { condicionFisica: true } });
      if (estado?.condicionFisica === 'MUERTO' || estado?.condicionFisica === 'CONVALECIENTE') throw new Rechazo(`combate1v1: ${npc.name} está ${estado.condicionFisica} aquí.`);
      const r = await aplicarEfecto(
        { tx, saveId, worldId: save.worldId, fictionalMinutes: save.worldState?.fictionalMinutes ?? 0, origen: 'MOTOR' },
        { tipo: 'forzarCombate', npcId: npc.id, mensaje: `${npc.name} se lanza contra ti.` },
      );
      if (!r.aplicado) throw new Rechazo(`combate1v1: no se pudo abrir el combate contra ${npc.name}.`);
      return { nombre: npc.name, scope };
    });
  } catch (e) {
    if (e instanceof Rechazo) return { error: e.message };
    throw e;
  }
}
