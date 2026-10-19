import type { PrismaClient } from '@prisma/client';
import { nombreOcultoPorRaza, nombreVisibleDeNpc } from '../dynamicMode.js';

type Db = Pick<PrismaClient, 'npc' | 'discoveredEntity'>;

/// P200 (QA-27): quién encarga una misión, con el nombre con que la jugadora lo ve. La descripción se
/// guarda al crearla con el nombre real («Maestro Herrero Serhu: «…»»); si aún no lo ha descubierto, se
/// enseña por su raza («Orco desconocido: «…»»), como en el mapa y en el menú (P165). Sin NPC, la facción.
export async function conQuienVisible(db: Db, saveId: string, huecos: unknown, descripcion: string): Promise<{ descripcion: string; encarga: string | null }> {
  const h = huecos as { npc?: { id: string; nombre: string }; faccion?: { nombre: string } } | null;
  if (!h?.npc) return { descripcion, encarga: h?.faccion?.nombre ?? null };
  const npc = await db.npc.findUnique({ where: { id: h.npc.id }, select: { slug: true, name: true, kind: true, raza: true, genero: true } });
  if (!npc) return { descripcion, encarga: h.npc.nombre };
  const { nombre, oculto } = await nombreVisibleDeNpc(db, saveId, npc);
  if (!oculto) return { descripcion, encarga: h.npc.nombre };
  const prefijo = `${h.npc.nombre}: «`;
  return { descripcion: descripcion.startsWith(prefijo) ? `${nombre}: «${descripcion.slice(prefijo.length)}` : descripcion, encarga: nombre };
}

/// Lo mismo para varias misiones a la vez (el detalle de la partida): dos consultas en total, no dos por misión.
export async function conQuienVisibleEnLote(
  db: Db,
  saveId: string,
  misiones: { id: string; huecos: unknown; descripcion: string }[],
): Promise<Map<string, { descripcion: string; encarga: string | null }>> {
  const conNpc = misiones.map((m) => ({ ...m, h: m.huecos as { npc?: { id: string; nombre: string }; faccion?: { nombre: string } } | null }));
  const ids = [...new Set(conNpc.flatMap((m) => (m.h?.npc ? [m.h.npc.id] : [])))];
  const npcs = ids.length > 0 ? await db.npc.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, kind: true, raza: true, genero: true } }) : [];
  const principales = npcs.filter((n) => n.kind === 'PRINCIPAL');
  const vistos = new Set(
    principales.length > 0
      ? (await db.discoveredEntity.findMany({ where: { saveId, entityType: 'npc', entitySlug: { in: principales.map((n) => n.slug) } }, select: { entitySlug: true } })).map((d) => d.entitySlug)
      : [],
  );
  const npcPorId = new Map(npcs.map((n) => [n.id, n]));
  const resultado = new Map<string, { descripcion: string; encarga: string | null }>();
  for (const m of conNpc) {
    const npc = m.h?.npc ? npcPorId.get(m.h.npc.id) : undefined;
    if (!m.h?.npc) {
      resultado.set(m.id, { descripcion: m.descripcion, encarga: m.h?.faccion?.nombre ?? null });
      continue;
    }
    if (!npc || npc.kind !== 'PRINCIPAL' || vistos.has(npc.slug)) {
      resultado.set(m.id, { descripcion: m.descripcion, encarga: m.h.npc.nombre });
      continue;
    }
    const nombre = nombreOcultoPorRaza(npc.raza, npc.genero);
    const prefijo = `${m.h.npc.nombre}: «`;
    resultado.set(m.id, { descripcion: m.descripcion.startsWith(prefijo) ? `${nombre}: «${m.descripcion.slice(prefijo.length)}` : m.descripcion, encarga: nombre });
  }
  return resultado;
}
