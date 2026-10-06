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
