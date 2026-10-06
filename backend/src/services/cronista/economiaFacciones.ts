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

// ─────────────────────────── 54c: extinción y refundación (Q7) ───────────────────────────

/// Q7: un año de ficción (120 días) tras extinguirse, el pueblo puede refundar una facción en esa
/// región si conserva más de 50 personas sin facción. Se lleva como mucho a 120 de ellas.
export const DIAS_PARA_REFUNDAR = 120;
export const POBLACION_MINIMA_PARA_REFUNDAR = 50;
export const MAXIMO_REFUNDADORES = 120;

/// Puro: el reparto estándar (55 % trabajadores, 15 % soldados, 30 % civiles) de una facción nueva.
export function repartoEstandar(total: number): CuentaFaccion {
  const trabajadores = Math.round(total * 0.55);
  const soldados = Math.round(total * 0.15);
  return { trabajadores, soldados, civiles: Math.max(0, total - trabajadores - soldados) };
}

/// La región de una facción: la de sus filas de población.
async function regionDeFaccion(tx: Tx, saveId: string, slug: string): Promise<string | null> {
  const fila = await tx.worldPopulation.findFirst({ where: { saveId, targetType: 'FACCION', targetSlug: `${slug}-poblacion` }, select: { distribucion: true } });
  return Object.keys((fila?.distribucion ?? {}) as Record<string, number>)[0] ?? REPARTO_FACCIONES.find((r) => r.slug === slug)?.region ?? null;
}

/// Un día del mundo de la partida: se extinguen las facciones sin nadie y, pasado un año, su pueblo
/// puede refundar otra en la región (como escisión nueva, con otro nombre).
export async function revisarExtinciones(tx: Tx, saveId: string, ahora: number, random: () => number): Promise<{ extintas: string[]; refundadas: string[] }> {
  const { aplicarEfecto } = await import('./efectos.js');
  const { populationTargetSlugFor } = await import('../population.js');
  const { nombreDeEscision } = await import('./nombresFaccion.js');
  const { generarNombre } = await import('./nombres.js');
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const ctx = { tx, saveId, worldId: save.worldId, fictionalMinutes: ahora, origen: 'MUNDO' as const, random };
  const extintas: string[] = [];
  const vivas = await tx.faction.findMany({ where: { saveId, disueltaEn: null, origenSlug: { not: null } }, select: { slug: true, kingdomStats: { select: { poblacion: true, soldados: true, visitantes: true } } } });
  for (const f of vivas) {
    const k = f.kingdomStats;
    if (!k || k.poblacion + k.soldados + k.visitantes > 0) continue;
    if ((await aplicarEfecto(ctx, { tipo: 'disolverFaccion', faccionSlug: f.slug })).aplicado) extintas.push(f.slug);
  }

  const refundadas: string[] = [];
  const muertas = await tx.faction.findMany({ where: { saveId, origenSlug: { not: null }, disueltaEn: { lte: ahora - DIAS_PARA_REFUNDAR * 1440 } }, select: { slug: true, raza: true } });
  if (muertas.length === 0) return { extintas, refundadas };
  const todas = await tx.faction.findMany({ where: { saveId }, select: { slug: true, name: true, raza: true, disueltaEn: true } });
  const usados = new Set(todas.map((t) => t.name));
  for (const m of muertas) {
    const region = await regionDeFaccion(tx, saveId, m.slug);
    if (!region || !m.raza) continue;
    // Ya hay una facción viva de ese pueblo en la región: no hace falta refundar.
    let ocupada = false;
    for (const v of todas.filter((t) => t.disueltaEn === null && t.raza === m.raza)) {
      if ((await regionDeFaccion(tx, saveId, v.slug)) === region) ocupada = true;
    }
    if (ocupada) continue;
    const poolSlug = populationTargetSlugFor(m.raza, m.slug, region);
    const pool = poolSlug ? await tx.worldPopulation.findFirst({ where: { saveId, targetType: 'RAZA', targetSlug: poolSlug } }) : null;
    if (!pool || pool.poblacion <= POBLACION_MINIMA_PARA_REFUNDAR) continue;
    const nombre = nombreDeEscision(m.raza, generarNombre(m.raza, random() < 0.5 ? 'F' : 'M', random), usados);
    if (!nombre) continue;
    const slug = nombre.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const r = await aplicarEfecto(ctx, { tipo: 'crearFaccion', slug, nombre: nombre.nombre, raza: m.raza, descripcion: `Nacida de los que quedaron tras la caída de la antigua facción de su pueblo en ${region}: ${nombre.traduccion}.` });
    if (!r.aplicado) continue;
    usados.add(nombre.nombre);
    const total = Math.min(MAXIMO_REFUNDADORES, pool.poblacion - POBLACION_MINIMA_PARA_REFUNDAR);
    await tx.worldPopulation.update({ where: { id: pool.id }, data: { poblacion: { decrement: total } } });
    const c = repartoEstandar(total);
    for (const f of filasDeFaccion({ slug, nombre: nombre.nombre, region, ...c, holgura: 0.5 })) {
      await tx.worldPopulation.create({ data: { worldId: save.worldId, saveId, targetType: 'FACCION', targetSlug: f.targetSlug, label: f.label, poblacion: f.poblacion, poblacionMax: f.poblacionMax, distribucion: f.distribucion } });
    }
    const fac = await tx.faction.findFirstOrThrow({ where: { saveId, slug }, select: { id: true } });
    await tx.kingdomStats.update({ where: { factionId: fac.id }, data: { poblacion: c.civiles + c.trabajadores, trabajadores: c.trabajadores, soldados: c.soldados } });
    refundadas.push(slug);
  }
  return { extintas, refundadas };
}
