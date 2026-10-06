// Economía de supervivencia de las facciones del mundo (CR-54, hito 0.3 — Fase D, decisiones Q7-Q8 y
// Q16-Q20 de la usuaria del 2026-10-06). Las mismas cifras que el Reino, en agregado.
// Paso 54a: el reparto de cada facción (`REPARTO_FACCIONES`) y su re-siembra única en las partidas.
import type { Prisma } from '@prisma/client';
import { filasDeFaccion, REPARTO_FACCIONES } from '../../scripts/repartoFacciones.js';

type Tx = Prisma.TransactionClient;

/// Versión vigente del reparto. Subirla re-siembra una vez todas las partidas.
export const VERSION_REPARTO_FACCIONES = 1;

/// Q16: en una facción comen todos; `KingdomStats.poblacion` son sus civiles y sus trabajadores (como en
/// el Reino, `subditos.ts`), y soldados y visitantes van aparte.
export const poblacionQueCome = (civiles: number, trabajadores: number) => civiles + trabajadores;

/// Q20: re-siembra una vez el reparto de las facciones vivas de la partida (sus filas de población).
/// Idempotente por `WorldState.repartoFacciones`.
export async function resembrarFacciones(tx: Tx, saveId: string): Promise<number> {
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { repartoFacciones: true } });
  if (!ws || ws.repartoFacciones >= VERSION_REPARTO_FACCIONES) return 0;
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const vivas = new Set((await tx.faction.findMany({ where: { saveId, disueltaEn: null }, select: { slug: true } })).map((f) => f.slug));
  let n = 0;
  for (const r of REPARTO_FACCIONES.filter((x) => vivas.has(x.slug))) {
    for (const f of filasDeFaccion(r)) {
      const existe = await tx.worldPopulation.findFirst({ where: { saveId, targetType: 'FACCION', targetSlug: f.targetSlug }, select: { id: true } });
      const datos = { label: f.label, poblacion: f.poblacion, poblacionMax: f.poblacionMax, distribucion: f.distribucion };
      if (existe) await tx.worldPopulation.update({ where: { id: existe.id }, data: datos });
      else await tx.worldPopulation.create({ data: { worldId: save.worldId, saveId, targetType: 'FACCION', targetSlug: f.targetSlug, ...datos } });
    }
    n++;
  }
  await tx.worldState.update({ where: { saveId }, data: { repartoFacciones: VERSION_REPARTO_FACCIONES } });
  return n;
}

// ─────────────────────────── 54b: agua, Goirnos, hambre, sed y muerte ───────────────────────────
// Las reglas del Reino (Q1, Q4-Q6) en agregado (Q8, Q17-Q19). Donde el Reino habla de «un súbdito», una
// facción pierde una parte de su gente:
// - deserción: el 5 % de sus soldados cada semana sin cobrar (desde el día 7), que vuelven a su pueblo;
// - hambre (desde el día 3 sin comida): muere el 1 % de quienes comen al día; sed (desde el día 2), el 2 %.
// Mueren primero los civiles, luego los trabajadores y por último los soldados.

export const AGUA_FUENTE_FACCION = 1.1;
export const DESERCION_FACCION_SEMANA = 0.05;
export const MUERTE_HAMBRE_FACCION_DIA = 0.01;
export const MUERTE_SED_FACCION_DIA = 0.02;

export interface CuentaFaccion {
  civiles: number;
  trabajadores: number;
  soldados: number;
}

/// Puro: quién muere de una facción si mueren `n` (civiles, luego trabajadores, luego soldados).
export function repartirMuertes(c: CuentaFaccion, n: number): CuentaFaccion {
  const quita = { civiles: 0, trabajadores: 0, soldados: 0 };
  let resto = n;
  for (const campo of ['civiles', 'trabajadores', 'soldados'] as const) {
    const q = Math.min(c[campo], resto);
    quita[campo] = q;
    resto -= q;
  }
  return quita;
}

/// Puro: cuántos mueren hoy de hambre y de sed en una facción.
export function muertesDelDia(c: CuentaFaccion, diasHambre: number, diasSed: number): number {
  const comen = c.civiles + c.trabajadores + c.soldados;
  let n = 0;
  if (diasHambre >= 3) n += Math.ceil(comen * MUERTE_HAMBRE_FACCION_DIA);
  if (diasSed >= 2) n += Math.ceil(comen * MUERTE_SED_FACCION_DIA);
  return Math.min(comen, n);
}

/// Puro: el pago de un día de una facción. Cada 7 días se pagan los sueldos (trabajador 2, soldado 5).
/// Sin Goirnos, −3 de felicidad al día y, desde el día 7, el 5 % de los soldados deserta cada semana.
export function sueldosDelDia(
  s: { riqueza: number; felicidad: number; diasSinCobrar: number; trabajadores: number; soldados: number },
  dia: number,
): { riqueza: number; felicidad: number; diasSinCobrar: number; desertores: number } {
  const total = s.trabajadores * 2 + s.soldados * 5;
  const tocaPagar = dia % 7 === 0;
  if ((tocaPagar || s.diasSinCobrar > 0) && s.riqueza >= total) return { riqueza: s.riqueza - total, felicidad: s.felicidad, diasSinCobrar: 0, desertores: 0 };
  if (!tocaPagar && s.diasSinCobrar === 0) return { riqueza: s.riqueza, felicidad: s.felicidad, diasSinCobrar: 0, desertores: 0 };
  const dias = s.diasSinCobrar + 1;
  const deserta = dias >= 7 && (dias - 7) % 7 === 0;
  return {
    riqueza: s.riqueza, felicidad: Math.max(0, s.felicidad - 3), diasSinCobrar: dias,
    desertores: deserta ? Math.max(1, Math.round(s.soldados * DESERCION_FACCION_SEMANA)) : 0,
  };
}

/// Aplica a las filas de población de una facción de la partida sus muertos y desertores (los
/// desertores vuelven a la población de su pueblo).
export async function aplicarBajasDeFaccion(tx: Tx, saveId: string, factionSlug: string, raza: string | null, muertos: CuentaFaccion, desertores: number): Promise<void> {
  const fila = async (campo: string, delta: number) => {
    if (delta === 0) return;
    const f = await tx.worldPopulation.findFirst({ where: { saveId, targetType: 'FACCION', targetSlug: `${factionSlug}-${campo}` }, select: { id: true, poblacion: true } });
    if (f) await tx.worldPopulation.update({ where: { id: f.id }, data: { poblacion: Math.max(0, f.poblacion + delta) } });
  };
  await fila('poblacion', -muertos.civiles);
  await fila('trabajadores', -muertos.trabajadores);
  await fila('soldados', -(muertos.soldados + desertores));
  if (desertores > 0 && raza) {
    const region = REPARTO_FACCIONES.find((r) => r.slug === factionSlug)?.region ?? null;
    const { populationTargetSlugFor } = await import('../population.js');
    const slug = populationTargetSlugFor(raza, factionSlug, region);
    if (slug) await tx.worldPopulation.updateMany({ where: { saveId, targetType: 'RAZA', targetSlug: slug }, data: { poblacion: { increment: desertores } } });
  }
}
