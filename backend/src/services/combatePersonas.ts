// Grupos de personas en combate de varios (CR-49, hito 0.2 — ronda 2 de la Fase G, 2026-10-05).
// Hasta ahora solo la caza abría combates de varios, y siempre contra fauna: una persona peleaba
// siempre sola (1v1). Ahora, al abrir combate contra una persona:
// - si es de una banda (su punto del mapa de zona tiene `cantidad` > 1), pelea toda la banda;
// - si no, se unen los de su misma facción que estén cerca (como en BG3): hasta 3 a pocas casillas
//   y, en el interior de una ciudad, su guardia.
// El combate usa el mismo motor y panel que la caza en grupo (`iniciarCombatEncounter`).
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AttributeBlock } from './dice.js';
import { iniciarCombatEncounter, type CombatienteInicial } from './combateMultipleOrquestacion.js';
import { MAX_COMBATIENTES_POR_BANDO } from './combateMultiple.js';
import { scopeFor } from './npcScene.js';
import { celdaDePixel } from './zonaPosicion.js';
import { lockRowForUpdate } from '../routes/saves/shared.js';

type Db = PrismaClient | Prisma.TransactionClient;

/// Casillas (distancia de Chebyshev) a las que un aliado de la misma facción se une al combate.
export const RADIO_AYUDA_CASILLAS = 3;
/// Como mucho tantos aliados cercanos (sin contar la guardia de un interior).
export const MAX_ALIADOS_CERCANOS = 3;

export interface MiembroDeGrupo {
  npcId: string;
  nombre: string;
  scope: string;
  destreza: number;
  inteligencia: number;
  /// Varios miembros comparten el mismo NPC de catálogo (banda): su condición va en el participante.
  esGrupo: boolean;
}

type Punto = { x: number; y: number };
const casillas = (a: Punto, b: Punto) => {
  const ca = celdaDePixel(a);
  const cb = celdaDePixel(b);
  return Math.max(Math.abs(ca.col - cb.col), Math.abs(ca.row - cb.row));
};
const esGuardia = (slug: string) => /guard/i.test(slug);

/// Puro: de los candidatos de la misma facción, quién se une: la guardia de un interior siempre y,
/// además, los más cercanos dentro del radio, hasta llenar el bando (`MAX_COMBATIENTES_POR_BANDO`).
export function aliadosQueSeUnen<T extends { slug: string; punto: Punto | null }>(
  objetivo: Punto | null,
  candidatos: T[],
  enInterior: boolean,
): T[] {
  const guardia = enInterior ? candidatos.filter((c) => esGuardia(c.slug)) : [];
  const cercanos = candidatos
    .filter((c) => !guardia.includes(c) && objetivo && c.punto && casillas(objetivo, c.punto) <= RADIO_AYUDA_CASILLAS)
    .sort((a, b) => casillas(objetivo!, a.punto!) - casillas(objetivo!, b.punto!))
    .slice(0, MAX_ALIADOS_CERCANOS);
  return [...guardia, ...cercanos].slice(0, MAX_COMBATIENTES_POR_BANDO - 1);
}

