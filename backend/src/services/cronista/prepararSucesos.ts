// QA-263 (2026-10-26): estados del mundo que `prepararReino.ts` deja listos para jugar sus ids, SOLO con las funciones del
// juego (QA-151: nada de UPDATE/INSERT a mano). Aquí están las escrituras de cada paso para que el test las ejerza sin el
// script (que se ejecuta al importarlo):
//   - `matarLiderDeFaccion` (CR-43): el líder muere «de viejo» por la vía del motor del mundo (`morirDeViejo`) y la facción
//     tiene los dos candidatos que pide la escisión (`crearNpc` DESTACA, como el motor); la sucesión queda abierta.
//   - `aliarTrasRuptura` (P247): alianza, ruptura y alianza nueva entre dos facciones con `recordFactionEvent`.
//   - `vasalloPagaConDeuda` (P314): el vasallo con una cuota de deuda y fondos para pagar la cuota entera sin saldarla.
import type { FactionRelationType, PrismaClient } from '@prisma/client';
import { aplicarEfecto } from './efectos.js';
import { candidatosALider, COHESION_CAIDA, COHESION_ESCISION } from './reglasConsecuencias.js';
import { morirDeViejo } from './envejecer.js';
import { BAJA_COHESION_MUERTE_LIDER } from './reacciones.js';
import { asegurarVasallajes, cuotaSemanal, revisarVasallajes } from './vasallaje.js';
import { recordFactionEvent, type FactionEventType } from '../factionRelations.js';

/// Lo que baja la cohesión al morir el líder (`MUERTE_LIDER_BAJA_COHESION`, reacciones.ts): la facción tiene que quedar
/// entre `COHESION_CAIDA` y `COHESION_ESCISION` para que la sucesión escinda en vez de disolver o suceder a secas.
const COHESION_DE_PARTIDA = 70;
const MINUTOS_DIA = 1440;

export type ResultadoLider = { lider: string; faccion: string; candidatos: string[]; cohesion: number };

export async function matarLiderDeFaccion(prisma: PrismaClient, { saveId, faccionSlug, random = Math.random }: { saveId: string; faccionSlug: string; random?: () => number }): Promise<ResultadoLider | { error: string }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, worldState: { select: { fictionalMinutes: true } } } });
  if (!save?.worldState) return { error: `No hay partida ${saveId} con reloj.` };
  const ahora = save.worldState.fictionalMinutes;
  const ctx = { saveId, worldId: save.worldId, fictionalMinutes: ahora, origen: 'MUNDO' as const, random };
  const faccion = await prisma.faction.findFirst({ where: { saveId, slug: faccionSlug, disueltaEn: null } });
  if (!faccion) return { error: `lider-muere: no hay facción viva «${faccionSlug}».` };
  if (!faccion.liderNpcId) return { error: `lider-muere: ${faccion.name} no tiene líder.` };
  const lider = await prisma.npc.findUniqueOrThrow({ where: { id: faccion.liderNpcId }, select: { id: true, name: true } });

  // La escisión pide dos candidatos adultos además del líder: los que falten destacan, como cuando el mundo avanza.
  for (let intento = 0; intento < 6; intento++) {
    const hay = await prisma.$transaction((tx) => candidatosALider(tx, saveId, save.worldId, faccion));
    if (hay.length >= 2) break;
    const r = await prisma.$transaction((tx) => aplicarEfecto({ ...ctx, tx }, { tipo: 'crearNpc', faccionSlug, como: 'DESTACA' }));
    if (!r.aplicado) return { error: `lider-muere: ${faccion.name} no tiene de dónde sacar un candidato nuevo.` };
  }
  const candidatos = await prisma.$transaction((tx) => candidatosALider(tx, saveId, save.worldId, faccion));
  if (candidatos.length < 2) return { error: `lider-muere: ${faccion.name} se queda con ${candidatos.length} candidatos a líder (hacen falta 2).` };

  // Cohesión: con menos de `COHESION_CAIDA` + 25 la facción se disolvería; con más de `COHESION_ESCISION` + 25 no se escindiría.
  let cohesion = faccion.cohesion;
  if (cohesion - BAJA_COHESION_MUERTE_LIDER < COHESION_CAIDA || cohesion - BAJA_COHESION_MUERTE_LIDER > COHESION_ESCISION) {
    await prisma.$transaction((tx) => aplicarEfecto({ ...ctx, tx }, { tipo: 'cambiarCohesion', faccionSlug, delta: COHESION_DE_PARTIDA - cohesion }));
    cohesion = COHESION_DE_PARTIDA;
  }
  const r = await morirDeViejo(prisma, { saveId, worldId: save.worldId, ahora, npcId: lider.id, random });
  if (!r.aplicado) return { error: `lider-muere: ${lider.name} no ha muerto (ya estaba muerto).` };
  // La reacción `MUERTE_LIDER_BAJA_COHESION` ya ha restado la baja: se devuelve la cohesión de después.
  return { lider: lider.name, faccion: faccion.name, candidatos: candidatos.map((c) => c.name), cohesion: cohesion - BAJA_COHESION_MUERTE_LIDER };
}

