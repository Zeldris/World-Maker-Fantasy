// QA-8 (retro de la Fase D del 0.2, 2026-10-05): los tests con Postgres real comparten el catálogo y
// algunos lo cambian sin devolverlo. Este `globalSetup` del proyecto `bd-real` guarda al empezar lo
// que se sabe que se ensucia y lo deja como estaba al terminar:
//
// - El progreso de oficio de los NPC (`NpcProfessionProgress`): las expediciones de cada avance diario
//   dan XP a NPC del catálogo; tras varias pasadas de la suite llegaba al tope y los tests que esperan
//   «la XP sube» fallaban («expected 2399 to be greater than 2399»).
// - Los interiores de cuartel avanzado que crean los tests (`cuartel-avanzado-interior-<id>`). Solo se
//   borran los creados durante la suite: los anteriores pueden ser de partidas reales de desarrollo.
//
// QA-38 (retro de QA-27, 2026-10-12): al traer `main`, la base `tarkor` se quedaba vieja (sin la columna
// nueva de una migración, con el catálogo de antes) y los tests fallaban con errores que no decían eso.
// Antes de empezar se aplican las migraciones pendientes y, si cambiaron las fuentes del catálogo
// (`src/scripts/`), se vuelve a sembrar. En la CI no: el workflow ya lo hace en sus propios pasos.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

type Progreso = { id: string; nivel: number; xp: number };

let prisma: PrismaClient;
let progreso: Progreso[] = [];
let interioresPrevios = new Set<string>();

const INTERIOR_DE_PRUEBA = 'cuartel-avanzado-interior-';

/// Huella de las fuentes del catálogo: cualquier `.ts` de `src/scripts/` que no sea un test.
function huellaDelCatalogo(): string {
  const hash = createHash('sha256');
  const recorrer = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) hash.update(ruta).update(readFileSync(ruta));
    }
  };
  recorrer('src/scripts');
  return hash.digest('hex');
}

function baseAlDia(): void {
  if (process.env.CI) return;
  execSync('npx prisma migrate deploy', { stdio: 'pipe' });
  const base = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/tarkor').pathname.slice(1) || 'tarkor';
  const archivo = join('node_modules', '.cache', `catalogo-${base}.sha256`);
  const huella = huellaDelCatalogo();
  if (existsSync(archivo) && readFileSync(archivo, 'utf8') === huella) return;
  execSync('npm run -s seed-catalog', { stdio: 'pipe' });
  mkdirSync(join('node_modules', '.cache'), { recursive: true });
  writeFileSync(archivo, huella);
}

export async function setup(): Promise<void> {
  baseAlDia();
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
