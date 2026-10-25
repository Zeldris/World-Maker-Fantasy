import { Prisma, type EquipSlot, type PrismaClient } from '@prisma/client';
import { equipSlotFamily } from './equipment.js';

/// Resincronización de objetos de catálogo en partidas existentes (Fase B del plan 0.1,
/// 2026-09-29). `InventoryItem` y `AlmacenItem` COPIAN `statBonuses` (y el inventario, la ranura
/// equipada) al adquirir/craftear el objeto; el backfill del seed solo rellena los null, así que
/// tras un rebalanceo del catálogo las copias viejas quedaban con stats obsoletos, y un objeto
/// pasado a cosmético podía seguir equipado en una ranura que el catálogo ya no permite.

type StatMap = Record<string, number>;

export interface FilaSincronizable {
  catalogSlug: string | null;
  statBonuses: unknown;
  /// Solo InventoryItem — AlmacenItem no tiene ranura equipada.
  slot?: EquipSlot | null;
}

export interface EntradaCatalogo {
  statBonuses: unknown;
  equipSlot: EquipSlot | null;
}

export interface CambiosSincronizacion {
  /// Presente solo si hay que reescribir statBonuses (null = dejarlo sin bonus).
  statBonuses?: StatMap | null;
  /// true = pasar a la mochila (slot null, sin compañero/súbdito).
  desequipar?: true;
}

/// Mapa de bonus normalizado: null/undefined/{} → null; si no, entradas numéricas ordenadas.
function normalizar(value: unknown): StatMap | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number')
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? null : (Object.fromEntries(entries) as StatMap);
}

function iguales(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizar(a)) === JSON.stringify(normalizar(b));
}

/// Función pura. `catalogo` = fila de ItemCatalog de ese `catalogSlug` (undefined si ya no existe
/// → no se toca nada). Toda diferencia de bonus se resetea al catálogo, también en lo fabricado:
/// desde `QA-240` (2026-10-25, «el catálogo manda») la receta ya no fija bonus propios, así que
/// una copia fabricada con los bonus viejos de su receta vuelve a los de su ficha.
export function cambiosParaSincronizar(
  fila: FilaSincronizable,
  catalogo: EntradaCatalogo | undefined,
): CambiosSincronizacion | null {
  if (!fila.catalogSlug || !catalogo) return null;
  const cambios: CambiosSincronizacion = {};

  if (!iguales(fila.statBonuses, catalogo.statBonuses)) cambios.statBonuses = normalizar(catalogo.statBonuses);

  // Misma validación que el equipar (routes/saves/inventario.ts): la ranura debe estar en la
  // familia de la equipSlot del catálogo; sin equipSlot no es equipable.
  if (fila.slot) {
    const permitidas = catalogo.equipSlot ? equipSlotFamily(catalogo.equipSlot) : [];
    if (!permitidas.includes(fila.slot)) cambios.desequipar = true;
  }

  return Object.keys(cambios).length > 0 ? cambios : null;
}

export interface ResumenSincronizacion {
  revisados: number;
  inventarioActualizados: number;
  inventarioDesequipados: number;
  almacenActualizados: number;
}

const jsonInput = (v: StatMap | null) => (v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

/// Recorre por lotes (cursor por id) las filas con `catalogSlug`. Idempotente: tras una pasada,
/// otra no encuentra cambios. Un objeto desequipado sigue en el inventario (solo pierde ranura).
export async function sincronizarObjetosDeCatalogo(
  prisma: PrismaClient,
  opts: { tamanoLote?: number } = {},
): Promise<ResumenSincronizacion> {
  const take = opts.tamanoLote ?? 500;
  const resumen: ResumenSincronizacion = { revisados: 0, inventarioActualizados: 0, inventarioDesequipados: 0, almacenActualizados: 0 };

  const catalogoPorMundo = new Map<string, Map<string, EntradaCatalogo>>();
  const catalogoDe = async (worldId: string) => {
    let m = catalogoPorMundo.get(worldId);
    if (!m) {
      const rows = await prisma.itemCatalog.findMany({ where: { worldId }, select: { slug: true, statBonuses: true, equipSlot: true } });
      m = new Map(rows.map((r) => [r.slug, { statBonuses: r.statBonuses, equipSlot: r.equipSlot }]));
      catalogoPorMundo.set(worldId, m);
    }
    return m;
  };

  let cursor: string | undefined;
  for (;;) {
    const lote = await prisma.inventoryItem.findMany({
      where: { catalogSlug: { not: null } },
      select: { id: true, catalogSlug: true, statBonuses: true, slot: true, save: { select: { worldId: true } } },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (lote.length === 0) break;
    cursor = lote[lote.length - 1].id;
    for (const row of lote) {
      resumen.revisados++;
      const cat = (await catalogoDe(row.save.worldId)).get(row.catalogSlug!);
      const c = cambiosParaSincronizar(row, cat);
      if (!c) continue;
      await prisma.inventoryItem.update({
        where: { id: row.id },
        data: {
          ...(c.statBonuses !== undefined ? { statBonuses: jsonInput(c.statBonuses) } : {}),
          ...(c.desequipar ? { slot: null, companionId: null, subjectId: null } : {}),
        },
      });
      if (c.statBonuses !== undefined) resumen.inventarioActualizados++;
      if (c.desequipar) resumen.inventarioDesequipados++;
    }
  }

  let cursorAlmacen: string | undefined;
  for (;;) {
    const lote = await prisma.almacenItem.findMany({
      where: { catalogSlug: { not: null } },
      select: { id: true, catalogSlug: true, statBonuses: true, save: { select: { worldId: true } }, faction: { select: { worldId: true } } },
      orderBy: { id: 'asc' },
      take,
      ...(cursorAlmacen ? { skip: 1, cursor: { id: cursorAlmacen } } : {}),
    });
    if (lote.length === 0) break;
    cursorAlmacen = lote[lote.length - 1].id;
    for (const row of lote) {
      resumen.revisados++;
      const worldId = row.save?.worldId ?? row.faction?.worldId;
      if (!worldId) continue;
      const cat = (await catalogoDe(worldId)).get(row.catalogSlug!);
      const c = cambiosParaSincronizar(row, cat);
      if (!c || c.statBonuses === undefined) continue;
      await prisma.almacenItem.update({ where: { id: row.id }, data: { statBonuses: jsonInput(c.statBonuses) } });
      resumen.almacenActualizados++;
    }
  }

  return resumen;
}
