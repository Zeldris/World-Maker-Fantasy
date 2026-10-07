// Escaramuzas de fondo (CR-62 paso 62c, hito 0.3 — ADR 0002, Q4-Q6 de la ronda de CR-62). Dos facciones
// (o una contra los renegados) pelean de verdad con el motor de combate de fondo: sus combatientes
// (`combatientesDeFaccion`), sus bajas (de los caídos muere el 3 %, nunca un NPC con nombre) restan
// soldados, y el resultado va al suceso `ESCARAMUZA` y a su noticia.
import type { Prisma } from '@prisma/client';
import { simularCombateDeFondo } from '../combateDeFondo.js';
import { baseDePueblo, combatientesDeFaccion, soldadoGenerico } from './combatientesFaccion.js';
import { aplicarBajasDeFaccion } from './economiaFacciones.js';

type Tx = Prisma.TransactionClient;

/// Q4: tamaño de cada bando en una escaramuza del narrador (2d4).
export function tamanoEscaramuza(random: () => number): number {
  return 2 + Math.floor(random() * 4) + Math.floor(random() * 4);
}

export interface ResultadoEscaramuza {
  nombreA: string;
  nombreB: string;
  /// Bando que se queda con el campo (null si nadie).
  ganador: 'A' | 'B' | null;
  /// Bandos que se retiraron.
  retiradas: ('A' | 'B')[];
  muertosA: number;
  muertosB: number;
}

/// Pelean `nA` de la facción A contra `nB` de la facción B (o de los renegados, si `slugB` es null). Las
/// bajas de cada facción se restan de sus soldados (filas de población y `KingdomStats`).
export async function pelearEscaramuza(
  tx: Tx,
  ctx: { saveId: string; worldId: string },
  slugA: string,
  slugB: string | null,
  nA: number,
  nB: number,
  random: () => number,
  /// Para los tests: probabilidad de que muera quien cae (por defecto la del combate de fondo, 3 %).
  probMuerte?: number,
): Promise<ResultadoEscaramuza | null> {
  const faccion = (slug: string) =>
    tx.faction.findFirst({
      where: { saveId: ctx.saveId, slug, disueltaEn: null },
      select: { slug: true, name: true, raza: true, kingdomStats: { select: { id: true, soldados: true, sinArma: true } } },
    });
  const a = await faccion(slugA);
  const b = slugB ? await faccion(slugB) : null;
  if (!a?.kingdomStats || (slugB && !b?.kingdomStats)) return null;
  const ladoA = await combatientesDeFaccion(tx, ctx, { slug: a.slug, name: a.name, raza: a.raza, soldados: a.kingdomStats.soldados, sinArma: a.kingdomStats.sinArma }, Math.min(nA, a.kingdomStats.soldados), 'A');
  let ladoB;
  if (b?.kingdomStats) {
    ladoB = await combatientesDeFaccion(tx, ctx, { slug: b.slug, name: b.name, raza: b.raza, soldados: b.kingdomStats.soldados, sinArma: b.kingdomStats.sinArma }, Math.min(nB, b.kingdomStats.soldados), 'B');
  } else {
    // Renegados: gente de su mismo pueblo, armada.
    const base = await baseDePueblo(tx, ctx.worldId, a.raza ?? 'orcos');
    ladoB = Array.from({ length: nB }, (_, i) => soldadoGenerico(`renegado-${i + 1}`, 'Renegado', 'B', base, true));
  }
  if (ladoA.length === 0 || ladoB.length === 0) return null;

  const r = simularCombateDeFondo([...ladoA, ...ladoB], random, probMuerte === undefined ? {} : { probMuerte });
  const muertos = (bando: 'A' | 'B') => r.estados.filter((e) => e.muerto && (bando === 'A' ? ladoA : ladoB).some((c) => c.id === e.id)).length;
  const muertosA = muertos('A');
  const muertosB = muertos('B');
  const bajas = async (f: NonNullable<typeof a>, n: number) => {
    if (n <= 0) return;
    await aplicarBajasDeFaccion(tx, ctx.saveId, f.slug, f.raza, { civiles: 0, trabajadores: 0, soldados: n }, 0);
    await tx.kingdomStats.update({ where: { id: f.kingdomStats!.id }, data: { soldados: Math.max(0, f.kingdomStats!.soldados - n) } });
  };
  await bajas(a, muertosA);
  if (b) await bajas(b, muertosB);
  return { nombreA: a.name, nombreB: b?.name ?? 'los renegados', ganador: r.ganador, retiradas: r.retiradas, muertosA, muertosB };
}

/// Q6: cómo acabó, para el suceso y la noticia: «Clan Serhu se retira; caen 2 de Clan Serhu».
export function resumenEscaramuza(r: ResultadoEscaramuza): string {
  const nombre = (x: 'A' | 'B') => (x === 'A' ? r.nombreA : r.nombreB);
  const partes: string[] = [];
  if (r.retiradas.length > 0) partes.push(`${r.retiradas.map(nombre).join(' y ')} se retira${r.retiradas.length > 1 ? 'n' : ''}`);
  else if (r.ganador) partes.push(`${nombre(r.ganador)} se queda con el campo`);
  const caen: string[] = [];
  if (r.muertosA > 0) caen.push(`${r.muertosA} de ${r.nombreA}`);
  if (r.muertosB > 0) caen.push(`${r.muertosB} de ${r.nombreB}`);
  if (caen.length > 0) partes.push(`caen ${caen.join(' y ')}`);
  return partes.join('; ');
}
