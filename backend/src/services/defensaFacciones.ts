// CR-65 (hito 0.3, Fase E, paso 65e, Q8): la defensa de las facciones con los mismos módulos que el
// Reino (ADR 0003). Como la IA de X4, que añade defensas a la estación que atacan: cada facción
// arranca con una Empalizada según su tamaño y la sube un escalón cuando la asaltan, si le sobra
// comida y le llegan los Goirnos. El resto de obras de las facciones (por carencias) es `CR-36`.
import type { Prisma } from '@prisma/client';
import { CONSTRUCTION_RECIPES } from './construction.js';
import { efectoDefensa } from './cronista/defensa.js';
import { DIAS_RESERVA_PARA_CAZAR, diasDeReservaFaccion } from './partidasFacciones.js';

type Tx = Prisma.TransactionClient;

/// Gente (población + soldados) a partir de la cual una facción arranca con Muro (2) o Muralla (3).
/// Cifras provisionales.
export const GENTE_PARA_ESCALON = [0, 0, 60, 200] as const;
/// Goirnos que le cuesta a una facción subir su Empalizada al escalón `n` (provisional).
export const COSTE_REFUERZO_FACCION = [0, 0, 120, 300] as const;
/// Una facción solo refuerza con esta reserva de comida (la misma prudencia que para cazar).
export const DIAS_RESERVA_PARA_REFORZAR = DIAS_RESERVA_PARA_CAZAR;

/// Puro: escalón de la Empalizada con el que arranca una facción de `gente`.
export function escalonInicialEmpalizada(gente: number): number {
  return gente >= GENTE_PARA_ESCALON[3] ? 3 : gente >= GENTE_PARA_ESCALON[2] ? 2 : 1;
}

const recetaEmpalizada = (escalon: number) =>
  CONSTRUCTION_RECIPES.find((r) => (escalon === 1 ? r.key === 'empalizada' : r.upgradesRecipeKey === 'empalizada' && r.edificioOficioNivel === escalon))!;

/// Las facciones de la partida que aún no tienen Empalizada la levantan en su casa (idempotente;
/// partidas nuevas y guardadas). Devuelve cuántas.
export async function asegurarDefensasDeFacciones(tx: Tx, saveId: string): Promise<number> {
  const sin = await tx.faction.findMany({
    where: { saveId, disueltaEn: null, buildings: { some: { locationId: { not: null } }, none: { recipeKey: 'empalizada' } } },
    select: { id: true, kingdomStats: { select: { poblacion: true, soldados: true } }, buildings: { where: { locationId: { not: null } }, select: { locationId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 } },
  });
  for (const f of sin) {
    const escalon = escalonInicialEmpalizada((f.kingdomStats?.poblacion ?? 0) + (f.kingdomStats?.soldados ?? 0));
    const r = recetaEmpalizada(escalon);
    await tx.building.create({ data: { factionId: f.id, locationId: f.buildings[0]!.locationId, recipeKey: 'empalizada', name: r.name, kind: 'empalizada', description: r.description, status: 'ACTIVO', tier: escalon } });
  }
  return sin.length;
}

/// La cobertura que da la Empalizada de una facción a quien la defiende (para los asaltos de
/// `CR-37`).
export async function coberturaDeFaccion(tx: Tx, factionId: string): Promise<number> {
  const e = await tx.building.findFirst({ where: { factionId, recipeKey: 'empalizada', status: 'ACTIVO' }, select: { tier: true, caida: true } });
  return e ? efectoDefensa({ empalizada: e.tier ?? 1, torre: 0, armeria: 0, barracon: 0, empalizadaCaida: e.caida }).cobertura : 0;
}

/// Q8: tras un asalto, la facción repara su Empalizada y, si puede, la sube un escalón.
export async function reforzarDefensaFaccion(tx: Tx, factionId: string): Promise<'reforzada' | 'reparada' | null> {
  const e = await tx.building.findFirst({ where: { factionId, recipeKey: 'empalizada', status: 'ACTIVO' }, select: { id: true, tier: true, caida: true } });
  const k = await tx.kingdomStats.findFirst({ where: { factionId }, select: { id: true, comida: true, poblacion: true, soldados: true, visitantes: true, riqueza: true } });
  if (!e || !k || diasDeReservaFaccion(k) < DIAS_RESERVA_PARA_REFORZAR) return null;
  const sube = (e.tier ?? 1) < 3 && k.riqueza >= COSTE_REFUERZO_FACCION[(e.tier ?? 1) + 1]!;
  if (!sube && !e.caida) return null;
  if (sube) {
    const escalon = (e.tier ?? 1) + 1;
    const r = recetaEmpalizada(escalon);
    await tx.kingdomStats.update({ where: { id: k.id }, data: { riqueza: { decrement: COSTE_REFUERZO_FACCION[escalon]! } } });
    await tx.building.update({ where: { id: e.id }, data: { tier: escalon, name: r.name, description: r.description, caida: false, golpesDefensa: 0 } });
    return 'reforzada';
  }
  await tx.building.update({ where: { id: e.id }, data: { caida: false, golpesDefensa: 0 } });
  return 'reparada';
}
