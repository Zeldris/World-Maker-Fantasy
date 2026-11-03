import { prisma } from '../lib/prisma.js';

/// P420 (ronda 2 de QA-289): Ulkha habló de «la traición de los Goirntes», un pueblo que no existe. Vocabulario de nombres
/// propios del mundo: las palabras en mayúscula del lore indexado y los nombres de NPC (y sus alias), lugares y facciones.
/// Se carga una vez por mundo (el lore solo cambia al reindexar, que reinicia el backend).
const cache = new Map<string, Promise<Set<string>>>();

export function nombresDelMundo(worldId: string): Promise<Set<string>> {
  let nombres = cache.get(worldId);
  if (!nombres) {
    nombres = cargar(worldId);
    cache.set(worldId, nombres);
    nombres.catch(() => cache.delete(worldId));
  }
  return nombres;
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