const MAX_EMPUJES = 15;

/// Empuja la relación `origen → destino` con `evento` hasta que su banda cumpla `hasta`. Devuelve los eventos aplicados.
async function empujar(prisma: PrismaClient, p: { worldId: string; saveId: string; origenId: string; destinoId: string }, evento: FactionEventType, hasta: (t: FactionRelationType) => boolean): Promise<number> {
  const tipo = async () => (await prisma.factionRelation.findUnique({ where: { sourceFactionId_targetFactionId: { sourceFactionId: p.origenId, targetFactionId: p.destinoId } }, select: { type: true } }))?.type ?? 'NEUTRAL';
  let n = 0;
  while (!hasta(await tipo())) {
    if (n >= MAX_EMPUJES) throw new Error(`la relación no llega a la banda pedida con ${evento} en ${MAX_EMPUJES} eventos.`);
    await prisma.$transaction((tx) => recordFactionEvent(tx, p.worldId, p.origenId, p.destinoId, evento, p.saveId));
    n++;
  }
  return n;
}

/// Alianza, ruptura y alianza nueva entre las dos facciones (relación `a → b`), todo con `recordFactionEvent`: salir de la
/// alianza si ya estaban en ella (EXPANSION_TERRITORIAL_AGRESIVA), sellarla (NEGOCIACION_TREGUA), romperla y sellarla otra vez.
/// El Libro queda con dos ALIANZA y, entre ellas, el cambio de banda: la segunda se cuenta (`alianzaYaContada`, P247).
export async function aliarTrasRuptura(prisma: PrismaClient, { saveId, facA, facB }: { saveId: string; facA: string; facB: string }): Promise<{ eventos: number } | { error: string }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return { error: `No hay partida ${saveId}.` };
  const [a, b] = await Promise.all([facA, facB].map((slug) => prisma.faction.findFirst({ where: { saveId, slug, disueltaEn: null }, select: { id: true } })));
  if (!a || !b) return { error: `alianza: no hay facción viva «${!a ? facA : facB}».` };
  if (a.id === b.id) return { error: 'alianza: hacen falta dos facciones distintas.' };
  const p = { worldId: save.worldId, saveId, origenId: a.id, destinoId: b.id };
  const sellar = () => empujar(prisma, p, 'NEGOCIACION_TREGUA', (t) => t === 'ALIANZA');
  const romper = () => empujar(prisma, p, 'EXPANSION_TERRITORIAL_AGRESIVA', (t) => t !== 'ALIANZA');
  try {
    // Si ya eran aliadas, la alianza primera del paso tiene que ser nueva: se sale de ella antes.
    const eventos = (await romper()) + (await sellar()) + (await romper()) + (await sellar());
    return { eventos };
  } catch (e) {
    return { error: `alianza: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/// El vasallo con deuda (la vieja se recorta a una cuota con `asegurarVasallajes`) y fondos para pagar la cuota de la semana
/// entera sin llegar a saldar lo pendiente, y la revisión de esa semana (`revisarVasallajes`), que sale `pagada-con-deuda`
/// (P314). Los fondos se ajustan con el efecto `ajustarReino` del juego y la revisión se corre en la misma transacción: entre
/// un día y el siguiente la facción gasta y la riqueza saldría de la franja (al avanzar un día salía «parcial»). Solo se
/// adelanta la revisión de mañana como mucho; el avance diario ya no la repite (`ultimaSemana`).
export async function vasalloPagaConDeuda(prisma: PrismaClient, { saveId, vasalloSlug, random = Math.random }: { saveId: string; vasalloSlug: string; random?: () => number }): Promise<{ cuota: number; deuda: number; riqueza: number; dia: number; estado: string; porcentaje: number } | { error: string }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, worldState: { select: { fictionalMinutes: true } } } });
  if (!save?.worldState) return { error: `No hay partida ${saveId} con reloj.` };
  const ahora = save.worldState.fictionalMinutes;
  await prisma.$transaction((tx) => asegurarVasallajes(tx, saveId, ahora));
  const v = await prisma.vasallaje.findFirst({ where: { saveId, vasalloSlug, rotoEn: null } });
  if (!v) return { error: `vasallo-paga: «${vasalloSlug}» no es vasallo de nadie ahora.` };
  if (v.deuda <= 0) return { error: `vasallo-paga: ${vasalloSlug} está al corriente, sin deuda que arrastrar (que pase una semana sin fondos).` };
  const stats = await prisma.kingdomStats.findFirst({ where: { faction: { saveId, slug: vasalloSlug } }, select: { soldados: true, riqueza: true } });
  if (!stats) return { error: `vasallo-paga: ${vasalloSlug} no tiene reino.` };
  const dia = Math.floor(ahora / MINUTOS_DIA);
  const proximaRevision = Math.max(dia, (v.ultimaSemana ?? dia - 7) + 7);
  if (proximaRevision - dia > 1) return { error: `vasallo-paga: la revisión de ${vasalloSlug} es el día ${proximaRevision} y hoy es el ${dia}; avanza hasta el día ${proximaRevision - 1} y repite.` };
  const cuota = cuotaSemanal(stats.soldados);
  if (cuota <= 0) return { error: `vasallo-paga: ${vasalloSlug} no tiene soldados, no hay cuota.` };
  // Cuota entera y menos que (cuota + lo pendiente): paga el 100 % sin saldar la deuda.
  const riqueza = cuota + Math.floor(Math.min(v.deuda, cuota) / 2);
  const antes = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const r = await aplicarEfecto({ tx, saveId, worldId: save.worldId, fictionalMinutes: ahora, origen: 'MUNDO', random }, { tipo: 'ajustarReino', faccionSlug: vasalloSlug, riqueza: riqueza - stats.riqueza });
      if (!r.aplicado && riqueza !== stats.riqueza) throw new Error(`el motor no ha ajustado la riqueza de ${vasalloSlug}`);
      await revisarVasallajes(tx, saveId, proximaRevision, ahora, random);
    });
  } catch (e) {
    return { error: `vasallo-paga: ${e instanceof Error ? e.message : String(e)}.` };
  }
  const linea = await prisma.suceso.findFirst({
    where: { saveId, tipo: 'PATRULLA_VASALLO', createdAt: { gte: antes }, actores: { some: { entidadTipo: 'FACCION', entidadId: vasalloSlug } } },
    orderBy: { createdAt: 'desc' },
    select: { datos: true },
  });
  const datos = (linea?.datos ?? {}) as { estado?: string; porcentaje?: number };
  if (datos.estado !== 'pagada-con-deuda') return { error: `vasallo-paga: la revisión del día ${proximaRevision} ha salido «${datos.estado ?? 'sin línea'}», no «pagada-con-deuda».` };
  return { cuota, deuda: v.deuda, riqueza, dia: proximaRevision, estado: datos.estado, porcentaje: datos.porcentaje ?? 0 };
}
