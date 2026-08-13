import { prisma } from '../../lib/prisma.js';
import { startingQuestsFor } from '../../services/startingQuests.js';

/// Resuelve `targetNpcSlug` (startingQuests.ts) al id real del Npc de catálogo de este mundo —
/// mismo mecanismo que narrador.ts usa para misiones propuestas en juego (Quest.targetNpcId),
/// pero aquí se resuelve de una vez para las misiones "de serie" en vez de por coincidencia de
/// texto contra la escena. Compartido entre POST /saves y POST /saves/:id/restart (creation.ts) —
/// las dos rutas de "arranca en Día 1" necesitan exactamente lo mismo.
export async function buildStartingQuestsData(worldId: string, characterName: string) {
  const quests = startingQuestsFor(characterName);
  const npcSlugs = quests.map((q) => q.targetNpcSlug).filter((slug): slug is string => Boolean(slug));
  const targetNpcs = npcSlugs.length ? await prisma.npc.findMany({ where: { worldId, slug: { in: npcSlugs } } }) : [];
  const npcIdBySlug = new Map(targetNpcs.map((npc) => [npc.slug, npc.id]));
  return quests.map((q) => ({
    title: q.title,
    description: q.description,
    targetNpcId: q.targetNpcSlug ? npcIdBySlug.get(q.targetNpcSlug) : undefined,
    objetivo: q.objetivo,
    rewardXp: q.rewardXp,
    rewardItems: q.rewardItems ?? [],
  }));
}

/// Forma de LogEntry que espera el frontend — compartida entre GET /saves/:id (ventana de 24h,
/// detail.ts) y GET /saves/:id/diario (registro completo, log.ts): las dos aplanan la misma fila
/// de Prisma al mismo shape, solo cambia qué ventana de filas se lee antes de mapear.
export function toFrontendLogEntry(entry: {
  id: string;
  channel: string;
  text: string;
  roll: unknown;
  isPlayerAction: boolean;
  timeLabel: string;
  createdAt: Date;
  xpDelta?: number | null;
  entityBannerType?: string | null;
  entityBannerSlug?: string | null;
  combate?: boolean;
  travelInterrupted?: boolean;
  combatExchange?: unknown;
}) {
  return {
    id: entry.id,
    channel: entry.channel.toLowerCase(),
    text: entry.text,
    timeLabel: entry.timeLabel,
    roll: entry.roll ?? undefined,
    // Bug real jugando en vivo (2026-08-13) — sin esto, recargar la partida perdía el lado
    // "Enemigo" del intercambio de combate (ver comentario de la columna en schema.prisma).
    combatExchange: entry.combatExchange ?? undefined,
    isPlayerAction: entry.isPlayerAction || undefined,
    xpDelta: entry.xpDelta ?? undefined,
    // Persistencia de banners de entidad (rework 2026-07-24) — solo la referencia (tipo+slug); el
    // frontend resuelve la imagen real contra la Enciclopedia ya cargada, nunca se guarda una URL.
    entityBannerType: entry.entityBannerType ?? undefined,
    entityBannerSlug: entry.entityBannerSlug ?? undefined,
    createdAt: entry.createdAt.toISOString(),
    // Rediseño de la vista de combate (2026-07-28) — fondo rojo en el frontend.
    combate: entry.combate || undefined,
    // Eventos de viaje interactivos (2026-08-05) — fondo ámbar en el frontend, mismo criterio.
    travelInterrupted: entry.travelInterrupted || undefined,
  };
}
