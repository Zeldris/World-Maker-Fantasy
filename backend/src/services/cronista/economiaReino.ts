// Economía de supervivencia del Reino (CR-53, hito 0.3 — Fase D, decisiones Q1-Q6 de la usuaria del
// 2026-10-06; Medieval Dynasty y D&D: cada boca bebe y come a diario, el pozo es la fuente de agua).
// Paso 53a: el agua que entra (pozos y fuente natural) y los topes del almacén por categoría.
import type { Prisma } from '@prisma/client';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import type { SuministrosDia } from '../kingdomTick.js';
import { locationTerrainTags } from '../../scripts/worldCatalog.js';

type Tx = Prisma.TransactionClient;

/// Q2: lo que guarda el Reino sin ningún almacén (el Ayuntamiento o el campamento).
export const BASE_ALMACEN = { comida: 60, bebida: 60, materiales: 60 };
/// Q1: una fuente natural junto al Ayuntamiento (Los Manaderos, el Cauce, costa o agua) da esto al día.
export const AGUA_FUENTE_NATURAL_DIA = 20;
const AYUNTAMIENTOS = new Set(['ayuntamiento', 'ayuntamiento-mediano', 'ayuntamiento-grande']);

/// Puro: si un lugar tiene agua natural (por sus etiquetas de terreno o por su nombre).
export function tieneFuenteNatural(lugar: { slug: string; name: string }): boolean {
  const tags = locationTerrainTags[lugar.slug] ?? [];
  return tags.includes('acuatico') || tags.includes('costero') || /manadero|cauce/i.test(`${lugar.slug} ${lugar.name}`);
}

/// Puro: lo que suman los edificios activos del Reino (agua al día y topes).
export function suministrosDeEdificios(recipeKeys: (string | null)[], fuenteNatural: boolean): SuministrosDia & { topeMateriales: number } {
  const r = { agua: fuenteNatural ? AGUA_FUENTE_NATURAL_DIA : 0, topeComida: BASE_ALMACEN.comida, topeBebida: BASE_ALMACEN.bebida, topeMateriales: BASE_ALMACEN.materiales };
  for (const key of recipeKeys) {
    const s = CONSTRUCTION_RECIPES.find((x) => x.key === key)?.suministro;
    if (!s) continue;
    r.agua += s.aguaDia ?? 0;
    r.topeComida += s.topeComida ?? 0;
    r.topeBebida += s.topeBebida ?? 0;
    r.topeMateriales += s.topeMateriales ?? 0;
  }
  return r;
}

/// Lo que da hoy el Reino de la jugadora: edificios activos y fuente natural junto al Ayuntamiento.
export async function suministrosDelReino(tx: Tx, saveId: string) {
  const edificios = await tx.building.findMany({ where: { saveId, status: 'ACTIVO' }, select: { recipeKey: true, location: { select: { slug: true, name: true } } } });
  const ayuntamiento = edificios.find((b) => b.recipeKey && AYUNTAMIENTOS.has(b.recipeKey));
  return suministrosDeEdificios(edificios.map((b) => b.recipeKey), !!ayuntamiento?.location && tieneFuenteNatural(ayuntamiento.location));
}
