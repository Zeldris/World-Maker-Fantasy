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
// (`src/scripts/` y los servicios que usa la siembra) o la base no tiene catálogo, se vuelve a sembrar.
// En la CI no: el workflow ya lo hace en sus propios pasos.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as cargarEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

/// La carpeta `backend/`, se lance vitest desde donde se lance.
const RAIZ = fileURLToPath(new URL('.', import.meta.url));
// La misma base que usan Prisma y seed-catalog (leen `.env`); sin esto, la huella podía apuntar a otra.
cargarEnv({ path: join(RAIZ, '.env') });

type Progreso = { id: string; nivel: number; xp: number };

let prisma: PrismaClient;
let progreso: Progreso[] = [];
let interioresPrevios = new Set<string>();

const INTERIOR_DE_PRUEBA = 'cuartel-avanzado-interior-';

/// Huella de las fuentes del catálogo: los `.ts` de `src/scripts/` que no son tests y los servicios
/// que usa `seed-catalog.ts`.
const SERVICIOS_DE_LA_SIEMBRA = ['professionProgress.ts', 'factionRelations.ts', 'itemTaxonomy.ts'];
function huellaDelCatalogo(): string {
  const hash = createHash('sha256');
  const anadir = (ruta: string): void => void hash.update(ruta).update(readFileSync(ruta));
  const recorrer = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) anadir(ruta);
    }
  };
  recorrer(join(RAIZ, 'src', 'scripts'));
  for (const f of SERVICIOS_DE_LA_SIEMBRA) anadir(join(RAIZ, 'src', 'services', f));
  return hash.digest('hex');
}

/// Retro del PR #56: una suite cortada a medias (el tope de 10 minutos) deja sin devolver lo que un test
/// cambió en un NPC del catálogo (`faunaAbilities` sube el `aullador-rojo` a nivel 20), y al día siguiente
/// falla otro test sin relación. Si algún NPC del catálogo no coincide con `worldCatalog.ts` en nivel,
/// tope, clase o atributos, se vuelve a sembrar (la siembra los sobrescribe).
/// Postgres (jsonb) guarda las claves en otro orden: se comparan ordenadas.
function mismosAtributos(a: unknown, b: unknown): boolean {
  const ordenar = (o: unknown) => JSON.stringify(Object.entries((o ?? {}) as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)));
  return ordenar(a) === ordenar(b);
}

async function npcsDelCatalogoIntactos(db: PrismaClient): Promise<boolean> {
  const { fauna, npcs } = await import('./src/scripts/worldCatalog.js');
  const esperado = new Map([...fauna, ...npcs].map((n) => [n.slug, n]));
  const filas = await db.npc.findMany({ where: { slug: { in: [...esperado.keys()] } }, select: { slug: true, level: true, levelMax: true, clase: true, attributes: true } });
  return filas.every((f) => {
    const n = esperado.get(f.slug)!;
    return f.level === n.level && (n.levelMax == null || f.levelMax === n.levelMax) && (n.clase == null || f.clase === n.clase) && mismosAtributos(f.attributes, n.attributes);
  });
}

async function baseAlDia(db: PrismaClient): Promise<void> {
  if (process.env.CI) return;
  // Por nombre, no por número: una base con migraciones de otra rama puede tener tantas o más.
  const enDisco = readdirSync(join(RAIZ, 'prisma', 'migrations'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const aplicadas = new Set(
    await db.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
      .then((r) => r.map((f) => f.migration_name))
      .catch(() => [] as string[]),
  );
  if (enDisco.some((m) => !aplicadas.has(m))) execSync('npx prisma migrate deploy', { stdio: 'pipe', cwd: RAIZ });

  const base = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/tarkor').pathname.slice(1) || 'tarkor';
  const cache = join(RAIZ, 'node_modules', '.cache');
  const archivo = join(cache, `catalogo-${base}.sha256`);
  const huella = huellaDelCatalogo();
  const hayCatalogo = (await db.location.count({ where: { saveId: null } })) > 0;
  if (hayCatalogo && existsSync(archivo) && readFileSync(archivo, 'utf8') === huella && (await npcsDelCatalogoIntactos(db))) return;
  execSync('npm run -s seed-catalog', { stdio: 'pipe', cwd: RAIZ });
  mkdirSync(cache, { recursive: true });
  writeFileSync(archivo, huella);
}

export async function setup(): Promise<void> {
  prisma = new PrismaClient();
  await baseAlDia(prisma);
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
