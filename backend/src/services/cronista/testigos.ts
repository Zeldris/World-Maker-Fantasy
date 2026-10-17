// Testigos de una muerte (CR-11, hito 0.2 — decisión de la entrevista: solo testigos, sin parentesco).
// Testigo = NPC con nombre, vivo, con un punto activo de la partida en el mismo lugar en que ocurre.
import type { Prisma } from '@prisma/client';
import { npcSinCaerEnPartida } from '../mundoPartida.js';
import { bando } from './misiones.js';
import { applyFactionRepDelta, parseFactionsStatus, type FactionRepChangeInfo } from '../reputation.js';

export async function testigosEnLugar(tx: Prisma.TransactionClient, saveId: string, worldId: string, locationId: string, victimaId: string): Promise<string[]> {
  const puntos = await tx.zonePoint.findMany({ where: { saveId, locationId, activo: true, tipo: 'NPC' }, select: { targetSlug: true } });
  if (puntos.length === 0) return [];
  const npcs = await tx.npc.findMany({
    where: {
      worldId, kind: 'PRINCIPAL', slug: { in: puntos.map((p) => p.targetSlug) }, id: { not: victimaId }, ...npcSinCaerEnPartida(saveId),
    },
    select: { id: true },
    orderBy: { slug: 'asc' },
  });
  return npcs.map((n) => n.id);
}

/// P172/P187 (QA-27, decidido por la usuaria 2026-10-15): quién del bando dueño ve a la jugadora llevarse
/// lo suyo. NPC vivos de ese bando (cualquiera, también guardias y cazadores de plantilla) con su punto
/// activo en el mismo lugar, como el robo visto de Medieval Dynasty o Bellwright.
export async function testigosDelBando(tx: Prisma.TransactionClient, saveId: string, worldId: string, locationId: string, faccion: string): Promise<string[]> {
  const puntos = await tx.zonePoint.findMany({ where: { saveId, locationId, activo: true, tipo: 'NPC' }, select: { targetSlug: true } });
  if (puntos.length === 0) return [];
  const npcs = await tx.npc.findMany({
    where: {
      worldId, faction: faccion, slug: { in: puntos.map((p) => p.targetSlug) }, ...npcSinCaerEnPartida(saveId),
    },
    select: { id: true },
    orderBy: { slug: 'asc' },
  });
  return npcs.map((n) => n.id);
}

/// Cuánto resta, con el bando dueño, que te vean coger lo suyo (P172) o cazarle el ganado (P187: mucho
/// más). Escala de 0 a 5000; matar a uno de los suyos resta 150. Cifras provisionales.
export const REP_COGER_LO_AJENO = -50;
export const REP_CAZAR_GANADO_AJENO = -100;

/// Si alguien del bando dueño lo ve, resta reputación con él y devuelve la frase para el diario. Sin
/// dueño o sin testigos, nada (se puede coger y cazar; solo cuesta si te ven).
export async function aprovecharseDeLoAjeno(
  tx: Prisma.TransactionClient,
  /// `cazar`: lo vio caer (caza limpia); `atacar`: lo vio ir a por ellos (la caza que acaba en combate, cuente
  /// lo que cuente luego el combate).
  p: { saveId: string; worldId: string; locationId: string; faccion: string | null; que: 'coger' | 'cazar' | 'atacar' },
): Promise<{ frase: string; cambio: FactionRepChangeInfo } | null> {
  if (!p.faccion) return null;
  const testigos = await testigosDelBando(tx, p.saveId, p.worldId, p.locationId, p.faccion);
  if (testigos.length === 0) return null;
  const delta = p.que === 'coger' ? REP_COGER_LO_AJENO : REP_CAZAR_GANADO_AJENO;
  const ws = await tx.worldState.findUnique({ where: { saveId: p.saveId }, select: { factionsStatus: true } });
  const status = applyFactionRepDelta(parseFactionsStatus(ws?.factionsStatus), p.faccion, delta);
  await tx.worldState.update({ where: { saveId: p.saveId }, data: { factionsStatus: status } });
  const cambio: FactionRepChangeInfo = { faction: p.faccion, delta, newValue: status[p.faccion]! };
  const frase =
    p.que === 'coger'
      ? `Alguien ${bando(p.faccion, 'de')} lo ha visto llevarse lo que es suyo.`
      : p.que === 'cazar'
        ? `Alguien ${bando(p.faccion, 'de')} lo ha visto matar a uno de sus animales.`
        : `Alguien ${bando(p.faccion, 'de')} lo ha visto ir a por sus animales.`;
  return { frase, cambio };
}
