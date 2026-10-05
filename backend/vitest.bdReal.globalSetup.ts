// QA-8 (retro de la Fase D del 0.2, 2026-10-05): los tests con Postgres real comparten el catálogo y
// algunos lo cambian sin devolverlo. Este `globalSetup` del proyecto `bd-real` guarda al empezar lo
// que se sabe que se ensucia y lo deja como estaba al terminar:
//
// - El progreso de oficio de los NPC (`NpcProfessionProgress`): las expediciones de cada avance diario
//   dan XP a NPC del catálogo; tras varias pasadas de la suite llegaba al tope y los tests que esperan
//   «la XP sube» fallaban («expected 2399 to be greater than 2399»).
// - Los interiores de cuartel avanzado que crean los tests (`cuartel-avanzado-interior-<id>`). Solo se
//   borran los creados durante la suite: los anteriores pueden ser de partidas reales de desarrollo.
import { PrismaClient } from '@prisma/client';

type Progreso = { id: string; nivel: number; xp: number };

let prisma: PrismaClient;
let progreso: Progreso[] = [];
let interioresPrevios = new Set<string>();

const INTERIOR_DE_PRUEBA = 'cuartel-avanzado-interior-';

export async function setup(): Promise<void> {
  prisma = new PrismaClient();
  progreso = await prisma.npcProfessionProgress.findMany({ select: { id: true, nivel: true, xp: true } });
  interioresPrevios = new Set((await prisma.location.findMany({ where: { slug: { startsWith: INTERIOR_DE_PRUEBA } }, select: { id: true } })).map((l) => l.id));
}

export async function teardown(): Promise<void> {
  const ids = progreso.map((p) => p.id);
  await prisma.npcProfessionProgress.deleteMany({ where: { id: { notIn: ids } } });
  for (const p of progreso) await prisma.npcProfessionProgress.updateMany({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
  await prisma.location.deleteMany({ where: { slug: { startsWith: INTERIOR_DE_PRUEBA }, id: { notIn: [...interioresPrevios] } } });
  await prisma.$disconnect();
}
