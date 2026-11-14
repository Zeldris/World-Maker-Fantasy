import { prisma } from '../lib/prisma.js';

/// P420 (ronda 2 de QA-289): Ulkha habló de «la traición de los Goirntes», un pueblo que no existe. Vocabulario de nombres
/// propios del mundo: las palabras en mayúscula del lore indexado y los nombres de NPC (y sus alias), lugares y facciones.
/// Se carga por mundo y caduca (NPC, lugares y facciones cambian en ejecución: Cronista, campamentos).
export const TTL_NOMBRES_MS = 5 * 60 * 1000;
const cache = new Map<string, { nombres: Promise<Set<string>>; cargadoEn: number }>();

export function nombresDelMundo(worldId: string): Promise<Set<string>> {
  const hit = cache.get(worldId);
  if (hit && Date.now() - hit.cargadoEn < TTL_NOMBRES_MS) return hit.nombres;
  const nombres = cargar(worldId);
  cache.set(worldId, { nombres, cargadoEn: Date.now() });
  nombres.catch(() => {
    if (cache.get(worldId)?.nombres === nombres) cache.delete(worldId);
  });
  return nombres;
}

/// Descarta lo cargado de un mundo (o de todos) para que la siguiente consulta lo recargue.
export function invalidarNombresDelMundo(worldId?: string): void {
  if (worldId) cache.delete(worldId);
  else cache.clear();
}

async function cargar(worldId: string): Promise<Set<string>> {
  const [lore, npcs, lugares, facciones] = await Promise.all([
    prisma.loreChunk.findMany({ where: { worldId }, select: { title: true, text: true } }),
    prisma.npc.findMany({ where: { worldId }, select: { name: true, aliases: true } }),
    prisma.location.findMany({ where: { worldId }, select: { name: true } }),
    prisma.faction.findMany({ where: { worldId }, select: { name: true } }),
  ]);
  const textos = [
    ...lore.flatMap((c) => [c.title, c.text]),
    ...npcs.flatMap((n) => [n.name, ...n.aliases]),
    ...lugares.map((l) => l.name),
    ...facciones.map((f) => f.name),
  ];
  return new Set(textos.flatMap(palabrasConMayuscula));
}

export function palabrasConMayuscula(texto: string): string[] {
  return (texto.match(/\p{Lu}[\p{L}'’-]+/gu) ?? []).map(normalizarNombre);
}

export function normalizarNombre(palabra: string): string {
  return palabra.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
