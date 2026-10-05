// Tablones de avisos (CR-40 paso 40c, hito 0.2 — Q11-Q12). Cada ciudad con interior tiene el suyo en el
// catálogo (`worldCatalog.ts`, `TABLON_AVISOS_SLUG`), y el clonado del mundo de la partida
// (`mundoPartida.ts`) se lo copia a las facciones de cada partida nueva. Las partidas clonadas antes
// de que existiera lo reciben aquí, de forma perezosa e idempotente.
import type { Prisma } from '@prisma/client';
import { copiaDeFila } from '../mundoPartida.js';

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
