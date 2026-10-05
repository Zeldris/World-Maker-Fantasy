// Tablones de avisos (CR-40 paso 40c, hito 0.2 — Q11-Q12). Cada ciudad con interior tiene el suyo en el
// catálogo (`worldCatalog.ts`, `TABLON_AVISOS_SLUG`), y el clonado del mundo de la partida
// (`mundoPartida.ts`) se lo copia a las facciones de cada partida nueva. Las partidas clonadas antes
// de que existiera lo reciben aquí, de forma perezosa e idempotente.
import type { Prisma, PrismaClient } from '@prisma/client';
import { copiaDeFila } from '../mundoPartida.js';
import { nombreDeTablon } from '../../scripts/worldCatalog.js';

type Tx = Prisma.TransactionClient;

export const TABLON_RECIPE_KEY = 'tablon-avisos';

/// Copia a las facciones de la partida los tablones del catálogo que aún no tienen. Devuelve cuántos.
export async function asegurarTablonesDePartida(tx: Tx, saveId: string): Promise<number> {
  const copias = await tx.faction.findMany({
    where: { saveId, origenSlug: { not: null }, disueltaEn: null, buildings: { none: { recipeKey: TABLON_RECIPE_KEY } } },
    select: { id: true, origenSlug: true, worldId: true },
  });
  if (copias.length === 0) return 0;
  const plantillas = await tx.building.findMany({
    where: { recipeKey: TABLON_RECIPE_KEY, faction: { worldId: copias[0]!.worldId, saveId: null, slug: { in: copias.map((c) => c.origenSlug!) } } },
    include: { faction: { select: { slug: true } } },
  });
  let creados = 0;
  for (const copia of copias) {
    const plantilla = plantillas.find((p) => p.faction?.slug === copia.origenSlug);
    if (!plantilla) continue;
    const { faction: _f, ...fila } = plantilla;
    await tx.building.create({ data: copiaDeFila('Building', fila, { factionId: copia.id }) as Prisma.BuildingUncheckedCreateInput });
    creados++;
  }
  return creados;
}

/// Tablones de avisos activos en el mundo de la partida, con su facción y su lugar. El del Reino de
/// la jugadora (construido con la receta `tablon-avisos`, cuelga de la partida) va marcado.
export async function tablonesDePartida(tx: Tx, saveId: string) {
  return tx.building.findMany({
    where: {
      recipeKey: TABLON_RECIPE_KEY, status: 'ACTIVO',
      OR: [{ saveId }, { faction: { saveId, origenSlug: { not: null }, disueltaEn: null } }],
    },
    select: { id: true, saveId: true, locationId: true, faction: { select: { id: true, slug: true, name: true, raza: true } }, location: { select: { name: true, region: true } } },
    orderBy: { id: 'asc' },
  });
}

export interface TablonEnLugar {
  buildingId: string;
  nombre: string;
  /// Facción que cuelga los avisos; null en el tablón del Reino (muestra los de sus aliados).
  faccion: string | null;
}

/// CR-43: cada pueblo llama al tablón a su manera; el del Reino, como el pueblo de la jugadora.
async function nombreVisible(db: Tx | PrismaClient, saveId: string, razaFaccion: string | null): Promise<string> {
  if (razaFaccion) return nombreDeTablon(razaFaccion);
  const save = await db.save.findUnique({ where: { id: saveId }, select: { raza: true } });
  return nombreDeTablon(save?.raza);
}

/// El tablón de avisos activo en un lugar de la partida (de una facción de su mundo o del Reino).
export async function tablonEnLugar(db: Tx | PrismaClient, saveId: string, locationId: string): Promise<TablonEnLugar | null> {
  const b = await db.building.findFirst({
    where: {
      recipeKey: TABLON_RECIPE_KEY, status: 'ACTIVO', locationId,
      OR: [{ saveId }, { faction: { saveId, origenSlug: { not: null }, disueltaEn: null } }],
    },
    select: { id: true, name: true, faction: { select: { name: true, raza: true } } },
  });
  return b ? { buildingId: b.id, nombre: await nombreVisible(db, saveId, b.faction?.raza ?? null), faccion: b.faction?.name ?? null } : null;
}

export interface AvisoInfo {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  faccion: string;
  recompensa: unknown;
  retiraEn: number;
}

/// Avisos a la vista en un tablón. El del Reino muestra los de las facciones con tratado o alianza con
/// él (Q12). Null si el tablón no es de la partida.
export async function avisosDeTablon(db: Tx | PrismaClient, saveId: string, buildingId: string): Promise<{ tablon: TablonEnLugar; avisos: AvisoInfo[] } | null> {
  const b = await db.building.findFirst({
    where: { id: buildingId, recipeKey: TABLON_RECIPE_KEY, OR: [{ saveId }, { faction: { saveId } }] },
    select: { id: true, name: true, saveId: true, factionId: true, faction: { select: { name: true, raza: true } } },
  });
  if (!b) return null;
  let donde: Prisma.MisionOfrecidaWhereInput = { buildingId: b.id };
  if (b.saveId) {
    const reino = await db.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { id: true } });
    const aliadas = reino
      ? (await db.factionRelation.findMany({
          where: { type: { in: ['ALIANZA', 'TRATADO_COMERCIAL'] }, OR: [{ sourceFactionId: reino.id }, { targetFactionId: reino.id }] },
          select: { sourceFactionId: true, targetFactionId: true },
        })).map((r) => (r.sourceFactionId === reino.id ? r.targetFactionId : r.sourceFactionId))
      : [];
    donde = { buildingId: { not: null }, factionId: { in: aliadas } };
  }
  const filas = await db.misionOfrecida.findMany({
    where: { saveId, estado: 'DISPONIBLE', ...donde },
    orderBy: { createdAt: 'asc' },
  });
  const nombres = new Map((await db.faction.findMany({ where: { id: { in: [...new Set(filas.map((f) => f.factionId))] } }, select: { id: true, name: true } })).map((f) => [f.id, f.name]));
  return {
    tablon: { buildingId: b.id, nombre: await nombreVisible(db, saveId, b.faction?.raza ?? null), faccion: b.faction?.name ?? null },
    avisos: filas.map((f) => ({ id: f.id, titulo: f.titulo, descripcion: f.descripcion, tipo: f.tipo, faccion: nombres.get(f.factionId) ?? '', recompensa: f.recompensa, retiraEn: f.retiraEn })),
  };
}
