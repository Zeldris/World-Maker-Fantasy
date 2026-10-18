import type { PrismaClient } from '@prisma/client';
import { nombreVisibleDeNpc } from '../dynamicMode.js';

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
