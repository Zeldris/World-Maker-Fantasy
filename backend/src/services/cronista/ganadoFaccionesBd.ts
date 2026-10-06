// CR-55 (55f): carga, siembra y guarda el rebaño de una facción (las reglas, en `ganadoFacciones.ts`).
import type { Prisma } from '@prisma/client';
import { REPARTO_FACCIONES } from '../../scripts/repartoFacciones.js';
import { comidaDe, ESPECIES_GANADO, hayPasto, valorCrudo, type Sexo } from './ganaderia.js';
import { PLAZAS_GANADO_FACCION, REBANO_INICIAL, VERSION_REBANO, type Cohorte, type DatosDiaFaccion } from './ganadoFacciones.js';

type Tx = Prisma.TransactionClient;

export interface Rebano {
  cohortes: Cohorte[];
  /// Cohortes tal como se leyeron (para no reescribirlas si no cambian).
  leidas: string;
  /// Lo fijo de cada día (sin el día, los trabajadores ni las reservas de comida y agua).
  datos: Omit<DatosDiaFaccion, 'dia' | 'trabajadores' | 'comidaDisponible' | 'diasSinComer' | 'bebidaDisponible' | 'diasSinBeber'>;
  /// Lana, plumas… acumuladas en estos días, para su almacén.
  otros: Record<string, number>;
}

/// El rebaño de la facción de `fks`; siembra las versiones del rebaño inicial que le falten, con las edades
/// contadas desde `diaSiembra`. Null si no tiene ganado ni le toca.
export async function cargarRebano(
  tx: Tx,
  worldId: string,
  fks: { id: string; factionId: string | null; ganadoVersion: number; faction: { slug: string } | null },
  diaSiembra: number,
): Promise<Rebano | null> {
  const factionId = fks.factionId;
  const slug = fks.faction?.slug;
  if (!factionId || !slug) return null;
  if (fks.ganadoVersion < VERSION_REBANO) {
    const nuevas = (REBANO_INICIAL[slug] ?? []).filter((c) => c.version > fks.ganadoVersion);
    if (nuevas.length > 0) {
      await tx.ganadoFaccion.createMany({ data: nuevas.map((c) => ({ factionId, especie: c.especie, sexo: c.sexo, nacidoEnDia: diaSiembra - c.edadDias, cantidad: c.cantidad })) });
    }
    await tx.kingdomStats.update({ where: { id: fks.id }, data: { ganadoVersion: VERSION_REBANO } });
  }
  const filas = await tx.ganadoFaccion.findMany({ where: { factionId }, select: { especie: true, sexo: true, nacidoEnDia: true, cantidad: true } });
  if (filas.length === 0) return null;

  const especies = [...new Set(filas.map((f) => f.especie))];
  const fauna = await tx.npc.findMany({ where: { worldId, saveId: null, slug: { in: especies } }, select: { slug: true, faunaCategoria: true } });
  const productos = [...new Set(especies.flatMap((e) => ESPECIES_GANADO[e]?.produccion.map((p) => p.itemSlug) ?? []))];
  const catalogo = await tx.itemCatalog.findMany({ where: { worldId, slug: { in: productos } }, select: { slug: true, category: true, curaHambre: true } });
  const rendimientos = await tx.harvestYield.findMany({ where: { worldId, sourceSlug: { in: especies } }, select: { sourceSlug: true, cantidad: true, item: { select: { slug: true, category: true, curaHambre: true } } } });
  const carnePorAnimal: Record<string, number> = {};
  for (const r of rendimientos) {
    if (r.item.category !== 'alimento' && !(r.item.curaHambre ?? 0)) continue;
    carnePorAnimal[r.sourceSlug] = (carnePorAnimal[r.sourceSlug] ?? 0) + comidaDe(valorCrudo(r.item.slug, r.item.curaHambre), r.cantidad);
  }
  const region = REPARTO_FACCIONES.find((r) => r.slug === slug)?.region ?? null;
  return {
    cohortes: filas.map((f) => ({ ...f, sexo: f.sexo as Sexo })),
    leidas: firma(filas),
    datos: {
      pasto: hayPasto(region),
      plazas: PLAZAS_GANADO_FACCION[slug] ?? {},
      categoria: Object.fromEntries(fauna.map((f) => [f.slug, f.faunaCategoria])),
      carnePorAnimal,
      valorComestible: Object.fromEntries(catalogo.filter((c) => c.category === 'alimento').map((c) => [c.slug, valorCrudo(c.slug, c.curaHambre)])),
    },
    otros: {},
  };
}

/// Guarda las cohortes y deja en el almacén de la facción lo que no se come, hasta `tope` por objeto.
export async function guardarRebano(tx: Tx, factionId: string, rebano: Rebano, tope: number): Promise<void> {
  if (firma(rebano.cohortes) !== rebano.leidas) {
    await tx.ganadoFaccion.deleteMany({ where: { factionId } });
    if (rebano.cohortes.length > 0) await tx.ganadoFaccion.createMany({ data: rebano.cohortes.map((c) => ({ factionId, ...c })) });
  }
  const slugs = Object.keys(rebano.otros);
  if (slugs.length === 0) return;
  const save = await tx.faction.findUniqueOrThrow({ where: { id: factionId }, select: { worldId: true } });
  const catalogo = await tx.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: slugs } }, select: { slug: true, name: true, description: true } });
  const cuentas = await tx.almacenItem.groupBy({ by: ['catalogSlug'], where: { factionId, catalogSlug: { in: slugs } }, _count: { _all: true } });
  const hayDe = new Map(cuentas.map((c) => [c.catalogSlug, c._count._all]));
  for (const it of catalogo) {
    const hay = hayDe.get(it.slug) ?? 0;
    const n = Math.min(rebano.otros[it.slug] ?? 0, Math.max(0, tope - hay));
    if (n > 0) await tx.almacenItem.createMany({ data: Array.from({ length: n }, () => ({ factionId, name: it.name, description: it.description, catalogSlug: it.slug })) });
  }
}

/// Firma de un rebaño, para saber si ha cambiado.
function firma(cs: { especie: string; sexo: string; nacidoEnDia: number; cantidad: number }[]): string {
  return cs.map((c) => `${c.especie}|${c.sexo}|${c.nacidoEnDia}|${c.cantidad}`).sort().join(';');
}