/// Quiénes pelean junto a `objetivo` (él incluido). Un solo miembro = combate 1v1 de siempre.
export async function grupoDePersona(
  db: Db,
  p: { saveId: string; worldId: string; locationId: string | null; objetivo: { id: string; slug: string; kind: string; faction: string | null; raza: string | null; attributes: unknown; name: string } },
): Promise<MiembroDeGrupo[]> {
  const { objetivo, locationId } = p;
  const atr = objetivo.attributes as AttributeBlock;
  const propio: MiembroDeGrupo = { npcId: objetivo.id, nombre: objetivo.name, scope: scopeFor(objetivo.kind as never, locationId), destreza: atr.destreza, inteligencia: atr.inteligencia, esGrupo: false };
  if (!objetivo.raza || !locationId) return [propio];

  const puntos = await db.zonePoint.findMany({
    where: { locationId, tipo: 'NPC', activo: true, OR: [{ saveId: p.saveId }, { saveId: null }] },
    select: { targetSlug: true, x: true, y: true, cantidad: true, saveId: true },
  });
  // Lo de la partida manda sobre el catálogo para el mismo NPC.
  const puntoDe = new Map<string, (typeof puntos)[number]>();
  for (const pt of puntos) if (!puntoDe.has(pt.targetSlug) || pt.saveId) puntoDe.set(pt.targetSlug, pt);

  // Banda: su punto del mapa tiene varios.
  const suPunto = puntoDe.get(objetivo.slug);
  if (suPunto && suPunto.cantidad > 1) {
    const n = Math.min(suPunto.cantidad, MAX_COMBATIENTES_POR_BANDO);
    return Array.from({ length: n }, () => ({ ...propio, esGrupo: true }));
  }
  if (!objetivo.faction) return [propio];

  // Aliados: personas de su facción con punto en esta zona, vivas y presentes.
  const slugs = [...puntoDe.keys()].filter((s) => s !== objetivo.slug);
  if (slugs.length === 0) return [propio];
  const npcs = await db.npc.findMany({
    where: { slug: { in: slugs }, faction: objetivo.faction, raza: { not: null }, OR: [{ worldId: p.worldId, saveId: null }, { saveId: p.saveId }] },
    select: { id: true, slug: true, name: true, kind: true, attributes: true },
  });
  const estados = await db.npcState.findMany({
    where: { saveId: p.saveId, npcId: { in: npcs.map((n) => n.id) } },
    select: { npcId: true, condicionFisica: true, muerto: true, zonaAusenteHastaMinutes: true, zonaLocationId: true },
  });
  const ws = await db.worldState.findUnique({ where: { saveId: p.saveId }, select: { fictionalMinutes: true } });
  const ahora = ws?.fictionalMinutes ?? 0;
  const fuera = new Set(
    estados
      .filter((e) => e.muerto || e.condicionFisica === 'CONVALECIENTE' || e.condicionFisica === 'MUERTO' || (e.zonaLocationId === locationId && (e.zonaAusenteHastaMinutes ?? 0) > ahora))
      .map((e) => e.npcId),
  );
  const location = await db.location.findUnique({ where: { id: locationId }, select: { slug: true } });
  const candidatos = npcs.filter((n) => !fuera.has(n.id)).map((n) => ({ ...n, punto: puntoDe.get(n.slug) ?? null }));
  const unidos = aliadosQueSeUnen(suPunto ?? null, candidatos, !!location?.slug.endsWith('-interior'));
  return [
    propio,
    ...unidos.map((n) => {
      const a = n.attributes as AttributeBlock;
      return { npcId: n.id, nombre: n.name, scope: scopeFor(n.kind as never, locationId), destreza: a.destreza, inteligencia: a.inteligencia, esGrupo: false };
    }),
  ];
}

/// Abre el combate de varios de la jugadora (y sus compañeros de grupo) contra `miembros`. Null si
/// ya había uno en curso.
export async function abrirCombateDePersonas(
  prisma: PrismaClient,
  save: { id: string; characterName: string; attributes: AttributeBlock; fictionalMinutes: number; timeLabel: string },
  miembros: MiembroDeGrupo[],
): Promise<{ encounterId: string } | null> {
  const companeros = await prisma.companion.findMany({
    where: { saveId: save.id, combatGroupSlotIndex: 0, condicionFisica: { not: 'MUERTO' } },
    select: { id: true, name: true, attributes: true },
  });
  const combatientes: (CombatienteInicial & { destreza: number; inteligencia: number })[] = [
    { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: save.attributes.destreza, inteligencia: save.attributes.inteligencia, nombre: save.characterName },
    ...companeros
      .filter((c) => c.attributes)
      .slice(0, MAX_COMBATIENTES_POR_BANDO - 1)
      .map((c) => {
        const a = c.attributes as AttributeBlock;
        return { bando: 'JUGADOR' as const, tipo: 'COMPANION' as const, companionId: c.id, destreza: a.destreza, inteligencia: a.inteligencia, nombre: c.name };
      }),
    ...miembros.slice(0, MAX_COMBATIENTES_POR_BANDO).map((m) => ({
      bando: 'ENEMIGO' as const, tipo: 'NPC' as const, npcId: m.npcId, npcScope: m.scope, destreza: m.destreza, inteligencia: m.inteligencia, esGrupo: m.esGrupo, nombre: m.nombre,
    })),
  ];
  return prisma.$transaction(async (tx) => {
    await lockRowForUpdate(tx, 'Save', save.id, ['id']);
    if (await tx.combatEncounter.findFirst({ where: { saveId: save.id, estado: 'EN_CURSO', jugable: true }, select: { id: true } })) return null;
    const { encounterId, iniciativa } = await iniciarCombatEncounter(tx, save.id, combatientes);
    const nombres = [...new Set(miembros.map((m) => m.nombre))].join(', ');
    await tx.logEntry.create({
      data: {
        saveId: save.id, channel: 'CHARACTER', isSystemMessage: true, timeLabel: save.timeLabel, fictionalMinutes: save.fictionalMinutes,
        text: `Comienza el combate contra ${miembros.length > 1 ? `un grupo (${nombres})` : nombres}: cada combatiente tira iniciativa.`,
        roll: { kind: 'combate-grupo', engagement: [], iniciativa } as unknown as Prisma.InputJsonValue,
      },
    });
    return { encounterId };
  });
}
