// Migración de partidas existentes al mundo por partida (CR-8, hito 0.2 — roadmap-cronista.md § 16).
// Idempotente: volver a pasarla no cambia nada. Sin `aplicar` solo calcula el informe.
//
// No incluye los sucesos fundacionales a partir de `SessionSummary` (opcionales en § 16).
import type { PrismaClient } from '@prisma/client';
import { asegurarMundoDePartida, ambitoFacciones } from '../mundoPartida.js';
import { CONFLICTO_ID, parseAgenda, sincronizarRelacionesConflicto } from '../worldAgenda.js';
import { diaDeFiccion } from '../avanceDiario.js';

export interface InformeMigracion {
  saveId: string;
  /// La partida no tenía aún su copia del mundo.
  clonaMundo: boolean;
  /// NPC que pasan a `NpcState.muerto` (retirados para siempre + muertos de mundo), sin repetir.
  npcsMuertos: number;
  /// Etapa del conflicto Serhu de su agenda (null si aún no tiene agenda).
  etapaConflicto: number | null;
  /// Día que queda en `WorldState.ultimoDiaSimulado` (el actual: no se simula el atraso de golpe).
  diaSimulado: number;
}

/// Migra una partida. `muertosDeMundo`: ids de `Npc` con `muertoEnMundo` de su mundo; no se sabe en
/// qué partida murieron, así que se dan por muertos en todas las existentes (decisión D-10).
export async function migrarPartida(
  prisma: PrismaClient,
  saveId: string,
  muertosDeMundo: string[],
  aplicar: boolean,
): Promise<InformeMigracion | null> {
  const save = await prisma.save.findUnique({
    where: { id: saveId },
    select: { worldId: true, npcsRetiredForever: true, worldState: { select: { mundoClonadoEn: true, agenda: true, fictionalMinutes: true, ultimoDiaSimulado: true } } },
  });
  if (!save?.worldState) return null;
  const ws = save.worldState;

  const retirados = save.npcsRetiredForever.length
    ? await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: save.npcsRetiredForever } }, select: { id: true } })
    : [];
  const npcIds = [...new Set([...retirados.map((n) => n.id), ...muertosDeMundo])];
  const etapa = parseAgenda(ws.agenda).find((e) => e.id === CONFLICTO_ID)?.stage ?? null;
  const diaSimulado = Math.max(ws.ultimoDiaSimulado, diaDeFiccion(ws.fictionalMinutes));
  const informe: InformeMigracion = { saveId, clonaMundo: !ws.mundoClonadoEn, npcsMuertos: npcIds.length, etapaConflicto: etapa, diaSimulado };
  if (!aplicar) return informe;

  await asegurarMundoDePartida(prisma, saveId);
  for (const npcId of npcIds) {
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      create: { saveId, npcId, scope: '', muerto: true, muertoEn: ws.fictionalMinutes },
      update: { muerto: true },
    });
  }
  if (etapa !== null) await sincronizarRelacionesConflicto(prisma, await ambitoFacciones(prisma, saveId), etapa);
  await prisma.worldState.update({ where: { saveId }, data: { ultimoDiaSimulado: diaSimulado } });
  return informe;
}

/// Migra todas las partidas (con `WorldState`) y, al aplicar, deja de marcar los muertos de mundo en
/// el `Npc` (ya están en cada partida existente; las nuevas los reciben vivos del catálogo).
export async function migrarTodasLasPartidas(prisma: PrismaClient, aplicar: boolean): Promise<{ informes: InformeMigracion[]; muertosDeMundoLiberados: number }> {
  const muertos = await prisma.npc.findMany({ where: { muertoEnMundo: true }, select: { id: true, worldId: true } });
  const porMundo = new Map<string, string[]>();
  for (const m of muertos) porMundo.set(m.worldId, [...(porMundo.get(m.worldId) ?? []), m.id]);

  const partidas = await prisma.save.findMany({ where: { worldState: { isNot: null } }, select: { id: true, worldId: true }, orderBy: { createdAt: 'asc' } });
  const informes: InformeMigracion[] = [];
  for (const p of partidas) {
    const informe = await migrarPartida(prisma, p.id, porMundo.get(p.worldId) ?? [], aplicar);
    if (informe) informes.push(informe);
  }
  if (aplicar && muertos.length > 0) {
    await prisma.npc.updateMany({ where: { id: { in: muertos.map((m) => m.id) } }, data: { muertoEnMundo: false } });
  }
  return { informes, muertosDeMundoLiberados: muertos.length };
}
